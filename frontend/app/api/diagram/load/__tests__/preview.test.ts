import { NextRequest } from 'next/server';
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

  it('leaves the SVG out unless asked', async () => {
    const body = await (await POST(post({ mermaid: MERMAID, dryRun: true }))).json();
    expect(body.previewSvg).toBeUndefined();
    expect(body.nodes.length).toBeGreaterThan(0);
  });
});
