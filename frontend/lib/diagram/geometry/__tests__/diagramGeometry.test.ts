import { describe, expect, it } from 'vitest';
import { Position, type Edge, type Node } from 'reactflow';
import { computeDiagramGeometryPlan, computeDiagramGeometryPreview, geometrySnapshotKey, getCachedDiagramGeometryPlan } from '../diagramGeometry';
import { computeEdgeRoute, getNodeRect } from '../../edges/edgeRouteBuilder';
import { optimizeEdgeRoutes } from '../../edges/edgeRouteOptimizer';
import { TEMPLATES } from '@/data/templates';
import { layoutDiagramViaMermaid } from '@/lib/diagram/mermaid/relayout';

const node = (id: string, x: number, y: number): Node => ({
  id, type: 'systemNode', position: { x, y }, width: 160, height: 80, data: { label: id },
} as Node);
const edge = (id: string, label: string): Edge => ({
  id, source: 'a', target: 'b', label, data: { label },
} as Edge);

describe('computeDiagramGeometryPlan', () => {
  it('reroutes the Restaurant Portal crossing on a Food Delivery canvas laid out at default card sizes', async () => {
    const template = TEMPLATES.find(({ id }) => id === 'food_delivery')!;
    const layout = await layoutDiagramViaMermaid(template.nodes, template.edges, 'LR', { title: template.name });
    expect(layout.success).toBe(true);
    const options = { direction: 'LR', renderStyleId: 'studio-metallic', iconMode: 'all', straightEdges: false } as const;
    const original = computeDiagramGeometryPlan(layout.nodes, layout.edges, options);
    expect(original.violations).toContainEqual(expect.objectContaining({
      code: 'EDGE_CROSSING', edgeId: 'fd_e2', otherEdgeId: 'fd_e9',
    }));

    const visible = computeDiagramGeometryPlan(layout.nodes, layout.edges, { ...options, repairReturnCrossings: true });

    expect(visible.quality.crossings).toBe(0);
    expect(visible.quality.hardViolations).toBe(0);
    expect(visible.routes.size).toBe(layout.edges.length);
    expect(visible.quality.unexplainedPrivateOverlapLength).toBeLessThanOrEqual(original.quality.unexplainedPrivateOverlapLength);
    const changedRoutes = layout.edges.filter(({ id }) =>
      visible.routes.get(id)?.svgPath !== original.routes.get(id)?.svgPath,
    );
    const movedReturn = layout.edges.find(({ id }) => id === 'fd_e9')!;
    expect(changedRoutes).toContain(movedReturn);
    for (const changed of changedRoutes) {
      // Other routes may re-center when the return edge leaves their side.
      expect([changed.source, changed.target].some(id => id === movedReturn.source || id === movedReturn.target)).toBe(true);
    }
    expect(visible.routes.get('fd_e2')?.svgPath).toBe(original.routes.get('fd_e2')?.svgPath);
    expect(['left', 'bottom']).toContain(visible.routes.get('fd_e9')?.sourcePosition);
  });

  it('centers the remaining incoming edge when the return edge leaves the top side', () => {
    const nodes = [node('gateway', 700, 0), node('order', 700, 360), node('events', 0, 360)];
    const edges: Edge[] = [
      { id: 'incoming', source: 'gateway', target: 'order', data: {
        sourceSide: 'bottom', sourceSideLocked: true, targetSide: 'top', targetSideLocked: true,
      } },
      { id: 'return', source: 'order', target: 'events', data: { targetSide: 'right', targetSideLocked: true } },
    ];
    const options = {
      nodes, edges, direction: 'LR' as const,
      searchBudget: { maxCandidateRoutes: edges.length },
      handleAnchors: new Map([
        ['return', { sourceSide: Position.Top, source: { x: 800, y: 348 }, target: { x: 212, y: 400 } }],
      ]),
    };
    const original = optimizeEdgeRoutes(options);
    const incoming = original.routes.get('incoming')!;
    const returning = original.routes.get('return')!;
    expect(returning.sourcePosition).toBe('top');
    expect(incoming.targetPosition).toBe('top');
    expect(returning.sourcePoint.x).not.toBe(incoming.targetPoint.x);

    const visible = optimizeEdgeRoutes({ ...options, repairReturnCrossings: true });

    expect(['left', 'bottom']).toContain(visible.routes.get('return')?.sourcePosition);
    const box = getNodeRect(nodes[1], nodes);
    expect(visible.routes.get('incoming')?.targetPosition).toBe(incoming.targetPosition);
    expect(visible.routes.get('incoming')?.targetPoint.x).toBe(box.x + box.w / 2);
    expect(visible.diagnostics).toEqual([]);
  });

  it('reports when a fitted preview label overlaps its own terminal cards', () => {
    const nodes = [node('a', 0, 0), node('b', 325, 0)];
    const index = edge('index', 'Index page information');
    const edges = [{ ...index, data: { ...index.data, fitPreviewLabels: true } }];
    const plan = computeDiagramGeometryPlan(nodes, edges, { direction: 'LR', renderStyleId: 'studio-metallic' });

    expect(plan.violations).toEqual([
      { severity: 'hard', code: 'LABEL_COLLISION', edgeId: 'index', withId: 'a' },
      { severity: 'hard', code: 'LABEL_COLLISION', edgeId: 'index', withId: 'b' },
    ]);
  });

  it('uses orthogonal segments for staggered nodes under the canvas routing policy', () => {
    const nodes = [node('a', 0, 0), node('b', 500, 200)];
    const edges: Edge[] = [{ id: 'step', source: 'a', target: 'b' }];
    const plan = computeDiagramGeometryPlan(nodes, edges, { direction: 'LR', straightEdges: false });
    const points = plan.routes.get('step')!.waypoints;
    expect(points.length).toBeGreaterThan(2);
    for (let i = 1; i < points.length; i++) {
      expect(Math.min(Math.abs(points[i].x - points[i - 1].x), Math.abs(points[i].y - points[i - 1].y))).toBeLessThan(0.01);
    }
  });

  it('connects bottom handles with terminal legs instead of a floating horizontal wire', () => {
    const nodes = [{ ...node('a', 0, 0), height: 100 }, { ...node('b', 500, 0), height: 100 }];
    const edges: Edge[] = [{ id: 'messages-tools', source: 'b', target: 'a', label: 'messages + tools', data: { sourceSide: 'bottom', targetSide: 'bottom', sourceSideLocked: true, targetSideLocked: true } }];
    const plan = computeDiagramGeometryPlan(nodes, edges, { direction: 'LR', straightEdges: true });
    const points = plan.routes.get('messages-tools')!.waypoints;
    expect(points.length).toBeGreaterThanOrEqual(4);
    expect(points[1].x).toBe(points[0].x);
    expect(points[1].y).toBeGreaterThan(points[0].y);
    expect(points.at(-2)!.x).toBe(points.at(-1)!.x);
    expect(points.at(-2)!.y).toBeGreaterThan(points.at(-1)!.y);
    expect(points.at(-1)!.y).toBe(nodes[0].position.y + nodes[0].height!);
  });

  it('weights crossings independently of input edge order', () => {
    const nodes = [node('a', 0, 0), node('b', 0, 400), node('c', 500, 400), node('d', 500, 0)];
    const edges: Edge[] = [
      { id: 'main', source: 'a', target: 'c', data: { flowRole: 'main', flowRoleSource: 'explicit' } },
      { id: 'feedback', source: 'b', target: 'd', data: { flowRole: 'feedback', flowRoleSource: 'explicit' } },
    ];
    const options = { direction: 'LR' as const, straightEdges: true };
    const forward = computeDiagramGeometryPlan(nodes, edges, options);
    const reverse = computeDiagramGeometryPlan(nodes, [...edges].reverse(), options);
    expect(forward.quality.weightedCrossings).toBe(reverse.quality.weightedCrossings);
  });

  it('invalidates cached label placement for a top-level label edit', () => {
    const nodes = [node('a', 0, 0), node('b', 400, 0)];
    const edges = [{ id: 'label-cache', source: 'a', target: 'b', label: 'short' }] as Edge[];
    const first = getCachedDiagramGeometryPlan(nodes, edges, { direction: 'LR' });
    const next = getCachedDiagramGeometryPlan(nodes, [{ ...edges[0], label: 'A much longer edited label' }], { direction: 'LR' });
    expect(next).not.toBe(first);
    expect(next.key).not.toBe(first.key);
  });

  it('keeps the plan key when only a dragged label position changes, if the canvas asks for it', () => {
    const nodes = [node('a', 0, 0), node('b', 400, 0)];
    const at = (labelT: number) => [{ ...edge('drag', 'request'), data: { label: 'request', labelT } }];
    expect(geometrySnapshotKey(nodes, at(0.3), { direction: 'LR', ignoreLabelPosition: true }))
      .toBe(geometrySnapshotKey(nodes, at(0.7), { direction: 'LR', ignoreLabelPosition: true }));
    // Exports and every other caller keep the full key.
    expect(geometrySnapshotKey(nodes, at(0.3), { direction: 'LR' }))
      .not.toBe(geometrySnapshotKey(nodes, at(0.7), { direction: 'LR' }));
    // A label text change still invalidates it.
    expect(geometrySnapshotKey(nodes, at(0.3), { direction: 'LR', ignoreLabelPosition: true }))
      .not.toBe(geometrySnapshotKey(nodes, [{ ...at(0.3)[0], data: { label: 'other', labelT: 0.3 } }], { direction: 'LR', ignoreLabelPosition: true }));
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
      handleAnchors: new Map([['e1', { source: { x: 309, y: 145 }, target: { x: 491, y: 145 } }]]),
    });
    const second = getCachedDiagramGeometryPlan(nodes, edges, {
      ...base,
      handleAnchors: new Map([['e1', { source: { x: 315, y: 155 }, target: { x: 485, y: 155 } }]]),
    });

    expect(second.key).not.toBe(first.key);
    expect(second.routes.get('e1')?.sourcePoint.x).not.toBe(first.routes.get('e1')?.sourcePoint.x);
    expect(second.routes.get('e1')?.sourcePoint.y).toBe(first.routes.get('e1')?.sourcePoint.y);
  });
});
