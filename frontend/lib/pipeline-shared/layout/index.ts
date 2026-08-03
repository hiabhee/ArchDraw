export { DagreLayoutEngine } from './DagreLayout';
// Elk is lazy-loaded via IntegratedLayout when useElk=true. Keep a named export for tests/callers
// that need the engine directly — ElkLayout itself loads elk.bundled.js dynamically (no web-worker).
export { ElkLayoutEngine } from './ElkLayout';
export {
  IntegratedLayoutEngine,
  getIntegratedLayoutEngine,
  applyRfLayout,
  applyRfLayoutAsync,
} from './IntegratedLayout';
export type {
  LayoutEngine,
  LayoutParams,
  LayoutResult,
  LayoutNode,
  LayoutEdge,
  PositionedNode,
  PositionedEdge,
  LayoutDirection,
  LayoutOptions,
} from './LayoutEngine';
export {
  defaultCompoundLayoutOptions,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
} from './LayoutEngine';
export type {
  IntegratedLayoutOptions,
  RFObjects,
  RFNode,
  RFEdge,
  Direction,
} from './IntegratedLayout';
