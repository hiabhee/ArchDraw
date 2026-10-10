/**
 * Canonical React Flow graph shapes shared by the Mermaid pipeline, layout
 * engine and converters. Defined here (the lowest pipeline layer) so that
 * pipeline-shared never has to import upward from lib/mermaid.
 */

export type Direction = 'TD' | 'LR' | 'BT' | 'RL'

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

/** Edge shape accepted as layout input: handles/type may be absent. */
export interface RFEdgeInput {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  type?: string
  label?: unknown
  data?: Record<string, unknown>
  animated?: boolean
  [key: string]: unknown
}

/** Graph accepted as layout input. */
export interface RFObjectsInput {
  nodes: RFNode[]
  edges: RFEdgeInput[]
}
