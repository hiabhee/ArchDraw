import type { MermaidAST, ValidationWarning } from './types'

export function validateAST(ast: MermaidAST): { ok: true; ast: MermaidAST } | { ok: false; errors: ValidationWarning[] } {
  const errors: ValidationWarning[] = []
  // Pipes / arrows are legitimate inside quoted labels ("Kafka | Redpanda",
  // "retry --> fallback") — our own serializer always quotes labels, and the
  // parser's arrow scan is quote-aware, so artifacts found in a parsed label
  // cannot be edge syntax.
  const labelArtifacts = [' -- ', '["']
  const nodeMap = new Map(ast.nodes.map(n => [n.id, n]))
  const subgraphMap = new Map(ast.subgraphs.map(s => [s.id, s]))

  // Every edge source and target must exist as a node or subgraph
  for (const edge of ast.edges) {
    if (!nodeMap.has(edge.source) && !subgraphMap.has(edge.source)) {
      errors.push({ type: 'EDGE_SOURCE_NOT_FOUND', edgeId: edge.id, message: `Edge ${edge.id} source '${edge.source}' not found as a node id` })
    }
    if (!nodeMap.has(edge.target) && !subgraphMap.has(edge.target)) {
      errors.push({ type: 'EDGE_TARGET_NOT_FOUND', edgeId: edge.id, message: `Edge ${edge.id} target '${edge.target}' not found as a node id` })
    }
  }

  // No duplicate node ids
  const seen = new Set<string>()
  for (const node of ast.nodes) {
    if (seen.has(node.id)) {
      errors.push({ type: 'DUPLICATE_NODE_ID', nodeId: node.id, message: `Duplicate node id: ${node.id}` })
    }
    seen.add(node.id)
  }

  // No node label contains edge syntax
  for (const node of ast.nodes) {
    for (const artifact of labelArtifacts) {
      if (node.label.includes(artifact)) {
        errors.push({ type: 'NODE_LABEL_ARTIFACT', nodeId: node.id, message: `Node ${node.id} label contains edge syntax: "${node.label}"` })
        break
      }
    }
  }

  // Every node inside a subgraph has that subgraph
  for (const node of ast.nodes) {
    if (node.subgraphId && !subgraphMap.has(node.subgraphId)) {
      errors.push({ type: 'NODE_IN_MISSING_SUBGRAPH', nodeId: node.id, message: `Node ${node.id} references subgraph '${node.subgraphId}' which does not exist` })
    }
  }

  // Every subgraph nodeIds entry references an existing node
  for (const sub of ast.subgraphs) {
    for (const nodeId of sub.nodeIds) {
      if (!nodeMap.has(nodeId)) {
        errors.push({ type: 'SUBGRAPH_NODE_NOT_FOUND', nodeId, message: `Subgraph '${sub.id}' lists node '${nodeId}' which does not exist` })
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, ast }
}
