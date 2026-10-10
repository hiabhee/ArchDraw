import { describe, it, expect } from 'vitest';
import { classifyEdge } from '../mermaid/edgeClassifier';
import type { RFNode, RFEdge, ValidationWarning } from '../mermaid/types';
import { processEdgeManagement } from './edgeManagement';
import { validateDiagramOutput } from '../mermaid/validation';
import type { Node, Edge } from 'reactflow';

function makeNode(id: string, serviceType: string, label?: string): RFNode {
  return { id, type: 'shapeNode', position: { x: 0, y: 0 }, width: 180, height: 70, data: { serviceType, label: label || id } };
}

describe('Edge Semantic Classifier', () => {
  it('should correctly classify protocol, importance, syncAsync', () => {
    const src = makeNode('A', 'service', 'Service A');
    const tgt = makeNode('B', 'service', 'Service B');
    const res1 = classifyEdge(src, tgt, 'HTTPS request', 'arrow');
    expect(res1.protocol).toBe('HTTPS');
    expect(res1.importance).toBe('secondary');
    expect(res1.syncAsync).toBe('sync');

    const res3 = classifyEdge(src, tgt, 'Kafka event', 'dotted');
    expect(res3.syncAsync).toBe('async');
  });
});

describe('Edge Lanes & Bundling service', () => {
  it('should not bundle when degree <= 8', () => {
    const nodes: Node[] = [
      { id: 'A', data: { label: 'Node A' }, position: { x: 0, y: 0 } },
      { id: 'B', data: { label: 'Node B' }, position: { x: 100, y: 0 } },
    ] as Node[];
    const edges: Edge[] = [
      { id: 'e1', source: 'A', target: 'B', data: { importance: 'secondary' } },
    ] as Edge[];
    const res = processEdgeManagement(nodes, edges);
    expect(res.edges.length).toBe(1);
    expect(res.edges[0].id).toBe('e1');
  });

  it('should bundle secondary/supporting edges when node degree is > 8', () => {
    const nodes: Node[] = [
      { id: 'DenseNode', data: { label: 'Dense Gateway' }, position: { x: 0, y: 0 } },
      ...Array.from({ length: 9 }).map((_, i) => ({
        id: `N${i}`,
        data: { label: `Node ${i}` },
        position: { x: 100, y: i * 50 },
      })),
    ] as Node[];

    const edges: Edge[] = Array.from({ length: 9 }).map((_, i) => ({
      id: `e-${i}`,
      source: 'DenseNode',
      target: `N${i}`,
      data: { importance: 'secondary', label: 'HTTP API call' },
    })) as Edge[];

    const res = processEdgeManagement(nodes, edges);
    expect(res.edges.length).toBe(1);
    expect(res.edges[0].data.isBundle).toBe(true);
    expect(res.edges[0].data.bundledEdges.length).toBe(9);
  });
});

describe('Accuracy Guardrails Validator', () => {
  it('should trigger warning for client connecting directly to database', () => {
    const nodes = [
      { id: 'client1', data: { label: 'React SPA', serviceType: 'client' }, position: { x: 0, y: 0 } },
      { id: 'db1', data: { label: 'PostgreSQL', serviceType: 'database' }, position: { x: 100, y: 0 } },
    ] as unknown as RFNode[];
    const edges = [
      { id: 'e1', source: 'client1', target: 'db1', data: { connectionType: 'sync' } },
    ] as unknown as RFEdge[];

    const report = validateDiagramOutput(nodes, edges);
    expect(report.passed).toBe(false);
    expect(report.warnings.some((w: ValidationWarning) => w.type === 'CLIENT_DIRECT_TO_DB')).toBe(true);
  });

  it('should trigger warning for database initiating requests to service (non-replication/CDC)', () => {
    const nodes = [
      { id: 'db1', data: { label: 'PostgreSQL', serviceType: 'database' }, position: { x: 0, y: 0 } },
      { id: 'svc1', data: { label: 'Auth Service', serviceType: 'service' }, position: { x: 100, y: 0 } },
    ] as unknown as RFNode[];
    const edges = [
      { id: 'e1', source: 'db1', target: 'svc1', data: { label: 'Query Auth' } },
    ] as unknown as RFEdge[];

    const report = validateDiagramOutput(nodes, edges);
    expect(report.passed).toBe(false);
    expect(report.warnings.some((w: ValidationWarning) => w.type === 'DATABASE_INITIATOR')).toBe(true);
  });

  it('should NOT trigger warning for database CDC/replication sync flows', () => {
    const nodes = [
      { id: 'db1', data: { label: 'PostgreSQL', serviceType: 'database' }, position: { x: 0, y: 0 } },
      { id: 'svc1', data: { label: 'Sync Worker', serviceType: 'service' }, position: { x: 0, y: 200 } },
    ] as unknown as RFNode[];
    const edges = [
      { id: 'e1', source: 'db1', target: 'svc1', data: { label: 'CDC stream events' } },
    ] as unknown as RFEdge[];

    const report = validateDiagramOutput(nodes, edges, 'TD');
    expect(report.passed).toBe(true);
  });

  it('should trigger warning for sync connection to Queue', () => {
    const nodes = [
      { id: 'svc1', data: { label: 'Order Service', serviceType: 'service' }, position: { x: 0, y: 0 } },
      { id: 'queue1', data: { label: 'RabbitMQ', serviceType: 'queue' }, position: { x: 100, y: 0 } },
    ] as unknown as RFNode[];
    const edges = [
      { id: 'e1', source: 'svc1', target: 'queue1', data: { connectionType: 'sync' } },
    ] as unknown as RFEdge[];

    const report = validateDiagramOutput(nodes, edges);
    expect(report.passed).toBe(false);
    expect(report.warnings.some((w: ValidationWarning) => w.type === 'SYNC_TO_QUEUE')).toBe(true);
  });
});
