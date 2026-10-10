import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  create: vi.fn(),
  runMermaidPipeline: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock('@/lib/redis', () => ({ checkRateLimitWithFallback: m.rateLimit }));
vi.mock('@/lib/prisma', () => ({ default: { sharedCanvas: { create: m.create } } }));
vi.mock('@/lib/mermaid/pipeline', () => ({ runMermaidPipeline: m.runMermaidPipeline }));
vi.mock('@/lib/middleware/quotaCheck', () => ({ getSessionFromRequest: m.getSession, logUsage: vi.fn() }));
vi.mock('@/lib/server/ip', () => ({ getClientIP: () => '203.0.113.7' }));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() } }));

import { POST } from '../route';

const post = (body: unknown) => new NextRequest('http://localhost/api/diagram/load', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const now = () => Math.floor(Date.now() / 1000);

describe('POST /api/diagram/load rate limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getSession.mockResolvedValue(null);
    m.create.mockResolvedValue({ id: 'share-1' });
    m.rateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: now() + 3600 });
  });

  it('keys anonymous creates by client IP with the create limit', async () => {
    await POST(post({ nodes: [], edges: [], label: 'x' }));
    expect(m.rateLimit).toHaveBeenCalledWith('diagram-load:create:ip:203.0.113.7', 30, 3600);
  });

  it('uses the per-user bucket and higher limit when signed in', async () => {
    m.getSession.mockResolvedValue({ user: { id: 'u1' } });
    await POST(post({ nodes: [], edges: [] }));
    expect(m.rateLimit).toHaveBeenCalledWith('diagram-load:create:user:u1', 60, 3600);
  });

  it('applies the separate preview limit to dry runs', async () => {
    await POST(post({ nodes: [], edges: [], dryRun: true }));
    expect(m.rateLimit).toHaveBeenCalledWith('diagram-load:preview:ip:203.0.113.7', 300, 3600);
  });

  it('returns 429 with Retry-After before running the pipeline or writing', async () => {
    m.rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: now() + 120 });
    const res = await POST(post({ mermaid: 'graph LR\n A-->B', source: 'mcp', publish: true }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('RATE_LIMITED');
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(m.runMermaidPipeline).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });
});
