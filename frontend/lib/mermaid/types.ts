export type Direction = 'TD' | 'LR' | 'BT' | 'RL'
export type Shape = 'rectangle' | 'diamond' | 'circle' | 'rounded' | 'cylinder' | 'hexagon' | 'parallelogram'
export type EdgeType = 'arrow' | 'dotted' | 'thick' | 'open' | 'bidirectional'

export interface ParsedNode {
  id: string
  label: string
  shape: Shape
  subgraphId: string | null
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

export interface MermaidAST {
  direction: Direction
  nodes: ParsedNode[]
  edges: ParsedEdge[]
  subgraphs: ParsedSubgraph[]
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
  extent?: 'parent'
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
export const NODE_HEIGHT = 60
export const SUBGRAPH_PADDING = 40

export const SHAPE_TO_NODE_TYPE: Record<Shape, string> = {
  rectangle: 'shapeNode',
  diamond: 'shapeNode',
  circle: 'shapeNode',
  rounded: 'shapeNode',
  cylinder: 'shapeNode',
  hexagon: 'shapeNode',
  parallelogram: 'shapeNode',
}
