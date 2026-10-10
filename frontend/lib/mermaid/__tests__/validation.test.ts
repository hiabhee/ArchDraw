import { describe, it, expect } from 'vitest';
import { validateDiagramOutput } from '../validation';
import type { RFNode, RFEdge } from '../types';

const baseNode = (id: string, overrides: Partial<RFNode> = {}): RFNode => ({
  id,
  type: 'systemNode',
  position: { x: 0, y: 0 },
  width: 200,
  height: 100,
  data: { label: id, serviceType: 'service' },
  ...overrides,
});

const textNode = (id: string, data: Record<string, unknown> = {}): RFNode =>
  baseNode(id, { type: 'textLabelNode', data: { text: id, ...data } });

const annotationNode = (id: string, data: Record<string, unknown> = {}): RFNode =>
  baseNode(id, { type: 'annotationNode', data: { title: id, body: '', ...data } });

describe('validateDiagramOutput text-node tolerance', () => {
  it('does not flag free-text labels containing edge-like characters', () => {
    const nodes: RFNode[] = [
      textNode('t1', { text: 'API | Cache --> Reads' }),
      baseNode('A', { position: { x: 0, y: 50 } }),
    ];
    const edges: RFEdge[] = [];
    const report = validateDiagramOutput(nodes, edges, 'LR');
    expect(report.passed).toBe(true);
    expect(report.warnings.some(w => w.type === 'NODE_LABEL_ARTIFACT')).toBe(false);
  });

  it('still flags shape-node labels containing edge syntax', () => {
    const nodes: RFNode[] = [baseNode('A', { data: { label: 'A-->B' } })];
    const report = validateDiagramOutput(nodes, [], 'LR');
    expect(report.warnings.some(w => w.type === 'NODE_LABEL_ARTIFACT')).toBe(true);
  });

  it('accepts a graph whose only nodes are text elements', () => {
    const nodes: RFNode[] = [
      textNode('title', { text: 'System Overview', anchor: 'top' }),
      annotationNode('note', { title: 'Note', body: 'async via queue', anchor: 'node', anchorTarget: 'title' }),
    ];
    const report = validateDiagramOutput(nodes, [], 'TD');
    expect(report.passed).toBe(true);
  });

  it('still reports orphaned parentNode on text nodes', () => {
    const nodes: RFNode[] = [
      baseNode('t1', { type: 'textLabelNode', data: { text: 'Heading' }, parentNode: 'MISSING_GROUP' }),
    ];
    const report = validateDiagramOutput(nodes, [], 'TD');
    expect(report.warnings.some(w => w.type === 'ORPHANED_NODE')).toBe(true);
  });
});
