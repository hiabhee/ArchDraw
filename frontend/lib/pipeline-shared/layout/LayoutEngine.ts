export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

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
 * Canonical compound-graph spacing.
 * Tuned for optical-grid nodes (160–240px): keep clear air between ranks so
 * dense diagrams (e.g. load-balancer / api-edge) do not read as packed.
 */
export function defaultCompoundLayoutOptions(direction: LayoutDirection): LayoutOptions {
  const isVertical = direction === 'TB' || direction === 'BT';
  return {
    nodeSep: isVertical ? 140 : 180,
    rankSep: isVertical ? 200 : 200,
    marginX: 40,
    marginY: 40,
    paddingLeft: 48,
    paddingRight: 48,
    paddingTop: 72,
    paddingBottom: 48,
  };
}

export const DEFAULT_NODE_WIDTH = 180;
export const DEFAULT_NODE_HEIGHT = 60;
