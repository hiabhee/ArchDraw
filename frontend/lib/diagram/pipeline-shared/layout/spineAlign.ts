/**
 * Lines the main flow up on one straight line.
 *
 * A layered layout places every rank on its own, so the main request path (Client, DNS, CDN, load
 * balancer, gateway...) zig-zags: each step sits a little higher or lower than the last, pulled by
 * its other connections. That reads as unstructured even when nothing crosses. This pass takes the
 * main path (edges whose flow role is `main`), finds the line most of it already sits on (the
 * median of the cards' centres across the flow) and moves each main card onto it, as long as the
 * card would not come within `margin` of another card or group. Branches stay where they are, so
 * they fan off the spine.
 *
 * Only top-level cards move: cards inside a group belong to that group's own arrangement. Positions
 * are absolute canvas coordinates. Returns `undefined` when nothing moves.
 */

export type SpineDirection = 'LR' | 'TD';

interface SpineNode {
  id: string;
  type?: string;
  parentNode?: string;
  parentId?: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  style?: unknown;
  data?: unknown;
}

interface SpineEdge {
  source: string;
  target: string;
  data?: unknown;
}

const isGroup = (node: SpineNode) =>
  node.type === 'groupNode' || node.type === 'group' || node.type === 'frameNode'
  || (node.data as { isGroup?: boolean } | undefined)?.isGroup === true;

const sizeOf = (node: SpineNode) => {
  const style = (node.style ?? {}) as { width?: number; height?: number };
  const data = (node.data ?? {}) as { nodeWidth?: number; nodeHeight?: number };
  return {
    w: node.width ?? style.width ?? data.nodeWidth ?? 200,
    h: node.height ?? style.height ?? data.nodeHeight ?? 100,
  };
};

export interface SpineOptions {
  /** Room kept between a moved card and any other card or group. */
  margin?: number;
  /** The line to align on (a centre across the flow); by default the median of the spine's centres. */
  target?: number;
  /** Move only these spine cards (to try one card at a time). */
  only?: ReadonlySet<string>;
}

/** The main path's cards and the lines (centres across the flow) they already sit on. */
export function mainSpine(nodes: readonly SpineNode[], edges: readonly SpineEdge[], direction: SpineDirection): { ids: string[]; lines: number[] } {
  const found = findSpine(nodes, edges);
  if (!found) return { ids: [], lines: [] };
  const horizontal = direction === 'LR';
  const byId = new Map(nodes.map(node => [node.id, node]));
  const lines = [...new Set(found.map(id => {
    const node = byId.get(id)!;
    const { w, h } = sizeOf(node);
    return Math.round(horizontal ? node.position.y + h / 2 : node.position.x + w / 2);
  }))].sort((a, b) => a - b);
  return { ids: found, lines };
}

function findSpine(nodes: readonly SpineNode[], edges: readonly SpineEdge[]): string[] | undefined {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const eligible = (id: string) => {
    const node = byId.get(id);
    return Boolean(node && !isGroup(node) && !node.parentNode && !node.parentId);
  };
  const main = edges.filter(edge =>
    (edge.data as { flowRole?: string } | undefined)?.flowRole === 'main' && edge.source !== edge.target
    && eligible(edge.source) && eligible(edge.target));
  if (main.length < 2) return undefined;
  const neighbours = new Map<string, Set<string>>();
  for (const edge of main) {
    for (const [a, b] of [[edge.source, edge.target], [edge.target, edge.source]]) {
      (neighbours.get(a) ?? neighbours.set(a, new Set()).get(a)!).add(b);
    }
  }
  let spine: string[] = [];
  const seen = new Set<string>();
  for (const start of neighbours.keys()) {
    if (seen.has(start)) continue;
    const component: string[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const id = stack.pop()!;
      component.push(id);
      for (const next of neighbours.get(id) ?? []) if (!seen.has(next)) { seen.add(next); stack.push(next); }
    }
    if (component.length > spine.length) spine = component;
  }
  return spine.length >= 3 ? spine : undefined;
}

export function alignMainSpine<T extends SpineNode>(
  nodes: readonly T[],
  edges: readonly SpineEdge[],
  direction: SpineDirection,
  options: SpineOptions = {},
): T[] | undefined {
  const margin = options.margin ?? 24;
  const horizontal = direction === 'LR';
  const byId = new Map(nodes.map(node => [node.id, node]));
  const spine = findSpine(nodes, edges);
  if (!spine) return undefined;

  const position = new Map(nodes.map(node => [node.id, { ...node.position }]));
  const box = (id: string) => {
    const { w, h } = sizeOf(byId.get(id)!);
    const at = position.get(id)!;
    return { x: at.x, y: at.y, w, h };
  };
  const centre = (id: string) => {
    const b = box(id);
    return horizontal ? b.y + b.h / 2 : b.x + b.w / 2;
  };

  // The line most of the spine already sits on.
  const centres = spine.map(centre).sort((a, b) => a - b);
  const target = options.target ?? centres[Math.floor(centres.length / 2)];

  // Cards and groups a moved card must keep clear of: everything top-level that is not itself.
  const obstacles = nodes.filter(node => !node.parentNode && !node.parentId);
  const clear = (id: string, candidate: { x: number; y: number; w: number; h: number }) => obstacles.every(other => {
    if (other.id === id) return true;
    const b = box(other.id);
    return candidate.x + candidate.w + margin <= b.x || b.x + b.w + margin <= candidate.x
      || candidate.y + candidate.h + margin <= b.y || b.y + b.h + margin <= candidate.y;
  });

  let moved = false;
  // Closest first: a card that only needs a nudge should not be blocked by one moving a long way.
  for (const id of [...spine].sort((a, b) => Math.abs(centre(a) - target) - Math.abs(centre(b) - target))) {
    if (options.only && !options.only.has(id)) continue;
    const shift = target - centre(id);
    if (Math.abs(shift) < 0.5) continue;
    const current = box(id);
    const candidate = horizontal ? { ...current, y: current.y + shift } : { ...current, x: current.x + shift };
    if (!clear(id, candidate)) continue;
    position.set(id, { x: candidate.x, y: candidate.y });
    moved = true;
  }
  if (!moved) return undefined;

  return nodes.map(node => {
    const at = position.get(node.id)!;
    return at.x === node.position.x && at.y === node.position.y ? node : { ...node, position: at };
  });
}
