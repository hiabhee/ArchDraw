import { describe, expect, it } from 'vitest';
import { resolveEdgeFlowSemantics } from '../edgeFlowSemantics';

const node = (id: string, serviceType?: string) => ({
  id,
  type: 'shapeNode',
  position: { x: 0, y: 0 },
  data: { label: id, serviceType },
});
const edge = (id: string, source: string, target: string, data: Record<string, unknown> = {}) => ({
  id, source, target, data,
});

describe('resolveEdgeFlowSemantics', () => {
  it('keeps an infrastructure queue on the producer-to-outcome backbone', () => {
    const result = resolveEdgeFlowSemantics(
      [node('producer', 'producer'), node('queue', 'queue'), node('worker', 'worker'), node('result', 'database')],
      [
        edge('publish', 'producer', 'queue', { importance: 'primary', connectionType: 'async' }),
        edge('consume', 'queue', 'worker', { importance: 'primary', connectionType: 'async' }),
        edge('write', 'worker', 'result', { importance: 'primary' }),
      ],
    );

    expect(result.assignments.get('publish')?.role).toBe('main');
    expect(result.assignments.get('consume')?.role).toBe('main');
    expect(result.assignments.get('write')?.role).toBe('main');
  });

  it('keeps the same semantic backbone when node and edge arrays are shuffled', () => {
    const nodes = [node('client', 'client'), node('api', 'compute'), node('worker', 'compute')];
    const edges = [edge('client-api', 'client', 'api'), edge('api-worker', 'api', 'worker'), edge('worker-api', 'worker', 'api')];
    const signature = (inputNodes: typeof nodes, inputEdges: typeof edges) =>
      [...resolveEdgeFlowSemantics(inputNodes, inputEdges).assignments.entries()]
        .map(([id, value]) => [id, value.role]).sort(([a], [b]) => String(a).localeCompare(String(b)));

    expect(signature([...nodes].reverse(), [...edges].reverse())).toEqual(signature(nodes, edges));
  });
});
