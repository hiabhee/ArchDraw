/**
 * Backward-compatible re-export barrel.
 * All logic has been split into:
 *   - edgeRouting/svgPathBuilder.ts  (SVG path / trim helpers)
 *   - edgeRouting/astar.ts           (A* grid fallback)
 *   - edgeRouting/waypoints.ts       (types, collision, routing, public API)
 */
export * from './edgeRouting/svgPathBuilder';
export * from './edgeRouting/waypoints';
// astar is an internal dependency of waypoints; re-export so callers that
// reference findAstFallbackPath directly still compile.
export { findAstFallbackPath } from './edgeRouting/astar';
