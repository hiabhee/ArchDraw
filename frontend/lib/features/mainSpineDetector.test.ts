import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { detectMainSpine } from '@/lib/features/mainSpineDetector';
import { runClarityCompiler } from '@/lib/features/clarityCompiler';

const cyclicNodes: Node[] = [
  { id: 'A', type: 'shapeNode', position: { x: 0, y: 0 }, data: { label: 'Web Browser', serviceType: 'client' } },
  { id: 'B', type: 'shapeNode', position: { x: 200, y: 0 }, data: { label: 'Load Balancer', serviceType: 'load-balancer' } },
  { id: 'C', type: 'shapeNode', position: { x: 400, y: 0 }, data: { label: 'Video Server', serviceType: 'service' } },
  { id: 'D', type: 'shapeNode', position: { x: 600, y: 0 }, data: { label: 'Cache Layer', serviceType: 'database' } },
  { id: 'E', type: 'shapeNode', position: { x: 800, y: 0 }, data: { label: 'CDN', serviceType: 'service' } },
  { id: 'F', type: 'shapeNode', position: { x: 300, y: 200 }, data: { label: 'Video Database', serviceType: 'database' } },
  { id: 'G', type: 'shapeNode', position: { x: 300, y: 300 }, data: { label: 'Auth Server', serviceType: 'database' } },
];

const cyclicEdges: Edge[] = [
  { id: 'e1', source: 'A', target: 'B' },
  { id: 'e2', source: 'B', target: 'G' },
  { id: 'e3', source: 'G', target: 'B' },
  { id: 'e4', source: 'B', target: 'F' },
  { id: 'e5', source: 'F', target: 'C' },
  { id: 'e6', source: 'C', target: 'D' },
  { id: 'e7', source: 'D', target: 'E' },
  { id: 'e8', source: 'C', target: 'E' },
  { id: 'e9', source: 'E', target: 'A' },
  { id: 'e10', source: 'E', target: 'A' },
];

describe('mainSpineDetector', () => {
  it('completes on cyclic request/response graphs without hanging', () => {
    const start = performance.now();
    const result = detectMainSpine(cyclicNodes, cyclicEdges);
    const elapsed = performance.now() - start;

    expect(result.spineNodeIds.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });

  it('allows runClarityCompiler to finish on cyclic graphs', () => {
    const start = performance.now();
    const result = runClarityCompiler(cyclicNodes, cyclicEdges);
    const elapsed = performance.now() - start;

    expect(result.nodes.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });
});
