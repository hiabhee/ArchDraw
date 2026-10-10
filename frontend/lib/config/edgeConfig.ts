export type NodeCategory = 'client' | 'edge' | 'compute' | 'async' | 'data' | 'observe' | 'external';

export function isValidConnection(
  sourceCategory: string | undefined,
  targetCategory: string | undefined,
  _connectionType: string = 'sync'
): boolean {
  return true;
}

export function wouldCreateCycle(
  edges: { source: string; target: string }[],
  newConnection: { source: string; target: string }
): boolean {
  const graph = new Map<string, Set<string>>();

  edges.forEach(edge => {
    if (!graph.has(edge.source)) {
      graph.set(edge.source, new Set());
    }
    graph.get(edge.source)!.add(edge.target);
  });

  if (!graph.has(newConnection.source)) {
    graph.set(newConnection.source, new Set());
  }
  graph.get(newConnection.source)!.add(newConnection.target);

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  return hasCycle(newConnection.source);
}