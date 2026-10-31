import * as dagre from 'dagre';
import type {
  LayoutEdge,
  LayoutParams,
  LayoutResult,
  RankDirection,
} from './LayoutEngine';
import {
  aggregateLayoutEdges,
  defaultCompoundLayoutOptions,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  getLayoutEdgeWeight,
  isCoreServiceType,
  isInfrastructureServiceType,
  selectAcyclicLayoutEdges,
} from './LayoutEngine';
import {
  SUBGRAPH_PADDING_X,
  SUBGRAPH_PADDING_TOP,
  SUBGRAPH_PADDING_BOTTOM,
  SUBGRAPH_CONTENT_RANK_SEP,
} from './layoutConstants';
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

function toDagreRankDir(direction: RankDirection): string {
  const map: Record<RankDirection, string> = { TB: 'TB', BT: 'BT', LR: 'LR', RL: 'RL' };
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
  serviceTypeById: Map<string, string | undefined>;
  edges: LayoutEdge[];
  direction: RankDirection;
  directionByGroup: Map<string, RankDirection>;
  nodeSep: number;
  rankSep: number;
  warnings: string[];
  globalEdgeDensity?: number;
}

interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Move a root and all of its descendants together in the absolute coordinate
 * map emitted by the two-phase layout. Sizing converts those absolute child
 * positions back to parent-relative coordinates later in the pipeline.
 */
function moveLayoutSubtree(
  rootId: string,
  delta: { x: number; y: number },
  positions: Map<string, { x: number; y: number }>,
  parentOf: Map<string, string>,
): void {
  for (const [id, position] of positions) {
    let current: string | undefined = id;
    const seen = new Set<string>();
    let belongsToRoot = false;
    while (current && !seen.has(current)) {
      seen.add(current);
      if (current === rootId) {
        belongsToRoot = true;
        break;
      }
      current = parentOf.get(current);
    }
    if (belongsToRoot) {
      positions.set(id, { x: position.x + delta.x, y: position.y + delta.y });
    }
  }
}

function descendantsOf(rootId: string, parentOf: Map<string, string>): Set<string> {
  const descendants = new Set<string>([rootId]);
  for (const id of parentOf.keys()) {
    let current: string | undefined = id;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
      seen.add(current);
      if (current === rootId) {
        descendants.add(id);
        break;
      }
      current = parentOf.get(current);
    }
  }
  return descendants;
}

/**
 * Returns a rendered-size approximation for a group from the absolute child
 * positions. The +padding terms mirror `recomputeSubgraphBounds`, so the
 * placement pass reasons about the box users actually see rather than the
 * small placeholder dimensions present before sizing.
 */
function groupRect(
  groupId: string,
  positions: Map<string, { x: number; y: number }>,
  parentOf: Map<string, string>,
  dimsById: Map<string, { width: number; height: number }>,
): LayoutRect {
  const origin = positions.get(groupId) ?? { x: 0, y: 0 };
  const descendants = descendantsOf(groupId, parentOf);
  let maxX = origin.x;
  let maxY = origin.y;
  for (const id of descendants) {
    if (id === groupId) continue;
    const position = positions.get(id);
    const dims = dimsById.get(id);
    if (!position || !dims) continue;
    maxX = Math.max(maxX, position.x + dims.width);
    maxY = Math.max(maxY, position.y + dims.height);
  }

  return {
    x: origin.x,
    y: origin.y,
    width: Math.max(dimsById.get(groupId)?.width ?? 1, maxX - origin.x + SUBGRAPH_PADDING_X),
    height: Math.max(dimsById.get(groupId)?.height ?? 1, maxY - origin.y + SUBGRAPH_PADDING_BOTTOM),
  };
}

function rootRect(
  rootId: string,
  groupIds: Set<string>,
  positions: Map<string, { x: number; y: number }>,
  parentOf: Map<string, string>,
  dimsById: Map<string, { width: number; height: number }>,
): LayoutRect {
  if (groupIds.has(rootId)) {
    return groupRect(rootId, positions, parentOf, dimsById);
  }
  const position = positions.get(rootId) ?? { x: 0, y: 0 };
  const dims = dimsById.get(rootId) ?? { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
  return { x: position.x, y: position.y, width: dims.width, height: dims.height };
}

function rectsOverlap(a: LayoutRect, b: LayoutRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Place narrow, multi-connection groups beside the main flow instead of
 * forcing them into the same left-to-right rank as a wide group.
 *
 * A compound graph lays out a populated group as one macro-node. That is
 * correct for ranking, but it can be visually poor when several leaf edges
 * attach to the middle of a wide group: the real leaf-to-leaf routes then
 * become enormous top/bottom trunks. Sidecar placement preserves the macro
 * ranking while moving those support groups to an orthogonal lane where their
 * actual attachment points stay close to the main flow.
 */
function placeSidecarGroups(
  positions: Map<string, { x: number; y: number }>,
  params: LayoutParams,
  parentOf: Map<string, string>,
  childrenByParent: Map<string, string[]>,
  dimsById: Map<string, { width: number; height: number }>,
  rankSep: number,
): void {
  const groupIds = new Set(params.nodes.filter(node => node.isGroup).map(node => node.id));
  const rootIds = params.nodes.filter(node => !parentOf.has(node.id)).map(node => node.id);
  const rootGroupIds = rootIds.filter(id => groupIds.has(id) && (childrenByParent.get(id)?.length ?? 0) > 0);
  if (rootGroupIds.length < 2) return;

  const descendantSets = new Map(rootGroupIds.map(id => [id, descendantsOf(id, parentOf)]));
  const nodeById = new Map(params.nodes.map(node => [node.id, node]));
  const groupRole = (id: string): 'core' | 'support' | 'unknown' => {
    const leafIds = [...(descendantSets.get(id) ?? [])]
      .filter(descendantId => descendantId !== id && !groupIds.has(descendantId));
    const leafNodes = leafIds.map(leafId => nodeById.get(leafId)).filter(Boolean);
    const serviceTypes = leafNodes.map(node => node!.serviceType);
    if (serviceTypes.some(isCoreServiceType)) return 'core';
    if (
      serviceTypes.length > 0 &&
      serviceTypes.every(type => type && isInfrastructureServiceType(type))
    ) return 'support';

    const label = `${nodeById.get(id)?.label ?? ''} ${id}`.toLowerCase();
    if (/\b(client|gateway|ingress|edge|service|services|core|compute|api|backend)\b/.test(label)) {
      return 'core';
    }
    if (/\b(data|database|external|support|infra|infrastructure|storage|messaging|events|observability|cache|queue)\b/.test(label)) {
      return 'support';
    }
    return 'unknown';
  };
  const rootEdgeDegree = (id: string) => params.edges.reduce((degree, edge) => {
    const sourceIn = descendantSets.get(id)?.has(edge.source);
    const targetIn = descendantSets.get(id)?.has(edge.target);
    return sourceIn || targetIn ? degree + getLayoutEdgeWeight(edge) : degree;
  }, 0);
  const mainGroupId = [...rootGroupIds].sort((a, b) => {
    const roleDiff = Number(groupRole(b) === 'core') - Number(groupRole(a) === 'core');
    if (roleDiff !== 0) return roleDiff;
    // Use graph centrality first. The largest group is frequently a data or
    // observability group and should not automatically become the visual spine.
    const degreeDiff = rootEdgeDegree(b) - rootEdgeDegree(a);
    if (degreeDiff !== 0) return degreeDiff;
    const countDiff = (descendantSets.get(b)?.size ?? 0) - (descendantSets.get(a)?.size ?? 0);
    if (countDiff !== 0) return countDiff;
    const aRect = groupRect(a, positions, parentOf, dimsById);
    const bRect = groupRect(b, positions, parentOf, dimsById);
    return bRect.width * bRect.height - aRect.width * aRect.height;
  })[0];
  const mainDescendants = descendantSets.get(mainGroupId);
  if (!mainDescendants) return;

  const candidates = rootGroupIds
    .filter(id => id !== mainGroupId)
    .map(id => {
      const candidateDescendants = descendantSets.get(id)!;
      const crossEdges = params.edges.filter(edge => {
        const sourceInMain = mainDescendants.has(edge.source);
        const targetInMain = mainDescendants.has(edge.target);
        const sourceInCandidate = candidateDescendants.has(edge.source);
        const targetInCandidate = candidateDescendants.has(edge.target);
        return (sourceInMain && targetInCandidate) || (targetInMain && sourceInCandidate);
      });
      return { id, candidateDescendants, crossEdges };
    })
    // A single attachment is usually an entry/exit group. Reposition only
    // multi-connection sidecars, where the long-trunk problem is measurable.
    // A group that only feeds the main group (data sources, upstream APIs)
    // is part of the flow: it stays upstream, where its edges run along it.
    .filter(candidate =>
      groupRole(candidate.id) !== 'core' &&
      candidate.crossEdges.length >= 2 &&
      !candidate.crossEdges.every(edge => candidate.candidateDescendants.has(edge.source)));
  if (candidates.length === 0) return;

  const horizontalFlow = params.direction === 'LR' || params.direction === 'RL';
  const mainRect = () => groupRect(mainGroupId, positions, parentOf, dimsById);

  for (const candidate of candidates) {
    const candidateRect = groupRect(candidate.id, positions, parentOf, dimsById);
    const main = mainRect();
    const attachmentPoints = candidate.crossEdges.flatMap(edge => {
      const mainId = mainDescendants.has(edge.source) ? edge.source : edge.target;
      const position = positions.get(mainId);
      const dims = dimsById.get(mainId);
      if (!position || !dims) return [];
      return [{
        x: position.x + dims.width / 2,
        y: position.y + dims.height / 2,
        weight: getLayoutEdgeWeight(edge),
      }];
    });
    if (attachmentPoints.length === 0) continue;

    const totalWeight = attachmentPoints.reduce((sum, point) => sum + point.weight, 0);
    const anchor = attachmentPoints.reduce(
      (sum, point) => ({
        x: sum.x + point.x * point.weight / totalWeight,
        y: sum.y + point.y * point.weight / totalWeight,
      }),
      { x: 0, y: 0 },
    );
    const preferred = horizontalFlow
      ? { x: anchor.x - candidateRect.width / 2, y: main.y - candidateRect.height - rankSep }
      : { x: main.x - candidateRect.width - rankSep, y: anchor.y - candidateRect.height / 2 };
    const alternate = horizontalFlow
      ? { x: anchor.x - candidateRect.width / 2, y: main.y + main.height + rankSep }
      : { x: main.x + main.width + rankSep, y: anchor.y - candidateRect.height / 2 };

    const occupiedRoots = rootIds
      .filter(id => id !== candidate.id)
      .map(id => rootRect(id, groupIds, positions, parentOf, dimsById));
    const canPlace = (origin: { x: number; y: number }) => {
      const proposed = { ...candidateRect, x: origin.x, y: origin.y };
      return !occupiedRoots.some(rect => rectsOverlap(proposed, rect));
    };
    const destination = canPlace(preferred) ? preferred : canPlace(alternate) ? alternate : undefined;
    if (!destination) continue;

    moveLayoutSubtree(
      candidate.id,
      { x: destination.x - candidateRect.x, y: destination.y - candidateRect.y },
      positions,
      parentOf,
    );
  }
}

/**
 * Each group is laid out on its own, blind to where its outside neighbours
 * end up, so independent members (e.g. an "External" column of data sources)
 * can be stacked against the order of what they connect to and their edges
 * cross. Re-order members that share a lane and have no edges among their
 * siblings by the mean cross-axis position of their outside neighbours
 * (barycenter), keeping the lane's slot centers.
 */
function orderUnlinkedSiblingsByNeighbours(
  positions: Map<string, { x: number; y: number }>,
  params: LayoutParams,
  childrenByParent: Map<string, string[]>,
  dimsById: Map<string, { width: number; height: number }>,
): void {
  const horizontalFlow = params.direction === 'LR' || params.direction === 'RL';
  const groupIds = new Set(params.nodes.filter(node => node.isGroup).map(node => node.id));
  const center = (id: string) => {
    const position = positions.get(id);
    const dims = dimsById.get(id);
    if (!position || !dims) return undefined;
    return { x: position.x + dims.width / 2, y: position.y + dims.height / 2 };
  };
  const neighbours = new Map<string, string[]>();
  for (const edge of params.edges) {
    if (edge.source === edge.target) continue;
    neighbours.set(edge.source, [...(neighbours.get(edge.source) ?? []), edge.target]);
    neighbours.set(edge.target, [...(neighbours.get(edge.target) ?? []), edge.source]);
  }

  for (const [, children] of childrenByParent) {
    const siblings = new Set(children);
    const loose = children.filter(id =>
      !groupIds.has(id) &&
      positions.has(id) &&
      !(neighbours.get(id) ?? []).some(other => siblings.has(other)));
    // Lanes: members in the same rank (same column for LR, row for TD).
    const lanes = new Map<number, string[]>();
    for (const id of loose) {
      const c = center(id)!;
      const key = Math.round(horizontalFlow ? c.x : c.y);
      lanes.set(key, [...(lanes.get(key) ?? []), id]);
    }
    for (const lane of lanes.values()) {
      if (lane.length < 2) continue;
      const barycenter = new Map<string, number>();
      for (const id of lane) {
        const points = (neighbours.get(id) ?? []).map(center).filter(Boolean) as Array<{ x: number; y: number }>;
        if (points.length === 0) break;
        barycenter.set(id, points.reduce((sum, p) => sum + (horizontalFlow ? p.y : p.x), 0) / points.length);
      }
      if (barycenter.size !== lane.length) continue;
      const slots = lane.map(id => (horizontalFlow ? center(id)!.y : center(id)!.x)).sort((a, b) => a - b);
      const ordered = [...lane].sort((a, b) => barycenter.get(a)! - barycenter.get(b)! || a.localeCompare(b));
      ordered.forEach((id, index) => {
        const position = positions.get(id)!;
        const dims = dimsById.get(id)!;
        positions.set(id, horizontalFlow
          ? { x: position.x, y: slots[index] - dims.height / 2 }
          : { x: slots[index] - dims.width / 2, y: position.y });
      });
    }
  }
}

/**
 * Each group is laid out on its own, so two nodes joined by an edge that
 * crosses a group boundary (a service and the external API it calls) land at
 * slightly different cross-axis heights and the edge is drawn off-level.
 * Nudge one endpoint so their centers line up, when that keeps it inside its
 * group's current frame and clear of its neighbours. Offsets beyond
 * MAX_CROSS_GROUP_ALIGN are deliberate lanes and are left alone; a node that is
 * already level with another cross-group neighbour is never moved.
 */
const MAX_CROSS_GROUP_ALIGN = 140;
const ALIGN_CLEARANCE = 16;

function alignCrossGroupEdges(
  positions: Map<string, { x: number; y: number }>,
  params: LayoutParams,
  parentOf: Map<string, string>,
  dimsById: Map<string, { width: number; height: number }>,
): void {
  const horizontalFlow = params.direction === 'LR' || params.direction === 'RL';
  const groupIds = new Set(params.nodes.filter(node => node.isGroup).map(node => node.id));
  const size = (id: string) => dimsById.get(id)!;
  const center = (id: string) => {
    const position = positions.get(id)!;
    const dims = size(id);
    return horizontalFlow ? position.y + dims.height / 2 : position.x + dims.width / 2;
  };
  const crossing = params.edges.filter(edge =>
    edge.source !== edge.target &&
    !groupIds.has(edge.source) && !groupIds.has(edge.target) &&
    positions.has(edge.source) && positions.has(edge.target) &&
    parentOf.get(edge.source) !== parentOf.get(edge.target));

  const level = new Set<string>();
  for (const edge of crossing) {
    if (Math.abs(center(edge.source) - center(edge.target)) < 0.5) {
      level.add(edge.source);
      level.add(edge.target);
    }
  }

  const moved = new Set<string>();
  const fits = (id: string, delta: number): boolean => {
    if (level.has(id) || moved.has(id)) return false;
    const position = positions.get(id)!;
    const dims = size(id);
    const next = horizontalFlow ? { x: position.x, y: position.y + delta } : { x: position.x + delta, y: position.y };
    const rect = { x: next.x, y: next.y, width: dims.width, height: dims.height };
    const parentId = parentOf.get(id);
    if (parentId) {
      const frame = groupRect(parentId, positions, parentOf, dimsById);
      const top = horizontalFlow ? frame.y + SUBGRAPH_PADDING_TOP : frame.y + SUBGRAPH_PADDING_X;
      const bottom = horizontalFlow ? frame.y + frame.height - SUBGRAPH_PADDING_BOTTOM : frame.x + frame.width - SUBGRAPH_PADDING_X;
      const low = horizontalFlow ? rect.y : rect.x;
      const high = low + (horizontalFlow ? rect.height : rect.width);
      if (low < top || high > bottom) return false;
    }
    for (const other of positions.keys()) {
      if (other === id || other === parentId || parentOf.get(other) !== parentId) continue;
      const otherRect = rootRect(other, groupIds, positions, parentOf, dimsById);
      if (rectsOverlap(
        { x: rect.x - ALIGN_CLEARANCE, y: rect.y - ALIGN_CLEARANCE, width: rect.width + 2 * ALIGN_CLEARANCE, height: rect.height + 2 * ALIGN_CLEARANCE },
        otherRect,
      )) return false;
    }
    return true;
  };
  const shift = (id: string, delta: number) => {
    const position = positions.get(id)!;
    positions.set(id, horizontalFlow ? { x: position.x, y: position.y + delta } : { x: position.x + delta, y: position.y });
    moved.add(id);
  };

  for (const edge of crossing) {
    const delta = center(edge.source) - center(edge.target);
    if (Math.abs(delta) < 0.5 || Math.abs(delta) > MAX_CROSS_GROUP_ALIGN) continue;
    if (fits(edge.target, delta)) shift(edge.target, delta);
    else if (fits(edge.source, -delta)) shift(edge.source, -delta);
  }
}

/** Move standalone infrastructure next to the core group that consumes it. */
function placeRootInfrastructureNodes(
  positions: Map<string, { x: number; y: number }>,
  params: LayoutParams,
  parentOf: Map<string, string>,
  dimsById: Map<string, { width: number; height: number }>,
  gap: number,
): void {
  const groupIds = new Set(params.nodes.filter(node => node.isGroup).map(node => node.id));
  const rootIds = params.nodes.filter(node => !parentOf.has(node.id)).map(node => node.id);
  const nodeById = new Map(params.nodes.map(node => [node.id, node]));
  const supportNodes = params.nodes.filter(node =>
    !groupIds.has(node.id) && !parentOf.has(node.id) && isInfrastructureServiceType(node.serviceType),
  );

  const rootAncestor = (nodeId: string): string => {
    let current = nodeId;
    const visited = new Set<string>();
    while (parentOf.has(current) && !visited.has(current)) {
      visited.add(current);
      current = parentOf.get(current)!;
    }
    return current;
  };

  for (const supportNode of supportNodes) {
    const connections = params.edges.flatMap(edge => {
      const otherId = edge.source === supportNode.id ? edge.target
        : edge.target === supportNode.id ? edge.source
        : undefined;
      const other = otherId ? nodeById.get(otherId) : undefined;
      if (!otherId || !other || isInfrastructureServiceType(other.serviceType)) return [];
      return [{ id: otherId, rootId: rootAncestor(otherId), weight: Math.max(1, getLayoutEdgeWeight(edge)) }];
    });
    if (connections.length === 0) continue;

    const ownerWeights = new Map<string, number>();
    for (const connection of connections) {
      ownerWeights.set(connection.rootId, (ownerWeights.get(connection.rootId) ?? 0) + connection.weight);
    }
    const ownerId = [...ownerWeights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!ownerId || !positions.has(ownerId)) continue;

    const anchorConnections = connections.filter(connection => connection.rootId === ownerId);
    const totalWeight = anchorConnections.reduce((sum, connection) => sum + connection.weight, 0);
    const anchor = anchorConnections.reduce((sum, connection) => {
      const point = positions.get(connection.id);
      const dims = dimsById.get(connection.id);
      if (!point || !dims) return sum;
      return {
        x: sum.x + (point.x + dims.width / 2) * connection.weight / totalWeight,
        y: sum.y + (point.y + dims.height / 2) * connection.weight / totalWeight,
      };
    }, { x: 0, y: 0 });

    const ownerRect = rootRect(ownerId, groupIds, positions, parentOf, dimsById);
    const dims = dimsById.get(supportNode.id);
    const current = positions.get(supportNode.id);
    if (!dims || !current) continue;
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
    const slots = [
      { x: Math.max(0, ownerRect.x - dims.width - gap), y: clamp(anchor.y - dims.height / 2, ownerRect.y, ownerRect.y + ownerRect.height - dims.height) },
      { x: ownerRect.x + ownerRect.width + gap, y: clamp(anchor.y - dims.height / 2, ownerRect.y, ownerRect.y + ownerRect.height - dims.height) },
      { x: clamp(anchor.x - dims.width / 2, ownerRect.x, ownerRect.x + ownerRect.width - dims.width), y: Math.max(0, ownerRect.y - dims.height - gap) },
      { x: clamp(anchor.x - dims.width / 2, ownerRect.x, ownerRect.x + ownerRect.width - dims.width), y: ownerRect.y + ownerRect.height + gap },
    ];
    const occupiedRoots = rootIds
      .filter(id => id !== supportNode.id && id !== ownerId)
      .map(id => rootRect(id, groupIds, positions, parentOf, dimsById));
    const available = slots
      .map(slot => ({
        ...slot,
        width: dims.width,
        height: dims.height,
        distance: Math.abs(slot.x + dims.width / 2 - anchor.x) + Math.abs(slot.y + dims.height / 2 - anchor.y),
      }))
      .filter(slot => !occupiedRoots.some(rect => rectsOverlap(slot, rect)))
      .sort((a, b) => a.distance - b.distance);
    const destination = available[0];
    if (!destination) continue;

    moveLayoutSubtree(
      supportNode.id,
      { x: destination.x - current.x, y: destination.y - current.y },
      positions,
      parentOf,
    );
  }
}

/** Keep infrastructure children beside their consumers inside each group. */
function placeInfrastructureMembers(
  members: string[],
  memberRects: Map<string, LayoutRect>,
  ctx: CompoundContext,
  resolveMember: (nodeId: string) => string | null,
  gap: number,
): void {
  const supportMembers = members.filter(id => isInfrastructureServiceType(ctx.serviceTypeById.get(id)));
  for (const supportId of supportMembers) {
    const anchors = new Map<string, number>();
    for (const edge of ctx.edges) {
      const source = resolveMember(edge.source);
      const target = resolveMember(edge.target);
      const other = source === supportId ? target : target === supportId ? source : null;
      if (!other || other === supportId || isInfrastructureServiceType(ctx.serviceTypeById.get(other))) continue;
      anchors.set(other, Math.max(anchors.get(other) ?? 0, Math.max(0.5, getLayoutEdgeWeight(edge))));
    }
    if (anchors.size === 0) continue;

    const anchorRects = [...anchors.keys()].map(id => memberRects.get(id)).filter(Boolean) as LayoutRect[];
    const supportRect = memberRects.get(supportId);
    if (anchorRects.length === 0 || !supportRect) continue;
    const totalWeight = [...anchors.values()].reduce((sum, weight) => sum + weight, 0);
    const anchor = [...anchors.entries()].reduce((sum, [id, weight]) => {
      const rect = memberRects.get(id);
      if (!rect) return sum;
      return {
        x: sum.x + (rect.x + rect.width / 2) * weight / totalWeight,
        y: sum.y + (rect.y + rect.height / 2) * weight / totalWeight,
      };
    }, { x: 0, y: 0 });
    const bounds = anchorRects.reduce((rect, anchorRect) => ({
      x: Math.min(rect.x, anchorRect.x),
      y: Math.min(rect.y, anchorRect.y),
      width: Math.max(rect.x + rect.width, anchorRect.x + anchorRect.width) - Math.min(rect.x, anchorRect.x),
      height: Math.max(rect.y + rect.height, anchorRect.y + anchorRect.height) - Math.min(rect.y, anchorRect.y),
    }), anchorRects[0]);
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
    const slots = [
      { x: bounds.x - supportRect.width - gap, y: clamp(anchor.y - supportRect.height / 2, bounds.y, bounds.y + bounds.height - supportRect.height) },
      { x: bounds.x + bounds.width + gap, y: clamp(anchor.y - supportRect.height / 2, bounds.y, bounds.y + bounds.height - supportRect.height) },
      { x: clamp(anchor.x - supportRect.width / 2, bounds.x, bounds.x + bounds.width - supportRect.width), y: bounds.y - supportRect.height - gap },
      { x: clamp(anchor.x - supportRect.width / 2, bounds.x, bounds.x + bounds.width - supportRect.width), y: bounds.y + bounds.height + gap },
    ];
    const occupied = [...memberRects.entries()]
      .filter(([id]) => id !== supportId)
      .map(([, rect]) => rect);
    const destination = slots
      .map(slot => ({
        ...slot,
        width: supportRect.width,
        height: supportRect.height,
        distance: Math.abs(slot.x + supportRect.width / 2 - anchor.x) + Math.abs(slot.y + supportRect.height / 2 - anchor.y),
      }))
      .filter(slot => !occupied.some(rect => rectsOverlap(slot, rect)))
      .sort((a, b) => a.distance - b.distance)[0];
    if (destination) memberRects.set(supportId, { x: destination.x, y: destination.y, width: supportRect.width, height: supportRect.height });
  }
}

function layoutLevel(members: string[], ctx: CompoundContext, depth: number = 0): LevelLayout {
  const memberSet = new Set(members);

  // Determine the rank direction for this level: top-level uses global, inner levels use their parent group's direction if set (e.g. LR outer / TB inner for the dashed loop)
  let levelDirection: RankDirection = ctx.direction;
  if (depth > 0 && members.length > 0) {
    const parentId = ctx.parentOf.get(members[0]);
    if (parentId && ctx.directionByGroup.has(parentId)) {
      levelDirection = ctx.directionByGroup.get(parentId)!;
    }
  }

  // Phase 1 — settle each child group into a fixed box first.
  const macroIds = new Set<string>();
  const macroBoxes = new Map<string, LevelLayout>();
  for (const id of members) {
    const children = (ctx.childrenByParent.get(id) ?? []).filter(c => ctx.dimsById.has(c));
    if (children.length === 0) continue;
    const inner = layoutLevel(children, ctx, depth + 1);
    macroIds.add(id);
    macroBoxes.set(id, inner);
  }

  // Per-level density bump: small inner groups (1 edge) stay compact, crowded
  // top-level (many cross-group edges) gets extra air. Respects explicit overrides.
  let nodeSep = ctx.nodeSep;
  let rankSep = ctx.rankSep;
  const hasExplicit = (ctx as unknown as { _hasExplicitSep?: boolean })._hasExplicitSep;
  if (!hasExplicit) {
    let baseNodeSep: number;
    let baseRankSep: number;
    // For inner groups with their own direction, recompute base spacing for that direction (TB needs 90 vs LR 110)
    if (depth > 0 && members.length > 0) {
      const parentId = ctx.parentOf.get(members[0]);
      if (parentId && ctx.directionByGroup.has(parentId)) {
        const lvlBase = defaultCompoundLayoutOptions(ctx.directionByGroup.get(parentId)!);
        baseNodeSep = lvlBase.nodeSep!;
        baseRankSep = lvlBase.rankSep!;
      } else {
        baseNodeSep = (ctx as unknown as { _baseNodeSep?: number })._baseNodeSep ?? ctx.nodeSep;
        baseRankSep = (ctx as unknown as { _baseRankSep?: number })._baseRankSep ?? ctx.rankSep;
      }
    } else {
      baseNodeSep = (ctx as unknown as { _baseNodeSep?: number })._baseNodeSep ?? ctx.nodeSep;
      baseRankSep = (ctx as unknown as { _baseRankSep?: number })._baseRankSep ?? ctx.rankSep;
    }
    // Count distinct relationships that affect this level, weighted so support
    // links do not inflate spacing as much as the main request flow.
    const pairWeights = new Map<string, number>();
    for (const e of ctx.edges) {
      let cur: string | undefined | null = e.source;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        if (memberSet.has(cur)) break;
        cur = ctx.parentOf.get(cur) ?? null;
      }
      const srcMember = cur && memberSet.has(cur) ? cur : null;
      cur = e.target;
      seen.clear();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        if (memberSet.has(cur)) break;
        cur = ctx.parentOf.get(cur) ?? null;
      }
      const tgtMember = cur && memberSet.has(cur) ? cur : null;
      if (srcMember && tgtMember && srcMember !== tgtMember) {
        const key = `${srcMember}\u0000${tgtMember}`;
        pairWeights.set(key, Math.max(pairWeights.get(key) ?? 0, getLayoutEdgeWeight(e)));
      }
    }
    const localEdgeCount = [...pairWeights.values()].reduce(
      (count, weight) => count + Math.min(1, weight / 3),
      0,
    );
    // Top level: use weighted graph density (like flat Dagre) so
    // cross-group trunks get the same air as flat crowded graphs.
    // Inner levels use local distinct-pair count to stay compact.
    let nodeExtra = 0;
    let rankExtra = 0;
    if (depth === 0 && ctx.globalEdgeDensity !== undefined && ctx.globalEdgeDensity > 6) {
      const extra = ctx.globalEdgeDensity - 6;
      nodeExtra = Math.min(40, extra * 8);
      rankExtra = Math.min(80, extra * 12);
      nodeSep = baseNodeSep + nodeExtra;
      rankSep = baseRankSep + rankExtra;
    } else {
      // Inner levels (or top with ≤6 edges): only bump when noticeably crowded (≥4 distinct pairs)
      if (localEdgeCount > 3) {
        const extra = localEdgeCount - 3;
        nodeExtra = Math.min(24, extra * 6);
        rankExtra = Math.min(48, extra * 10);
        nodeSep = baseNodeSep + nodeExtra;
        rankSep = baseRankSep + rankExtra;
      } else {
        nodeSep = baseNodeSep;
        rankSep = baseRankSep;
      }
    }
  
  }

  // Keep the spacing between a group's own ranks compact even when the outer
  // diagram uses an editorial spacing profile. The group bounds are derived
  // from these child positions, so this also removes the dead space seen in
  // small groups without changing the outer flow or the frame padding.
  if (depth > 0) rankSep = Math.min(rankSep, SUBGRAPH_CONTENT_RANK_SEP);

  // Phase 2 — dagre over leaves + group-boxes.
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: toDagreRankDir(levelDirection),
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: 0,
    marginy: 0,
    ranker: 'network-simplex',
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

  const isPopulatedGroup = (id: string) =>
    ctx.childrenByParent.has(id) && (ctx.childrenByParent.get(id)?.length ?? 0) > 0;
  const isDescendantOfGroup = (groupId: string, leafId: string): boolean => {
    let cur: string | undefined = leafId;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      if (cur === groupId) return true;
      cur = ctx.parentOf.get(cur);
    }
    return false;
  };
  const levelEdges: LayoutEdge[] = [];
  for (const edge of ctx.edges) {
    // Deduplicate populated-group edges that duplicate a leaf edge (keep non-duplicate group edges)
    if (isPopulatedGroup(edge.source) || isPopulatedGroup(edge.target)) {
      const isDuplicate = ctx.edges.some(other => {
        if (other === edge) return false;
        if (isPopulatedGroup(edge.source) && isDescendantOfGroup(edge.source, other.source) && other.target === edge.target) return true;
        if (isPopulatedGroup(edge.target) && isDescendantOfGroup(edge.target, other.target) && other.source === edge.source) return true;
        return false;
      });
      if (isDuplicate) continue;
    }
    const source = resolveMember(edge.source);
    const target = resolveMember(edge.target);
    if (!source || !target || source === target) continue;
    levelEdges.push({ ...edge, source, target });
  }
  const rankEdges = selectAcyclicLayoutEdges(
    aggregateLayoutEdges(levelEdges),
    levelDirection,
    members,
  );
  for (const edge of rankEdges) {
    g.setEdge(edge.source, edge.target, {
      width: edge.width,
      height: edge.height,
      weight: edge.weight,
      labelpos: 'c',
      minlen: 1,
    });
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

  const memberRects = new Map<string, LayoutRect>();
  for (const id of members) {
    const node = g.node(id);
    if (!node) continue;
    const d = dimsOf(id);
    const x = (node.x as number) - d.width / 2;
    const y = (node.y as number) - d.height / 2;
    memberRects.set(id, { x, y, width: d.width, height: d.height });
  }
  if (depth > 0) {
    placeInfrastructureMembers(members, memberRects, ctx, resolveMember, Math.max(24, nodeSep / 3));
  }

  for (const id of members) {
    const rect = memberRects.get(id);
    if (!rect) continue;
    place(id, rect.x, rect.y, rect.width, rect.height);

    // Embed the settled interior inside the group box, inset by the same frame
    // padding baked into the box dims (dimsOf) above — this keeps children
    // aligned with the drawn frame and leaves the label-header gap at the top.
    // Inner positions are already normalized to start at (0,0).
    const inner = macroBoxes.get(id);
    if (inner) {
      for (const [childId, pos] of inner.positions) {
        if (memberSet.has(childId)) continue;
        positions.set(childId, {
          x: rect.x + SUBGRAPH_PADDING_X + pos.x,
          y: rect.y + SUBGRAPH_PADDING_TOP + pos.y,
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

    // Base spacing (no density bump here) — per-level adaptation happens inside layoutLevel
    const defaults = defaultCompoundLayoutOptions(params.direction);
    const opts = { ...defaults, ...params.options };
    const roots = params.nodes
      .filter(n => !parentOf.has(n.id))
      .map(n => n.id);
    if (roots.length === 0) return null;

    // Honor explicit caller overrides (e.g. toolbar) but otherwise use base;
    // density bump is applied per-level inside layoutLevel so small inner groups
    // don't inherit the top-level crowding penalty.
    const hasExplicitSep = params.options?.nodeSep !== undefined || params.options?.rankSep !== undefined;
    // If caller already supplied a density-aware sep (via IntegratedLayout), treat as non-explicit
    // for per-level calc — we recompute locally. Only toolbar explicit `layered-tb` toggles should bypass.
    // Detect density case by checking if opts came from IntegratedLayout density (globalEdgeCount >6)
    // Heuristic: if hasExplicit but globalEdgeCount >6 and opts matches density-aware defaults, don't treat as explicit.
    let effectiveHasExplicit = hasExplicitSep;
    if (hasExplicitSep && params.edges.length > 6) {
      const densityDefaults = defaultCompoundLayoutOptions(params.direction, { edgeCount: params.edges.length });
      if (opts.nodeSep === densityDefaults.nodeSep && opts.rankSep === densityDefaults.rankSep) {
        effectiveHasExplicit = false;
      }
    }
    const baseNodeSep = effectiveHasExplicit ? (opts.nodeSep ?? defaults.nodeSep ?? 110) : (defaults.nodeSep ?? 110);
    const baseRankSep = effectiveHasExplicit ? (opts.rankSep ?? defaults.rankSep ?? 170) : (defaults.rankSep ?? 170);

    const directionByGroup = new Map<string, RankDirection>();
    for (const node of params.nodes) {
      if (node.isGroup && node.direction) {
        directionByGroup.set(node.id, node.direction);
      }
    }

    const ctx: CompoundContext = {
      childrenByParent,
      parentOf,
      dimsById,
      serviceTypeById: new Map(params.nodes.map(node => [node.id, node.serviceType])),
      edges: params.edges.map(edge => ({ ...edge })),
      direction: params.direction,
      directionByGroup,
      nodeSep: baseNodeSep,
      rankSep: baseRankSep,
      warnings,
      globalEdgeDensity: params.edges.reduce(
        (count, edge) => count + Math.min(1, getLayoutEdgeWeight(edge) / 3),
        0,
      ),
    };
    // Store base + explicit flag for per-level calc (attached to ctx via closure)
    // layoutLevel will see ctx and recompute locally if not explicitly overridden.
    (ctx as unknown as { _hasExplicitSep?: boolean; _baseNodeSep?: number; _baseRankSep?: number })._hasExplicitSep = effectiveHasExplicit;
    (ctx as unknown as { _baseNodeSep?: number })._baseNodeSep = baseNodeSep;
    (ctx as unknown as { _baseRankSep?: number })._baseRankSep = baseRankSep;

    const result = layoutLevel(roots, ctx);

    // Keep multi-connection support groups in an orthogonal side lane of the
    // main flow. This prevents leaf-to-leaf edges from becoming giant trunks
    // around a wide compound group (for example planner → knowledge/cache in
    // an agent loop) while leaving ordinary single-entry/single-exit groups in
    // their Dagre-ranked positions.
    if (!params.options?.flowAreas) placeSidecarGroups(
      result.positions,
      params,
      parentOf,
      childrenByParent,
      dimsById,
      ctx.rankSep || defaults.rankSep || 170,
    );
    placeRootInfrastructureNodes(
      result.positions,
      params,
      parentOf,
      dimsById,
      Math.max(32, Math.min(72, (ctx.nodeSep || defaults.nodeSep || 110) / 2)),
    );

    orderUnlinkedSiblingsByNeighbours(result.positions, params, childrenByParent, dimsById);
    alignCrossGroupEdges(result.positions, params, parentOf, dimsById);

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
      // Edge geometry is recomputed by the floating-edge renderer downstream.
      // Preserve every relationship here. Group-level deduplication used to
      // make real parallel/group connections disappear on layout toggles.
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
