/**
 * Whether a node's wrapper (`node.width` / `node.height`: the size React Flow draws the
 * node box at, measures, and routes edges to) already matches the size its card
 * computed for itself. A card writes its computed size to the store, but a saved or
 * reloaded node can come back with the older size on the wrapper while its `data` is
 * already current; the card then overflows its own box, and handles and edges stay at
 * the old box. A wrapper whose size is not known yet has nothing to correct.
 *
 * The tolerance absorbs React Flow's measured floats (a size that settles to within a
 * pixel is the same size), which is what keeps a re-sync from ping-ponging.
 */
export function wrapperMatchesSize(
  wrapper: { width?: number | null; height?: number | null } | undefined,
  width: number,
  height: number,
): boolean {
  if (wrapper?.width == null || wrapper?.height == null) return true;
  return Math.abs(wrapper.width - width) < 1 && Math.abs(wrapper.height - height) < 1;
}
