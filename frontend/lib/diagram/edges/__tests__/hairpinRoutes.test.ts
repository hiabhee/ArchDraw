import { describe, it, expect } from 'vitest'
import { Position, type Edge, type Node } from 'reactflow'
import { computeDiagramGeometryPlan } from '@/lib/diagram/geometry/diagramGeometry'
import { hasHairpinTurn } from '../edgeRouteBuilder'
import { buildDefaultOrthogonalWaypoints, facingSideToward } from '../handlerPairScorer'

function makeNode(id: string, x: number, y: number, width = 200, height = 80): Node {
  return { id, type: 'shapeNode', position: { x, y }, width, height, data: {} } as Node
}

describe('hairpin-free routing', () => {
  it('faces vertically when stacked wide nodes have a sideways offset', () => {
    // Centers differ more in x (150) than y (120), but the only clear gap is vertical.
    const a = { x: 0, y: 0, width: 200, height: 80 }
    const b = { x: 150, y: 120, width: 200, height: 80 }
    expect(facingSideToward(a, b)).toBe(Position.Bottom)
    expect(facingSideToward(b, a)).toBe(Position.Top)
  })

  it('keeps a lane offset from pushing the Z lane behind a facing handle', () => {
    const points = buildDefaultOrthogonalWaypoints(
      { x: 772, y: 114 }, { x: 788, y: 154 }, Position.Right, Position.Left, -24,
    )
    // First leg must leave the Right handle rightward, never backwards.
    expect(points[1].x).toBeGreaterThanOrEqual(772)
    expect(hasHairpinTurn(points, 48)).toBe(false)
  })

  it('routes a bidirectional pair between offset stacked nodes without a U-turn', () => {
    // Previously both edges overshot their handle and doubled back.
    const nodes = [makeNode('a', 0, 0), makeNode('b', 40, 160)]
    const edges = [
      { id: 'ab', source: 'a', target: 'b', data: {} },
      { id: 'ba', source: 'b', target: 'a', data: {} },
    ] as Edge[]
    const plan = computeDiagramGeometryPlan(nodes, edges, { direction: 'LR', renderStyleId: 'precision' })
    for (const edge of edges) {
      expect(hasHairpinTurn(plan.routes.get(edge.id)!.waypoints, 48)).toBe(false)
    }
  })

  it('detects a tight overshoot-and-return', () => {
    expect(hasHairpinTurn([{ x: 0, y: 200 }, { x: 0, y: 0 }, { x: 16, y: 0 }, { x: 16, y: 40 }], 48)).toBe(true)
    expect(hasHairpinTurn([{ x: 0, y: 200 }, { x: 0, y: 0 }, { x: 160, y: 0 }, { x: 160, y: 40 }], 48)).toBe(false)
  })
})
