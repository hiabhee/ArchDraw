import { describe, it, expect } from 'vitest';
import { toReactFlowNode, toReactFlowEdge } from '../reactFlowConverters';
import type { RFNode, RFEdge } from '@/lib/mermaid/types';

describe('toReactFlowNode field preservation', () => {
  it('keeps shape, color, category, typeId for Node Info sidebar', () => {
    const n: RFNode = {
      id: 'db1',
      type: 'shapeNode',
      position: { x: 10, y: 20 },
      parentNode: 'Data',
      width: 200,
      height: 88,
      data: {
        label: 'Postgres',
        subtitle: 'primary',
        sublabel: 'primary',
        shape: 'cylinder',
        serviceType: 'database',
        componentType: 'database',
        typeId: 'database',
        color: '#1e293b',
        category: 'data',
        icon: 'Database',
        technology: 'PostgreSQL',
        tech: 'PostgreSQL',
      },
    };

    const rf = toReactFlowNode(n);
    expect(rf.type).toBe('shapeNode');
    expect(rf.parentId).toBe('Data');
    expect(rf.parentNode).toBe('Data');
    expect(rf.data.label).toBe('Postgres');
    expect(rf.data.shape).toBe('cylinder');
    expect(rf.data.color).toBe('#1e293b');
    expect(rf.data.category).toBe('data');
    expect(rf.data.componentType).toBe('database');
    expect(rf.data.typeId).toBe('database');
    expect(rf.data.technology).toBe('PostgreSQL');
    expect(rf.data.sublabel).toBe('primary');
  });

  it('derives componentType from typeId when missing', () => {
    const n: RFNode = {
      id: 'a',
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      data: { label: 'API', typeId: 'service', serviceType: 'service' },
    };
    const rf = toReactFlowNode(n);
    expect(rf.data.componentType).toBe('service');
  });
});

describe('toReactFlowEdge field preservation', () => {
  it('keeps importance and connectionType for edge hierarchy', () => {
    const e: RFEdge = {
      id: 'e1',
      source: 'A',
      target: 'B',
      sourceHandle: null,
      targetHandle: null,
      type: 'simpleFloating',
      label: 'queries',
      data: {
        label: 'queries',
        edgeVariant: 'solid',
        importance: 'primary',
        connectionType: 'sync',
        syncAsync: 'sync',
        protocol: 'SQL/TCP',
      },
    };

    const rf = toReactFlowEdge(e);
    expect(rf.data.importance).toBe('primary');
    expect(rf.data.connectionType).toBe('sync');
    expect(rf.data.edgeVariant).toBe('solid');
    expect(rf.label).toBe('queries');
  });
});
