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
 * Canonical compound-graph spacing — compact, alignment-first.
 * Tuned for fixed-grid nodes (160/200/240×100) with tight air so ranks read
 * as cohesive columns/rows without sprawling. Previous generous (150/180, 240,
 * 80) left large gaps between 2 nodes — tightened to remove unnecessary space
 * while still centering mirrored sub-trees (e.g. Leader → 2 Followers).
 */
export function defaultCompoundLayoutOptions(
  direction: LayoutDirection,
  density?: { edgeCount?: number; nodeCount?: number },
): LayoutOptions {
  const isVertical = direction === 'TB' || direction === 'BT';
  const base: LayoutOptions = {
    nodeSep: isVertical ? 50 : 60,
    rankSep: 120,
    marginX: 32,
    marginY: 32,
    // Group padding must match the subgraph sizer exactly (layoutConstants) so
    // the container dagre reserves is the container that gets drawn.
    paddingLeft: SUBGRAPH_PADDING_X,
    paddingRight: SUBGRAPH_PADDING_X,
    paddingTop: SUBGRAPH_PADDING_TOP,
    paddingBottom: SUBGRAPH_PADDING_BOTTOM,
  };

  // Adaptive density bump — simple approach for crowded graphs (e.g. >6 edges).
  // Keeps base values stable for sparse diagrams (tests, landing demo) but
  // adds air when edge count signals a tangled flow (URL-shortener example).
  const edgeCount = density?.edgeCount ?? 0;
  if (edgeCount > 6) {
    const extraEdges = edgeCount - 6;
    // Cap to avoid sprawling small demo graphs on extreme inputs
    const nodeExtra = Math.min(40, extraEdges * 8);
    const rankExtra = Math.min(80, extraEdges * 12);
    base.nodeSep = (base.nodeSep ?? 0) + nodeExtra;
    base.rankSep = (base.rankSep ?? 0) + rankExtra;
  }

  return base;
}

/**
 * Rough edge-label pill size so dagre reserves rank space for it. Mirrors the
 * counter-scaled label sizing in `lib/utils/edgeLabelLayout.ts` (worst-case 2x
 * CSS size) without importing canvas-only modules into the engine.
 *
 * Lives here (not in a single engine) so the flat compound path AND the
 * two-phase compound path reserve label space identically — otherwise grouped
 * diagrams, which take the two-phase path, would pack ranks as if labels had
 * zero size and drop labels onto nodes.
 */
export function estimateEdgeLabelSize(label: string | undefined): { width: number; height: number } {
  if (!label) return { width: 0, height: 0 };
  const cssWidth = Math.max(24, label.length * 4.8 + 10);
  return { width: cssWidth * 2, height: 11 * 2 };
}
