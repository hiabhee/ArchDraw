import * as dagre from 'dagre';
import type {
  LayoutParams,
  LayoutResult,
  LayoutDirection,
} from './LayoutEngine';
import { defaultCompoundLayoutOptions, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, estimateEdgeLabelSize } from './LayoutEngine';
import { SUBGRAPH_PADDING_X, SUBGRAPH_PADDING_TOP, SUBGRAPH_PADDING_BOTTOM } from './layoutConstants';
import logger from '@/lib/logger';

/**
 * Two-phase compound layout (audit item A4).
 *
 * A single global dagre pass ranks every group's children against the WHOLE
 * graph's edges, so a group whose members connect to far-apart ranks sprawls
 * (see docs/layout-toggler-learnings.md — "grp_client became very wide").
 *
 * Instead:
 *   Phase 1 — lay out each group's interior independently (recursively, so
 *             nested groups become boxes inside their parent's pass).
 *   Phase 2 — treat each settled group box as ONE macro-node in the enclosing
 *             level's dagre pass.
 *
 * Cross-group edges participate at every level: their endpoints are lifted to
 * the ancestor that lives at that level, which keeps connected groups adjacent
 * without stretching either of them.
 *
 * Returns null whenever the graph has no populated clusters (or anything goes
 * wrong) so the caller can fall back to the flat compound dagre path.
 */

interface LevelLayout {
  /** Absolute positions (top-left) for every node placed at/below this level. */
  positions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
}

function toDagreRankDir(direction: LayoutDirection): string {
  const map: Record<LayoutDirection, string> = { TB: 'TB', BT: 'BT', LR: 'LR', RL: 'RL' };
  return map[direction] ?? 'TB';
}

/** Same guard as the flat engine — a malformed parent chain must not recurse forever. */
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

interface CompoundContext {
  childrenByParent: Map<string, string[]>;
  parentOf: Map<string, string>;
  dimsById: Map<string, { width: number; height: number }>;
  edges: Array<{ source: string; target: string; label?: string }>;
  direction: LayoutDirection;
  nodeSep: number;
  rankSep: number;
  warnings: string[];
}

function layoutLevel(members: string[], ctx: CompoundContext): LevelLayout {
  const memberSet = new Set(members);

  // Phase 1 — settle each child group into a fixed box first.
  const macroIds = new Set<string>();
  const macroBoxes = new Map<string, LevelLayout>();
  for (const id of members) {
    const children = (ctx.childrenByParent.get(id) ?? []).filter(c => ctx.dimsById.has(c));
    if (children.length === 0) continue;
    const inner = layoutLevel(children, ctx);
    macroIds.add(id);
    macroBoxes.set(id, inner);
  }

  // Phase 2 — dagre over leaves + group-boxes.
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: toDagreRankDir(ctx.direction),
    nodesep: ctx.nodeSep,
    ranksep: ctx.rankSep,
    marginx: 0,
    marginy: 0,
  });

  // A settled group box reserves its tight child extent PLUS the frame padding
  // that recomputeSubgraphBounds will later draw around it, so the slot dagre
  // spaces here is the box that actually gets rendered (reserved == drawn).
  const dimsOf = (id: string) => {
    if (macroIds.has(id)) {
      const box = macroBoxes.get(id)!;
      return {
        width: Math.max(1, box.width) + SUBGRAPH_PADDING_X * 2,
        height: Math.max(1, box.height) + SUBGRAPH_PADDING_TOP + SUBGRAPH_PADDING_BOTTOM,
      };
    }
    return ctx.dimsById.get(id) ?? { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
  };
  for (const id of members) {
    const d = dimsOf(id);
    g.setNode(id, { width: d.width, height: d.height });
  }

  // Lift each edge's endpoints to whichever member of THIS level they belong
  // to (a leaf, or a group box). Edges fully inside one group are skipped —
  // the recursive pass already accounted for them.
  const resolveMember = (nodeId: string): string | null => {
    let current: string | undefined = nodeId;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
      seen.add(current);
      if (memberSet.has(current)) return current;
      current = ctx.parentOf.get(current);
    }
    return null;
  };

  const pairSize = new Map<string, { source: string; target: string; width: number; height: number }>();
  for (const edge of ctx.edges) {
    const source = resolveMember(edge.source);
    const target = resolveMember(edge.target);
    if (!source || !target || source === target) continue;
    const pairKey = `${source}\u0000${target}`;
    const size = estimateEdgeLabelSize(edge.label);
    const prev = pairSize.get(pairKey);
    if (prev) {
      prev.width = Math.max(prev.width, size.width);
      prev.height = Math.max(prev.height, size.height);
    } else {
      pairSize.set(pairKey, { source, target, width: size.width, height: size.height });
    }
  }
  for (const { source, target, width, height } of pairSize.values()) {
    g.setEdge(source, target, { width, height, labelpos: 'c', minlen: 1 });
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const place = (id: string, x: number, y: number, w: number, h: number) => {
    positions.set(id, { x, y });
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  };

  for (const id of members) {
    const node = g.node(id);
    if (!node) continue;
    const d = dimsOf(id);
    const x = (node.x as number) - d.width / 2;
    const y = (node.y as number) - d.height / 2;
    place(id, x, y, d.width, d.height);

    // Embed the settled interior inside the group box, inset by the same frame
    // padding baked into the box dims (dimsOf) above — this keeps children
    // aligned with the drawn frame and leaves the label-header gap at the top.
    // Inner positions are already normalized to start at (0,0).
    const inner = macroBoxes.get(id);
    if (inner) {
      for (const [childId, pos] of inner.positions) {
        if (memberSet.has(childId)) continue;
        positions.set(childId, {
          x: x + SUBGRAPH_PADDING_X + pos.x,
          y: y + SUBGRAPH_PADDING_TOP + pos.y,
        });
      }
    }
  }

  if (minX === Infinity) {
    // Degenerate level (nothing placed) — park members at the origin.
    for (const id of members) {
      const d = dimsOf(id);
      place(id, 0, 0, d.width, d.height);
    }
    minX = 0;
    minY = 0;
    maxX = Math.max(...members.map(id => dimsOf(id).width), 1);
    maxY = Math.max(...members.map(id => dimsOf(id).height), 1);
  }

  // Normalize so the level starts at (0,0) — the parent embeds it by adding
  // the group box's top-left corner.
  for (const [id, pos] of positions) {
    positions.set(id, { x: pos.x - minX, y: pos.y - minY });
  }

  return {
    positions,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/**
 * Two-phase layout entry. Returns null when the graph has no populated
 * clusters — callers should fall back to the flat compound engine.
 */
export function layoutCompoundTwoPhase(params: LayoutParams): LayoutResult | null {
  try {
    const groupIds = new Set(params.nodes.filter(n => n.isGroup).map(n => n.id));
    const dimsById = new Map<string, { width: number; height: number }>();
    const parentOf = new Map<string, string>();

    const warnings: string[] = [];
    for (const node of params.nodes) {
      dimsById.set(node.id, {
        width: node.width || DEFAULT_NODE_WIDTH,
        height: node.height || DEFAULT_NODE_HEIGHT,
      });
      if (node.parentId && groupIds.has(node.parentId) && node.parentId !== node.id) {
        if (!wouldCreateCycle(node.id, node.parentId, parentOf)) {
          parentOf.set(node.id, node.parentId);
        } else {
          warnings.push(`Cycle detected: node "${node.id}" parent "${node.parentId}" — removed parent reference`);
        }
      }
    }

    const childrenByParent = new Map<string, string[]>();
    for (const [child, parent] of parentOf) {
      const list = childrenByParent.get(parent);
      if (list) list.push(child);
      else childrenByParent.set(parent, [child]);
    }

    // No populated clusters → nothing for the two-phase pass to improve.
    const populatedClusters = Array.from(childrenByParent.keys())
      .filter(id => groupIds.has(id) && childrenByParent.get(id)!.length > 0);
    if (populatedClusters.length === 0) return null;

    // Guard against parent cycles among groups themselves.
    for (const groupId of populatedClusters) {
      const parent = parentOf.get(groupId);
      if (parent && wouldCreateCycle(groupId, parent, parentOf)) {
        warnings.push(`Cycle detected: group "${groupId}" parent "${parent}" — removed parent reference`);
        parentOf.delete(groupId);
      }
    }

    const defaults = defaultCompoundLayoutOptions(params.direction);
    const opts = { ...defaults, ...params.options };
    const roots = params.nodes
      .filter(n => !parentOf.has(n.id))
      .map(n => n.id);
    if (roots.length === 0) return null;

    const ctx: CompoundContext = {
      childrenByParent,
      parentOf,
      dimsById,
      edges: params.edges.map(e => ({ source: e.source, target: e.target, label: e.label })),
      direction: params.direction,
      // opts always carries these (spread from defaults); the fallback chain
      // only satisfies the optional type — no misleading hard-coded literal.
      nodeSep: opts.nodeSep ?? defaults.nodeSep ?? 140,
      rankSep: opts.rankSep ?? defaults.rankSep ?? 220,
      warnings,
    };

    const result = layoutLevel(roots, ctx);

    // Root offset: keeps absolute coordinates clear of (0,0) and gives the
    // diagram a small margin on the canvas.
    const ORIGIN_X = 60;
    const ORIGIN_Y = 60;
    for (const [id, pos] of result.positions) {
      result.positions.set(id, { x: pos.x + ORIGIN_X, y: pos.y + ORIGIN_Y });
    }

    const positionedNodes = params.nodes.map(node => {
      const pos = result.positions.get(node.id);
      const clearedParentId = parentOf.has(node.id) ? node.parentId : undefined;
      if (!pos) {
        return { ...node, parentId: clearedParentId, x: 0, y: 0 };
      }
      const d = dimsById.get(node.id)!;
      return {
        ...node,
        parentId: clearedParentId,
        x: pos.x,
        y: pos.y,
        width: d.width,
        height: d.height,
      };
    });

    return {
      nodes: positionedNodes,
      // Edge geometry is recomputed by the floating-edge renderer downstream;
      // the flat engine's points never survive IntegratedLayout anyway.
      edges: params.edges.map(edge => ({ ...edge, points: undefined })),
      warnings,
    };
  } catch (err) {
    // Two-phase is the primary path for grouped diagrams; a throw here would
    // silently switch every grouped diagram to the flat engine, so surface it.
    logger.warn('[two-phase compound layout] failed, falling back to flat engine', err);
    return null;
  }
}
