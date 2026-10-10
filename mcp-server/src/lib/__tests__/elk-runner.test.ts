import { describe, it, expect } from 'vitest';
import type { ArchitectureNode, ArchitectureEdge } from '../../types/index.js';
import { generateELKOptions, runFallbackLayout } from '../elk-runner.js';

function makeNode(id: string, overrides: Partial<ArchitectureNode> = {}): ArchitectureNode {
  return {
    id,
    type: 'systemNode',
    label: id,
    layer: 'compute',
    width: 200,
    height: 70,
    icon: 'box',
    metadata: {},
    ...overrides,
  };
}

function makeEdge(id: string, source: string, target: string): ArchitectureEdge {
  return {
    id,
    source,
    target,
    communicationType: 'sync',
    pathType: 'smooth',
    label: '',
    labelPosition: 'center',
    animated: false,
    style: { stroke: '#94a3b8', strokeDasharray: '', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    markerStart: 'none',
  };
}

describe('generateELKOptions', () => {
  it('honors the requested direction', () => {
    expect(generateELKOptions('DOWN')['elk.direction']).toBe('DOWN');
    expect(generateELKOptions('UP')['elk.direction']).toBe('UP');
    expect(generateELKOptions('LEFT')['elk.direction']).toBe('LEFT');
    expect(generateELKOptions('RIGHT')['elk.direction']).toBe('RIGHT');
  });

  it('defaults to RIGHT', () => {
    expect(generateELKOptions()['elk.direction']).toBe('RIGHT');
  });

  it('scales spacing by density', () => {
    const low = generateELKOptions('RIGHT', 'low');
    const high = generateELKOptions('RIGHT', 'high');
    expect(Number(high['elk.spacing.nodeNode'])).toBeGreaterThan(Number(low['elk.spacing.nodeNode']));
  });
});

describe('runFallbackLayout', () => {
  it('emits parentNode at the top level for grouped children', () => {
    const group = makeNode('backend_group', {
      isGroup: true,
      layer: 'compute',
      width: 500,
      height: 280,
    });
    const child = makeNode('order_svc', {
      parentId: 'backend_group',
      layer: 'compute',
    });
    const edge = makeEdge('e1', 'client', 'order_svc');

    const result = runFallbackLayout([group, child, makeNode('client', { layer: 'client' })], [edge]);

    const outputChild = result.nodes.find(n => n.id === 'order_svc');
    expect(outputChild).toBeDefined();
    expect(outputChild?.parentNode).toBe('backend_group');
    expect(outputChild?.data.parentId).toBe('backend_group');

    const outputGroup = result.nodes.find(n => n.id === 'backend_group');
    expect(outputGroup?.type).toBe('groupNode');
    expect(outputGroup?.data.isGroup).toBe(true);
  });

  it('produces positioned, non-overlapping nodes', () => {
    const nodes = [
      makeNode('web', { layer: 'client' }),
      makeNode('gw', { layer: 'edge' }),
      makeNode('db', { layer: 'data' }),
    ];
    const edges = [makeEdge('e1', 'web', 'gw'), makeEdge('e2', 'gw', 'db')];

    const result = runFallbackLayout(nodes, edges);

    expect(result.nodes).toHaveLength(3);
    for (const node of result.nodes) {
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
      expect(node.data.tierColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
    const positions = result.nodes.map(n => `${n.position.x},${n.position.y}`);
    expect(new Set(positions).size).toBe(3);
  });
});
