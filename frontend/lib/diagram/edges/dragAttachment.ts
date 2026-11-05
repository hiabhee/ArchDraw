interface DragLookupNode {
  dragging?: boolean;
  parentNode?: string;
  parentId?: string;
}

/**
 * Whether a node is moving because of the current drag: it is being dragged, or it
 * sits inside a group (at any depth) that is. React Flow flags only the node under
 * the pointer, so dragging a group leaves every node inside it unflagged even though
 * they all move with it. An edge on any of them has to follow, not stay where it was.
 */
export function movesWithDrag(
  get: (id: string) => DragLookupNode | undefined,
  id: string,
): boolean {
  const seen = new Set<string>();
  let current: string | undefined = id;
  while (current && !seen.has(current)) {
    seen.add(current);
    const node = get(current);
    if (!node) return false;
    if (node.dragging) return true;
    current = node.parentNode ?? node.parentId;
  }
  return false;
}
