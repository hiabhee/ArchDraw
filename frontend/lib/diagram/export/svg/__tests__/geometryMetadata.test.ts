import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { generatePureSVG } from '../index';

describe('SVG geometry metadata', () => {
  it('exports the same planner status and diagnostic contract with the SVG', () => {
    const nodes = [
      { id: 'a', type: 'systemNode', position: { x: 0, y: 0 }, width: 160, height: 88, data: { label: 'A' } },
      { id: 'b', type: 'systemNode', position: { x: 360, y: 0 }, width: 160, height: 88, data: { label: 'B' } },
    ] as Node[];
    const edges = [{ id: 'ab', source: 'a', target: 'b', type: 'simpleFloating', data: { label: 'request' } }] as Edge[];

    const svg = generatePureSVG(nodes, edges);

    expect(svg).toMatch(/data-geometry-status="(?:ok|degraded|invalid|failed)"/);
    expect(svg).toContain('<metadata id="archdraw-geometry">');
    expect(svg).toContain('&quot;edgeId&quot;:&quot;ab&quot;');
  });
});
