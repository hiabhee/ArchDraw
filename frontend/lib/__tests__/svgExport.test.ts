import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { generatePureSVG } from '@/lib/svgExport';

function fixture(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: 'a',
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      width: 200,
      height: 200,
      selected: false,
      data: { label: 'API Gateway', shape: 'diamond', accentColor: '#0f766e' },
    },
    {
      id: 'b',
      type: 'shapeNode',
      position: { x: 320, y: 50 },
      width: 200,
      height: 100,
      selected: false,
      data: { label: 'Orders Service', shape: 'rounded-rectangle', accentColor: '#7c3aed' },
    },
  ];
  const edges: Edge[] = [
    {
      id: 'e1',
      source: 'a',
      target: 'b',
      type: 'simpleFloating',
      sourceHandle: 'source-right',
      targetHandle: 'target-left',
      data: { label: 'routes' },
    },
  ];
  return { nodes, edges };
}

describe('generatePureSVG render styles', () => {
  it('precision keeps the legacy crisp markup for shapes and edges', () => {
    const { nodes, edges } = fixture();
    const svg = generatePureSVG(nodes, edges, true, '#0f172a', 'LR', 'precision');

    expect(svg).toContain('<polygon points="100,4 196,100 100,196 4,100" fill=');
    expect(svg).toContain('<rect x="1" y="1" width="198" height="98" rx="10" ry="10" fill=');
    expect(svg).toContain('stroke-width="1.25"');
    expect(svg).toContain('data-edge-marker="solid-arrowhead"');
    expect(svg).not.toContain('marker-end="url(#arrow-e1)"');
    expect(svg).toMatch(/<path[\s\S]*?d="M [\d.]+ [\d.]+ /);
    expect(svg).not.toContain('rough');
  });

  it('sketch routes shapes and edges through the rough stroke renderer', () => {
    const { nodes, edges } = fixture();
    const svg = generatePureSVG(nodes, edges, true, '#0f172a', 'LR', 'sketch');

    expect(svg).not.toContain('marker-end="url(#arrow-e1)"');
    expect(svg).not.toMatch(/<polygon points="100,4 196,100 100,196 4,100" fill=/);
    expect(svg).not.toMatch(/<rect x="1" y="1" width="198" height="98" rx="10" ry="10" fill=/);
    expect(svg).toContain('font-family="Inter, system-ui, -apple-system, sans-serif"');
  });

  it('sketch export keeps dashes on dashed edges (async / dotted stay semantic)', () => {
    const { nodes } = fixture();
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        type: 'simpleFloating',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        data: { label: 'events', edgeVariant: 'dashed' },
      },
    ];
    const svg = generatePureSVG(nodes, edges, true, '#0f172a', 'LR', 'sketch');
    expect(svg).toMatch(/stroke-dasharray="[^"]*[0-9]/);
    expect(svg).toContain('stroke-dasharray="5,4"');
  });

  it('correctly exports the five new architecture-native shapes to precision and sketch SVG', () => {
    const nodes: Node[] = [
      {
        id: 'q',
        type: 'shapeNode',
        position: { x: 0, y: 0 },
        width: 240,
        height: 64,
        selected: false,
        data: { label: 'Queue', shape: 'queue' },
      },
      {
        id: 'c',
        type: 'shapeNode',
        position: { x: 250, y: 0 },
        width: 180,
        height: 96,
        selected: false,
        data: { label: 'Cache', shape: 'cache' },
      },
      {
        id: 'f',
        type: 'shapeNode',
        position: { x: 440, y: 0 },
        width: 180,
        height: 96,
        selected: false,
        data: { label: 'Function', shape: 'function' },
      },
      {
        id: 'cnt',
        type: 'shapeNode',
        position: { x: 630, y: 0 },
        width: 220,
        height: 104,
        selected: false,
        data: { label: 'Container', shape: 'container' },
      },
      {
        id: 'b',
        type: 'shapeNode',
        position: { x: 860, y: 0 },
        width: 180,
        height: 104,
        selected: false,
        data: { label: 'Bucket', shape: 'bucket' },
      },
    ];

    const precisionSvg = generatePureSVG(nodes, [], true, '#0f172a', 'LR', 'precision');
    expect(precisionSvg).toContain('Queue');
    expect(precisionSvg).toContain('Cache');
    expect(precisionSvg).toContain('Function');
    expect(precisionSvg).toContain('Container');
    expect(precisionSvg).toContain('Bucket');

    // Queue has lane lines
    expect(precisionSvg).toContain('x1=');
    // Function has polygon
    expect(precisionSvg).toContain('<polygon');
    // Cache has shadow layers
    expect(precisionSvg).toContain('<rect');

    const sketchSvg = generatePureSVG(nodes, [], true, '#0f172a', 'LR', 'sketch');
    expect(sketchSvg).toContain('Queue');
    expect(sketchSvg).toContain('Cache');
    expect(sketchSvg).toContain('Function');
    expect(sketchSvg).toContain('Container');
    expect(sketchSvg).toContain('Bucket');
  });
});
