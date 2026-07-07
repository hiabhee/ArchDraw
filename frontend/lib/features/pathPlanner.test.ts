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
    expect(result?.sourcePort.side).toBe(Position.Right)
    expect(result?.targetPort.side).toBe(Position.Left)
    expect(pathHitsRect(result!.points, blocker)).toBe(false)
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

    expect(route.sourcePosition).toBe(Position.Right)
    expect(route.targetPosition).toBe(Position.Left)
    expect(pathHitsRect(route.waypoints, { x: 260, y: 70, w: 120, h: 140 })).toBe(false)
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
})
