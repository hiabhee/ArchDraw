import type { Node, Edge } from 'reactflow'

export interface SpineResult {
  spineNodeIds: string[]
  spineEdgeIds: string[]
  entryNodes: string[]
  exitNodes: string[]
}

const ENTRY_SERVICE_TYPES = new Set([
  'client', 'load-balancer', 'gateway', 'browser',
])

const EXIT_SERVICE_TYPES = new Set([
  'database', 'cache', 'external-service', 'queue',
  'observability', 'storage',
])

export function detectMainSpine(nodes: Node[], edges: Edge[]): SpineResult {
  const nodeServiceTypes = new Map<string, string>()
  const nodeLabels = new Map<string, string>()

  for (const node of nodes) {
    const data = node.data as Record<string, unknown> || {}
    const serviceType = (data.serviceType as string) || 'service'
    nodeServiceTypes.set(node.id, serviceType)
    nodeLabels.set(node.id, (data.label as string) || node.id)
  }

  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
    adjacency.get(edge.source)!.push(edge.target)
  }

  const inDegree = new Map<string, number>()
  for (const [src, targets] of adjacency) {
    for (const tgt of targets) {
      inDegree.set(tgt, (inDegree.get(tgt) || 0) + 1)
    }
  }

  const entryNodes: string[] = []
  const exitNodes: string[] = []

  for (const node of nodes) {
    if (node.type === 'groupNode') continue
    const st = nodeServiceTypes.get(node.id) || 'service'

    if (ENTRY_SERVICE_TYPES.has(st)) {
      entryNodes.push(node.id)
    }
    if (EXIT_SERVICE_TYPES.has(st)) {
      exitNodes.push(node.id)
    }
  }

  if (entryNodes.length === 0) {
    for (const node of nodes) {
      if (node.type === 'groupNode') continue
      const deg = inDegree.get(node.id) || 0
      if (deg === 0 && adjacency.has(node.id) && adjacency.get(node.id)!.length > 0) {
        entryNodes.push(node.id)
      }
    }
  }

  if (exitNodes.length === 0) {
    for (const node of nodes) {
      if (node.type === 'groupNode') continue
      const out = adjacency.get(node.id)?.length || 0
      const inn = inDegree.get(node.id) || 0
      if (out === 0 && inn > 0) {
        exitNodes.push(node.id)
      }
    }
  }

  const nodeIdx = new Map<string, number>()
  const allNodes = nodes.filter(n => n.type !== 'groupNode')
  const spineNodeIds = new Set(allNodes.map(n => n.id))
  allNodes.forEach((n, i) => nodeIdx.set(n.id, i))

  /**
   * Longest *simple* path between two nodes (no repeated vertices).
   * Architecture diagrams often contain request/response cycles, so a DAG
   * longest-path pass would create cyclic `prev` links and hang forever.
   */
  function findLongestSimplePath(from: string, to: string): string[] {
    if (!spineNodeIds.has(from) || !spineNodeIds.has(to)) return []
    if (from === to) return [from]

    let best: string[] = []

    function dfs(current: string, path: string[], visited: Set<string>) {
      if (current === to) {
        if (path.length > best.length) best = [...path]
        return
      }
      // Simple paths cannot exceed the number of spine nodes.
      if (path.length >= spineNodeIds.size) return

      for (const next of adjacency.get(current) || []) {
        if (!spineNodeIds.has(next) || visited.has(next)) continue
        visited.add(next)
        path.push(next)
        dfs(next, path, visited)
        path.pop()
        visited.delete(next)
      }
    }

    dfs(from, [from], new Set([from]))
    return best
  }

  let bestPath: string[] = []
  for (const entry of entryNodes) {
    for (const exit of exitNodes) {
      const path = findLongestSimplePath(entry, exit)
      if (path.length > bestPath.length) {
        bestPath = path
      }
    }
  }

  if (bestPath.length === 0 && entryNodes.length > 0) {
    const entry = entryNodes[0]
    let longest: string[] = []

    function exploreFrom(start: string) {
      function dfs(current: string, path: string[], visited: Set<string>) {
        if (path.length > longest.length) longest = [...path]
        if (path.length >= spineNodeIds.size) return
        for (const next of adjacency.get(current) || []) {
          if (!spineNodeIds.has(next) || visited.has(next)) continue
          visited.add(next)
          path.push(next)
          dfs(next, path, visited)
          path.pop()
          visited.delete(next)
        }
      }
      dfs(start, [start], new Set([start]))
    }

    exploreFrom(entry)
    if (longest.length > bestPath.length) bestPath = longest
  }

  const spineNodeSet = new Set(bestPath)
  const spineEdgeIds: string[] = []

  for (let i = 0; i < bestPath.length - 1; i++) {
    const src = bestPath[i]
    const tgt = bestPath[i + 1]
    const matchingEdge = edges.find(e => e.source === src && e.target === tgt)
    if (matchingEdge) {
      spineEdgeIds.push(matchingEdge.id)
    }
  }

  return {
    spineNodeIds: bestPath,
    spineEdgeIds,
    entryNodes,
    exitNodes,
  }
}
