import { describe, expect, it } from 'vitest';
import { classifyEdge } from '../edgeClassifier';
import type { RFNode } from '../types';

const node = (id: string, label: string, serviceType: string) => ({
  id,
  type: 'shapeNode',
  position: { x: 0, y: 0 },
  data: { label, serviceType },
}) as RFNode;

describe('classifyEdge', () => {
  it('marks queue connections as async even when the label omits transport details', () => {
    const result = classifyEdge(
      node('checkout', 'Checkout Service', 'service'),
      node('kafka', 'Kafka', 'queue'),
      'delivers order',
    );

    expect(result.syncAsync).toBe('async');
    expect(result.protocol).toBe('Kafka Event');
  });
});
