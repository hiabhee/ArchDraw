import type { RFObjects, RFNode, RFEdge, Direction } from './types'
import { parseMermaid } from './parse'
import { validateAST } from './validate'
import { buildReactFlowObjects } from './buildReactFlow'
import { applyLayout } from './layout'
import { sizeSubgraphs } from './subgraphSizing'
import { validateDiagramOutput } from './validation'

export interface PipelineResult {
  nodes: RFNode[]
  edges: RFEdge[]
  warnings: string[]
  success: boolean
  direction?: Direction
}

export function runMermaidPipeline(mermaidText: string): PipelineResult {
  // STAGE 1: Parse
  const parseResult = parseMermaid(mermaidText)
  if (!parseResult.ok) {
    return {
      nodes: [],
      edges: [],
      warnings: parseResult.errors.map(e => `Parse error (line ${e.line}): ${e.reason}`),
      success: false,
    }
  }

  // STAGE 2: Validate
  const validateResult = validateAST(parseResult.ast)
  if (!validateResult.ok) {
    return {
      nodes: [],
      edges: [],
      warnings: validateResult.errors.map(e => `[${e.type}] ${e.message}`),
      success: false,
    }
  }

  // STAGE 3: Build ReactFlow objects (unpositioned)
  const objects = buildReactFlowObjects(validateResult.ast)

  // STAGE 4: Layout with Dagre
  const layouted = applyLayout(objects, parseResult.ast.direction)

  // STAGE 5: Size subgraph containers
  const sized = sizeSubgraphs(layouted.nodes)

  // Handles are assigned by the store's distributeTargetHandles when importDiagram is called.
  // The edge component (SimpleFloatingEdge) computes its own positions at runtime via getDynamicHandles,
  // so handle IDs on the edge are cosmetic metadata only.

  // Validation report
  const report = validateDiagramOutput(sized, layouted.edges)
  const warnings = report.warnings.map(w => `[${w.type}] ${w.message}`)

  return {
    nodes: sized,
    edges: layouted.edges,
    warnings,
    success: true,
    direction: parseResult.ast.direction,
  }
}
