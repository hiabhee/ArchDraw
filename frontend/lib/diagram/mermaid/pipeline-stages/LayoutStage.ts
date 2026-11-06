import { BaseStage, type StageResult, successResult } from '@/lib/diagram/pipeline-core';
import type { PipelineContext } from '@/lib/diagram/pipeline-core';
import { measureLayoutQuality } from '@/lib/diagram/pipeline-shared/layout/layoutQuality';
import { applyRfLayout } from '@/lib/diagram/pipeline-shared/layout/IntegratedLayout';
import { foldCandidates } from '@/lib/diagram/pipeline-shared/layout/foldLongFlows';
import { measureLayoutAesthetics } from '@/lib/diagram/pipeline-shared/layout/layoutAesthetics';
import { MIN_MIX_GAIN, searchGroupDirections, type FlowDirection } from '@/lib/diagram/pipeline-shared/layout/groupDirectionSearch';
import { defaultCompoundLayoutOptions, type RankDirection } from '@/lib/diagram/pipeline-shared/layout/LayoutEngine';
import { applySubgraphBoundsToRf } from '../recomputeSubgraphBounds';
import { getCachedDiagramGeometryPlan } from '@/lib/diagram/geometry/diagramGeometry';
import type { RFObjects, Direction } from '../types';
import {
  createSemanticEdgeKey,
  resolveEdgeFlowSemantics,
  semanticEdgeKeyString,
  type EdgeLayoutSemantics,
} from '../edgeFlowSemantics';

/**
 * How many folds are routed and compared per layout. Each costs one geometry plan,
 * which grows quickly with the diagram, and a large diagram is the least likely to
 * fold cleanly, so fewer are tried the bigger it is.
 */
function foldTries(nodeCount: number): number {
  return nodeCount <= 20 ? 6 : nodeCount <= 40 ? 3 : 1;
}

/**
 * A fold (or a mix of directions) may add some weighted crossings over the plain
 * layout and still be used, in proportion to how much larger it makes the diagram on
 * screen: a few for a change that merely tidies the shape, more for one that doubles
 * the text.
 */
const FOLD_CROSSING_BASE = 2;
const FOLD_CROSSING_PER_EXTRA_FIT = 5;
const FOLD_CROSSING_CAP = 12;
function foldCrossingAllowance(fitGain: number): number {
  return Math.min(FOLD_CROSSING_CAP, FOLD_CROSSING_BASE + FOLD_CROSSING_PER_EXTRA_FIT * Math.max(0, fitGain - 1));
}

/** A diagram with more nodes than this is not searched for a mix of directions (each trial is a layout). */
const MIX_MAX_NODES = 120;

const isGroupLike = (node: { type?: string; data?: unknown }) =>
  node.type === 'groupNode' || (node.data as { isGroup?: boolean } | undefined)?.isGroup === true;

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
    // Studio: large cards packed close, but not so close that a label pill cannot
    // sit between two columns: every label reserves its full width on top of
    // rankSep, which leaves room for the arrowhead and a gap on both sides. A live
    // project map keeps more room inside a column for the agent tags that hang
    // below a component. Other appearances keep the shared default geometry.
    const profile = _context.metadata.layoutProfile;
    const layoutOptions = profile === 'studio-minimal' || profile === 'studio-live'
      ? {
          nodeSep: profile === 'studio-live' ? 72 : 48,
          rankSep: 60,
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
    const layoutDirection = (input.direction === 'LR' || input.direction === 'RL' ? input.direction : input.direction === 'BT' ? 'BT' : 'TB') as RankDirection;
    const denseDefaults = defaultCompoundLayoutOptions(layoutDirection, {
      edgeCount: semanticObjects.edges.length,
      nodeCount: semanticObjects.nodes.length,
    });
    const base = { ...denseDefaults, ...layoutOptions };
    const baseNodeSep = base.nodeSep ?? 110;
    const baseRankSep = base.rankSep ?? 170;
    // Areas given in data-flow order are stages: keep them in rank order.
    // `zones`: hub-and-zones placement (falls back to the flow layout with no hub).
    const flowAreas = {
      ...(_context.metadata.areaOrder ? { flowAreas: true } : {}),
      ...(_context.metadata.layoutStyle === 'zones' ? { zones: true } : {}),
    };
    const candidates = [
      { nodes: canonicalNodes, options: layoutOptions || Object.keys(flowAreas).length ? { ...layoutOptions, ...flowAreas } : undefined },
      { nodes: [...canonicalNodes].reverse(), options: layoutOptions || Object.keys(flowAreas).length ? { ...layoutOptions, ...flowAreas } : undefined },
      { nodes: canonicalNodes, options: { ...base, nodeSep: baseNodeSep + 32, ...flowAreas } },
      { nodes: canonicalNodes, options: { ...base, rankSep: baseRankSep + 48, ...flowAreas } },
    ];
    const qualityDirection = input.direction === 'TD' ? 'TB' : input.direction;
    const geometryDirection = input.direction === 'LR' || input.direction === 'RL' ? 'LR' : 'TD';
    const foldDirection = _context.metadata.foldLongFlows === false ? undefined
      : input.direction === 'LR' ? 'LR' as const
      : input.direction === 'TD' ? 'TD' as const
      : undefined;

    const measureCandidate = (laid: RFObjects) => {
      // Dagre emits absolute child coordinates. Normalize them through the
      // canonical sizing pass before measuring, otherwise parent offsets are
      // counted twice and grouped candidates receive incorrect scores.
      const normalized = applySubgraphBoundsToRf(laid.nodes);
      const quality = measureLayoutQuality(normalized, laid.edges, qualityDirection);
      const geometry = getCachedDiagramGeometryPlan(normalized as never, laid.edges as never, { direction: geometryDirection });
      const labelCollisions = geometry.violations.filter(issue => issue.code === 'LABEL_COLLISION').length;
      return {
        quality,
        geometry,
        // How large the diagram can be drawn on a typical screen (1 = full size).
        fit: measureLayoutAesthetics(normalized as never, [], geometryDirection).fitScale,
        candidateScore: [
          geometry.quality.hardViolations,
          geometry.quality.criticalPathDisconnectCount,
          geometry.quality.unexplainedPrivateOverlapLength,
          geometry.quality.weightedCrossings,
          labelCollisions,
          geometry.quality.bendCount,
          geometry.quality.totalPathLength,
          quality.area,
          quality.penalty,
        ],
      };
    };
    type Measured = ReturnType<typeof measureCandidate>;

    /** Lays the nodes out, then tries folding the result; returns the layout to use and its measure. */
    const produce = (spec: typeof candidates[number]): { candidate: RFObjects; measured: Measured } => {
      const laidOut = applyRfLayout(
        { ...semanticObjects, nodes: spec.nodes } as unknown as Parameters<typeof applyRfLayout>[0],
        input.direction,
        spec.options,
      ) as unknown as RFObjects;

      // A long flow is also tried folded into rows (or lanes) so it fills a 16:9
      // screen; the fold is used only when routing it is no worse (see FOLD_*), since
      // the wrap can put an edge across others. Folding happens before scoring, so
      // the score sees the rows that will be drawn.
      let candidate = laidOut;
      let measured = measureCandidate(laidOut);
      if (foldDirection) {
        // Best-fitting fold first; the first that routes about as cleanly as the
        // unfolded layout wins. A few are tried: the best fit is not always the
        // one whose wrap edges clear every node and label.
        for (const fold of foldCandidates(laidOut.nodes, { direction: foldDirection, edges: laidOut.edges }).slice(0, foldTries(laidOut.nodes.length))) {
          const folded = { ...laidOut, nodes: fold.nodes };
          const foldedMeasure = measureCandidate(folded);
          const before = measured.geometry.quality;
          const after = foldedMeasure.geometry.quality;
          if (
            after.hardViolations <= before.hardViolations &&
            after.criticalPathDisconnectCount <= before.criticalPathDisconnectCount &&
            after.weightedCrossings <= before.weightedCrossings + foldCrossingAllowance(foldedMeasure.fit / Math.max(measured.fit, 1e-6))
          ) {
            candidate = folded;
            measured = foldedMeasure;
            break;
          }
        }
      }
      return { candidate, measured };
    };

    let layouted: RFObjects | undefined;
    let best: { nodeQuality: ReturnType<typeof measureLayoutQuality>; geometry: ReturnType<typeof getCachedDiagramGeometryPlan>; fit: number } | undefined;
    // Compare two deterministic Dagre orderings in the requested direction.
    // Keep topology, dimensions and groups intact; never delete edges for aesthetics.
    const evaluated = new Set<string>();
    const evaluate = (candidateSpec: typeof candidates[number]) => {
      const signature = `${candidateSpec.options?.nodeSep ?? 'default'}:${candidateSpec.options?.rankSep ?? 'default'}:${candidateSpec.nodes.map(node => node.id).join(',')}`;
      if (evaluated.has(signature)) return;
      evaluated.add(signature);
      const { candidate, measured } = produce(candidateSpec);
      const { quality, geometry, candidateScore } = measured;
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
      const priorScore = score(best);
      const improves = candidateScore.some((value, index) => {
        for (let previous = 0; previous < index; previous++) if (candidateScore[previous] !== priorScore[previous]) return false;
        return value < priorScore[index];
      });
      if (!best || improves) {
        best = { nodeQuality: quality, geometry, fit: measured.fit };
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
      evaluate({ nodes: canonicalNodes, options: { ...base, nodeSep: baseNodeSep + 24, ...flowAreas } });
      if (best?.geometry.quality.hardViolations) {
        evaluate({ nodes: canonicalNodes, options: { ...base, rankSep: baseRankSep + 32, ...flowAreas } });
      }
    }

    // A mix of directions: some groups are laid out the other way (a tall block
    // instead of a wide one) when that lets the diagram be drawn clearly larger.
    // Searched on quick layouts, then routed like a fold and used only if it routes
    // about as cleanly as the best layout so far. The directions are chosen here, not
    // by the author, so they are removed from the result again (see below).
    let mixedGroups: ReadonlyMap<string, FlowDirection> | undefined;
    const otherDirection: FlowDirection | undefined = input.direction === 'LR' ? 'TD' : input.direction === 'TD' ? 'LR' : undefined;
    if (otherDirection && _context.metadata.mixGroupDirections !== false && best && best.fit < 1 && semanticObjects.nodes.length <= MIX_MAX_NODES) {
      const hasOwnDirection = (node: { data?: unknown }) => Boolean((node.data as { direction?: string; groupDirection?: string } | undefined)?.direction || (node.data as { groupDirection?: string } | undefined)?.groupDirection);
      const memberCount = new Map<string, number>();
      for (const node of canonicalNodes) {
        let parent = parentById.get(node.id);
        const seen = new Set<string>();
        // Count every descendant towards the top-level group it sits in.
        while (parent && parentById.get(parent) && !seen.has(parent)) { seen.add(parent); parent = parentById.get(parent); }
        if (parent) memberCount.set(parent, (memberCount.get(parent) ?? 0) + 1);
      }
      const topGroups = canonicalNodes
        .filter(node => isGroupLike(node) && !parentById.get(node.id) && !hasOwnDirection(node))
        .sort((a, b) => (memberCount.get(b.id) ?? 0) - (memberCount.get(a.id) ?? 0) || a.id.localeCompare(b.id))
        .map(node => node.id);
      const withDirections = (assignment: ReadonlyMap<string, FlowDirection>) =>
        canonicalNodes.map(node => (assignment.has(node.id) ? { ...node, data: { ...node.data, direction: assignment.get(node.id) } } : node));
      const quick = { ...candidates[0].options, settle: false };
      const fitOf = (assignment: ReadonlyMap<string, FlowDirection>) => {
        const laid = applyRfLayout(
          { ...semanticObjects, nodes: withDirections(assignment) } as unknown as Parameters<typeof applyRfLayout>[0],
          input.direction,
          quick,
        ) as unknown as RFObjects;
        // The unfolded fit, not the best fold's: a fold has to route cleanly to be used, which
        // is only known after routing it, so the search scores the shape and the fold is
        // tried afterwards on the mix it picks (see `produce`).
        return measureLayoutAesthetics(applySubgraphBoundsToRf(laid.nodes) as never, [], geometryDirection).fitScale;
      };
      const found = searchGroupDirections(topGroups, otherDirection, fitOf);
      if (found) {
        const { candidate, measured } = produce({ nodes: withDirections(found.assignment), options: candidates[0].options });
        const before = best.geometry.quality;
        const after = measured.geometry.quality;
        if (
          measured.fit >= best.fit * MIN_MIX_GAIN &&
          after.hardViolations <= before.hardViolations &&
          after.criticalPathDisconnectCount <= before.criticalPathDisconnectCount &&
          after.weightedCrossings <= before.weightedCrossings + foldCrossingAllowance(measured.fit / Math.max(best.fit, 1e-6))
        ) {
          best = { nodeQuality: measured.quality, geometry: measured.geometry, fit: measured.fit };
          layouted = candidate;
          mixedGroups = found.assignment;
        }
      }
    }

    // Preserve the original parent-before-child order expected by React Flow.
    const positions = new Map(layouted!.nodes.map(n => [n.id, n]));
    layouted = {
      nodes: semanticObjects.nodes.map(n => {
        const laid = positions.get(n.id)!;
        if (!mixedGroups?.has(n.id)) return laid;
        // The direction was the layout's choice, not the diagram's: leave it off the node,
        // so a later layout (another direction, an edit) decides afresh.
        const { direction: _direction, ...data } = (laid.data ?? {}) as Record<string, unknown>;
        return { ...laid, data };
      }),
      edges: semanticObjects.edges,
    };

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
