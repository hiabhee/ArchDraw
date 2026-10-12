import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  authorize: vi.fn(),
  rate: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  executeRaw: vi.fn(),
}));
vi.mock('@/lib/server/projects/projectCanvas', () => ({
  authorizeAgentForCanvas: m.authorize,
  readJsonBody: async (request: Request) => ({ tooLarge: false, value: await request.json().catch(() => null) }),
}));
vi.mock('@/lib/server/redis', () => ({ checkRateLimitWithFallback: m.rate }));
vi.mock('@/lib/server/prisma', () => ({ default: { agentSession: { findUnique: m.findUnique, upsert: m.upsert, deleteMany: m.deleteMany }, $executeRaw: m.executeRaw } }));
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
  name: 'Giraffe',
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
    m.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('retries once when a concurrent report created the session first', async () => {
    m.upsert.mockRejectedValueOnce(Object.assign(new Error('Unique constraint'), { code: 'P2002' }));
    const res = await POST(req({ sessionKey: 'k', event: 'edit', files: ['src/a.ts'] }), params);
    expect(res.status).toBe(200);
    expect(m.upsert).toHaveBeenCalledTimes(2);
  });

  it('names an auto-named canvas after the repository on session start, and only then', async () => {
    await POST(req({ sessionKey: 'k', event: 'start', repoName: 'ArchDraw' }), params);
    expect(m.executeRaw).toHaveBeenCalledTimes(1);
    expect(m.executeRaw.mock.calls[0].slice(1)).toEqual(['ArchDraw', 'c1', 'Giraffe']);

    m.authorize.mockResolvedValue({ canvas: { ...canvas, name: 'Payments' }, principal: { userId: 'u1', credentialId: 'cred' } });
    await POST(req({ sessionKey: 'k', event: 'start', repoName: 'ArchDraw' }), params);
    await POST(req({ sessionKey: 'k', event: 'edit', repoName: 'ArchDraw' }), params);
    expect(m.executeRaw).toHaveBeenCalledTimes(1);
  });

  it('prunes old sessions of the canvas when a session starts', async () => {
    await POST(req({ sessionKey: 'k', event: 'start' }), params);
    expect(m.deleteMany.mock.calls[0][0].where.canvasId).toBe('c1');
    await POST(req({ sessionKey: 'k', event: 'edit' }), params);
    expect(m.deleteMany).toHaveBeenCalledTimes(1);
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
