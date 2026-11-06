import { NextRequest } from 'next/server';
import { resolveCanvasTokens } from '@/lib/theme/renderStyles';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/redis', () => ({
  checkRateLimitWithFallback: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 }),
}));
vi.mock('@/lib/server/prisma', () => ({ default: { sharedCanvas: { create: vi.fn() } } }));
vi.mock('@/lib/server/quotaCheck', () => ({ getSessionFromRequest: vi.fn().mockResolvedValue(null), logUsage: vi.fn() }));
vi.mock('@/lib/server/ip', () => ({ getClientIP: () => '203.0.113.7' }));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() } }));

import { POST } from '../route';

const post = (body: unknown) => new NextRequest('http://localhost/api/diagram/load', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const MERMAID = 'graph LR\n  subgraph api["API"]\n    Web[Web App] --> Server[API Server]\n  end\n  Server --> DB[(Postgres)]';

describe('POST /api/diagram/load preview', () => {
  it('draws the diagram with the SVG export when asked', async () => {
    const body = await (await POST(post({ mermaid: MERMAID, dryRun: true, preview: true }))).json();
    expect(body.previewSvg).toMatch(/^<svg[\s>]/);
    expect(body.previewSvg).toContain('API Server');
    // Rendered inside an <img>, so it must not depend on outside resources.
    expect(body.previewSvg).not.toMatch(/href="https?:/);
  });

  it('draws a raw drawing hand-drawn when previewStyle is sketch, and keeps the Studio look otherwise', async () => {
    const nodes = [
      { id: 'a', type: 'textLabelNode', position: { x: 0, y: 0 }, width: 200, height: 100, data: { text: 'Whiteboard' } },
      { id: 'b', type: 'shapeNode', position: { x: 0, y: 200 }, width: 200, height: 90, data: { label: 'Idea', shape: 'rounded-rectangle' } },
    ];
    const sketch = await (await POST(post({ nodes, edges: [], dryRun: true, preview: true, previewStyle: 'sketch' }))).json();
    const clean = await (await POST(post({ nodes, edges: [], dryRun: true, preview: true }))).json();
    expect(sketch.previewSvg).toContain('Whiteboard');
    const paper = resolveCanvasTokens({ renderStyleId: 'sketch', colorThemeId: 'default', isDark: false }).cssVars['--arch-canvas-bg'];
    expect(sketch.previewSvg).toContain(paper); // the sketch paper
    expect(clean.previewSvg).not.toContain(paper);
    expect(sketch.previewSvg).not.toBe(clean.previewSvg);
  });

  it('refuses a raw drawing with a node type the canvas does not know', async () => {
    const response = await POST(post({ nodes: [{ id: 'x', type: 'scriptNode', position: { x: 0, y: 0 }, data: {} }], edges: [], dryRun: true }));
    expect(response.status).toBe(400);
  });

  it('leaves the SVG out unless asked', async () => {
    const body = await (await POST(post({ mermaid: MERMAID, dryRun: true }))).json();
    expect(body.previewSvg).toBeUndefined();
    expect(body.nodes.length).toBeGreaterThan(0);
  });

  it('re-lays out a graph sent as nodes and edges when asked, in the requested direction', async () => {
    const node = (id: string) => ({ id, type: 'shapeNode', position: { x: 0, y: 0 }, width: 200, height: 90, data: { label: id, shape: 'rounded-rectangle' } });
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [{ id: 'e1', source: 'a', target: 'b', type: 'simpleFloating' }, { id: 'e2', source: 'b', target: 'c', type: 'simpleFloating' }];
    const lr = await (await POST(post({ nodes, edges, dryRun: true, layout: { direction: 'LR' } }))).json();
    const td = await (await POST(post({ nodes, edges, dryRun: true, layout: { direction: 'TD' } }))).json();
    const at = (graph: { nodes: Array<{ id: string; position: { x: number; y: number } }> }, id: string) => graph.nodes.find((n) => n.id === id)!.position;
    expect(lr.nodes).toHaveLength(3);
    expect(at(lr, 'c').x).toBeGreaterThan(at(lr, 'a').x);
    expect(at(td, 'c').y).toBeGreaterThan(at(td, 'a').y);
    expect(lr.edges).toHaveLength(2);
  });

  it('rejects a layout direction it does not know', async () => {
    expect((await POST(post({ nodes: [], edges: [], dryRun: true, layout: { direction: 'sideways' } }))).status).toBe(400);
  });
});
