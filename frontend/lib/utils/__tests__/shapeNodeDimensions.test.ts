import { describe, it, expect } from 'vitest';
import { resolveShapeNodeDimensions, getEffectiveNodeDimensions } from '@/lib/utils/shapeNodeDimensions';
import type { Node } from 'reactflow';

describe('resolveShapeNodeDimensions', () => {
  it('uses 100px height for horizontal pipe with title and subtitle (uniform)', () => {
    const dims = resolveShapeNodeDimensions({
      label: 'Brokerage API',
      sublabel: 'Connector',
      shape: 'cylinder',
      serviceType: 'queue',
    });

    expect(dims.height).toBe(100);
  });

  it('ignores stale vertical nodeHeight on horizontal pipe cylinders', () => {
    const dims = resolveShapeNodeDimensions({
      label: 'Brokerage API',
      sublabel: 'Connector',
      shape: 'cylinder',
      serviceType: 'queue',
      nodeWidth: 240,
      nodeHeight: 112,
    });

    expect(dims.height).toBeLessThanOrEqual(110);
    expect(dims.height).toBeGreaterThanOrEqual(100);
    expect(dims.width).toBeGreaterThanOrEqual(240);
  });

  it('keeps vertical drum height for database cylinders', () => {
    const dims = resolveShapeNodeDimensions({
      label: 'Postgres',
      shape: 'cylinder',
      serviceType: 'database',
      nodeHeight: 120,
    });

    expect(dims.height).toBeGreaterThanOrEqual(100);
  });

  it('getEffectiveNodeDimensions keeps fixed height when label wraps (fixed grid)', () => {
    const short: Node = {
      id: 'n1',
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      data: { label: 'API', shape: 'rounded-rectangle', nodeWidth: 160, nodeHeight: 48 },
    };
    const wrapped: Node = {
      id: 'n2',
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Brokerage API Connector Service With Extra Long Title That Wraps',
        shape: 'rounded-rectangle',
        nodeWidth: 160,
        nodeHeight: 48,
      },
    };

    const shortDims = getEffectiveNodeDimensions(short);
    const wrappedDims = getEffectiveNodeDimensions(wrapped);

    // Fixed grid: heights stay on 100px lane so Dagre rank centers align and edges sit on same Y
    expect(wrappedDims.height).toBe(shortDims.height);
    expect(wrappedDims.height).toBe(100);
  });
});
