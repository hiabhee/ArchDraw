import { describe, it, expect } from 'vitest';
import { parseAndValidateRepoDiagram } from '../importRepoDiagram';
import { getEffectiveNodeDimensions } from '@/lib/diagram/nodes/shapeNodeDimensions';

describe('parseAndValidateRepoDiagram', () => {
  it('returns null for empty NDJSON', async () => {
    expect(await parseAndValidateRepoDiagram('')).toBeNull();
  });

  it('returns null for NDJSON with only edges', async () => {
    const ndjson = JSON.stringify({ path: ['a', 'b'], label: 'connects', async: false });
    expect(await parseAndValidateRepoDiagram(ndjson)).toBeNull();
  });

  it('parses valid NDJSON with nodes', async () => {
    const ndjson = [
      JSON.stringify({ id: 'svc', label: 'Service', layer: 'application', x: 0, y: 0, width: 180, height: 80, icon: 'box', serviceType: 'api' }),
      JSON.stringify({ path: ['svc', 'db'], label: 'queries', async: false }),
      JSON.stringify({ id: 'db', label: 'Database', layer: 'data', x: 0, y: 200, width: 180, height: 80, icon: 'database', serviceType: 'database' }),
    ].join('\n');

    const result = await parseAndValidateRepoDiagram(ndjson);
    expect(result).not.toBeNull();
    expect(result!.nodeCount).toBe(2);
    expect(result!.edgeCount).toBe(1);
  });
  it('lays out grouped cards at the size used by the selected Studio settings', async () => {
    const ndjson = [
      { id: 'app', label: 'Application', isGroup: true },
      { id: 'api', label: 'API Server', subtitle: 'Handles application requests', parentId: 'app' },
      { id: 'worker', label: 'Job Worker', subtitle: 'Processes background jobs', parentId: 'app' },
      { path: ['api', 'worker'], label: 'Submits jobs', async: true },
    ].map(item => JSON.stringify(item)).join('\n');

    const result = await parseAndValidateRepoDiagram(ndjson, { renderStyleId: 'studio-minimal', iconMode: 'off' });
    const group = result!.nodes.find(node => node.id === 'app')!;
    const children = result!.nodes.filter(node => node.parentNode === group.id);
    expect(children).toHaveLength(2);
    for (const node of children) {
      const { width, height } = getEffectiveNodeDimensions(node, 'studio-minimal', 'off');
      expect(node.width).toBe(width);
      expect(node.height).toBe(height);
      expect(node.position.x).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeGreaterThanOrEqual(0);
      expect(node.position.x + width).toBeLessThanOrEqual(group.width!);
      expect(node.position.y + height).toBeLessThanOrEqual(group.height!);
    }
    expect(result!.edges[0]).toMatchObject({ label: 'Submits jobs', data: { syncAsync: 'async' } });
  });

});
