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
  allNodes.forEach((n, i) => nodeIdx.set(n.id, i))

  function findLongestPath(from: string, to: string): string[] {
    const dist = new Map<string, number>()
    const prev = new Map<string, string | null>()
    const topoOrder: string[] = []

    const visited = new Set<string>()
    function dfs(v: string) {
      if (visited.has(v)) return
      visited.add(v)
      const neighbors = adjacency.get(v) || []
      for (const w of neighbors) {
        if (allNodes.some(n => n.id === w)) {
          dfs(w)
        }
      }
      topoOrder.push(v)
    }

    if (!visited.has(from)) dfs(from)

    for (const node of allNodes) {
      if (!visited.has(node.id)) dfs(node.id)
    }

    topoOrder.reverse()

    for (const v of topoOrder) {
      dist.set(v, v === from ? 0 : -Infinity)
      prev.set(v, null)
    }

    for (const v of topoOrder) {
      if (dist.get(v) === -Infinity) continue
      const neighbors = adjacency.get(v) || []
      for (const w of neighbors) {
        if (!dist.has(w)) continue
        const nd = dist.get(v)! + 1
        if (nd > (dist.get(w) || -Infinity)) {
          dist.set(w, nd)
          prev.set(w, v)
        }
      }
    }

    const path: string[] = []
    let current: string | null = dist.has(to) ? to : null
    if (current && dist.get(current)! > -Infinity) {
      while (current && prev.has(current)) {
        path.unshift(current)
        current = prev.get(current) || null
      }
      if (path[0] === from || current === from) {
        if (current) path.unshift(current)
      }
    }

    return path
  }

  let bestPath: string[] = []
  for (const entry of entryNodes) {
    for (const exit of exitNodes) {
      const path = findLongestPath(entry, exit)
      if (path.length > bestPath.length) {
        bestPath = path
      }
    }
  }

  if (bestPath.length === 0 && entryNodes.length > 0) {
    const entry = entryNodes[0]
    const visited = new Set<string>()
    const longest: string[] = []
    function dfsBFS(start: string) {
      const queue: string[][] = [[start]]
      while (queue.length > 0) {
        const p = queue.shift()!
        const last = p[p.length - 1]
        if (p.length > longest.length) longest.push(...p.slice(longest.length))
        const neighbors = adjacency.get(last) || []
        for (const w of neighbors) {
          if (!visited.has(w)) {
            visited.add(w)
            queue.push([...p, w])
          }
        }
      }
    }
    visited.add(entry)
    dfsBFS(entry)
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
