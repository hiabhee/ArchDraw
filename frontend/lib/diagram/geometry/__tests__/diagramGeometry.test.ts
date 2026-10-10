import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { computeDiagramGeometryPlan, computeDiagramGeometryPreview, getCachedDiagramGeometryPlan } from '../diagramGeometry';
import { computeEdgeRoute } from '../../edges/edgeRouteBuilder';

const node = (id: string, x: number, y: number): Node => ({
  id, type: 'systemNode', position: { x, y }, width: 160, height: 80, data: { label: id },
} as Node);
const edge = (id: string, label: string): Edge => ({
  id, source: 'a', target: 'b', label, data: { label },
} as Edge);

describe('computeDiagramGeometryPlan', () => {
  it('invalidates cached label placement for a top-level label edit', () => {
    const nodes = [node('a', 0, 0), node('b', 400, 0)];
    const edges = [{ id: 'label-cache', source: 'a', target: 'b', label: 'short' }] as Edge[];
    const first = getCachedDiagramGeometryPlan(nodes, edges, { direction: 'LR' });
    const next = getCachedDiagramGeometryPlan(nodes, [{ ...edges[0], label: 'A much longer edited label' }], { direction: 'LR' });
    expect(next).not.toBe(first);
    expect(next.key).not.toBe(first.key);
  });

  it('invalidates cached routing when a shape changes with the same bounds', () => {
    const nodes = [{ ...node('a', 0, 0), type: 'shapeNode', data: { label: 'A', shape: 'rectangle' } }, node('b', 400, 0)];
    const edges = [edge('shape-cache', 'request')];
    const first = getCachedDiagramGeometryPlan(nodes, edges, { direction: 'LR' });
    const next = getCachedDiagramGeometryPlan([{ ...nodes[0], data: { label: 'A', shape: 'diamond' } }, nodes[1]], edges, { direction: 'LR' });
    expect(next).not.toBe(first);
  });

  it('uses absolute parent positions in incremental previews', () => {
    const group = { ...node('group', 600, 300), type: 'groupNode', width: 700, height: 400 };
    const nodes = [group, { ...node('a', 50, 60), parentNode: 'group' }, { ...node('b', 350, 60), parentNode: 'group' }];
    const edges = [edge('nested-preview', 'request')];
    const previous = computeDiagramGeometryPlan(nodes, edges, { direction: 'LR' });
    const next = computeDiagramGeometryPreview(previous, nodes.map(n => n.id === 'b' ? { ...n, position: { x: 360, y: 60 } } : n), edges, { direction: 'LR' });
    expect(next.bounds.get('a')?.x).toBe(650);
    expect(next.bounds.get('b')?.x).toBe(960);
  });

  it('re-routes moved-node routes during drag while retaining unrelated paths', () => {
    const nodes = [node('a', 0, 0), node('b', 280, 0), node('c', 0, 220), node('d', 280, 220)];
    const edges = [
      { id: 'ab', source: 'a', target: 'b', data: {} },
      { id: 'cd', source: 'c', target: 'd', data: {} },
    ] as Edge[];
    const options = { direction: 'LR' as const };
    const settled = computeDiagramGeometryPlan(nodes, edges, options);
    const moved = nodes.map(n => n.id === 'b' ? { ...n, position: { x: 340, y: 80 }, dragging: true } as Node : n);
    const preview = computeDiagramGeometryPreview(settled, moved, edges, options);

    expect(preview.provisional).toBe(true);
    expect(preview.routes.get('ab')).not.toBe(settled.routes.get('ab'));
    expect(preview.paths.get('cd')).toBe(settled.paths.get('cd'));
    expect(preview.violations).toEqual([]);
  });

  it('allocates distinct routes and puts labels on the same final path snapshot', () => {
    const nodes = [node('a', 100, 100), node('b', 500, 100)];
    const edges = [edge('e1', 'request'), edge('e2', 'audit')];
    const plan = computeDiagramGeometryPlan(nodes, edges, { direction: 'LR' });

    expect(plan.routes.get('e1')?.svgPath).not.toBe(plan.routes.get('e2')?.svgPath);
    expect(plan.paths.get('e1')).toBe(plan.routes.get('e1')?.renderedPath);
    expect(plan.labels.has('e1')).toBe(true);
    expect(plan.status).not.toBe('failed');
  });

  it('invalidates a settled snapshot when a measured node dimension changes', () => {
    const edges = [edge('e1', 'request')];
    const options = { direction: 'LR' as const, revision: 1 };
    const firstNodes = [node('a', 100, 100), node('b', 500, 100)];
    const first = getCachedDiagramGeometryPlan(firstNodes, edges, options);
    const secondNodes = [firstNodes[0], { ...firstNodes[1], width: 220 } as Node];
    const second = getCachedDiagramGeometryPlan(secondNodes, edges, options);

    expect(second.key).not.toBe(first.key);
    expect(second).not.toBe(first);
  });

  it('marks overlapping node bounds as hard invalid geometry', () => {
    const nodes = [node('a', 100, 100), node('b', 140, 120)];
    const plan = computeDiagramGeometryPlan(nodes, [], { direction: 'LR' });

    expect(plan.status).toBe('invalid');
    expect(plan.violations).toContainEqual({
      severity: 'hard', code: 'NODE_COLLISION', nodeId: 'a', otherNodeId: 'b',
    });
  });

  it('validates a cubic self-loop against foreign rendered obstacles', () => {
    const loop = { id: 'loop', source: 'a', target: 'a', data: { selfLoopStyle: 'corner' } } as Edge;
    const source = node('a', 100, 100);
    const baseRoute = computeEdgeRoute(loop, [source], [loop], 'LR');
    const distanceToSegment = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    };
    const curvedSample = baseRoute.renderedPath.samples.find((point, index, samples) => {
      if (index < 2 || index >= samples.length - 2) return false;
      return Math.min(...baseRoute.waypoints.slice(1).map((next, segment) =>
        distanceToSegment(point, baseRoute.waypoints[segment], next),
      )) > 4;
    });
    expect(curvedSample).toBeDefined();
    const blocker = {
      ...node('blocker', curvedSample!.x - 4, curvedSample!.y - 4),
      type: 'textLabel',
      width: 8,
      height: 8,
      data: { label: 'blocker', nodeWidth: 8, nodeHeight: 8 },
    } as Node;
    const nodes = [source, blocker];

    const plan = computeDiagramGeometryPlan(nodes, [loop], { direction: 'LR' });

    expect(plan.violations).toContainEqual({
      severity: 'hard', code: 'OBSTACLE_INTERSECTION', edgeId: 'loop', obstacleId: 'blocker',
    });
    expect(plan.routes.get('loop')?.status).toBe('invalid');
  });

  it('invalidates routes when React Flow reports changed measured handle centers', () => {
    const nodes = [node('a', 100, 100), node('b', 500, 100)];
    const edges = [{ ...edge('e1', 'request'), sourceHandle: 'source-right', targetHandle: 'target-left' }];
    const base = { direction: 'LR' as const, revision: 4 };
    const first = getCachedDiagramGeometryPlan(nodes, edges, {
      ...base,
      handleAnchors: new Map([['e1', { source: { x: 312, y: 145 }, target: { x: 488, y: 145 } }]]),
    });
    const second = getCachedDiagramGeometryPlan(nodes, edges, {
      ...base,
      handleAnchors: new Map([['e1', { source: { x: 312, y: 155 }, target: { x: 488, y: 155 } }]]),
    });

    expect(second.key).not.toBe(first.key);
    expect(second.routes.get('e1')?.sourcePoint.y).not.toBe(first.routes.get('e1')?.sourcePoint.y);
  });
});
