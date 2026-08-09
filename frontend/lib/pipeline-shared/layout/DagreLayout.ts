import * as dagre from 'dagre';
import type {
  LayoutEngine,
  LayoutParams,
  LayoutResult,
  PositionedNode,
  PositionedEdge,
  LayoutDirection,
} from './LayoutEngine';
import { defaultCompoundLayoutOptions, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './LayoutEngine';

function toDagreRankDir(direction: LayoutDirection): string {
  const map: Record<LayoutDirection, string> = { TB: 'TB', BT: 'BT', LR: 'LR', RL: 'RL' };
  return map[direction] ?? 'TB';
}

function wouldCreateCycle(childId: string, parentId: string, parentMap: Map<string, string>): boolean {
  if (childId === parentId) return true;
  let current = parentId;
  const visited = new Set<string>([childId, parentId]);
  while (parentMap.has(current)) {
    const next = parentMap.get(current)!;
    if (visited.has(next)) return true;
    visited.add(next);
    current = next;
  }
  return false;
}

export class DagreLayoutEngine implements LayoutEngine {
  readonly name = 'dagre';

  isAvailable(): boolean {
    return typeof dagre === 'object' && dagre !== null;
  }

  /** Sync entry point — dagre is synchronous; prefer this from sync call sites. */
  layoutSync(params: LayoutParams): LayoutResult {
    const warnings: string[] = [];
    const defaults = defaultCompoundLayoutOptions(params.direction);
    const opts = { ...defaults, ...params.options };

    const g = new dagre.graphlib.Graph({ compound: true });
    g.setDefaultEdgeLabel(() => ({}));

    g.setGraph({
      rankdir: toDagreRankDir(params.direction),
      nodesep: opts.nodeSep,
      ranksep: opts.rankSep,
      marginx: opts.marginX,
      marginy: opts.marginY,
    });

    const subgraphIds = new Set(params.nodes.filter(n => n.isGroup).map(n => n.id));

    const parentMap = new Map<string, string>();
    const cycledNodes = new Set<string>();
    for (const node of params.nodes) {
      if (node.parentId && subgraphIds.has(node.parentId)) {
        if (!wouldCreateCycle(node.id, node.parentId, parentMap)) {
          parentMap.set(node.id, node.parentId);
        } else {
          warnings.push(`Cycle detected: node "${node.id}" parent "${node.parentId}" — removed parent reference`);
          cycledNodes.add(node.id);
        }
      }
    }

    for (const node of params.nodes) {
      const isSubgraph = subgraphIds.has(node.id);
      const width = node.width || DEFAULT_NODE_WIDTH;
      const height = node.height || DEFAULT_NODE_HEIGHT;

      if (isSubgraph) {
        const hasChildren = params.nodes.some(n => parentMap.get(n.id) === node.id);
        if (hasChildren) {
          g.setNode(node.id, {
            paddingLeft: opts.paddingLeft,
            paddingRight: opts.paddingRight,
            paddingTop: opts.paddingTop,
            paddingBottom: opts.paddingBottom,
          });
        } else {
          g.setNode(node.id, {
            width: width + (opts.paddingLeft ?? 40) * 2,
            height: height + (opts.paddingTop ?? 64) + (opts.paddingBottom ?? 40),
          });
        }
      } else {
        g.setNode(node.id, { width, height });
      }

      const resolvedParentId = cycledNodes.has(node.id) ? undefined : parentMap.get(node.id);
      if (resolvedParentId && subgraphIds.has(resolvedParentId)) {
        g.setParent(node.id, resolvedParentId);
      }
    }

    // dagre compound layout does not support edges whose source or target is a
    // cluster (subgraph) node — it crashes with `Cannot set properties of
    // undefined (setting 'rank')`. Reroute such edges onto a representative
    // descendant leaf node so the graph lays out, then restore the original
    // endpoints when mapping points back. A leaf that is reachable through the
    // nearest subgraph ancestor acts as its proxy; deeper leaves are preferred.
    const subgraphIdSet = new Set(subgraphIds);
    const proxyFor = new Map<string, string>();
    for (const node of params.nodes) {
      if (subgraphIdSet.has(node.id)) continue;
      let current = parentMap.get(node.id);
      while (current && subgraphIdSet.has(current)) {
        if (!proxyFor.has(current)) proxyFor.set(current, node.id);
        current = parentMap.get(current);
      }
    }

    // A subgraph only becomes a real dagre cluster once a node is nested in it
    // via `g.setParent`. An empty subgraph has no children, so dagre treats it
    // as an ordinary node and its edges lay out normally — only clusters with
    // members need the proxy reroute above.
    const clusterIds = new Set<string>();
    for (const childId of parentMap.keys()) {
      const parentId = parentMap.get(childId)!;
      if (subgraphIds.has(parentId)) clusterIds.add(parentId);
    }

    const layoutEdges = params.edges.map(edge => {
      const source = proxyFor.get(edge.source) ?? edge.source;
      const target = proxyFor.get(edge.target) ?? edge.target;
      // If either endpoint still resolves to a real cluster (a subgraph that
      // actually contains children), drop the edge from the layout pass — it
      // cannot be placed by dagre. Edges to empty subgraphs are kept so the
      // group is laid out inside the flow rather than stranded at rank 0.
      if (clusterIds.has(source) || clusterIds.has(target)) {
        return null;
      }
      return { ...edge, source, target };
    });

    for (const edge of layoutEdges) {
      if (!edge) continue;
      g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    const positionedNodes: PositionedNode[] = params.nodes.map(node => {
      const dagreNode = g.node(node.id);
      const clearedParentId = cycledNodes.has(node.id) ? undefined : node.parentId;

      if (!dagreNode) {
        warnings.push(`Node "${node.id}" not positioned by dagre`);
        return { ...node, parentId: clearedParentId, x: 0, y: 0 };
      }

      const width = dagreNode.width || node.width || DEFAULT_NODE_WIDTH;
      const height = dagreNode.height || node.height || DEFAULT_NODE_HEIGHT;
      return {
        ...node,
        parentId: clearedParentId,
        x: dagreNode.x - width / 2,
        y: dagreNode.y - height / 2,
        width,
        height,
      };
    });

    const minSpacing = 30;
    const connectedNodeSpacing = 50;
    const connectedPairs = new Set<string>();
    params.edges.forEach(edge => {
      connectedPairs.add([edge.source, edge.target].sort().join('-'));
    });

    for (let i = 0; i < positionedNodes.length; i++) {
      for (let j = i + 1; j < positionedNodes.length; j++) {
        const nodeA = positionedNodes[i];
        const nodeB = positionedNodes[j];
        if (nodeA.parentId !== nodeB.parentId) continue;

        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const pairKey = [nodeA.id, nodeB.id].sort().join('-');
        const spacing = connectedPairs.has(pairKey) ? connectedNodeSpacing : minSpacing;
        const minDistance = (nodeA.width + nodeB.width) / 2 + spacing;

        if (distance < minDistance && distance > 0) {
          const overlap = minDistance - distance;
          const pushX = (dx / distance) * overlap * 0.5;
          const pushY = (dy / distance) * overlap * 0.5;
          positionedNodes[j] = { ...nodeB, x: nodeB.x + pushX, y: nodeB.y + pushY };
          positionedNodes[i] = { ...nodeA, x: nodeA.x - pushX, y: nodeA.y - pushY };
        }
      }
    }

    const positionedEdges: PositionedEdge[] = params.edges.map((edge, index) => {
      const layoutEdge = layoutEdges[index];
      if (!layoutEdge) {
        return { ...edge, points: undefined };
      }
      const dagreEdge = g.edge(layoutEdge.source, layoutEdge.target);
      return {
        ...edge,
        points: dagreEdge?.points?.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
      };
    });

    return { nodes: positionedNodes, edges: positionedEdges, warnings };
  }

  async layout(params: LayoutParams): Promise<LayoutResult> {
    return this.layoutSync(params);
  }
}
