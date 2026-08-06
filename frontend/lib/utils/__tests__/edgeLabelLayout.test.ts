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

  it('places fan-in labels on unique stems, not the shared trunk', () => {
    // Three sources stacked vertically, one target to the right — routes drop
    // then join a shared horizontal trunk into the target (the screenshot case).
    const nodes = [
      makeNode('n1', 100, 40),
      makeNode('n2', 100, 160),
      makeNode('n3', 100, 280),
      makeNode('sink', 700, 160),
    ]
    const edges = [
      makeEdge('e1', 'n1', 'sink', { label: 'sends update' }),
      makeEdge('e2', 'n2', 'sink', { label: 'stores comment' }),
      makeEdge('e3', 'n3', 'sink', { label: 'stores like' }),
    ]
    const res = computeEdgeLabelLayout(edges, nodeInternals(nodes), 'LR')

    const a1 = res.get('e1')!
    const a2 = res.get('e2')!
    const a3 = res.get('e3')!
    expect(a1).toBeDefined()
    expect(a2).toBeDefined()
    expect(a3).toBeDefined()

    // Each label should sit near its own source's y (unique vertical stem),
    // not stacked on the shared horizontal mid-corridor (~y of sink center).
    const sinkCenterY = 160 + 40
    expect(Math.abs(a1.y - sinkCenterY)).toBeGreaterThan(30)
    expect(Math.abs(a3.y - sinkCenterY)).toBeGreaterThan(30)

    // Labels must remain associated with distinct vertical positions.
    const ys = [a1.y, a2.y, a3.y].sort((x, y) => x - y)
    expect(ys[1] - ys[0]).toBeGreaterThan(20)
    expect(ys[2] - ys[1]).toBeGreaterThan(20)

    // And stay off the far-right shared trunk (closer to sources than sink).
    const sinkLeft = 700
    expect(a1.x).toBeLessThan(sinkLeft - 80)
    expect(a2.x).toBeLessThan(sinkLeft - 80)
    expect(a3.x).toBeLessThan(sinkLeft - 80)

    expect(overlaps(rectOf(a1, 'sends update'), rectOf(a2, 'stores comment'))).toBe(false)
    expect(overlaps(rectOf(a2, 'stores comment'), rectOf(a3, 'stores like'))).toBe(false)
  })

  it('places labels on vertical drops into a shared horizontal bus', () => {
    const nodes = [
      makeNode('notif', 80, 40, 200, 80),
      makeNode('comment', 320, 40, 200, 80),
      makeNode('like', 560, 40, 200, 80),
      makeNode('sink', 400, 400, 200, 80),
    ]
    const edges = [
      makeEdge('e1', 'notif', 'sink', {
        label: 'sends update',
        // Force bottom→top so routes drop then join a shared bus.
      }),
      makeEdge('e2', 'comment', 'sink', { label: 'stores comment' }),
      makeEdge('e3', 'like', 'sink', { label: 'stores like' }),
    ]
    // Attach explicit handles like the canvas does after connection.
    edges[0].sourceHandle = 'source-bottom'
    edges[0].targetHandle = 'target-top'
    edges[1].sourceHandle = 'source-bottom'
    edges[1].targetHandle = 'target-top'
    edges[2].sourceHandle = 'source-bottom'
    edges[2].targetHandle = 'target-top'

    const res = computeEdgeLabelLayout(edges, nodeInternals(nodes), 'TD')
    const a1 = res.get('e1')!
    const a2 = res.get('e2')!
    const a3 = res.get('e3')!

    // Labels must sit on the private vertical legs (near each source's x),
    // not on the shared horizontal bus at y≈260.
    expect(a1.x).toBeCloseTo(80 + 100, 0)
    expect(a2.x).toBeCloseTo(320 + 100, 0)
    expect(a3.x).toBeCloseTo(560 + 100, 0)
    expect(a1.y).toBeLessThan(250)
    expect(a2.y).toBeLessThan(250)
    expect(a3.y).toBeLessThan(250)
    expect(Math.abs(a1.x - a2.x)).toBeGreaterThan(100)
    expect(Math.abs(a2.x - a3.x)).toBeGreaterThan(100)
  })

  it('keeps a gap between chain-edge labels and their source nodes', () => {
    // Mid-path waypoints on a straight shot used to split the edge into two
    // segments and park the label flush against the source (BOP / Wellhead).
    const nodes = [
      makeNode('bop', 100, 100, 200, 88),
      makeNode('wh', 400, 100, 200, 88),
      makeNode('next', 700, 100, 200, 88),
    ]
    const edges = [
      makeEdge('e1', 'bop', 'wh', { label: 'controls pressure' }),
      makeEdge('e2', 'wh', 'next', { label: 'safely contains' }),
    ]
    const res = computeEdgeLabelLayout(edges, nodeInternals(nodes), 'LR')
    const a1 = res.get('e1')!
    const a2 = res.get('e2')!

    const cssSize = (text: string) => ({
      w: Math.max(30, text.length * 6 + 12),
      h: 14,
    })
    const gap = 12
    const overlapsNode = (
      anchor: { x: number; y: number },
      text: string,
      node: { x: number; y: number; w: number; h: number },
    ) => {
      const s = cssSize(text)
      const lr = { x: anchor.x - s.w / 2, y: anchor.y - s.h / 2, w: s.w, h: s.h }
      const nr = { x: node.x - gap, y: node.y - gap, w: node.w + 2 * gap, h: node.h + 2 * gap }
      return lr.x < nr.x + nr.w && lr.x + lr.w > nr.x && lr.y < nr.y + nr.h && lr.y + lr.h > nr.y
    }

    expect(overlapsNode(a1, 'controls pressure', { x: 100, y: 100, w: 200, h: 88 })).toBe(false)
    expect(overlapsNode(a1, 'controls pressure', { x: 400, y: 100, w: 200, h: 88 })).toBe(false)
    expect(overlapsNode(a2, 'safely contains', { x: 400, y: 100, w: 200, h: 88 })).toBe(false)
    expect(overlapsNode(a2, 'safely contains', { x: 700, y: 100, w: 200, h: 88 })).toBe(false)
    // Prefer mid-gap along the path, not the old source-hugging ~0.225.
    expect(a1.t).toBeGreaterThan(0.35)
    expect(a2.t).toBeGreaterThan(0.35)
  })
})
