import { describe, it, expect } from 'vitest';
import { Position, type Node, type Edge } from 'reactflow';
import { computeEdgeRoute } from '../edgeRouteBuilder';
import { INCOMING_OUTGOING_GAP } from '../simpleFloatingEdge';

describe('recheck: dedicated in/out merge via computeEdgeRoute', () => {
  const nodes = [
    { id: 'broker', position: { x: 400, y: 40 }, width: 180, height: 70, data: {} },
    { id: 'a', position: { x: 40, y: 200 }, width: 140, height: 60, data: {} },
    { id: 'b', position: { x: 40, y: 280 }, width: 140, height: 60, data: {} },
    { id: 'c', position: { x: 40, y: 360 }, width: 140, height: 60, data: {} },
    { id: 'd', position: { x: 40, y: 440 }, width: 140, height: 60, data: {} },
  ] as Node[];

  it('merges four incoming edges onto one shared target tip per side', () => {
    const edges = [
      { id: 'e1', source: 'a', target: 'broker' },
      { id: 'e2', source: 'b', target: 'broker' },
      { id: 'e3', source: 'c', target: 'broker' },
      { id: 'e4', source: 'd', target: 'broker' },
    ] as Edge[];

    const routes = edges.map((e) => computeEdgeRoute(e, nodes, edges));
    const bySide = new Map<Position, Array<{ x: number; y: number }>>();
    for (const r of routes) {
      const list = bySide.get(r.targetPosition) ?? [];
      list.push(r.targetPoint);
      bySide.set(r.targetPosition, list);
    }

    expect(bySide.size).toBeGreaterThan(0);
    for (const tips of bySide.values()) {
      const first = tips[0];
      for (const t of tips) {
        expect(t).toEqual(first);
      }
    }
  });

  it('keeps incoming and outgoing on opposite tips of the same side', () => {
    const hubNodes = [
      { id: 'hub', position: { x: 200, y: 200 }, width: 160, height: 80, data: {} },
      { id: 'rightA', position: { x: 500, y: 120 }, width: 120, height: 60, data: {} },
      { id: 'rightB', position: { x: 500, y: 280 }, width: 120, height: 60, data: {} },
    ] as Node[];
    const edges = [
      { id: 'in1', source: 'rightA', target: 'hub' },
      { id: 'in2', source: 'rightB', target: 'hub' },
      { id: 'out1', source: 'hub', target: 'rightA' },
      { id: 'out2', source: 'hub', target: 'rightB' },
    ] as Edge[];

    const inRoutes = edges
      .filter((e) => e.target === 'hub')
      .map((e) => computeEdgeRoute(e, hubNodes, edges));
    const outRoutes = edges
      .filter((e) => e.source === 'hub')
      .map((e) => computeEdgeRoute(e, hubNodes, edges));

    let compared = 0;
    for (const side of [Position.Left, Position.Right, Position.Top, Position.Bottom]) {
      const inTips = inRoutes.filter((r) => r.targetPosition === side).map((r) => r.targetPoint);
      const outTips = outRoutes.filter((r) => r.sourcePosition === side).map((r) => r.sourcePoint);
      if (inTips.length === 0 || outTips.length === 0) continue;
      compared += 1;

      for (const t of inTips) expect(t).toEqual(inTips[0]);
      for (const t of outTips) expect(t).toEqual(outTips[0]);
      expect(inTips[0]).not.toEqual(outTips[0]);

      const dx = Math.abs(inTips[0].x - outTips[0].x);
      const dy = Math.abs(inTips[0].y - outTips[0].y);
      expect(Math.max(dx, dy)).toBeGreaterThanOrEqual(INCOMING_OUTGOING_GAP * 2 - 0.1);
    }
    expect(compared).toBeGreaterThan(0);
  });
});
