import type { Edge, Node } from 'reactflow';

export interface AlignmentGuide {
  orientation: 'v' | 'h';
  position: number;
  // Optional label for UX (e.g., "edge straight")
  label?: string;
}

export interface SnapResult {
  guides: AlignmentGuide[];
  snapX: number | null;
  snapY: number | null;
}

const DEFAULT_THRESHOLD = 8;
const EDGE_STRAIGHT_THRESHOLD = 12;

function getNodeBounds(n: Node) {
  const w = n.width ?? (n.data as { nodeWidth?: number })?.nodeWidth ?? (n.style as { width?: number })?.width ?? 200;
  const h = n.height ?? (n.data as { nodeHeight?: number })?.nodeHeight ?? (n.style as { height?: number })?.height ?? 88;
  const x = n.position.x;
  const y = n.position.y;
  // For children of groups, position is parent-relative. For guide calc we need absolute.
  // Caller should provide already-absolute nodes; we handle parent walk if needed via positionAbsolute.
  const absX = (n as unknown as { positionAbsolute?: { x: number; y: number } }).positionAbsolute?.x ?? x;
  const absY = (n as unknown as { positionAbsolute?: { x: number; y: number } }).positionAbsolute?.y ?? y;
  // If node is inside group, its absolute is groupAbs + relative; but reactflow node.positionAbsolute is already absolute.
  // Fallback: use absX/absY if available, else x/y.
  return {
    left: absX,
    right: absX + w,
    centerX: absX + w / 2,
    top: absY,
    bottom: absY + h,
    centerY: absY + h / 2,
    width: w,
    height: h,
  };
}

/**
 * Compute alignment guides for a dragged node (or bounding box) against others.
 * Includes edge-straightness priority: if dragged is connected to another node
 * on same rank, snap to make that edge perfectly horizontal/vertical.
 * Pure function — testable without React.
 */
export function computeAlignmentGuides(
  dragged: Node | { position: { x: number; y: number }; width: number; height: number; id: string },
  others: Node[],
  threshold = DEFAULT_THRESHOLD,
  edges: Edge[] = [],
  draggedIds: Set<string> = new Set([(dragged as Node).id ?? '__bbox__'])
): SnapResult {
  // Normalize dragged to bounds
  const dW = (dragged as Node).width ?? (dragged as { width: number }).width ?? 200;
  const dH = (dragged as Node).height ?? (dragged as { height: number }).height ?? 88;
  const dX = dragged.position.x;
  const dY = dragged.position.y;
  // If dragged has positionAbsolute, use it (more accurate for nested groups)
  const dAbsX = (dragged as unknown as { positionAbsolute?: { x: number; y: number } }).positionAbsolute?.x ?? dX;
  const dAbsY = (dragged as unknown as { positionAbsolute?: { y: number } }).positionAbsolute?.y ?? dY;

  const dragAnchorsX = { left: dAbsX, centerX: dAbsX + dW / 2, right: dAbsX + dW };
  const dragAnchorsY = { top: dAbsY, centerY: dAbsY + dH / 2, bottom: dAbsY + dH };

  type Candidate = { delta: number; position: number; key: string; priority: number };
  const xCandidates: Candidate[] = [];
  const yCandidates: Candidate[] = [];

  for (const other of others) {
    const o = getNodeBounds(other);
    const isEdgeConnected = edges.some(
      (e) => (draggedIds.has(e.source) && e.target === other.id) || (draggedIds.has(e.target) && e.source === other.id)
    );
    const thX = isEdgeConnected ? EDGE_STRAIGHT_THRESHOLD : threshold;
    const thY = isEdgeConnected ? EDGE_STRAIGHT_THRESHOLD : threshold;
    const priority = isEdgeConnected ? 0 : 1; // edge-connected snaps win (straight edge)
    // Vertical (x) alignments
    for (const [dk, dv] of Object.entries(dragAnchorsX)) {
      for (const [ok, ov] of Object.entries({ left: o.left, centerX: o.centerX, right: o.right })) {
        const delta = ov - dv;
        if (Math.abs(delta) < thX) {
          xCandidates.push({ delta, position: ov, key: `v-${ov}-${dk}-${ok}`, priority });
        }
      }
    }
    // Horizontal (y)
    for (const [dk, dv] of Object.entries(dragAnchorsY)) {
      for (const [ok, ov] of Object.entries({ top: o.top, centerY: o.centerY, bottom: o.bottom })) {
        const delta = ov - dv;
        if (Math.abs(delta) < thY) {
          yCandidates.push({ delta, position: ov, key: `h-${ov}-${dk}-${ok}`, priority });
        }
      }
    }
  }

  // Edge-straightness extra: if centerY delta is small but not matching any anchor (e.g., off by 3px), still snap center to center for horizontal edges
  // Already covered by centerY↔centerY with larger threshold for connected nodes

  // Pick closest delta per orientation (smallest absolute)
  let snapX: number | null = null;
  let snapY: number | null = null;
  let bestXPos: number | null = null;
  let bestYPos: number | null = null;

  if (xCandidates.length > 0) {
    xCandidates.sort((a, b) => a.priority - b.priority || Math.abs(a.delta) - Math.abs(b.delta));
    snapX = xCandidates[0].delta;
    bestXPos = xCandidates[0].position;
  }
  if (yCandidates.length > 0) {
    yCandidates.sort((a, b) => a.priority - b.priority || Math.abs(a.delta) - Math.abs(b.delta));
    snapY = yCandidates[0].delta;
    bestYPos = yCandidates[0].position;
  }

  const guides: AlignmentGuide[] = [];
  if (bestXPos !== null) guides.push({ orientation: 'v', position: bestXPos });
  if (bestYPos !== null) guides.push({ orientation: 'h', position: bestYPos });

  // Deduplicate (if multiple dragged anchors snap to same position)
  const seen = new Set<string>();
  const deduped = guides.filter((g) => {
    const k = `${g.orientation}-${g.position}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { guides: deduped, snapX, snapY };
}

/**
 * For multi-select drag, compute bounding box of dragged nodes and snap that box.
 */
export function computeBoundingBox(nodes: Node[]) {
  if (nodes.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const b = getNodeBounds(n);
    minX = Math.min(minX, b.left);
    minY = Math.min(minY, b.top);
    maxX = Math.max(maxX, b.right);
    maxY = Math.max(maxY, b.bottom);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: minX + (maxX - minX) / 2,
    centerY: minY + (maxY - minY) / 2,
  };
}
