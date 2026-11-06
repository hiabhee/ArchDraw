import { describe, it, expect } from 'vitest';
import { resolveShapeNodeDimensions, getEffectiveNodeDimensions, studioContentNodeSize } from '@/lib/diagram/nodes/shapeNodeDimensions';
import type { Node } from 'reactflow';
import { STUDIO_CARD_HEIGHT, STUDIO_CARD_WIDTH, STUDIO_CARD_WIDTH_WITH_ICON } from '@/lib/diagram/nodes/studioMetrics';

const PLAIN = { width: STUDIO_CARD_WIDTH, height: STUDIO_CARD_HEIGHT };
const WITH_ICON = { width: STUDIO_CARD_WIDTH_WITH_ICON, height: STUDIO_CARD_HEIGHT };

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

  it('uses the compact Studio card for Studio Minimal so edges meet handles', () => {
    const node: Node = {
      id: 'n1',
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      data: { label: 'Payment Service', shape: 'rounded-rectangle', nodeWidth: 160, nodeHeight: 100 },
    };
    expect(getEffectiveNodeDimensions(node, 'studio-minimal')).toEqual(PLAIN);
    expect(getEffectiveNodeDimensions(node).height).toBe(100);
  });

  it('grows Studio cards for wrapped Mermaid titles and details', () => {
    const short = studioContentNodeSize('YES', 'Urgent: 0.94', true);
    const detailed = studioContentNodeSize(
      'Probability Distribution',
      'Billing: 0.82 · Technical: 0.13 · Other: 0.05',
      true,
    );
    expect(short.height).toBe(STUDIO_CARD_HEIGHT);
    expect(detailed.height).toBeGreaterThan(short.height);

    const node: Node = {
      id: 'distribution', type: 'shapeNode', position: { x: 0, y: 0 },
      data: { label: 'Probability Distribution', subtitle: 'Billing: 0.82 · Technical: 0.13 · Other: 0.05', shape: 'rounded-rectangle' },
    };
    expect(getEffectiveNodeDimensions(node, 'studio-minimal', 'all')).toEqual(detailed);
  });

  it('widens Studio Minimal cards when an icon is stored', () => {
    const node: Node = {
      id: 'n1',
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      data: { label: 'Ride Service', shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 64 },
    };
    expect(getEffectiveNodeDimensions(node, 'studio-minimal')).toEqual(WITH_ICON);
    expect(getEffectiveNodeDimensions(node, 'studio-minimal', 'off')).toEqual(PLAIN);
    expect(getEffectiveNodeDimensions(node, 'studio-minimal', 'all')).toEqual(WITH_ICON);
  });

  it('maps card widths saved by earlier versions to the current Studio widths', () => {
    const saved = (nodeWidth: number, showIcon?: boolean): Node => ({
      id: 'n1',
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      data: { label: 'Ride Service', shape: 'rounded-rectangle', nodeWidth, showIcon },
    });
    // The first design: 160 plain, 200 with an icon.
    expect(getEffectiveNodeDimensions(saved(160), 'studio-minimal')).toEqual(PLAIN);
    expect(getEffectiveNodeDimensions(saved(200), 'studio-minimal')).toEqual(WITH_ICON);
    // The 64px design: 192 plain, 240 with an icon.
    expect(getEffectiveNodeDimensions(saved(192), 'studio-minimal')).toEqual(PLAIN);
    expect(getEffectiveNodeDimensions(saved(240, true), 'studio-minimal')).toEqual(WITH_ICON);
  });

  it('reads a saved 240 as the old icon width only when the node shows an icon (it is also today\'s plain width)', () => {
    const saved = (showIcon: boolean): Node => ({
      id: 'n1',
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      data: { label: 'Ride Service', shape: 'rounded-rectangle', nodeWidth: 240, showIcon },
    });
    expect(getEffectiveNodeDimensions(saved(false), 'studio-minimal')).toEqual(PLAIN);
    expect(getEffectiveNodeDimensions(saved(true), 'studio-minimal')).toEqual(WITH_ICON);
  });

  it('uses content-fit Studio card dimensions for edge anchors instead of stale Dagre size', () => {
    const node: Node = {
      id: 'system', type: 'systemNode', position: { x: 0, y: 0 }, width: STUDIO_CARD_WIDTH_WITH_ICON, height: STUDIO_CARD_HEIGHT,
      data: { label: 'Long Service Name' },
    };
    expect(getEffectiveNodeDimensions(node, 'studio-minimal', 'all')).toEqual(studioContentNodeSize('Long Service Name', undefined, true));
  });
});
