import * as dagre from 'dagre';
import type {
  LayoutEngine,
  LayoutParams,
  LayoutResult,
  PositionedNode,
  PositionedEdge,
  RankDirection,
  LayoutEdge,
} from './LayoutEngine';
import {
  aggregateLayoutEdges,
  defaultCompoundLayoutOptions,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  selectAcyclicLayoutEdges,
} from './LayoutEngine';
import { SUBGRAPH_PADDING_X, SUBGRAPH_PADDING_TOP, SUBGRAPH_PADDING_BOTTOM } from './layoutConstants';
import { layoutCompoundTwoPhase } from './CompoundLayout';
import logger from '@/lib/logger';

function toDagreRankDir(direction: RankDirection): string {
  const map: Record<RankDirection, string> = { TB: 'TB', BT: 'BT', LR: 'LR', RL: 'RL' };
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

    // Preferred path for graphs with populated groups (audit A4): each cluster
    // is laid out independently and embedded as one box, so a group's width is
    // driven by its own children instead of the whole graph's edge ranks.
    // Returns null for flat graphs / on any anomaly → flat compound dagre.
    const compound = layoutCompoundTwoPhase(params);
    if (compound) {
      logger.debug('[dagre] layout path: two-phase compound', { nodes: params.nodes.length });
      return compound;
    }
    logger.debug('[dagre] layout path: flat compound', { nodes: params.nodes.length });

    const defaults = defaultCompoundLayoutOptions(params.direction, {
      edgeCount: params.edges.length,
      nodeCount: params.nodes.length,
    });
    const opts = { ...defaults, ...params.options };
    // Ensure adaptive bump applies even when caller pre-merged defaults (via IntegratedLayout)
    // – reuse density helper if edgeCount > 6 and caller didn't supply a custom sep explicitly via raw params
    // The defaults already include the bump, so merging as {defaults,...options} preserves caller overrides.
    // If the caller passed no custom sep, opts already equals density-aware defaults.

    const g = new dagre.graphlib.Graph({ compound: true });
    g.setDefaultEdgeLabel(() => ({}));

    g.setGraph({
      rankdir: toDagreRankDir(params.direction),
      nodesep: opts.nodeSep,
      ranksep: opts.rankSep,
      marginx: opts.marginX,
      marginy: opts.marginY,
      // Symmetry-first: network-simplex gives minimal edge length + balanced ranks
      ranker: 'network-simplex',
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
            width: width + SUBGRAPH_PADDING_X * 2,
            height: height + SUBGRAPH_PADDING_TOP + SUBGRAPH_PADDING_BOTTOM,
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

    const layoutEdges: Array<LayoutEdge | null> = params.edges.map(edge => {
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

    const rankEdges = selectAcyclicLayoutEdges(
      aggregateLayoutEdges(layoutEdges.filter((edge): edge is LayoutEdge => edge !== null)),
      params.direction,
      params.nodes.map(node => node.id),
    );
    for (const edge of rankEdges) {
      // Dagre ranks from the highest-value acyclic flow. Feedback/support
      // links remain in `params.edges` and are still rendered after layout.
      g.setEdge(edge.source, edge.target, {
        width: edge.width,
        height: edge.height,
        weight: edge.weight,
        minlen: 1,
        labelpos: 'c',
      });
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

    // Overlap-nudge pass removed: it pushed overlapping nodes on both axes at
    // once (shoving perfectly rank-aligned pairs sideways), was single-pass,
    // and could move a group frame without its children. Real overlaps came
    // from under-reserved node dimensions, which the shared layoutConstants
    // now prevent. Dagre's own spacing is trusted here; group bounds are
    // recomputed afterwards by the SizeStage / recomputeSubgraphBounds pass.

    // Auto-straighten: Dagre can leave 1-7px deltas between horizontally
    // adjacent nodes (e.g. y=100 vs 102.3). That shows as a diagonal slit
    // above the grid line and only snaps to 0° after a click/drag re-render.
    // Snap near-horizontal / near-vertical edges to perfect straight so the
    // initial load is already 0°/90° without user interaction.
    {
      const STRAIGHT_THRESHOLD = 12;
      const isHorizontalLayout = params.direction === 'LR' || params.direction === 'RL';
      // Sort edges by smallest delta first so the most aligned pair wins when
      // a node is target of multiple edges.
      const edgesByDelta = [...params.edges]
        .map((e) => {
          const src = positionedNodes.find((n) => n.id === e.source);
          const tgt = positionedNodes.find((n) => n.id === e.target);
          if (!src || !tgt) return { e, d: Infinity };
          const srcCX = src.x + (src.width || DEFAULT_NODE_WIDTH) / 2;
          const srcCY = src.y + (src.height || DEFAULT_NODE_HEIGHT) / 2;
          const tgtCX = tgt.x + (tgt.width || DEFAULT_NODE_WIDTH) / 2;
          const tgtCY = tgt.y + (tgt.height || DEFAULT_NODE_HEIGHT) / 2;
          const dx = tgtCX - srcCX;
          const dy = tgtCY - srcCY;
          const d = isHorizontalLayout ? Math.abs(dy) : Math.abs(dx);
          return { e, d, dx, dy, src, tgt };
        })
        .filter((x) => x.d < STRAIGHT_THRESHOLD && x.d > 0.01)
        .sort((a, b) => a.d - b.d);

      const moved = new Set<string>();
      for (const { dx, dy, src, tgt } of edgesByDelta as Array<{ e: LayoutEdge; d: number; dx: number; dy: number; src: PositionedNode; tgt: PositionedNode }>) {
        if (!src || !tgt) continue;
        if (src.isGroup || tgt.isGroup) continue;
        // Keep group-contained nodes inside their own lane — don't straighten
        // cross-group edges (e.g. Core -> Support side-lane) or top-level vs
        // grouped mixes, otherwise the side-lane test breaks.
        if (src.parentId !== tgt.parentId) continue;
        // Only straighten edges that are primarily along the layout axis
        const isHorizontalEdge = Math.abs(dx!) > Math.abs(dy!);
        if (isHorizontalLayout && !isHorizontalEdge) continue;
        if (!isHorizontalLayout && isHorizontalEdge) continue;

        // For LR/RL, align target's centerY to source's centerY; for TB/BT align centerX
        if (isHorizontalLayout) {
          if (moved.has(tgt.id)) continue; // keep first (smallest delta) winner
          const desiredTgtY = (src.y + (src.height || DEFAULT_NODE_HEIGHT) / 2) - (tgt.height || DEFAULT_NODE_HEIGHT) / 2;
          // Avoid creating overlap with existing nodes at that Y - only move small delta
          if (Math.abs(desiredTgtY - tgt.y) < STRAIGHT_THRESHOLD) {
            tgt.y = desiredTgtY;
            moved.add(tgt.id);
          }
        } else {
          if (moved.has(tgt.id)) continue;
          const desiredTgtX = (src.x + (src.width || DEFAULT_NODE_WIDTH) / 2) - (tgt.width || DEFAULT_NODE_WIDTH) / 2;
          if (Math.abs(desiredTgtX - tgt.x) < STRAIGHT_THRESHOLD) {
            tgt.x = desiredTgtX;
            moved.add(tgt.id);
          }
        }
      }
    }

    const positionedEdges: PositionedEdge[] = params.edges
      .map((edge, index) => {
        const layoutEdge = layoutEdges[index];
        if (!layoutEdge) {
          return { ...edge, points: undefined };
        }
        const dagreEdge = g.edge(layoutEdge.source, layoutEdge.target);
        return {
          ...edge,
          points: dagreEdge?.points?.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
        };
      })
      .filter((e): e is PositionedEdge => e !== null);

    return { nodes: positionedNodes, edges: positionedEdges, warnings };
  }

  async layout(params: LayoutParams): Promise<LayoutResult> {
    return this.layoutSync(params);
  }
}
