import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import { computeDiagramCropRect } from '@/lib/utils/exportCrop';

describe('exportCrop', () => {
  it('computes screen-space crop from node bounds and viewport', () => {
    const nodes: Node[] = [
      {
        id: 'a',
        type: 'shapeNode',
        position: { x: 100, y: 200 },
        width: 160,
        height: 80,
        data: { label: 'A' },
      },
    ];
    // Simulate RF internal absolute position
    (nodes[0] as Node & { positionAbsolute?: { x: number; y: number } }).positionAbsolute = {
      x: 100,
      y: 200,
    };

    const crop = computeDiagramCropRect(nodes, { x: 50, y: 40, zoom: 1 }, 0);
    expect(crop).not.toBeNull();
    expect(crop!.x).toBe(150);
    expect(crop!.y).toBe(240);
    expect(crop!.width).toBe(160);
    expect(crop!.height).toBe(80);
  });

  it('returns null when there are no nodes', () => {
    expect(computeDiagramCropRect([], { x: 0, y: 0, zoom: 1 })).toBeNull();
  });
});
