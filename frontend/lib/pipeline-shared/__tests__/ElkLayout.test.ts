import { describe, it, expect } from 'vitest';
import { ElkLayoutEngine } from '../layout/ElkLayout';
import type { LayoutParams } from '../layout/LayoutEngine';

describe('ElkLayoutEngine', () => {
  const engine = new ElkLayoutEngine();

  it('is always available', () => {
    expect(engine.isAvailable()).toBe(true);
  });

  it('produces a layout result for simple nodes', async () => {
    const params: LayoutParams = {
      nodes: [
        { id: 'a', width: 100, height: 50 },
        { id: 'b', width: 100, height: 50 },
      ],
      edges: [{ id: 'a-b', source: 'a', target: 'b' }],
      direction: 'TB',
    };
    const result = await engine.layout(params);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.warnings).toEqual([]);
    expect(typeof result.nodes[0].x).toBe('number');
    expect(typeof result.nodes[0].y).toBe('number');
  });

  it('handles LR direction', async () => {
    const params: LayoutParams = {
      nodes: [
        { id: 'a', width: 100, height: 50 },
        { id: 'b', width: 100, height: 50 },
      ],
      edges: [{ id: 'a-b', source: 'a', target: 'b' }],
      direction: 'LR',
    };
    const result = await engine.layout(params);
    expect(result.nodes).toHaveLength(2);
  });

  it('handles empty nodes', async () => {
    const params: LayoutParams = {
      nodes: [],
      edges: [],
      direction: 'TB',
    };
    const result = await engine.layout(params);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('handles nodes with parent grouping', async () => {
    const params: LayoutParams = {
      nodes: [
        { id: 'group1', isGroup: true, width: 400, height: 300 },
        { id: 'a', parentId: 'group1', width: 100, height: 50 },
        { id: 'b', parentId: 'group1', width: 100, height: 50 },
      ],
      edges: [{ id: 'a-b', source: 'a', target: 'b' }],
      direction: 'TB',
    };
    const result = await engine.layout(params);
    const groupNode = result.nodes.find(n => n.id === 'group1');
    expect(groupNode).toBeDefined();
    expect(groupNode!.isGroup).toBe(true);
  });
});
