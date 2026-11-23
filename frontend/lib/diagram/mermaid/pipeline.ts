import type { DiagramRenderStyleId } from '@/lib/theme/renderStyles'
import type { NodeIconMode } from '@/lib/diagram/nodes/nodeIconVisibility'
import { Pipeline, pipelineStages, toDomainResult } from '@/lib/diagram/pipeline-core'
import type { DomainPipelineResult } from '@/lib/diagram/pipeline-core'
import type { Stage } from '@/lib/diagram/pipeline-core/Stage'
import type { StageResult } from '@/lib/diagram/pipeline-core/StageResult'
import { successResult, errorResult, warningResult } from '@/lib/diagram/pipeline-core/StageResult'
import type { PipelineResult as CorePipelineResult } from '@/lib/diagram/pipeline-core/PipelineResult'
import type { PipelineContext } from '@/lib/diagram/pipeline-core/PipelineContext'
import type { RFObjects, RFNode, RFEdge, Direction, MermaidAST } from './types'
import type { PrepareLayoutGeometry } from './pipeline-stages/LayoutStage'
import type { EdgeLayoutSemantics } from './edgeFlowSemantics'
import { getCachedDiagramGeometryPlan, type DiagramGeometryPlan } from '@/lib/diagram/geometry/diagramGeometry'
import { measureLayoutAesthetics } from '@/lib/diagram/pipeline-shared/layout/layoutAesthetics'
import type { GeometryStatus } from '@/lib/diagram/geometry/geometryTypes'
import {
  ParseStage,
  ValidateStage,
  SanitizeStage,
  BuildStage,
  LayoutStage,
  SizeStage,
  TextPlacementStage,
  FinalValidationStage,
} from './pipeline-stages'

export interface PipelineResult {
  nodes: RFNode[]
  edges: RFEdge[]
  warnings: string[]
  success: boolean
  direction?: Direction
  nodesRemoved?: number
  edgesRemoved?: number
  groupsRemoved?: number
  removedNodeIds?: string[]
  geometrySummary?: GeometrySummary
}

export interface GeometrySummary {
  status: GeometryStatus;
  hardViolations: number;
  crossings: number;
  weightedCrossings: number;
  unexplainedPrivateOverlapLength: number;
  criticalPathDisconnectCount: number;
  labelCollisions: number;
  bendCount: number;
  totalPathLength: number;
}

export function summarizeGeometry(plan: DiagramGeometryPlan): GeometrySummary {
  return {
    status: plan.status,
    ...plan.quality,
    labelCollisions: plan.violations.filter(issue => issue.code === 'LABEL_COLLISION').length,
  };
}

export function geometryWarnings(warnings: string[], geometry?: GeometrySummary): string[] {
  const current = warnings.filter(warning => !/^\[GEOMETRY_(?:DEGRADED|INVALID|FAILED)\]/.test(warning));
  if (geometry && geometry.status !== 'ok') {
    current.push(`[GEOMETRY_${geometry.status.toUpperCase()}] ${geometry.hardViolations} hard geometry violations, ${geometry.criticalPathDisconnectCount} main-path route failures, and ${geometry.unexplainedPrivateOverlapLength}px private route overlap remain after bounded layout repair.`);
  }
  return [...new Set(current)];
}

/**
 * 'studio-minimal': Studio cards packed tight (diagrams drawn in the editor).
 * 'studio-live': the same cards with more room inside a column, because agent
 * name tags and task lines hang below a component on a live project map.
 */
export type MermaidLayoutProfile = 'studio-minimal' | 'studio-live';

export interface MermaidPipelineData {
  originalNodeIds?: string[]
  originalEdgeIds?: string[]
  originalGroupIds?: string[]
  text: string
  ast: MermaidAST | null
  objects: RFObjects | null
  direction: Direction
  warnings: string[]
  reduceRedundantEdges?: boolean
  diagramKind?: 'architecture' | 'workflow'
  pruneOrphans?: boolean
  removedNodeIds?: string[]
  geometrySummary?: GeometrySummary
}

const parseStage = new ParseStage()
const validateStage = new ValidateStage()
const sanitizeStage = new SanitizeStage()
const buildStage = new BuildStage()
const layoutStage = new LayoutStage()
const sizeStage = new SizeStage()
const textPlacementStage = new TextPlacementStage()
const finalValidationStage = new FinalValidationStage()

/** Composes class stages with accumulating MermaidPipelineData. Exported for tests. */
export function createMermaidPipelineStages(): Stage<string, MermaidPipelineData>[] {
  return pipelineStages<string, MermaidPipelineData>(
    {
      name: 'parse',
      description: 'Parse Mermaid text into AST',
      async execute(input: string, context: PipelineContext): Promise<StageResult<MermaidPipelineData>> {
        const result = await parseStage.execute(input, context)
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Mermaid parsing failed'), result.warnings)
        }
        return successResult({
          originalNodeIds: result.data.nodes.map(n => n.id),
          originalEdgeIds: result.data.edges.map(e => e.id),
          originalGroupIds: result.data.subgraphs.map(g => g.id),
          text: input,
          ast: result.data,
          objects: null,
          direction: result.data.direction,
          warnings: [],
          reduceRedundantEdges: context.metadata?.reduceRedundantEdges === true,
          diagramKind: context.metadata?.diagramKind as MermaidPipelineData['diagramKind'],
          pruneOrphans: context.metadata?.pruneOrphans === true,
        })
      },
    },
    {
      name: 'validate',
      description: 'Validate Mermaid AST',
      async execute(input: MermaidPipelineData, context: PipelineContext): Promise<StageResult<MermaidPipelineData>> {
        if (!input.ast) return errorResult(new Error('No AST to validate'))
        const result = await validateStage.execute(input.ast, context)
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('AST validation failed'), result.warnings)
        }
        return successResult({ ...input, ast: result.data, warnings: [...input.warnings, ...(result.warnings ?? [])] })
      },
    },
    {
      name: 'sanitize',
      description: 'Sanitize hallucinated nodes, tier reversals, and redundant generated edges',
      async execute(input: MermaidPipelineData, context: PipelineContext): Promise<StageResult<MermaidPipelineData>> {
        if (!input.ast) return errorResult(new Error('No AST to sanitize'))
        const result = await sanitizeStage.execute({
          ast: input.ast,
          reduceRedundantEdges: input.reduceRedundantEdges,
          diagramKind: input.diagramKind,
          pruneOrphans: input.pruneOrphans,
        }, context)
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Sanitize failed'), result.warnings)
        }
        const sanitizedAst = result.data
        const sanitizeWarnings = result.warnings ?? []
        const newWarnings = [...(input.warnings ?? []), ...sanitizeWarnings]
        return successResult({
          ...input,
          ast: sanitizedAst,
          warnings: newWarnings,
          removedNodeIds: [...(input.removedNodeIds ?? []), ...sanitizeWarnings.filter(w => w.startsWith('[ORPHAN_NODE]'))],
        }, newWarnings)
      },
    },
    {
      name: 'build',
      description: 'Build ReactFlow objects',
      weight: 2,
      async execute(input: MermaidPipelineData, context: PipelineContext): Promise<StageResult<MermaidPipelineData>> {
        if (!input.ast) return errorResult(new Error('No AST to build from'))
        const result = await buildStage.execute(input.ast, context)
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Build failed'), result.warnings)
        }
        return successResult({ ...input, objects: result.data })
      },
    },
    {
      name: 'layout',
      description: 'Apply layout',
      weight: 2,
      async execute(input: MermaidPipelineData, context: PipelineContext): Promise<StageResult<MermaidPipelineData>> {
        if (!input.objects) return errorResult(new Error('No objects to layout'))
        const result = await layoutStage.execute(
          { objects: input.objects, direction: input.direction },
          context
        )
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Layout failed'), result.warnings)
        }
        return successResult({ ...input, objects: result.data })
      },
    },
    {
      name: 'size',
      description: 'Size subgraph containers',
      async execute(input: MermaidPipelineData, context: PipelineContext): Promise<StageResult<MermaidPipelineData>> {
        if (!input.objects) return errorResult(new Error('No objects to size'))
        const result = await sizeStage.execute(input.objects.nodes, context)
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Sizing failed'), result.warnings)
        }
        return successResult({
          ...input,
          objects: { nodes: result.data, edges: input.objects.edges },
        })
      },
    },
    {
      name: 'place-text',
      description: 'Anchor free-text nodes after layout',
      async execute(input: MermaidPipelineData, context: PipelineContext): Promise<StageResult<MermaidPipelineData>> {
        if (!input.objects) return errorResult(new Error('No objects to place text on'))
        const result = await textPlacementStage.execute(input.objects, context)
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Text placement failed'), result.warnings)
        }
        return successResult({ ...input, objects: result.data })
      },
    },
    {
      name: 'validate-output',
      description: 'Validate final output',
      async execute(input: MermaidPipelineData, context: PipelineContext): Promise<StageResult<MermaidPipelineData>> {
        if (!input.objects) return errorResult(new Error('No objects to validate'))
        const result = await finalValidationStage.execute(
          {
            nodes: input.objects.nodes,
            edges: input.objects.edges,
            direction: input.direction,
          },
          context
        )
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Output validation failed'), result.warnings)
        }
        const geometrySummary = context.metadata.prepareGeometry ? undefined : summarizeGeometry(
          getCachedDiagramGeometryPlan(input.objects.nodes, input.objects.edges, {
            direction: input.direction === 'LR' || input.direction === 'RL' ? 'LR' : 'TD',
            straightEdges: false,
            renderStyleId: (context.metadata.renderStyleId ?? (context.metadata.layoutProfile === 'studio-minimal' || context.metadata.layoutProfile === 'studio-live' ? 'studio-minimal' : undefined)) as DiagramRenderStyleId | undefined,
            iconMode: context.metadata.iconMode as NodeIconMode | undefined,
          }),
        );
        const warnings = geometryWarnings([...input.warnings, ...result.data.validationWarnings], geometrySummary);
        const data = { ...input, warnings, geometrySummary }
        return warnings.length > 0 ? warningResult(data, warnings) : successResult(data)
      },
    },
  )
}

export async function runMermaidPipeline(
  mermaidText: string,
  options: {
    renderStyleId?: DiagramRenderStyleId;
    iconMode?: NodeIconMode;
    reduceRedundantEdges?: boolean;
    diagramKind?: 'architecture' | 'workflow';
    pruneOrphans?: boolean;
    layoutProfile?: MermaidLayoutProfile;
    studioNodeSizes?: ReadonlyMap<string, { width: number; height: number }>;
    edgeSemantics?: ReadonlyMap<string, EdgeLayoutSemantics>;
    /**
     * `flow`: top-level subgraphs are listed in data-flow order; or their ids
     * in that order. Edges back to an earlier one are feedback (not ranked).
     */
    areaOrder?: 'flow' | readonly string[];
    /** `auto`: compare applicable arrangements; `flow` (default): rank columns; `zones`: prefer a hub arrangement. */
    layoutStyle?: 'auto' | 'flow' | 'zones';
    /** Fold a long left-to-right flow into rows when that fits the screen far better (live projects). */
    foldLongFlows?: boolean;
    /** Keep differently styled branches legible when an external preview requests separate strokes. */
    separateSharedStrokes?: boolean;
    /** Reserve room for every label at the preview's fitted zoom. */
    fitPreviewLabels?: boolean;
    /** Score the restored graph during React Flow relayout. The caller verifies it after sizing and text placement. */
    prepareGeometry?: PrepareLayoutGeometry;
    /** Lay out some top-level groups the other way (top-down in a left-to-right diagram, or the reverse) when that fits the screen clearly better. Default on. */
    mixGroupDirections?: boolean;
  } = {},
): Promise<DomainPipelineResult<PipelineResult>> {
  const pipeline = new Pipeline<string, MermaidPipelineData>(
    'mermaid-pipeline-v2',
    createMermaidPipelineStages()
  )

  const result: CorePipelineResult<MermaidPipelineData> = await pipeline.execute(mermaidText, {
    context: { metadata: options },
  })

  const domainResult = toDomainResult(result)

  if (!domainResult.success) {
    return domainResult
  }

  const pipelineResult: PipelineResult = {
    nodes: domainResult.data.objects?.nodes ?? [],
    edges: domainResult.data.objects?.edges ?? [],
    warnings: domainResult.data.warnings,
    success: true,
    direction: domainResult.data.direction,
    nodesRemoved: domainResult.data.originalNodeIds?.filter(id => !domainResult.data.objects?.nodes.some(n => n.id === id)).length ?? 0,
    edgesRemoved: domainResult.data.originalEdgeIds?.filter(id => !domainResult.data.ast?.edges.some(e => e.id === id)).length ?? 0,
    groupsRemoved: domainResult.data.originalGroupIds?.filter(id => !domainResult.data.objects?.nodes.some(n => n.id === id)).length ?? 0,
    removedNodeIds: domainResult.data.removedNodeIds,
    geometrySummary: domainResult.data.geometrySummary,
  }

  return {
    success: true,
    data: pipelineResult,
    warnings: domainResult.warnings,
    metrics: domainResult.metrics,
  }
}

/** Prefer a readable, unfolded main flow in a compact preview. */
export async function runCompactMermaidPipeline(
  text: string,
  options: Parameters<typeof runMermaidPipeline>[1],
): Promise<DomainPipelineResult<PipelineResult>> {
  const unfolded = { ...options, foldLongFlows: false }
  const preferred = await runMermaidPipeline(text, unfolded)
  if (!preferred.success) return preferred
  const { direction, geometrySummary: before } = preferred.data
  if (!before || (direction !== 'LR' && direction !== 'TD')) return preferred

  const preferredFit = measureLayoutAesthetics(preferred.data.nodes, preferred.data.edges, direction).fitScale
  const hasLayoutProblems = before.hardViolations || before.criticalPathDisconnectCount
    || before.crossings || before.labelCollisions || before.unexplainedPrivateOverlapLength
  if (!hasLayoutProblems && preferredFit >= 0.55) return preferred

  const alternateDirection = direction === 'LR' ? 'TD' : 'LR'
  const alternateText = text.replace(/^(\s*(?:graph|flowchart)\s+)(?:LR|TD|TB)\b/im, `$1${alternateDirection}`)
  if (alternateText === text) return preferred
  const alternate = await runMermaidPipeline(alternateText, unfolded)
  if (!alternate.success || !alternate.data.geometrySummary) return preferred
  const after = alternate.data.geometrySummary
  const alternateFit = measureLayoutAesthetics(alternate.data.nodes, alternate.data.edges, alternateDirection).fitScale

  // A few extra crossings are preferable to unreadable labels or blocked cards
  // when the alternate fits almost as well and keeps the main flow connected.
  if (after.hardViolations < before.hardViolations
    && after.criticalPathDisconnectCount <= before.criticalPathDisconnectCount
    && alternateFit >= preferredFit * 0.9) return alternate

  const noWorse = after.hardViolations <= before.hardViolations
    && after.criticalPathDisconnectCount <= before.criticalPathDisconnectCount
    && after.crossings <= before.crossings
    && after.labelCollisions <= before.labelCollisions
    && after.unexplainedPrivateOverlapLength <= before.unexplainedPrivateOverlapLength
  const fixesIssue = after.hardViolations < before.hardViolations
    || after.criticalPathDisconnectCount < before.criticalPathDisconnectCount
    || after.crossings < before.crossings || after.labelCollisions < before.labelCollisions
    || after.unexplainedPrivateOverlapLength < before.unexplainedPrivateOverlapLength
  const improvesFit = alternateFit >= preferredFit * 1.2
  return noWorse && (improvesFit || (fixesIssue && alternateFit >= preferredFit * 0.9)) ? alternate : preferred
}
