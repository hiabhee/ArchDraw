/** Geometry diagnostics. Edge centerlines and label boxes are estimates, not rendered SVG paths. */
interface LayoutNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  parentNode?: string;
  data?: Record<string, unknown>;
}
interface LayoutEdge { source: string; target: string; label?: unknown; data?: Record<string, unknown> }
interface Point { x: number; y: number }
interface Box extends Point { width: number; height: number }
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

export function measureLayoutQuality(nodes: LayoutNode[], edges: LayoutEdge[]) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const boxes = new Map<string, Box>();
  for (const node of nodes) {
    let { x, y } = node.position;
    let parent = node.parentNode ?? node.data?.parentId as string | undefined;
    const visited = new Set([node.id]);
    while (parent && !visited.has(parent)) {
      visited.add(parent);
      const p = byId.get(parent);
      if (!p) break;
      x += p.position.x; y += p.position.y;
      parent = p.parentNode ?? p.data?.parentId as string | undefined;
    }
    boxes.set(node.id, { x, y, width: node.width ?? 200, height: node.height ?? 88 });
  }
  const leaves = nodes.filter(n => !['groupNode', 'frameNode', 'textLabelNode', 'annotationNode'].includes(n.type ?? ''));
  let nodeOverlaps = 0;
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    if (overlaps(boxes.get(leaves[i].id)!, boxes.get(leaves[j].id)!)) nodeOverlaps++;
  }
  const segments = edges.flatMap(edge => {
    const a = boxes.get(edge.source), b = boxes.get(edge.target);
    if (!a || !b || edge.source === edge.target) return [];
    return [{ edge, a: { x: a.x + a.width / 2, y: a.y + a.height / 2 }, b: { x: b.x + b.width / 2, y: b.y + b.height / 2 } }];
  });
  let estimatedCrossings = 0;
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const s = segments[i], t = segments[j];
    if ([s.edge.source, s.edge.target].some(id => id === t.edge.source || id === t.edge.target)) continue;
    if (cross(s.a, s.b, t.a) * cross(s.a, s.b, t.b) < 0 && cross(t.a, t.b, s.a) * cross(t.a, t.b, s.b) < 0) estimatedCrossings++;
  }
  const labels = segments.flatMap(({ edge, a, b }) => {
    const label = edge.label ?? edge.data?.label;
    if (typeof label !== 'string' || !label.trim()) return [];
    const width = Math.min(240, label.length * 7 + 16);
    return [{ edge, x: (a.x + b.x - width) / 2, y: (a.y + b.y) / 2 - 12, width, height: 24 }];
  });
  let estimatedLabelCollisions = 0;
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    for (const node of leaves) {
      if (node.id !== label.edge.source && node.id !== label.edge.target && overlaps(label, boxes.get(node.id)!)) estimatedLabelCollisions++;
    }
    for (let j = i + 1; j < labels.length; j++) if (overlaps(label, labels[j])) estimatedLabelCollisions++;
  }
  const all = [...boxes.values()];
  const area = all.length ? (Math.max(...all.map(b => b.x + b.width)) - Math.min(...all.map(b => b.x))) * (Math.max(...all.map(b => b.y + b.height)) - Math.min(...all.map(b => b.y))) : 0;
  return { nodeOverlaps, estimatedCrossings, estimatedLabelCollisions, area,
    penalty: nodeOverlaps * 100 + estimatedCrossings * 8 + estimatedLabelCollisions * 4 };
}
