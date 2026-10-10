/**
 * Single source of truth for layout-engine size/padding constants.
 *
 * Consumed by the Dagre engine, the subgraph sizers, and relayout so the
 * space dagre reserves for a group exactly matches the box the sizer draws.
 * Do not hand-copy these numbers into other modules — import them.
 */

/**
 * Fallback dimensions for nodes that reach layout without explicit dims
 * (programmatically added / not yet painted). Fixed grid uses 200×100 for
 * all nodes so ranks stay level and edges share same Y per rank.
 */
export const DEFAULT_NODE_WIDTH = 200;
export const DEFAULT_NODE_HEIGHT = 100;

/** Horizontal air inside a group container (left and right). */
export const SUBGRAPH_PADDING_X = 28;
/** Air above a group's children — reserved for group header/label (tightened from 56). */
export const SUBGRAPH_PADDING_TOP = 48;
/** Air below a group's children. */
export const SUBGRAPH_PADDING_BOTTOM = 28;
