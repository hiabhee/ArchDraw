import { resolveCanvasTokens } from '@/lib/theme/renderStyles';
import { describe, expect, it } from 'vitest';
import { renderDiagramImage, renderDiagramSvg } from '../diagramImage';

// A drawing as the MCP drawing tool makes it: text, a blank card, a decision, a group, a note.
const nodes = [
  { id: 'title', type: 'textLabelNode', position: { x: 40, y: 20 }, width: 300, height: 100, data: { text: 'Release plan', fontSize: 'heading', bold: true } },
  { id: 'blank', type: 'shapeNode', position: { x: 40, y: 220 }, width: 200, height: 90, data: { label: '', shape: 'rounded-rectangle', nodeWidth: 200, nodeHeight: 90 } },
  { id: 'decide', type: 'shapeNode', position: { x: 360, y: 200 }, width: 180, height: 130, data: { label: 'Ship it?', shape: 'diamond', nodeWidth: 180, nodeHeight: 130, strokeColor: '#f59e0b' } },
  { id: 'g', type: 'groupNode', position: { x: 700, y: 170 }, width: 260, height: 190, style: { width: 260, height: 190 }, data: { label: 'Backend', isGroup: true } },
  { id: 'api', type: 'systemNode', parentNode: 'g', extent: 'parent', position: { x: 28, y: 48 }, width: 200, height: 70, data: { label: 'API', subtitle: 'Node 20', tier: 'compute', layer: 'compute' } },
  { id: 'note', type: 'annotationNode', position: { x: 40, y: 420 }, width: 240, height: 120, data: { title: 'Risks', body: 'Migration may be slow' } },
];
const edges = [
  { id: 'e1', source: 'blank', target: 'decide', type: 'simpleFloating', label: 'review', data: { label: 'review', pathType: 'Smoothstep' } },
  { id: 'e2', source: 'decide', target: 'api', type: 'simpleFloating', label: 'yes', data: { label: 'yes', edgeVariant: 'dashed' } },
];

describe('diagram images', () => {
  it('draws a drawing in the hand-drawn style with all its text', () => {
    const svg = renderDiagramSvg(nodes, edges, { style: 'sketch', theme: 'light' });
    for (const text of ['Release plan', 'Ship it?', 'API', 'Risks', 'Migration may be slow', 'Backend', 'review', 'yes']) expect(svg, text).toContain(text);
    expect(svg).not.toContain('NaN');
    expect(svg).toContain(resolveCanvasTokens({ renderStyleId: 'sketch', colorThemeId: 'default', isDark: false }).cssVars['--arch-canvas-bg']); // the editor's own paper
  });

  it('differs by style and theme', () => {
    const sketch = renderDiagramSvg(nodes, edges, { style: 'sketch', theme: 'light' });
    expect(renderDiagramSvg(nodes, edges, { style: 'studio', theme: 'light' })).not.toBe(sketch);
    expect(renderDiagramSvg(nodes, edges, { style: 'sketch', theme: 'dark' })).toContain(resolveCanvasTokens({ renderStyleId: 'sketch', colorThemeId: 'default', isDark: true }).cssVars['--arch-canvas-bg']);
  });

  it('returns an SVG document when asked for svg', async () => {
    const image = await renderDiagramImage(nodes, edges, { style: 'sketch', theme: 'light', format: 'svg', scale: 2 });
    expect(image.contentType).toMatch(/image\/svg\+xml/);
    expect(String(image.body).startsWith('<svg')).toBe(true);
  });

  it('returns a real PNG, larger at a higher scale, and bounded in width', async () => {
    const small = await renderDiagramImage(nodes, edges, { style: 'sketch', theme: 'light', format: 'png', scale: 1 });
    const big = await renderDiagramImage(nodes, edges, { style: 'sketch', theme: 'light', format: 'png', scale: 3 });
    const png = small.body as Buffer;
    expect(small.contentType).toBe('image/png');
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect((big.width ?? 0)).toBeGreaterThan(small.width ?? 0);
    expect(big.width ?? 0).toBeLessThanOrEqual(4096);
    expect((big.body as Buffer).length).toBeGreaterThan(png.length);
  });

  it('draws an empty canvas without throwing', async () => {
    const image = await renderDiagramImage([], [], { style: 'sketch', theme: 'light', format: 'svg', scale: 1 });
    expect(String(image.body)).toContain('<svg');
  });
});
