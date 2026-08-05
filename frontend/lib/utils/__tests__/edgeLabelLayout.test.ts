import { describe, it, expect } from 'vitest'
import type { Edge, Node } from 'reactflow'
import {
  computeEdgeLabelLayout,
  buildPathSegments,
  pointAtFraction,
  type EdgeLabelAnchor,
} from '../edgeLabelLayout'
import { computeEdgeRoute } from '../edgeRouteBuilder'

function makeNode(id: string, x: number, y: number, w = 160, h = 80): Node {
  return { id, type: 'system', position: { x, y }, width: w, height: h, data: {} } as Node
}

function makeEdge(id: string, source: string, target: string, data?: Record<string, unknown>): Edge {
  return { id, source, target, type: 'default', data } as Edge
}

function nodeInternals(nodes: Node[]): ReadonlyMap<string, Node> {
  return new Map(nodes.map((n) => [n.id, n]))
}

/** Mirrors the reserved label rect used by the engine. */
function reservedSize(text: string): { w: number; h: number } {
  const cssW = Math.max(30, text.length * 6 + 12)
  return { w: cssW * 2, h: 14 * 2 }
}

function rectOf(anchor: EdgeLabelAnchor, text: string) {
  const size = reservedSize(text)
  return { x: anchor.x - size.w / 2, y: anchor.y - size.h / 2, w: size.w, h: size.h }
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

describe('pointAtFraction', () => {
  it('interpolates along a straight line by arc length', () => {
    const segs = buildPathSegments([{ x: 0, y: 0 }, { x: 200, y: 0 }])
    expect(pointAtFraction(segs, 0)).toEqual({ x: 0, y: 0 })
    expect(pointAtFraction(segs, 1)).toEqual({ x: 200, y: 0 })
    const mid = pointAtFraction(segs, 0.5)
    expect(mid.x).toBeCloseTo(100, 3)
    expect(mid.y).toBeCloseTo(0, 3)
  })

  it('walks corners with arc-length parameterization matching the smooth-step geometry', () => {
    // (0,0) -> (100,0) -> (100,100) rounds the corner at (100,0) with r=24.
    const segs = buildPathSegments([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])
    // t=0.5 lands exactly mid-arc of the 90° corner centered at (76,24).
    const expectedX = 76 + 24 * Math.cos(-Math.PI / 4)
    const expectedY = 24 + 24 * Math.sin(-Math.PI / 4)
    const p = pointAtFraction(segs, 0.5)
    expect(p.x).toBeCloseTo(expectedX, 1)
    expect(p.y).toBeCloseTo(expectedY, 1)
    expect(pointAtFraction(segs, 0)).toEqual({ x: 0, y: 0 })
    const end = pointAtFraction(segs, 1)
    expect(end.x).toBeCloseTo(100, 3)
    expect(end.y).toBeCloseTo(100, 3)
  })
})

describe('computeEdgeLabelLayout', () => {
  it('keeps a lone label at its preferred midpoint (no movement)', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 100)]
    const edges = [makeEdge('e1', 'a', 'b', { label: 'REQ' })]
    const res = computeEdgeLabelLayout(edges, nodeInternals(nodes), 'LR')
    const anchor = res.get('e1')
    expect(anchor).toBeDefined()
    expect(anchor!.t).toBeCloseTo(0.5, 3)
    // Straight route (260,140) -> (500,140): midpoint is (380,140).
    expect(anchor!.x).toBeCloseTo(380, 0)
    expect(anchor!.y).toBeCloseTo(140, 0)
  })

  it('respects a stored labelT as the preferred position', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 100)]
    const edges = [makeEdge('e1', 'a', 'b', { label: 'REQ', labelT: 0.25 })]
    const res = computeEdgeLabelLayout(edges, nodeInternals(nodes), 'LR')
    const anchor = res.get('e1')
    expect(anchor).toBeDefined()
    expect(anchor!.t).toBeCloseTo(0.25, 3)
    // The route starts 12px off the node edge (272, not 260), so the expected
    // point is computed from the same path geometry the engine uses.
    const route = computeEdgeRoute(edges[0], nodes, edges, 'LR')
    const expected = pointAtFraction(buildPathSegments(route.waypoints), 0.25)
    expect(anchor!.x).toBeCloseTo(expected.x, 0)
    expect(anchor!.y).toBeCloseTo(expected.y, 0)
  })

  it('stacks labels of parallel edges perpendicular to the path', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 100)]
    const edges = [
      makeEdge('e1', 'a', 'b', { label: 'REQUEST' }),
      makeEdge('e2', 'a', 'b', { label: 'RESPONSE' }),
    ]
    const res = computeEdgeLabelLayout(edges, nodeInternals(nodes), 'LR')
    const a = res.get('e1')!
    const b = res.get('e2')!
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    // Horizontal path -> perpendicular offset is vertical. The labels must not
    // share the line and their rects must not overlap.
    expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(32 - 0.001)
    expect(overlaps(rectOf(a, 'REQUEST'), rectOf(b, 'RESPONSE'))).toBe(false)
  })

  it('resolves overlaps across several labeled edges', () => {
    const nodes = [
      makeNode('a', 100, 100),
      makeNode('b', 500, 100),
      makeNode('c', 300, 320),
      makeNode('d', 700, 320),
    ]
    const edges = [
      makeEdge('e1', 'a', 'b', { label: 'SYNC CALL' }),
      makeEdge('e2', 'a', 'c', { label: 'ASYNC EVENT' }),
      makeEdge('e3', 'b', 'c', { label: 'DATA FETCH' }),
      makeEdge('e4', 'c', 'd', { label: 'STREAM PUSH' }),
    ]
    const res = computeEdgeLabelLayout(edges, nodeInternals(nodes), 'LR')
    const anchors = [
      ['e1', 'SYNC CALL'],
      ['e2', 'ASYNC EVENT'],
      ['e3', 'DATA FETCH'],
      ['e4', 'STREAM PUSH'],
    ].map(([id, label]) => rectOf(res.get(id)!, label as string))

    for (let i = 0; i < anchors.length; i++) {
      for (let j = i + 1; j < anchors.length; j++) {
        expect(overlaps(anchors[i], anchors[j])).toBe(false)
      }
    }
  })

  it('returns identical results (shared cache) for identical inputs', () => {
    const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 100)]
    const edges = [makeEdge('e1', 'a', 'b', { label: 'REQ' })]
    const ni = nodeInternals(nodes)
    const r1 = computeEdgeLabelLayout(edges, ni, 'LR')
    const r2 = computeEdgeLabelLayout(edges, ni, 'LR')
    expect(r1).toBe(r2)
    expect(Array.from(r1.entries())).toEqual(Array.from(r2.entries()))
  })

  it('recomputes when node geometry changes', () => {
    const edges = [makeEdge('e1', 'a', 'b', { label: 'REQ' })]
    const nodesA = [makeNode('a', 100, 100), makeNode('b', 500, 100)]
    const nodesB = [makeNode('a', 100, 100), makeNode('b', 500, 300)]
    const niA = nodeInternals(nodesA)
    const niB = nodeInternals(nodesB)
    const ra = computeEdgeLabelLayout(edges, niA, 'LR')
    const rb = computeEdgeLabelLayout(edges, niB, 'LR')
    expect(ra.get('e1')!.y).toBeCloseTo(140, 0)
    expect(rb.get('e1')!.y).toBeCloseTo(240, 0)
    expect(ra).not.toBe(rb)
  })
})
