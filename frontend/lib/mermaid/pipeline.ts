import type { RFObjects, RFNode, RFEdge, Direction, MermaidAST } from './types'
import { parseMermaid } from './parse'
import { validateAST } from './validate'
import { buildReactFlowObjects } from './buildReactFlow'
import { applyLayout } from './layout'
import { sizeSubgraphs } from './subgraphSizing'
import { validateDiagramOutput } from './validation'
import { Pipeline } from '@/lib/pipeline-core/Pipeline'
import type { Stage } from '@/lib/pipeline-core/Stage'
import type { StageResult } from '@/lib/pipeline-core/StageResult'
import { successResult, errorResult, warningResult } from '@/lib/pipeline-core/StageResult'
import type { PipelineResult as CorePipelineResult } from '@/lib/pipeline-core/PipelineResult'

export interface PipelineResult {
  nodes: RFNode[]
  edges: RFEdge[]
  warnings: string[]
  success: boolean
  direction?: Direction
}

export interface MermaidPipelineData {
  text: string
  ast: MermaidAST | null
  objects: RFObjects | null
  direction: Direction
  warnings: string[]
}

export function runMermaidPipeline(mermaidText: string): PipelineResult {
  const parseResult = parseMermaid(mermaidText)
  if (!parseResult.ok) {
    return {
      nodes: [],
      edges: [],
      warnings: parseResult.errors.map(e => `Parse error (line ${e.line}): ${e.reason}`),
      success: false,
    }
  }

  const validateResult = validateAST(parseResult.ast)
  if (!validateResult.ok) {
    return {
      nodes: [],
      edges: [],
      warnings: validateResult.errors.map(e => `[${e.type}] ${e.message}`),
      success: false,
    }
  }

  const objects = buildReactFlowObjects(validateResult.ast)
  const layouted = applyLayout(objects, parseResult.ast.direction)
  const report = validateDiagramOutput(layouted.nodes, layouted.edges, parseResult.ast.direction)
  const warnings = report.warnings.map(w => `[${w.type}] ${w.message}`)

  return {
    nodes: sizeSubgraphs(layouted.nodes),
    edges: layouted.edges,
    warnings,
    success: true,
    direction: parseResult.ast.direction,
  }
}

const stages: Stage<any, any>[] = [
  {
    name: 'parse',
    description: 'Parse Mermaid text into AST',
    async execute(input: string): Promise<StageResult<MermaidPipelineData>> {
      const result = parseMermaid(input)
      if (!result.ok) {
        return errorResult(new Error('Mermaid parsing failed'),
          result.errors.map(e => `Parse error (line ${e.line}): ${e.reason}`)
        )
      }
      return successResult({
        text: input,
        ast: result.ast,
        objects: null,
        direction: result.ast.direction,
        warnings: [],
      })
    },
  },
  {
    name: 'validate',
    description: 'Validate Mermaid AST',
    async execute(input: MermaidPipelineData): Promise<StageResult<MermaidPipelineData>> {
      if (!input.ast) return errorResult(new Error('No AST to validate'))
      const result = validateAST(input.ast)
      if (!result.ok) {
        return errorResult(new Error('AST validation failed'),
          result.errors.map(e => `[${e.type}] ${e.message}`)
        )
      }
      return successResult({ ...input, ast: result.ast })
    },
  },
  {
    name: 'build',
    description: 'Build ReactFlow objects',
    weight: 2,
    async execute(input: MermaidPipelineData): Promise<StageResult<MermaidPipelineData>> {
      if (!input.ast) return errorResult(new Error('No AST to build from'))
      const objects = buildReactFlowObjects(input.ast)
      return successResult({ ...input, objects })
    },
  },
  {
    name: 'layout',
    description: 'Apply layout',
    weight: 2,
    async execute(input: MermaidPipelineData): Promise<StageResult<MermaidPipelineData>> {
      if (!input.objects) return errorResult(new Error('No objects to layout'))
      const layouted = applyLayout(input.objects, input.direction)
      return successResult({ ...input, objects: layouted })
    },
  },
  {
    name: 'size',
    description: 'Size subgraph containers',
    async execute(input: MermaidPipelineData): Promise<StageResult<MermaidPipelineData>> {
      if (!input.objects) return errorResult(new Error('No objects to size'))
      const sizedNodes = sizeSubgraphs(input.objects.nodes)
      return successResult({
        ...input,
        objects: { nodes: sizedNodes, edges: input.objects.edges },
      })
    },
  },
  {
    name: 'validate-output',
    description: 'Validate final output',
    async execute(input: MermaidPipelineData): Promise<StageResult<MermaidPipelineData>> {
      if (!input.objects) return errorResult(new Error('No objects to validate'))
      const report = validateDiagramOutput(input.objects.nodes, input.objects.edges, input.direction)
      const warnings = report.warnings.map(w => `[${w.type}] ${w.message}`)
      const data = { ...input, warnings: warnings }
      return warnings.length > 0 ? warningResult(data, warnings) : successResult(data)
    },
  },
]

export async function runMermaidPipelineV2(mermaidText: string): Promise<PipelineResult> {
  const pipeline = new Pipeline<string, MermaidPipelineData>('mermaid-pipeline-v2', stages)

  const result: CorePipelineResult<MermaidPipelineData> = await pipeline.execute(mermaidText)

  if (!result.success || !result.data) {
    return {
      nodes: [],
      edges: [],
      warnings: [...result.warnings, ...result.errors],
      success: false,
    }
  }

  return {
    nodes: result.data.objects?.nodes ?? [],
    edges: result.data.objects?.edges ?? [],
    warnings: result.data.warnings,
    success: true,
    direction: result.data.direction,
  }
}
