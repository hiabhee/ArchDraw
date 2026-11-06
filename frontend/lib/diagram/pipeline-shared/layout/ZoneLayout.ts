import type { DagreLayoutEngine } from './DagreLayout';
import type { LayoutEdge, LayoutNode, LayoutParams, LayoutResult, PositionedNode } from './LayoutEngine';
import { isInfrastructureServiceType } from './LayoutEngine';
import { SUBGRAPH_PADDING_BOTTOM, SUBGRAPH_PADDING_TOP, SUBGRAPH_PADDING_X } from './layoutConstants';

/**
 * Hub-and-zones layout: the structure of a hand-drawn architecture map.
 *
 * A left-to-right rank layout puts everything in columns, which reads well for
 * one pipeline and badly for a system with a central service. Here the most
 * connected component (the hub) sits in the middle and what hangs off it is
 * placed by role around it:
 *
 *            data zones (storage, caches)
 *   clients       HUB        processing zones
 *            chains (queues, workers, pipelines)
 *
 * Each cluster that is left once the hub is removed (a branch) is laid out
 * internally by the normal compound Dagre pass, so groups, ports, symmetry and
 * edge channels all keep working; only the placement of whole branches around
 * the hub is new. Returns null when the diagram has no real hub, and the caller
 * falls back to the ordinary flow layout.
 */

/** Space between a branch and the hub: room for edge labels and bends. */
const GAP = 150;
/** Space between two branches that share a side. */
const BRANCH_GAP = 72;
/** Share of all cross-unit edges that must touch the hub for the zones layout to apply. */
const MIN_HUB_SHARE = 0.4;

const CLIENT_TYPES = new Set(['actor', 'client', 'mobile', 'user', 'browser', 'web-client', 'frontend', 'desktop']);
const CLIENT_LABEL = /\b(users?|clients?|desktop|mobile|browser|customers?|admin|ios|android|web app)\b/i;
const STORE_LABEL = /\b(db|database|redis|s3|postgres|mysql|mongo|dynamo(db)?|cache|bucket|storage|elasticsearch|cassandra)\b/i;

type Side = 'left' | 'right' | 'top' | 'bottom';

interface Branch {
  units: string[];
  nodeIds: string[];
  edgesInside: LayoutEdge[];
  /** Placed size and, after the internal layout, each node's position in the branch. */
  width: number;
  height: number;
  laid: PositionedNode[];
  edgeToHub: { in: number; out: number };
  clientScore: number;
  storeScore: number;
  hasGroup: boolean;
  weight: number;
  side?: Side;
}

/**
 * Fit every group's frame around its children (innermost first), the same way
 * the pipeline does afterwards, so a branch is measured at the size it will be
 * drawn. Coordinates are absolute.
 */
function refitGroups(nodes: PositionedNode[]): void {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const depthOf = (node: PositionedNode): number => {
    let depth = 0;
    let parent = node.parentId ? byId.get(node.parentId) : undefined;
    while (parent && depth < 50) {
      depth++;
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    return depth;
  };
  const groups = nodes.filter(node => node.isGroup).sort((a, b) => depthOf(b) - depthOf(a));
  for (const group of groups) {
    const children = nodes.filter(node => node.parentId === group.id);
    if (children.length === 0) continue;
    const left = Math.min(...children.map(child => child.x));
    const top = Math.min(...children.map(child => child.y));
    const right = Math.max(...children.map(child => child.x + child.width));
    const bottom = Math.max(...children.map(child => child.y + child.height));
    group.x = left - SUBGRAPH_PADDING_X;
    group.y = top - SUBGRAPH_PADDING_TOP;
    group.width = right - left + 2 * SUBGRAPH_PADDING_X;
    group.height = bottom - top + SUBGRAPH_PADDING_TOP + SUBGRAPH_PADDING_BOTTOM;
  }
}

export function layoutZones(params: LayoutParams, engine: DagreLayoutEngine): LayoutResult | null {
  const byId = new Map(params.nodes.map(node => [node.id, node]));
  const childrenOf = new Map<string, string[]>();
  for (const node of params.nodes) {
    if (node.parentId && byId.has(node.parentId)) {
      (childrenOf.get(node.parentId) ?? childrenOf.set(node.parentId, []).get(node.parentId)!).push(node.id);
    }
  }
  const topLevel = params.nodes.filter(node => !node.parentId || !byId.has(node.parentId));
  if (topLevel.length < 4) return null;

  const unitOf = new Map<string, string>();
  const membersOfUnit = new Map<string, string[]>();
  for (const unit of topLevel) {
    const members: string[] = [];
    const walk = (id: string) => {
      members.push(id);
      unitOf.set(id, unit.id);
      for (const child of childrenOf.get(id) ?? []) walk(child);
    };
    walk(unit.id);
    membersOfUnit.set(unit.id, members);
  }

  // Macro graph between top-level units.
  const neighbours = new Map<string, Map<string, number>>();
  let crossEdges = 0;
  for (const edge of params.edges) {
    const a = unitOf.get(edge.source);
    const b = unitOf.get(edge.target);
    if (!a || !b || a === b) continue;
    crossEdges++;
    for (const [from, to] of [[a, b], [b, a]] as const) {
      const row = neighbours.get(from) ?? neighbours.set(from, new Map()).get(from)!;
      row.set(to, (row.get(to) ?? 0) + 1);
    }
  }
  const degree = (id: string) => [...(neighbours.get(id)?.values() ?? [])].reduce((sum, value) => sum + value, 0);

  // The hub: the most connected unit; a plain component wins a tie over a group.
  const hub = [...topLevel].sort((a, b) => degree(b.id) - degree(a.id) || Number(!!a.isGroup) - Number(!!b.isGroup))[0];
  if (!hub || (neighbours.get(hub.id)?.size ?? 0) < 3) return null;
  // A hub is only real when much of the diagram runs through it; a long
  // pipeline with a busy gateway in the middle reads better as columns.
  const hubShare = crossEdges > 0 ? degree(hub.id) / crossEdges : 0;
  if (hubShare < MIN_HUB_SHARE) return null;

  // Branches: what stays connected once the hub is removed.
  const unitIds = topLevel.map(unit => unit.id).filter(id => id !== hub.id);
  const seen = new Set<string>();
  const components: string[][] = [];
  for (const start of unitIds) {
    if (seen.has(start)) continue;
    const queue = [start];
    const component: string[] = [];
    seen.add(start);
    while (queue.length) {
      const current = queue.shift()!;
      component.push(current);
      for (const next of neighbours.get(current)?.keys() ?? []) {
        if (next === hub.id || seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    components.push(component);
  }
  // Units not connected to anything still need a place.
  const hubLinked = new Set(neighbours.get(hub.id)?.keys() ?? []);

  const branches: Branch[] = [];
  for (const units of components) {
    const nodeIds = units.flatMap(unit => membersOfUnit.get(unit) ?? []);
    const idSet = new Set(nodeIds);
    const leaves = nodeIds.map(id => byId.get(id)!).filter(node => !node.isGroup);
    const edgesInside = params.edges.filter(edge => idSet.has(edge.source) && idSet.has(edge.target));

    let into = 0;
    let out = 0;
    for (const edge of params.edges) {
      const fromHere = idSet.has(edge.source);
      const toHere = idSet.has(edge.target);
      const sourceInHub = unitOf.get(edge.source) === hub.id;
      const targetInHub = unitOf.get(edge.target) === hub.id;
      if (fromHere && targetInHub) into++;
      if (toHere && sourceInHub) out++;
    }

    const typeOf = (node: LayoutNode) => (node.serviceType ?? '').toLowerCase();
    const isClient = (node: LayoutNode) => CLIENT_TYPES.has(typeOf(node)) || CLIENT_LABEL.test(node.label ?? '');
    const isStore = (node: LayoutNode) => isInfrastructureServiceType(node.serviceType) || STORE_LABEL.test(node.label ?? '');
    branches.push({
      units,
      nodeIds,
      edgesInside,
      width: 0,
      height: 0,
      laid: [],
      edgeToHub: { in: into, out },
      clientScore: leaves.length ? leaves.filter(isClient).length / leaves.length : 0,
      storeScore: leaves.length ? leaves.filter(isStore).length / leaves.length : 0,
      hasGroup: units.some(unit => byId.get(unit)!.isGroup),
      weight: nodeIds.length,
    });
  }
  const linked = branches.filter(branch => branch.units.some(unit => hubLinked.has(unit)));
  if (linked.length < 2) return null;

  // Sides. Clients on the left; zones that hold data above; other zones to the
  // right; chains of loose components (queues, workers) below.
  const clientBranch = [...linked]
    .filter(branch => branch.clientScore >= 0.4 && branch.edgeToHub.in >= branch.edgeToHub.out)
    .sort((a, b) => b.clientScore - a.clientScore || b.weight - a.weight)[0];
  const free = linked.filter(branch => branch !== clientBranch);
  for (const branch of branches) branch.side = undefined;
  if (clientBranch) clientBranch.side = 'left';
  for (const branch of free) {
    if (branch.hasGroup && branch.storeScore >= 0.5) branch.side = 'top';
  }
  for (const branch of free) {
    if (branch.side) continue;
    branch.side = branch.hasGroup ? 'right' : 'bottom';
  }
  // Nothing on the left and clients elsewhere: still keep every side used evenly.
  const countOn = (side: Side) => linked.filter(branch => branch.side === side).length;
  if (countOn('top') > 3) {
    const extra = linked.filter(branch => branch.side === 'top').sort((a, b) => a.weight - b.weight)[0];
    if (extra) extra.side = countOn('right') <= countOn('bottom') ? 'right' : 'bottom';
  }
  // Branches the hub does not touch (disconnected from it) go below.
  for (const branch of branches) if (!branch.side) branch.side = 'bottom';

  // Lay each branch out in the direction its side implies: away from the hub
  // for zones above, beside it for the rest, so siblings of a zone above the hub
  // form a row and every edge from the hub enters its component from below.
  const directionFor = (side: Side): LayoutParams['direction'] => (side === 'top' ? 'BT' : params.direction);
  for (const branch of branches) {
    const units = branch.units;
    const single = units.length === 1 && !byId.get(units[0])!.isGroup;
    let laid: PositionedNode[];
    if (single) {
      laid = [{ ...byId.get(units[0])!, x: 0, y: 0 }];
    } else {
      const sub: LayoutParams = {
        nodes: branch.nodeIds.map(id => ({ ...byId.get(id)! })),
        edges: branch.edgesInside,
        direction: directionFor(branch.side ?? 'bottom'),
        options: params.options,
      };
      laid = engine.layoutSync(sub).nodes;
      refitGroups(laid);
    }
    const topIds = new Set(units);
    const tops = laid.filter(node => topIds.has(node.id));
    const minX = Math.min(...tops.map(node => node.x));
    const minY = Math.min(...tops.map(node => node.y));
    // The compound layout reports every node in absolute coordinates (a later
    // pipeline step makes children parent-relative), so the whole branch moves together.
    for (const node of laid) {
      node.x -= minX;
      node.y -= minY;
    }
    branch.laid = laid;
    branch.width = Math.max(...tops.map(node => node.x + node.width));
    branch.height = Math.max(...tops.map(node => node.y + node.height));
  }

  const hubBranchLaid = hub.isGroup
    ? (() => {
        const ids = membersOfUnit.get(hub.id) ?? [];
        const sub: LayoutParams = { nodes: ids.map(id => ({ ...byId.get(id)! })), edges: params.edges.filter(edge => ids.includes(edge.source) && ids.includes(edge.target)), direction: params.direction, options: params.options };
        const laid = engine.layoutSync(sub).nodes;
        refitGroups(laid);
        const frame = laid.find(node => node.id === hub.id)!;
        const { x: frameX, y: frameY } = frame;
        for (const node of laid) {
          node.x -= frameX;
          node.y -= frameY;
        }
        return { laid, width: frame.width, height: frame.height };
      })()
    : { laid: [{ ...hub, x: 0, y: 0 } as PositionedNode], width: hub.width, height: hub.height };

  const onSide = (side: Side) => branches
    .filter(branch => branch.side === side)
    .sort((a, b) => b.weight - a.weight);
  const left = onSide('left');
  const right = onSide('right');
  const top = onSide('top');
  const bottom = onSide('bottom');

  const stackHeight = (list: Branch[]) => list.reduce((sum, branch) => sum + branch.height, 0) + Math.max(0, list.length - 1) * BRANCH_GAP;
  const stackWidth = (list: Branch[]) => list.reduce((sum, branch) => sum + branch.width, 0) + Math.max(0, list.length - 1) * BRANCH_GAP;
  const columnWidth = (list: Branch[]) => (list.length ? Math.max(...list.map(branch => branch.width)) : 0);
  const rowHeight = (list: Branch[]) => (list.length ? Math.max(...list.map(branch => branch.height)) : 0);

  const leftW = columnWidth(left);
  const rightW = columnWidth(right);
  const topH = rowHeight(top);
  const bottomH = rowHeight(bottom);
  const middleH = Math.max(hubBranchLaid.height, stackHeight(left), stackHeight(right));

  const originX = leftW ? leftW + GAP : 0;
  const originY = topH ? topH + GAP : 0;
  const hubX = originX;
  const hubY = originY + (middleH - hubBranchLaid.height) / 2;
  const hubCenterX = hubX + hubBranchLaid.width / 2;
  const middleCenterY = originY + middleH / 2;

  const placed = new Map<string, { x: number; y: number }>();
  const place = (branch: Branch, x: number, y: number) => {
    for (const node of branch.laid) placed.set(node.id, { x: x + node.x, y: y + node.y });
  };

  // Hub.
  for (const node of hubBranchLaid.laid) placed.set(node.id, { x: hubX + node.x, y: hubY + node.y });

  // Left and right stacks, centred on the hub's row.
  const stackColumn = (list: Branch[], x: (branch: Branch) => number) => {
    let cursor = middleCenterY - stackHeight(list) / 2;
    for (const branch of list) {
      place(branch, x(branch), cursor);
      cursor += branch.height + BRANCH_GAP;
    }
  };
  stackColumn(left, branch => originX - GAP - branch.width);
  stackColumn(right, branch => hubX + hubBranchLaid.width + GAP);

  // Top and bottom rows, centred over the hub.
  const rowAcross = (list: Branch[], y: (branch: Branch) => number) => {
    let cursor = hubCenterX - stackWidth(list) / 2;
    for (const branch of list) {
      place(branch, cursor, y(branch));
      cursor += branch.width + BRANCH_GAP;
    }
  };
  rowAcross(top, branch => originY - GAP - branch.height);
  rowAcross(bottom, branch => originY + middleH + GAP);

  // Shift everything so the diagram starts at the margin.
  const marginX = params.options?.marginX ?? 48;
  const marginY = params.options?.marginY ?? 48;
  const placedPositions = [...placed.values()];
  const minX = Math.min(...placedPositions.map(position => position.x));
  const minY = Math.min(...placedPositions.map(position => position.y));
  for (const [id, position] of placed) placed.set(id, { x: position.x - minX + marginX, y: position.y - minY + marginY });

  const sizeOf = new Map<string, { width: number; height: number }>();
  for (const branch of branches) for (const node of branch.laid) sizeOf.set(node.id, { width: node.width, height: node.height });
  for (const node of hubBranchLaid.laid) sizeOf.set(node.id, { width: node.width, height: node.height });

  const nodes: PositionedNode[] = params.nodes.map(node => {
    const position = placed.get(node.id);
    const size = sizeOf.get(node.id) ?? { width: node.width, height: node.height };
    return { ...node, width: size.width, height: size.height, x: position?.x ?? 0, y: position?.y ?? 0 };
  });
  const edges: LayoutResult['edges'] = params.edges.map((edge: LayoutEdge) => ({ ...edge }));
  return { nodes, edges, warnings: [] };
}
