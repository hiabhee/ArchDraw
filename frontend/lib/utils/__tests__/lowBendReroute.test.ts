import { describe, it, expect } from 'vitest'
import { type Edge, type Node } from 'reactflow'
import { computeEdgeRoute } from '../edgeRouteBuilder'

function makeNode(id: string, x: number, y: number, width = 120, height = 70): Node {
  return { id, type: 'shapeNode', position: { x, y }, width, height, data: {} } as Node
}

function bends(pts: Array<{ x: number; y: number }>) {
  let n = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1]
    if (Math.sign(b.x - a.x) !== Math.sign(c.x - b.x) || Math.sign(b.y - a.y) !== Math.sign(c.y - b.y)) n++
  }
  return n
}

/** True if path has a short reverse S near either end (unprofessional stub wiggle). */
function hasTerminalSPattern(pts: Array<{ x: number; y: number }>): boolean {
  if (pts.length < 4) return false
  for (let i = 0; i < pts.length - 3; i++) {
    // Only inspect near terminals
    if (i > 1 && i < pts.length - 4) continue
    const a = pts[i], b = pts[i + 1], c = pts[i + 2], d = pts[i + 3]
    const abx = Math.sign(b.x - a.x), aby = Math.sign(b.y - a.y)
    const cdx = Math.sign(d.x - c.x), cdy = Math.sign(d.y - c.y)
    const bcx = Math.sign(c.x - b.x), bcy = Math.sign(c.y - b.y)
    const horizS = aby === 0 && cdy === 0 && abx !== 0 && cdx !== 0 && abx === -cdx && bcx === 0
    const vertS = abx === 0 && cdx === 0 && aby !== 0 && cdy !== 0 && aby === -cdy && bcy === 0
    if (!horizS && !vertS) continue
    const reverseLen = horizS ? Math.abs(d.x - c.x) : Math.abs(d.y - c.y)
    const legLen = horizS ? Math.abs(c.y - b.y) : Math.abs(c.x - b.x)
    if (reverseLen <= 80 && legLen <= 100) return true
  }
  return false
}

describe('low-bend collision reroutes', () => {
  it('wraps a mid-corridor blocker with a clean U (≤4 bends, no terminal S)', () => {
    const source = makeNode('source', 0, 100)
    const target = makeNode('target', 500, 100)
    const blocker = makeNode('blocker', 260, 70, 120, 140)
    const edge = { id: 'e', source: 'source', target: 'target', data: {} } as Edge
    const route = computeEdgeRoute(edge, [source, target, blocker], [edge])

    expect(bends(route.waypoints)).toBeLessThanOrEqual(4)
    expect(hasTerminalSPattern(route.waypoints)).toBe(false)
  })

  it('clips a partially overlapping corridor with a clean U, not an 8-bend S', () => {
    const source = makeNode('source', 0, 100, 120, 80)
    const target = makeNode('target', 500, 100, 120, 80)
    const blocker = makeNode('blocker', 220, 110, 100, 60)
    const edge = {
      id: 'e',
      source: 'source',
      target: 'target',
      data: { sourceSide: 'right', targetSide: 'left' },
    } as Edge
    const route = computeEdgeRoute(edge, [source, target, blocker], [edge])

    expect(bends(route.waypoints)).toBeLessThanOrEqual(4)
    expect(hasTerminalSPattern(route.waypoints)).toBe(false)
  })
})
