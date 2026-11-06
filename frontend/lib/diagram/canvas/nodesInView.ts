/**
 * Whether any node overlaps the visible part of the canvas. React Flow only
 * fits the view on its first render, so a diagram replaced later (loaded from
 * the server, re-laid out by an agent) can sit entirely off screen; callers
 * re-frame only then, never a view that already shows part of the diagram.
 */
export interface ViewNode {
  position: { x: number; y: number };
  positionAbsolute?: { x: number; y: number };
  width?: number | null;
  height?: number | null;
}

export function anyNodeInView(
  nodes: Iterable<ViewNode>,
  transform: readonly [number, number, number],
  size: { width: number; height: number },
): boolean {
  const [tx, ty, zoom] = transform;
  const left = -tx / zoom;
  const top = -ty / zoom;
  const right = left + size.width / zoom;
  const bottom = top + size.height / zoom;
  for (const node of nodes) {
    const { x, y } = node.positionAbsolute ?? node.position;
    const w = node.width ?? 0;
    const h = node.height ?? 0;
    if (x <= right && x + w >= left && y <= bottom && y + h >= top) return true;
  }
  return false;
}
