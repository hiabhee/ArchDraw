import { describe, it, expect } from 'vitest';
import { resolveShapeNodeDimensions, getEffectiveNodeDimensions, studioContentNodeSize } from '@/lib/utils/shapeNodeDimensions';
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

  it('uses compact 160×64 for Studio Minimal so edges meet handles', () => {
    const node: Node = {
      id: 'n1',
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      data: { label: 'Payment Service', shape: 'rounded-rectangle', nodeWidth: 160, nodeHeight: 100 },
    };
    expect(getEffectiveNodeDimensions(node, 'studio-minimal')).toEqual({ width: 160, height: 64 });
    expect(getEffectiveNodeDimensions(node).height).toBe(100);
  });

  it('grows Studio cards for wrapped Mermaid titles and details', () => {
    const short = studioContentNodeSize('YES', 'Urgent: 0.94', true);
    const detailed = studioContentNodeSize(
      'Probability Distribution',
      'Billing: 0.82 · Technical: 0.13 · Other: 0.05',
      true,
    );
    expect(short.height).toBe(64);
    expect(detailed.height).toBeGreaterThan(short.height);

    const node: Node = {
      id: 'distribution', type: 'shapeNode', position: { x: 0, y: 0 },
      data: { label: 'Probability Distribution', subtitle: 'Billing: 0.82 · Technical: 0.13 · Other: 0.05', shape: 'rounded-rectangle' },
    };
    expect(getEffectiveNodeDimensions(node, 'studio-minimal', 'all')).toEqual(detailed);
  });

  it('widens Studio Minimal cards to 200px when an icon is stored', () => {
    const node: Node = {
      id: 'n1',
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      data: { label: 'Ride Service', shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 64 },
    };
    expect(getEffectiveNodeDimensions(node, 'studio-minimal')).toEqual({ width: 200, height: 64 });
    expect(getEffectiveNodeDimensions(node, 'studio-minimal', 'off')).toEqual({ width: 160, height: 64 });
    expect(getEffectiveNodeDimensions(node, 'studio-minimal', 'all')).toEqual({ width: 200, height: 64 });
  });

  it('uses content-fit Studio card dimensions for edge anchors instead of stale Dagre size', () => {
    const node: Node = {
      id: 'system', type: 'systemNode', position: { x: 0, y: 0 }, width: 240, height: 64,
      data: { label: 'Long Service Name' },
    };
    expect(getEffectiveNodeDimensions(node, 'studio-minimal', 'all')).toEqual({ width: 200, height: 66 });
  });
});
