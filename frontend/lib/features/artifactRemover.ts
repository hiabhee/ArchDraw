import type { Node, Edge } from 'reactflow'

const ARTIFACT_LABEL_PATTERNS = [
  'subgraph',
  '-->',
  '---',
  '["',
]

const NODE_ID_ARTIFACT_PATTERNS = [
  /^subgraph$/i,
  /^end$/i,
]

/**
 * Removes nodes that are clearly Mermaid parser artifacts rather than
 * real architecture components. A node is considered an artifact if:
 *
 * 1. Its ID exactly matches known artifact patterns (e.g. "subgraph", "end").
 * 2. Its label contains edge syntax characters that leak through from
 *    malformed Mermaid (e.g. "-->", "---", '["').
 */
export function removeArtifacts(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const artifactNodeIds = new Set<string>()

  for (const node of nodes) {
    if (node.type === 'groupNode') continue

    if (NODE_ID_ARTIFACT_PATTERNS.some(p => p.test(node.id))) {
      artifactNodeIds.add(node.id)
      continue
    }

    const label = ((node.data as Record<string, unknown>)?.label as string) ?? ''
    if (label.length > 0 && ARTIFACT_LABEL_PATTERNS.some(p => label.includes(p))) {
      artifactNodeIds.add(node.id)
    }
  }

  if (artifactNodeIds.size === 0) {
    return { nodes, edges }
  }

  const filteredNodes = nodes.filter(n => !artifactNodeIds.has(n.id))
  const filteredEdges = edges.filter(e => !artifactNodeIds.has(e.source) && !artifactNodeIds.has(e.target))

  return { nodes: filteredNodes, edges: filteredEdges }
}
