export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

import {
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  SUBGRAPH_PADDING_X,
  SUBGRAPH_PADDING_TOP,
  SUBGRAPH_PADDING_BOTTOM,
} from './layoutConstants';

export { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT };

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
  parentId?: string;
  isGroup?: boolean;
  direction?: LayoutDirection;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  /** Optional label — the engine reserves rank space for its pill. */
  label?: string;
}

export interface LayoutOptions {
  nodeSep?: number;
  rankSep?: number;
  marginX?: number;
  marginY?: number;
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
}

export interface LayoutParams {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  direction: LayoutDirection;
  options?: LayoutOptions;
}

export interface PositionedNode extends LayoutNode {
  x: number;
  y: number;
}

export interface PositionedEdge extends LayoutEdge {
  points?: Array<{ x: number; y: number }>;
}

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  warnings: string[];
}

export interface LayoutEngine {
  readonly name: string;
  layout(params: LayoutParams): Promise<LayoutResult>;
  isAvailable(): boolean;
}

/**
 * Canonical compound-graph spacing — flow-first, generous air.
 * Tuned for fixed-grid nodes (160/200/240×100) with balanced separation so
 * ranks read as distinct columns/rows and edges have room to route without
 * crossing. History: tight (50/60,120,32) packed nodes and hid label space;
 * generous (150/180,240,80) sprawled small diagrams. This middle ground keeps
 * 2-node demos compact while giving 10-15 node architectures clear flow,
 * still centering mirrored sub-trees (e.g. Leader → 2 Followers).
 */
export function defaultCompoundLayoutOptions(
  direction: LayoutDirection,
  density?: { edgeCount?: number; nodeCount?: number },
): LayoutOptions {
  const isVertical = direction === 'TB' || direction === 'BT';
  const base: LayoutOptions = {
    nodeSep: isVertical ? 90 : 110,
    rankSep: 170,
    marginX: 48,
    marginY: 48,
    // Group padding must match the subgraph sizer exactly (layoutConstants) so
    // the container dagre reserves is the container that gets drawn.
    paddingLeft: SUBGRAPH_PADDING_X,
    paddingRight: SUBGRAPH_PADDING_X,
    paddingTop: SUBGRAPH_PADDING_TOP,
    paddingBottom: SUBGRAPH_PADDING_BOTTOM,
  };

  // Adaptive density bump — adds air for crowded graphs (e.g. >10 edges) where
  // flat 170/110 would still feel tangled. Keeps base values stable for sparse
  // diagrams (tests, landing demo) but expands for URL-shortener / video-stream
  // style dense graphs. Capped to avoid sprawling extreme inputs.
  const edgeCount = density?.edgeCount ?? 0;
  const nodeCount = density?.nodeCount ?? 0;
  // Density trigger: either many edges or high edge-to-node ratio (>1.6 signals web)
  const densityScore = Math.max(edgeCount, Math.round((edgeCount / Math.max(1, nodeCount)) * 10));
  const effectiveCount = edgeCount > 10 || densityScore > 16 ? edgeCount : 0;
  if (effectiveCount > 10) {
    const extraEdges = effectiveCount - 10;
    const nodeExtra = Math.min(30, extraEdges * 6);
    const rankExtra = Math.min(60, extraEdges * 10);
    base.nodeSep = (base.nodeSep ?? 0) + nodeExtra;
    base.rankSep = (base.rankSep ?? 0) + rankExtra;
  } else if (edgeCount > 6) {
    // Mild bump for moderate density (7-10 edges) – keeps legacy behavior but softer
    const extraEdges = edgeCount - 6;
    const nodeExtra = Math.min(20, extraEdges * 5);
    const rankExtra = Math.min(30, extraEdges * 7);
    base.nodeSep = (base.nodeSep ?? 0) + nodeExtra;
    base.rankSep = (base.rankSep ?? 0) + rankExtra;
  }

  return base;
}

/**
 * Rough edge-label pill size so dagre reserves rank space for it. Mirrors the
 * counter-scaled label sizing in `lib/utils/edgeLabelLayout.ts` (worst-case 1.5x
 * CSS size) without importing canvas-only modules into the engine.
 * Updated for larger readable labels (precision 10.5px / brutal 11px).
 *
 * Lives here (not in a single engine) so the flat compound path AND the
 * two-phase compound path reserve label space identically — otherwise grouped
 * diagrams, which take the two-phase path, would pack ranks as if labels had
 * zero size and drop labels onto nodes.
 */
export function estimateEdgeLabelSize(label: string | undefined): { width: number; height: number } {
  if (!label) return { width: 0, height: 0 };
  // Reserve for the larger brutal pill (worst case): 6.2px per char + 16 padding, 15px height, 1.5x counter-scale
  const cssWidth = Math.max(38, label.length * 6.2 + 16);
  return { width: cssWidth * 1.5, height: 15 * 1.5 };
}
