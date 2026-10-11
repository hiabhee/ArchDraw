import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  authorize: vi.fn(),
  rate: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock('@/lib/server/projects/projectCanvas', () => ({ authorizeAgentForCanvas: m.authorize }));
vi.mock('@/lib/server/redis', () => ({ checkRateLimitWithFallback: m.rate }));
vi.mock('@/lib/server/prisma', () => ({ default: { agentSession: { findUnique: m.findUnique, upsert: m.upsert } } }));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { POST } from '../route';

const params = { params: Promise.resolve({ canvasId: 'c1' }) };
const req = (body: unknown) =>
  new NextRequest('http://localhost/api/projects/c1/activity', {
    method: 'POST',
    headers: { authorization: 'Bearer adp_x', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const canvas = {
  id: 'c1',
  userId: 'u1',
  nodes: [
    { id: 'auth', type: 'systemNode', data: { codePaths: ['frontend/lib/server/auth.ts'] } },
    { id: 'api', type: 'systemNode', data: { codePaths: ['frontend/app/api/**'] } },
  ],
};

describe('POST /api/projects/[canvasId]/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.authorize.mockResolvedValue({ canvas, principal: { userId: 'u1', credentialId: 'cred' } });
    m.rate.mockResolvedValue({ allowed: true });
    m.findUnique.mockResolvedValue(null);
    m.upsert.mockResolvedValue({ id: 's1' });
  });

  it('rejects unauthorized agents', async () => {
    m.authorize.mockResolvedValue(null);
    expect((await POST(req({ sessionKey: 'k', event: 'edit' }), params)).status).toBe(401);
  });

  it('rate-limits per credential', async () => {
    m.rate.mockResolvedValue({ allowed: false });
    expect((await POST(req({ sessionKey: 'k', event: 'edit' }), params)).status).toBe(429);
    expect(m.rate.mock.calls[0][0]).toBe('project-activity:cred');
  });

  it('validates the payload', async () => {
    expect((await POST(req({ event: 'edit' }), params)).status).toBe(400);
    expect((await POST(req({ sessionKey: 'k', event: 'nope' }), params)).status).toBe(400);
  });

  it('maps files to components and records unmapped paths', async () => {
    const res = await POST(
      req({ sessionKey: 'k', event: 'edit', branch: 'feat/x', files: ['./frontend/lib/server/auth.ts', 'docs/a.md'] }),
      params,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mapped: { 'frontend/lib/server/auth.ts': 'auth' },
      unmapped: ['docs/a.md'],
    });
    const { create } = m.upsert.mock.calls[0][0];
    expect(create.label).toBe('feat/x');
    expect(create.status).toBe('active');
    expect(create.currentComponentId).toBe('auth');
    expect(create.touched.auth.count).toBe(1);
    expect(create.unmappedPaths).toEqual(['docs/a.md']);
  });

  it('accumulates touched counts and ignores unknown componentIds', async () => {
    m.findUnique.mockResolvedValue({ touched: { auth: { count: 2, lastAt: 1 } }, unmappedPaths: [], currentComponentId: 'auth' });
    await POST(req({ sessionKey: 'k', event: 'edit', componentIds: ['api', 'ghost'], intent: 'Refactor API' }), params);
    const { update } = m.upsert.mock.calls[0][0];
    expect(update.touched.auth.count).toBe(2);
    expect(update.touched.api.count).toBe(1);
    expect(update.touched.ghost).toBeUndefined();
    expect(update.currentComponentId).toBe('api');
    expect(update.intent).toBe('Refactor API');
  });

  it('marks the session idle on stop and ended on end', async () => {
    await POST(req({ sessionKey: 'k', event: 'stop' }), params);
    expect(m.upsert.mock.calls[0][0].update.status).toBe('idle');
    await POST(req({ sessionKey: 'k', event: 'end' }), params);
    expect(m.upsert.mock.calls[1][0].update.status).toBe('ended');
  });
});
