/**
 * Single source of truth for layout-engine size/padding constants.
 *
 * Consumed by the Dagre engine, the subgraph sizers, and relayout so the
 * space dagre reserves for a group exactly matches the box the sizer draws.
 * Do not hand-copy these numbers into other modules — import them.
 */

/**
 * Fallback dimensions for nodes that reach layout without explicit dims
 * (programmatically added / not yet painted). Must be at or above the real
 * render floor: min shape sizes are ≥160×80 and cylinders are 200×120, so
 * reserving less guarantees rank overlaps.
 */
export const DEFAULT_NODE_WIDTH = 200;
export const DEFAULT_NODE_HEIGHT = 88;

/** Horizontal air inside a group container (left and right). */
export const SUBGRAPH_PADDING_X = 28;
/** Air above a group's children — reserved for the group header/label. */
export const SUBGRAPH_PADDING_TOP = 48;
/** Air below a group's children. */
export const SUBGRAPH_PADDING_BOTTOM = 28;
