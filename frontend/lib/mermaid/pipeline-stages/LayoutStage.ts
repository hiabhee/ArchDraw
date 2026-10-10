import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { measureLayoutQuality } from '@/lib/pipeline-shared/layout/layoutQuality';
import { applyRfLayout } from '@/lib/pipeline-shared/layout/IntegratedLayout';
import { defaultCompoundLayoutOptions, type LayoutDirection } from '@/lib/pipeline-shared/layout/LayoutEngine';
import { applySubgraphBoundsToRf } from '../recomputeSubgraphBounds';
import { getCachedDiagramGeometryPlan } from '@/lib/utils/diagramGeometry';
import type { RFObjects, Direction } from '../types';
import {
  createSemanticEdgeKey,
  resolveEdgeFlowSemantics,
  semanticEdgeKeyString,
  type EdgeLayoutSemantics,
} from '../edgeFlowSemantics';

export interface LayoutStageInput {
  objects: RFObjects;
  direction: Direction;
}

export class LayoutStage extends BaseStage<LayoutStageInput, RFObjects> {
  constructor() {
    super('layout', { description: 'Apply optimized layout to nodes', weight: 2 });
  }

  async execute(input: LayoutStageInput, _context: PipelineContext): Promise<StageResult<RFObjects>> {
    const semanticOverrides = _context.metadata.edgeSemantics as ReadonlyMap<string, EdgeLayoutSemantics> | undefined;
    const duplicateOrdinals = new Map<string, number>();
    const edgesWithOverrides = input.objects.edges.map(edge => {
      const semanticKey = createSemanticEdgeKey(edge, edge.source, edge.target, 0);
      const baseKey = JSON.stringify([
        semanticKey.sourceLayoutId, semanticKey.targetLayoutId,
        semanticKey.normalizedLabel, semanticKey.normalizedType,
      ]);
      const duplicateOrdinal = duplicateOrdinals.get(baseKey) ?? 0;
      duplicateOrdinals.set(baseKey, duplicateOrdinal + 1);
      const key = semanticEdgeKeyString({ ...semanticKey, duplicateOrdinal });
      const override = semanticOverrides?.get(key);
      return override ? { ...edge, data: { ...edge.data, ...override } } : edge;
    });
    const semantics = resolveEdgeFlowSemantics(input.objects.nodes, edgesWithOverrides);
    const semanticObjects: RFObjects = {
      ...input.objects,
      edges: edgesWithOverrides.map(edge => {
        const assignment = semantics.assignments.get(edge.id);
        if (!assignment) return edge;
        return {
          ...edge,
          data: {
            ...edge.data,
            flowRole: assignment.role,
            flowRoleSource: assignment.source,
            flowRoleConfidence: assignment.confidence,
            importanceSource: edge.data?.importanceSource ?? 'inferred',
          },
        };
      }),
    };
    // Studio Minimal is intentionally an editorial, low-density map: the
    // primary reading direction gets a generous column rhythm while branches
    // receive enough vertical room to stay distinct. Other appearances keep
    // the shared default geometry unchanged.
    const layoutOptions = _context.metadata.layoutProfile === 'studio-minimal'
      ? {
          nodeSep: input.direction === 'TD' || input.direction === 'BT' ? 140 : 160,
          rankSep: 220,
        }
      : undefined;
    const parentById = new Map(semanticObjects.nodes.map(node => [node.id, node.parentNode ?? (node.data as { parentId?: string } | undefined)?.parentId]));
    const depth = (id: string) => {
      let current = id, value = 0;
      const seen = new Set([id]);
      while (parentById.get(current) && !seen.has(parentById.get(current)!)) {
        current = parentById.get(current)!;
        seen.add(current);
        value++;
      }
      return value;
    };
    const canonicalNodes = [...semanticObjects.nodes].sort((a, b) =>
      depth(a.id) - depth(b.id)
      || String(parentById.get(a.id) ?? '').localeCompare(String(parentById.get(b.id) ?? ''))
      || a.id.localeCompare(b.id));
    const layoutDirection = (input.direction === 'LR' || input.direction === 'RL' ? input.direction : input.direction === 'BT' ? 'BT' : 'TB') as LayoutDirection;
    const denseDefaults = defaultCompoundLayoutOptions(layoutDirection, {
      edgeCount: semanticObjects.edges.length,
      nodeCount: semanticObjects.nodes.length,
    });
    const base = { ...denseDefaults, ...layoutOptions };
    const baseNodeSep = base.nodeSep ?? 110;
    const baseRankSep = base.rankSep ?? 170;
    const candidates = [
      { nodes: canonicalNodes, options: layoutOptions },
      { nodes: [...canonicalNodes].reverse(), options: layoutOptions },
      { nodes: canonicalNodes, options: { ...base, nodeSep: baseNodeSep + 32 } },
      { nodes: canonicalNodes, options: { ...base, rankSep: baseRankSep + 48 } },
    ];
    let layouted: RFObjects | undefined;
    let best: { nodeQuality: ReturnType<typeof measureLayoutQuality>; geometry: ReturnType<typeof getCachedDiagramGeometryPlan> } | undefined;
    // Compare two deterministic Dagre orderings in the requested direction.
    // Keep topology, dimensions and groups intact; never delete edges for aesthetics.
    const evaluated = new Set<string>();
    const evaluate = (candidateSpec: typeof candidates[number]) => {
      const signature = `${candidateSpec.options?.nodeSep ?? 'default'}:${candidateSpec.options?.rankSep ?? 'default'}:${candidateSpec.nodes.map(node => node.id).join(',')}`;
      if (evaluated.has(signature)) return;
      evaluated.add(signature);
      const candidate = applyRfLayout(
        { ...semanticObjects, nodes: candidateSpec.nodes } as unknown as Parameters<typeof applyRfLayout>[0],
        input.direction,
        candidateSpec.options,
      ) as unknown as RFObjects;
      // Dagre emits absolute child coordinates. Normalize them through the
      // canonical sizing pass before measuring, otherwise parent offsets are
      // counted twice and grouped candidates receive incorrect scores.
      const normalized = applySubgraphBoundsToRf(candidate.nodes);
      const qualityDirection = input.direction === 'TD' ? 'TB' : input.direction;
      const quality = measureLayoutQuality(normalized, candidate.edges, qualityDirection);
      const geometryDirection = input.direction === 'LR' || input.direction === 'RL' ? 'LR' : 'TD';
      const geometry = getCachedDiagramGeometryPlan(normalized as never, candidate.edges as never, { direction: geometryDirection });
      const labelCollisions = geometry.violations.filter(issue => issue.code === 'LABEL_COLLISION').length;
      const score = (value: typeof best) => value
        ? [
            value.geometry.quality.hardViolations,
            value.geometry.quality.criticalPathDisconnectCount,
            value.geometry.quality.unexplainedPrivateOverlapLength,
            value.geometry.quality.weightedCrossings,
            value.geometry.violations.filter(issue => issue.code === 'LABEL_COLLISION').length,
            value.geometry.quality.bendCount,
            value.geometry.quality.totalPathLength,
            value.nodeQuality.area,
            value.nodeQuality.penalty,
          ]
        : Array(9).fill(Infinity);
      const candidateScore = [
        geometry.quality.hardViolations,
        geometry.quality.criticalPathDisconnectCount,
        geometry.quality.unexplainedPrivateOverlapLength,
        geometry.quality.weightedCrossings,
        labelCollisions,
        geometry.quality.bendCount,
        geometry.quality.totalPathLength,
        quality.area,
        quality.penalty,
      ];
      const priorScore = score(best);
      const improves = candidateScore.some((value, index) => {
        for (let previous = 0; previous < index; previous++) if (candidateScore[previous] !== priorScore[previous]) return false;
        return value < priorScore[index];
      });
      if (!best || improves) {
        best = { nodeQuality: quality, geometry };
        // Keep Dagre's absolute coordinates for the next sizing stage; the
        // normalized copy is only the coordinate-space-correct scoring view.
        layouted = candidate;
      }
    };
    // One full route pass is enough for the common collision-free graph.
    // Only pay for alternate Dagre order when cheap node-level scoring or the
    // selected route plan reports crossings; spacing repairs target hard issues.
    evaluate(candidates[0]);
    if ((best?.nodeQuality.weightedCrossings ?? 0) > 0 || (best?.geometry.quality.weightedCrossings ?? 0) > 0) {
      evaluate(candidates[1]);
    }
    if (best?.geometry.quality.hardViolations) {
      // Two bounded Dagre spacing repairs. Route optimization then reallocates
      // the automatic edges around the new channels; fixed paths stay fixed.
      evaluate({ nodes: canonicalNodes, options: { ...base, nodeSep: baseNodeSep + 24 } });
      if (best?.geometry.quality.hardViolations) {
        evaluate({ nodes: canonicalNodes, options: { ...base, rankSep: baseRankSep + 32 } });
      }
    }
    // Preserve the original parent-before-child order expected by React Flow.
    const positions = new Map(layouted!.nodes.map(n => [n.id, n]));
    layouted = { nodes: semanticObjects.nodes.map(n => positions.get(n.id)!), edges: semanticObjects.edges };

    const selectedGeometry = best!.geometry;
    const geometryWarnings = selectedGeometry.status === 'ok'
      ? []
      : [`[GEOMETRY_${selectedGeometry.status.toUpperCase()}] ${selectedGeometry.quality.hardViolations} hard geometry violations, ${selectedGeometry.quality.criticalPathDisconnectCount} main-path route failures, and ${selectedGeometry.quality.unexplainedPrivateOverlapLength}px private route overlap remain after bounded layout repair.`];
    _context.metadata.geometryStatus = selectedGeometry.status;
    _context.metadata.geometryViolations = selectedGeometry.violations;
    return successResult(layouted, geometryWarnings, {
      geometryStatus: selectedGeometry.status,
      geometryViolations: selectedGeometry.violations,
    });
  }
}
