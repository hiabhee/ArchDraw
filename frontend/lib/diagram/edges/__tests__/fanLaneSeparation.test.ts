import { describe, expect, it } from 'vitest';
import { Position, type Edge, type Node } from 'reactflow';
import { buildEdgePathGeometry, getRenderedPathInteraction } from '../edgePathGeometry';
import type { EdgeRouteResult } from '../edgeRouteBuilder';
import { FAN_LANE_GAP, separateFanLanes } from '../fanLaneSeparation';
import { composeEdgeDisplayLabel } from '../edgeLabelLayout';

type Pt = { x: number; y: number };

function routeOf(waypoints: Pt[]): EdgeRouteResult {
  const path = { kind: 'orthogonal' as const, waypoints, cornerRadius: 12 };
  const renderedPath = buildEdgePathGeometry(path);
  return {
    sourcePosition: Position.Right, targetPosition: Position.Left,
    sourcePoint: waypoints[0], targetPoint: waypoints[waypoints.length - 1],
    waypoints, svgPath: renderedPath.d, path, renderedPath, status: 'ok', violations: [],
  };
}

const node = (id: string, x: number, y: number): Node =>
  ({ id, type: 'shapeNode', position: { x, y }, width: 200, height: 80, data: { label: id, nodeWidth: 200, nodeHeight: 80 } }) as Node;

describe('separateFanLanes', () => {
  // s fans out to a (just below) and b (far below): both leave s's right anchor and share x = 300.
  const nodes = [node('s', 0, 0), node('a', 500, 120), node('b', 500, 320)];
  const edges = [{ id: 'sa', source: 's', target: 'a' }, { id: 'sb', source: 's', target: 'b' }] as Edge[];
  const shared = () => new Map([
    ['sa', routeOf([{ x: 200, y: 40 }, { x: 300, y: 40 }, { x: 300, y: 160 }, { x: 500, y: 160 }])],
    ['sb', routeOf([{ x: 200, y: 40 }, { x: 300, y: 40 }, { x: 300, y: 360 }, { x: 500, y: 360 }])],
  ]);

  it('gives each edge of a fan its own lane, nested so they do not cross', () => {
    const routes = shared();
    separateFanLanes(routes, edges, nodes);
    const sa = routes.get('sa')!, sb = routes.get('sb')!;
    const laneA = sa.waypoints[1].x, laneB = sb.waypoints[1].x;
    expect(Math.abs(laneA - laneB)).toBe(FAN_LANE_GAP);
    // Turning away from the source: the farther target keeps the inner lane.
    expect(laneB).toBeLessThan(laneA);
    expect(getRenderedPathInteraction(sa.renderedPath, sb.renderedPath).crossing).toBe(false);
    // Anchors and arrowheads stay where they were.
    expect(sa.waypoints[0]).toEqual({ x: 200, y: 40 });
    expect(sb.waypoints.at(-1)).toEqual({ x: 500, y: 360 });
  });

  it('keeps the shared line when a lane would run into a card', () => {
    // A card right where the outer lane would go.
    const blocked = [...nodes, node('wall', 306, 60)];
    const routes = shared();
    separateFanLanes(routes, edges, blocked);
    expect(routes.get('sa')!.waypoints[1].x).toBe(300);
    expect(routes.get('sb')!.waypoints[1].x).toBe(300);
  });
});

describe('composeEdgeDisplayLabel', () => {
  it('preserves qualifiers and every listed operation', () => {
    expect(composeEdgeDisplayLabel('index text & metadata', undefined)).toBe('index text & metadata');
    expect(composeEdgeDisplayLabel('list, rename, move, delete', undefined)).toBe('list, rename, move, delete');
    expect(composeEdgeDisplayLabel('thumbnails & previews', undefined)).toBe('thumbnails & previews');
  });
});
