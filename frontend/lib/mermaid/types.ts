import type { ShapeType } from '@/lib/shapeRegistry';

export type Direction = 'TD' | 'LR' | 'BT' | 'RL'
export type Shape = 'rectangle' | 'diamond' | 'circle' | 'rounded' | 'cylinder' | 'hexagon' | 'parallelogram'
export type EdgeType = 'arrow' | 'dotted' | 'thick' | 'open' | 'bidirectional' | 'invisible'

export interface ParsedNodeStyle {
  fill?: string
  stroke?: string
}

export interface ParsedNode {
  id: string
  label: string
  shape: Shape
  subgraphId: string | null
  /** Optional Mermaid style/classDef fill+stroke applied at build time. */
  style?: ParsedNodeStyle
  /**
   * Canvas silhouette override from `%% archdraw-shape` directives for shapes
   * Mermaid has no native token for (cloud, shield, actor, monitor, mobile,
   * dashed-rectangle). Applied at build time over the native/classified shape.
   */
  shapeOverride?: ShapeType
}

export interface ParsedEdge {
  id: string
  source: string
  target: string
  label: string | null
  type: EdgeType
}

export interface ParsedSubgraph {
  id: string
  label: string
  nodeIds: string[]
  parentId?: string
  direction?: Direction
}

export type TextSize = 'small' | 'medium' | 'large' | 'heading'
export type TextAnchor = 'top' | 'subgraph' | 'node' | 'none'

/**
 * A free-text element the AI (or a pasted Mermaid snippet) can add to a diagram.
 * Serialized to/from `%% archdraw-text` / `%% archdraw-note` comment directives
 * so it survives the canonical Mermaid round-trip without affecting stock
 * Mermaid rendering.
 */
export interface ParsedText {
  id: string
  kind: 'text' | 'note'
  /** Free text of a `text` element. */
  text?: string
  /** Title of a `note` element. */
  title?: string
  /** Body of a `note` element. */
  body?: string
  size?: TextSize
  /** Placement strategy; `none` preserves `position` on round-trip. */
  anchor: TextAnchor
  /** Subgraph/node id when `anchor` is `subgraph` / `node`. */
  anchorTarget?: string
  position?: { x: number; y: number } | null
}

export interface MermaidAST {
  direction: Direction
  nodes: ParsedNode[]
  edges: ParsedEdge[]
  subgraphs: ParsedSubgraph[]
  texts: ParsedText[]
}

export interface ParseError {
  line: number
  reason: string
}

export type ParseResult = { ok: true; ast: MermaidAST } | { ok: false; errors: ParseError[] }

export interface ValidationWarning {
  type: string
  nodeId?: string
  edgeId?: string
  message: string
}

export interface ValidationReport {
  passed: boolean
  warnings: ValidationWarning[]
}

export interface RFNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  parentNode?: string
  extent?: 'parent' | [[number, number], [number, number]]
  width?: number
  height?: number
  style?: Record<string, unknown>
  zIndex?: number
}

export interface RFEdge {
  id: string
  source: string
  target: string
  sourceHandle: string | null
  targetHandle: string | null
  type: string
  label?: string
  data?: Record<string, unknown>
  animated?: boolean
  [key: string]: unknown
}

export interface RFObjects {
  nodes: RFNode[]
  edges: RFEdge[]
}

export const NODE_WIDTH = 180
export const NODE_HEIGHT = 100

export const SHAPE_TO_NODE_TYPE: Record<Shape, string> = {
  rectangle: 'shapeNode',
  diamond: 'shapeNode',
  circle: 'shapeNode',
  rounded: 'shapeNode',
  cylinder: 'shapeNode',
  hexagon: 'shapeNode',
  parallelogram: 'shapeNode',
}
