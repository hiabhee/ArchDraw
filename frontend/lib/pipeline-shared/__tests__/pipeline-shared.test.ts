import { describe, it, expect } from 'vitest';
import { DagreLayoutEngine } from '../layout/DagreLayout';
import { applyRfLayout, getIntegratedLayoutEngine } from '../layout/IntegratedLayout';
import { defaultCompoundLayoutOptions } from '../layout/LayoutEngine';
import { convertNodes } from '../reactflow/NodeConverter';
import { convertEdges } from '../reactflow/EdgeConverter';
import { ReactFlowAdapter } from '../reactflow/ReactFlowAdapter';
import { ProgressTracker, createProgressEvent } from '../progress';

describe('DagreLayoutEngine', () => {
  it('lays out nodes in TB direction', async () => {
    const engine = new DagreLayoutEngine();
    const result = await engine.layout({
      nodes: [
        { id: 'a', width: 100, height: 50 },
        { id: 'b', width: 100, height: 50 },
      ],
      edges: [{ id: 'a-b', source: 'a', target: 'b' }],
      direction: 'TB',
    });

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);

    const nodeA = result.nodes.find(n => n.id === 'a')!;
    const nodeB = result.nodes.find(n => n.id === 'b')!;
    expect(nodeA.x).toBeDefined();
    expect(nodeA.y).toBeDefined();
    expect(nodeB.x).toBeDefined();
    expect(nodeB.y).toBeDefined();
    expect(nodeB.y).toBeGreaterThan(nodeA.y);
  });

  it('lays out nodes in LR direction', async () => {
    const engine = new DagreLayoutEngine();
    const result = await engine.layout({
      nodes: [
        { id: 'a', width: 100, height: 50 },
        { id: 'b', width: 100, height: 50 },
      ],
      edges: [{ id: 'a-b', source: 'a', target: 'b' }],
      direction: 'LR',
    });

    const nodeA = result.nodes.find(n => n.id === 'a')!;
    const nodeB = result.nodes.find(n => n.id === 'b')!;
    expect(nodeB.x).toBeGreaterThan(nodeA.x);
  });

  it('detects cycles in parent relationships', async () => {
    const engine = new DagreLayoutEngine();
    const result = await engine.layout({
      nodes: [
        { id: 'a', width: 100, height: 50, parentId: 'b', isGroup: true },
        { id: 'b', width: 100, height: 50, parentId: 'a', isGroup: true },
      ],
      edges: [],
      direction: 'TB',
    });

    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0]).toContain('Cycle');
    // Closing edge is dropped; at least one node loses its parent reference
    expect(result.nodes.some(n => n.parentId === undefined)).toBe(true);
  });

  it('handles empty nodes gracefully', async () => {
    const engine = new DagreLayoutEngine();
    const result = await engine.layout({
      nodes: [],
      edges: [],
      direction: 'TB',
    });

    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('reroutes edges to/from subgraphs without crashing', async () => {
    const engine = new DagreLayoutEngine();
    const result = await engine.layout({
      nodes: [
        { id: 'G', width: 200, height: 200, isGroup: true },
        { id: 'a', width: 100, height: 50, parentId: 'G' },
        { id: 'b', width: 100, height: 50 },
        { id: 'c', width: 100, height: 50 },
      ],
      edges: [
        { id: 'b-G', source: 'b', target: 'G' },
        { id: 'G-c', source: 'G', target: 'c' },
      ],
      direction: 'TB',
    });

    expect(result.nodes).toHaveLength(4);
    result.nodes.forEach(n => {
      expect(n.x).toBeDefined();
      expect(n.y).toBeDefined();
    });
    // Original subgraph endpoints are preserved in the returned edges
    expect(result.edges).toHaveLength(2);
    expect(result.edges.find(e => e.id === 'b-G')?.target).toBe('G');
    expect(result.edges.find(e => e.id === 'G-c')?.source).toBe('G');
  });

  it('keeps edges to an empty subgraph so it lays out inside the flow', async () => {
    const engine = new DagreLayoutEngine();
    const result = await engine.layout({
      nodes: [
        { id: 'KAFKA', width: 220, height: 100, isGroup: true },
        { id: 'PRODUCER', width: 200, height: 111 },
        { id: 'ANALYTICS', width: 200, height: 111 },
      ],
      edges: [
        { id: 'PRODUCER-KAFKA', source: 'PRODUCER', target: 'KAFKA' },
        { id: 'KAFKA-ANALYTICS', source: 'KAFKA', target: 'ANALYTICS' },
      ],
      direction: 'LR',
    });

    expect(result.warnings).toEqual([]);
    // Every edge participates in the layout (has routed points)…
    expect(result.edges.find(e => e.id === 'PRODUCER-KAFKA')?.points?.length).toBeGreaterThan(0);
    expect(result.edges.find(e => e.id === 'KAFKA-ANALYTICS')?.points?.length).toBeGreaterThan(0);
    // …and the empty group sits between its in/out neighbours, not at rank 0.
    const producer = result.nodes.find(n => n.id === 'PRODUCER')!;
    const kafka = result.nodes.find(n => n.id === 'KAFKA')!;
    const analytics = result.nodes.find(n => n.id === 'ANALYTICS')!;
    expect(producer.x).toBeLessThan(kafka.x);
    expect(kafka.x).toBeLessThan(analytics.x);
  });
});

describe('applyRfLayout (canonical entry)', () => {
  it('layouts nested group graphs with non-zero positions', () => {
    const result = applyRfLayout({
      nodes: [
        { id: 'G', type: 'groupNode', position: { x: 0, y: 0 }, data: { isGroup: true } },
        { id: 'a', type: 'shapeNode', position: { x: 0, y: 0 }, data: { label: 'A' }, width: 180, height: 60, parentNode: 'G' },
        { id: 'b', type: 'shapeNode', position: { x: 0, y: 0 }, data: { label: 'B' }, width: 180, height: 60, parentNode: 'G' },
      ],
      edges: [{ id: 'a-b', source: 'a', target: 'b' }],
    }, 'TD');

    expect(result.nodes).toHaveLength(3);
    result.nodes.forEach(n => {
      expect(n.position.x !== 0 || n.position.y !== 0).toBe(true);
    });
    expect(result.nodes.find(n => n.id === 'a')?.parentNode).toBe('G');
    expect(result.nodes.find(n => n.id === 'b')?.parentNode).toBe('G');
  });

  it('uses roomy compound defaults for optical-grid nodes', () => {
    const tb = defaultCompoundLayoutOptions('TB');
    const lr = defaultCompoundLayoutOptions('LR');
    expect(tb.nodeSep).toBe(90);
    expect(tb.rankSep).toBe(170);
    expect(lr.nodeSep).toBe(110);
    expect(lr.rankSep).toBe(170);
    // Group padding must match the subgraph sizer exactly (layoutConstants).
    expect(tb.paddingLeft).toBe(28);
    expect(tb.paddingTop).toBe(48);
    expect(tb.paddingBottom).toBe(28);
  });

  it('exposes IntegratedLayoutEngine singleton', () => {
    expect(getIntegratedLayoutEngine()).toBe(getIntegratedLayoutEngine());
  });
});

describe('NodeConverter', () => {
  it('converts basic nodes', () => {
    const nodes = convertNodes([
      { id: '1', label: 'Node 1' },
      { id: '2', label: 'Node 2' },
    ]);

    expect(nodes).toHaveLength(2);
    expect(nodes[0].id).toBe('1');
    expect(nodes[0].data.label).toBe('Node 1');
    expect(nodes[0].type).toBe('shapeNode');
  });

  it('handles groups', () => {
    const nodes = convertNodes([
      { id: 'group1', label: 'Group', type: 'groupNode', data: { isGroup: true } },
    ]);

    expect(nodes[0].type).toBe('groupNode');
    expect(nodes[0].data.isGroup).toBe(true);
  });

  it('applies transformData function', () => {
    const nodes = convertNodes([
      { id: '1', label: 'Test', data: { extra: 'info' } },
    ], {
      transformData: (n) => ({ ...n.data, transformed: true, label: n.label }),
    });

    expect(nodes[0].data.transformed).toBe(true);
    expect(nodes[0].data.extra).toBe('info');
    expect(nodes[0].data.label).toBe('Test');
  });
});

describe('EdgeConverter', () => {
  it('converts basic edges', () => {
    const edges = convertEdges([
      { id: 'e1', source: 'a', target: 'b', label: 'calls' },
    ]);

    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe('e1');
    expect(edges[0].source).toBe('a');
    expect(edges[0].target).toBe('b');
    expect(edges[0].label).toBe('calls');
    expect(edges[0].type).toBe('simpleFloating');
  });

  it('handles custom edge type', () => {
    const edges = convertEdges([
      { id: 'e1', source: 'a', target: 'b', type: 'custom' },
    ], { defaultEdgeType: 'default' });

    expect(edges[0].type).toBe('custom');
  });
});

describe('ReactFlowAdapter', () => {
  it('adapts a diagram to ReactFlow format', () => {
    interface TestDiagram {
      items: Array<{ id: string; label: string }>;
      links: Array<{ from: string; to: string; label: string }>;
    }

    const adapter = new ReactFlowAdapter<TestDiagram>({
      extractNodes: (diagram) => diagram.items.map(i => ({ id: i.id, label: i.label })),
      extractEdges: (diagram) => diagram.links.map(l => ({ id: `${l.from}-${l.to}`, source: l.from, target: l.to, label: l.label })),
    });

    const diagram: TestDiagram = {
      items: [{ id: 'a', label: 'Service A' }, { id: 'b', label: 'Service B' }],
      links: [{ from: 'a', to: 'b', label: 'HTTP' }],
    };

    const result = adapter.adapt(diagram);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe('a');
    expect(result.edges[0].target).toBe('b');
  });

  it('includes metadata', () => {
    const adapter = new ReactFlowAdapter<{ items: []; links: [] }>({
      extractNodes: () => [],
      extractEdges: () => [],
      extractMetadata: () => ({ source: 'test', version: 1 }),
    });

    const result = adapter.adapt({ items: [], links: [] }, { metadata: { extra: true } });
    expect(result.metadata.source).toBe('test');
    expect(result.metadata.version).toBe(1);
    expect(result.metadata.extra).toBe(true);
  });
});

describe('ProgressTracker', () => {
  it('tracks progress through stages', () => {
    const tracker = new ProgressTracker([
      { name: 'stage1', weight: 1 },
      { name: 'stage2', weight: 2 },
      { name: 'stage3', weight: 1 },
    ]);

    const events: Array<{ stage: string; progress: number }> = [];
    tracker.onProgress((e) => events.push({ stage: e.stage, progress: e.progress }));

    tracker.report('stage1', 25, 'Starting');
    tracker.report('stage2', 50, 'Processing');
    tracker.report('stage3', 100, 'Done');

    expect(events).toHaveLength(3);
    expect(events[0].stage).toBe('stage1');
    expect(events[0].progress).toBe(25);
    expect(events[2].stage).toBe('stage3');
    expect(events[2].progress).toBe(100);
  });

  it('calculates weighted progress', () => {
    const tracker = new ProgressTracker([
      { name: 'light', weight: 1 },
      { name: 'heavy', weight: 3 },
    ]);

    tracker.stageStarted('light');
    tracker.stageCompleted('light');
    tracker.stageStarted('heavy');

    const progress = tracker.getCurrentProgress();
    expect(progress).toBeGreaterThan(0);
  });

  it('allows removing callbacks', () => {
    const tracker = new ProgressTracker([{ name: 's1' }]);
    const cb = () => {};
    const unsubscribe = tracker.onProgress(cb);
    unsubscribe();
    expect(tracker['callbacks'].size).toBe(0);
  });

  it('getCurrentStage returns current stage', () => {
    const tracker = new ProgressTracker([{ name: 's1' }]);
    tracker.report('s1', 50, 'working');
    expect(tracker.getCurrentStage()).toBe('s1');
  });
});

describe('createProgressEvent', () => {
  it('creates a valid progress event', () => {
    const event = createProgressEvent('test-stage', 50, 'working', 1, 5);
    expect(event.stage).toBe('test-stage');
    expect(event.progress).toBe(50);
    expect(event.message).toBe('working');
    expect(event.currentStage).toBe(1);
    expect(event.totalStages).toBe(5);
    expect(event.timestamp).toBeGreaterThan(0);
  });

  it('clamps progress to 0-100 range', () => {
    const event = createProgressEvent('s', -10, '');
    expect(event.progress).toBe(0);

    const event2 = createProgressEvent('s', 150, '');
    expect(event2.progress).toBe(100);
  });
});
