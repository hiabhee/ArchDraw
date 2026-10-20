import { describe, expect, it } from 'vitest';
import { anyNodeInView } from '../nodesInView';

const size = { width: 1000, height: 800 };
const node = (x: number, y: number, w = 200, h = 100) => ({ position: { x, y }, width: w, height: h });

describe('anyNodeInView', () => {
  it('sees a node inside the view at the default viewport', () => {
    expect(anyNodeInView([node(100, 100)], [0, 0, 1], size)).toBe(true);
  });

  it('is false when the whole diagram sits outside the view (a relaid-out map)', () => {
    expect(anyNodeInView([node(3000, 100), node(-900, -600, 200, 100)], [0, 0, 1], size)).toBe(false);
  });

  it('counts a node that only partly overlaps the edge of the view', () => {
    expect(anyNodeInView([node(950, 100)], [0, 0, 1], size)).toBe(true);
  });

  it('follows pan and zoom: the view covers -tx/zoom … (-tx+width)/zoom', () => {
    // Zoomed to 0.5 and panned so the view spans x 2000…4000, y 0…1600.
    expect(anyNodeInView([node(3000, 100)], [-1000, 0, 0.5], size)).toBe(true);
    expect(anyNodeInView([node(100, 100)], [-1000, 0, 0.5], size)).toBe(false);
  });

  it('uses the absolute position of nodes inside groups, and works before nodes are measured', () => {
    expect(anyNodeInView([{ position: { x: 10, y: 10 }, positionAbsolute: { x: 5000, y: 10 }, width: 100, height: 50 }], [0, 0, 1], size)).toBe(false);
    expect(anyNodeInView([{ position: { x: 400, y: 300 } }], [0, 0, 1], size)).toBe(true);
  });
});
