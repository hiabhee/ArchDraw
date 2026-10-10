import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatPreviewLinks } from '../../lib/preview-links.js';
import { GenerateDiagramInputSchema } from '../../lib/schema.js';

const API = 'https://archdraw.test';
const MERMAID = 'graph LR\n  Web[Web App] --> API[API]\n  API --> DB[("Postgres")]';
const previewBody = {
  nodes: [
    { id: 'Web', type: 'shapeNode', position: { x: 0, y: 0 }, data: { label: 'Web App' } },
    { id: 'API', type: 'shapeNode', position: { x: 300, y: 0 }, data: { label: 'API' } },
  ],
  edges: [{ id: 'e1', source: 'Web', target: 'API' }],
  warnings: [],
};

function json(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
}

describe('formatPreviewLinks', () => {
  it('puts the preview and edit links first with an instruction to show them', () => {
    const text = formatPreviewLinks({ shareUrl: `${API}/share/s1`, diagramUrl: `${API}/editor?session=s1` });
    expect(text.split('\n')[0]).toMatch(/Show these links to the user/);
    expect(text).toContain(`Preview: ${API}/share/s1`);
    expect(text).toContain(`${API}/editor?session=s1`);
  });

  it('explains private (publish:false) and failed-link cases instead of staying silent', () => {
    expect(formatPreviewLinks({ privateByRequest: true })).toMatch(/publish:false/);
    expect(formatPreviewLinks({ linkError: 'HTTP 500' })).toMatch(/No preview link could be created: HTTP 500/);
  });
});

describe('generate_diagram preview links', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.API_BASE_URL = API;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.API_BASE_URL;
  });

  it('defaults publish to true so the link comes back in the same response', () => {
    expect(GenerateDiagramInputSchema.parse({ mermaid: MERMAID }).publish).toBe(true);
  });

  it('returns preview + edit URLs from a single generate call', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(previewBody))
      .mockResolvedValueOnce(json({ sessionId: 's1', updateToken: 't1' }));
    vi.stubGlobal('fetch', fetchMock);
    const { generateDiagram } = await import('../generate-diagram.js');

    const result = await generateDiagram(GenerateDiagramInputSchema.parse({ mermaid: MERMAID }));
    expect(result.success).toBe(true);
    expect(result.shareUrl).toBe(`${API}/share/s1`);
    expect(result.diagramUrl).toBe(`${API}/editor?session=s1`);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('still returns the diagram when saving the preview fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(json(previewBody))
      .mockResolvedValueOnce(json({ error: 'db down' }, false, 500)));
    const { generateDiagram } = await import('../generate-diagram.js');

    const result = await generateDiagram(GenerateDiagramInputSchema.parse({ mermaid: MERMAID }));
    expect(result.success).toBe(true);
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.shareUrl).toBeUndefined();
    expect(result.linkError).toMatch(/HTTP 500/);
  });

  it('creates no link when the user opts out with publish:false', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(previewBody));
    vi.stubGlobal('fetch', fetchMock);
    const { generateDiagram } = await import('../generate-diagram.js');

    const result = await generateDiagram(GenerateDiagramInputSchema.parse({ mermaid: MERMAID, publish: false }));
    expect(result.success).toBe(true);
    expect(result.shareUrl).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
