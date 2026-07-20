import { describe, expect, it } from 'vitest'
import { Position, type Edge, type Node } from 'reactflow'
import { planPath, type ObstacleRect, type Point } from './pathPlanner'
import { computeEdgeRoute } from '../utils/edgeRouteBuilder'
import { getCollisionFreeWaypoints, segmentIntersectsRect } from '../utils/collisionFreeEdgePath'

function pathHitsRect(points: Point[], rect: ObstacleRect): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (segmentIntersectsRect(
      points[i].x,
      points[i].y,
      points[i + 1].x,
      points[i + 1].y,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
    )) {
      return true
    }
  }
  return false
}

function makeNode(id: string, x: number, y: number, width = 120, height = 70): Node {
  return {
    id,
    type: 'shapeNode',
    position: { x, y },
    width,
    height,
    data: {},
  } as Node
}

describe('pathPlanner', () => {
  it('routes around a node that blocks the direct source-to-target corridor', () => {
    const sourceRect = { x: 0, y: 100, w: 120, h: 70 }
    const targetRect = { x: 500, y: 100, w: 120, h: 70 }
    const blocker = { x: 260, y: 70, w: 120, h: 140 }
    const obstacles = new Map<string, ObstacleRect>([
      ['source', sourceRect],
      ['target', targetRect],
      ['blocker', blocker],
    ])

    const result = planPath({
      sourceRect,
      targetRect,
      obstacles,
      stubLength: 32,
    })

    expect(result).not.toBeNull()
    expect(pathHitsRect(result!.points, blocker)).toBe(false)
    expect(result!.points.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps computed route endpoints aligned with the rendered path', () => {
    const source = makeNode('source', 0, 100)
    const target = makeNode('target', 500, 100)
    const blocker = makeNode('blocker', 260, 70, 120, 140)
    const edge = {
      id: 'edge-source-target',
      source: 'source',
      target: 'target',
      data: {},
    } as Edge

    const route = computeEdgeRoute(edge, [source, target, blocker], [edge])
    const first = route.waypoints[0]
    const last = route.waypoints[route.waypoints.length - 1]

    expect(first).toEqual(route.sourcePoint)
    expect(last).toEqual(route.targetPoint)
    expect(pathHitsRect(route.waypoints, { x: 260, y: 70, w: 120, h: 140 })).toBe(false)
  })

  it('routes lane-assigned edges around blocking nodes', () => {
    const source = makeNode('source', 0, 100)
    const target = makeNode('target', 500, 100)
    const blocker = makeNode('blocker', 260, 70, 120, 140)
    const edge = {
      id: 'edge-source-target',
      source: 'source',
      target: 'target',
      data: {
        laneSourceSide: 'right',
        laneTargetSide: 'left',
      },
    } as Edge

    const route = computeEdgeRoute(edge, [source, target, blocker], [edge])

    // Lane bias cannot override collision on the default Right→Left corridor —
    // scorer may pick another pair, but the routed path must clear the blocker.
    expect(pathHitsRect(route.waypoints, { x: 260, y: 70, w: 120, h: 140 })).toBe(false)
    expect(route.waypoints.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps final edge segment aligned with the target side for correct arrow direction', () => {
    const points = getCollisionFreeWaypoints({
      sourceX: 100,
      sourceY: 40,
      targetX: 250,
      targetY: 200,
      sourcePosition: Position.Right,
      targetPosition: Position.Top,
      nodeRects: new Map([
        ['blocker', { id: 'blocker', x: 150, y: 60, w: 80, h: 120 }],
      ]),
      excludedNodeIds: new Set(),
    })

    const previous = points[points.length - 2]
    const target = points[points.length - 1]

    expect(previous.x).toBe(target.x)
    expect(previous.y).toBeLessThan(target.y)
  })

  it('routes upper-right to lower-left nodes with nearest facing handlers', () => {
    const source = makeNode('health-checks', 198, 17, 153, 90)
    const target = makeNode('load-balancing', 27, 254, 153, 90)
    const edge = {
      id: 'edge-health-load-balancing',
      source: 'health-checks',
      target: 'load-balancing',
      data: {},
    } as Edge

    const route = computeEdgeRoute(edge, [source, target], [edge])
    const beforeTarget = route.waypoints[route.waypoints.length - 2]

    expect(route.sourcePosition).toBe(Position.Bottom)
    expect(route.targetPosition).toBe(Position.Top)
    expect(route.waypoints.length).toBeGreaterThanOrEqual(3)
    // Entry into Top handle must be vertical from above
    expect(beforeTarget.x).toBe(route.targetPoint.x)
    expect(beforeTarget.y).toBeLessThan(route.targetPoint.y)
  })

  it('does not route through the source or target node interiors', () => {
    const source = makeNode('source', 100, 0, 150, 80)
    const target = makeNode('target', 100, 200, 150, 80)
    const edge = {
      id: 'edge-vertical',
      source: 'source',
      target: 'target',
      data: {},
    } as Edge

    const route = computeEdgeRoute(edge, [source, target], [edge])
    const sourceRect = { x: 100, y: 0, w: 150, h: 80 }
    const targetRect = { x: 100, y: 200, w: 150, h: 80 }

    // Shrink slightly so boundary/stub contact is not treated as interior overlap
    const shrink = (r: ObstacleRect, pad = 2): ObstacleRect => ({
      x: r.x + pad,
      y: r.y + pad,
      w: Math.max(1, r.w - pad * 2),
      h: Math.max(1, r.h - pad * 2),
    })

    expect(pathHitsRect(route.waypoints, shrink(sourceRect))).toBe(false)
    expect(pathHitsRect(route.waypoints, shrink(targetRect))).toBe(false)
  })

  it('reroutes forced far-side pairs so the path does not tunnel through terminals', () => {
    // Bottom→Right on vertically stacked nodes tunnels through the target by default.
    const source = makeNode('source', 100, 0, 150, 80)
    const target = makeNode('target', 100, 200, 150, 80)
    const edge = {
      id: 'edge-forced-tunnel',
      source: 'source',
      target: 'target',
      data: {
        sourceSide: 'bottom',
        targetSide: 'right',
      },
    } as Edge

    const route = computeEdgeRoute(edge, [source, target], [edge])
    const shrink = (r: ObstacleRect, pad = 2): ObstacleRect => ({
      x: r.x + pad,
      y: r.y + pad,
      w: Math.max(1, r.w - pad * 2),
      h: Math.max(1, r.h - pad * 2),
    })

    expect(route.sourcePosition).toBe(Position.Bottom)
    expect(route.targetPosition).toBe(Position.Right)
    expect(pathHitsRect(route.waypoints, shrink({ x: 100, y: 0, w: 150, h: 80 }))).toBe(false)
    expect(pathHitsRect(route.waypoints, shrink({ x: 100, y: 200, w: 150, h: 80 }))).toBe(false)
  })

  it('avoids both intermediate nodes and terminal interiors together', () => {
    const source = makeNode('source', 0, 100, 120, 70)
    const target = makeNode('target', 500, 100, 120, 70)
    const blocker = makeNode('blocker', 260, 70, 120, 140)
    const edge = {
      id: 'edge-source-target',
      source: 'source',
      target: 'target',
      data: {},
    } as Edge

    const route = computeEdgeRoute(edge, [source, target, blocker], [edge])
    const shrink = (r: ObstacleRect, pad = 2): ObstacleRect => ({
      x: r.x + pad,
      y: r.y + pad,
      w: Math.max(1, r.w - pad * 2),
      h: Math.max(1, r.h - pad * 2),
    })

    expect(pathHitsRect(route.waypoints, { x: 260, y: 70, w: 120, h: 140 })).toBe(false)
    expect(pathHitsRect(route.waypoints, shrink({ x: 0, y: 100, w: 120, h: 70 }))).toBe(false)
    expect(pathHitsRect(route.waypoints, shrink({ x: 500, y: 100, w: 120, h: 70 }))).toBe(false)
  })
})
