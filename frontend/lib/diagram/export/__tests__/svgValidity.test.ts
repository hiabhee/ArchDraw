// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { generatePureSVG } from '@/lib/diagram/export/svgExport';
import type { DiagramRenderStyleId } from '@/lib/theme/renderStyles';

const nodes: Node[] = [
  { id: 'a', type: 'systemNode', position: { x: 0, y: 0 }, width: 240, height: 64, data: { label: 'Client', subtitle: 'Web' } },
  { id: 'b', type: 'systemNode', position: { x: 400, y: 0 }, width: 240, height: 64, data: { label: 'API Gateway', subtitle: 'Routing' } },
];
const edges: Edge[] = [{ id: 'e', source: 'a', target: 'b', label: 'HTTPS', data: {} } as Edge];

/**
 * Font stacks such as `"Space Grotesk", "Inter"` carry their own double quotes. Written raw
 * into `font-family="…"` they end the attribute early and the whole export is invalid XML,
 * so it cannot be opened or turned into a PNG.
 */
describe('SVG export is well-formed XML in every render style', () => {
  const styles: DiagramRenderStyleId[] = ['precision', 'sketch', 'neubrutalism', 'studio-minimal', 'studio-metallic'];
  for (const style of styles) {
    for (const dark of [false, true]) {
      it(`${style} (${dark ? 'dark' : 'light'})`, () => {
        const svg = generatePureSVG(nodes, edges, dark, dark ? '#0b0d12' : '#ffffff', 'LR', style, 'default');
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const problem = doc.querySelector('parsererror');
        expect(problem?.textContent ?? '').toBe('');
      });
    }
  }
});
