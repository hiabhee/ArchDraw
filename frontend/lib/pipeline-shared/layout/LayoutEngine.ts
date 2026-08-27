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
 * Canonical compound-graph spacing — symmetry-first.
 * Tuned for optical-grid nodes (160–240px) with generous air so ranks read
 * as balanced columns/rows, not packed clusters. Larger rankSep/nodeSep give
 * mirrored sub-trees (e.g. Leader → 2 Followers) room to center.
 */
export function defaultCompoundLayoutOptions(direction: LayoutDirection): LayoutOptions {
  const isVertical = direction === 'TB' || direction === 'BT';
  return {
    nodeSep: isVertical ? 150 : 180,
    rankSep: 240,
    marginX: 80,
    marginY: 80,
    // Group padding must match the subgraph sizer exactly (layoutConstants) so
    // the container dagre reserves is the container that gets drawn.
    paddingLeft: SUBGRAPH_PADDING_X,
    paddingRight: SUBGRAPH_PADDING_X,
    paddingTop: SUBGRAPH_PADDING_TOP,
    paddingBottom: SUBGRAPH_PADDING_BOTTOM,
  };
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
