import { Pipeline, pipelineStages, toDomainResult } from '@/lib/pipeline-core'
import type { DomainPipelineResult } from '@/lib/pipeline-core'
import type { Stage } from '@/lib/pipeline-core/Stage'
import type { StageResult } from '@/lib/pipeline-core/StageResult'
import { successResult, errorResult, warningResult } from '@/lib/pipeline-core/StageResult'
import type { PipelineResult as CorePipelineResult } from '@/lib/pipeline-core/PipelineResult'
import type { PipelineContext } from '@/lib/pipeline-core/PipelineContext'
import type { RFObjects, RFNode, RFEdge, Direction, MermaidAST } from './types'
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
}

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
        const warnings = [...new Set([...input.warnings, ...result.data.validationWarnings])]
        const data = { ...input, warnings }
        return warnings.length > 0 ? warningResult(data, warnings) : successResult(data)
      },
    },
  )
}

export async function runMermaidPipeline(
  mermaidText: string,
  options: {
    reduceRedundantEdges?: boolean;
    diagramKind?: 'architecture' | 'workflow';
    pruneOrphans?: boolean;
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
  }

  return {
    success: true,
    data: pipelineResult,
    warnings: domainResult.warnings,
    metrics: domainResult.metrics,
  }
}
