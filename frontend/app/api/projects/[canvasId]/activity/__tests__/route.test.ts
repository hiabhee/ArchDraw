import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  authorize: vi.fn(),
  rate: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  executeRaw: vi.fn(),
  detailFindUnique: vi.fn(),
}));
vi.mock('@/lib/server/projects/projectCanvas', () => ({
  authorizeAgentForCanvas: m.authorize,
  readJsonBody: async (request: Request) => ({ tooLarge: false, value: await request.json().catch(() => null) }),
}));
vi.mock('@/lib/server/redis', () => ({ checkRateLimitWithFallback: m.rate }));
vi.mock('@/lib/server/prisma', () => ({ default: { agentSession: { findUnique: m.findUnique, findMany: m.findMany, upsert: m.upsert, deleteMany: m.deleteMany }, projectDetailMap: { findUnique: m.detailFindUnique }, $executeRaw: m.executeRaw } }));
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
    m.findMany.mockResolvedValue([]);
    m.upsert.mockResolvedValue({ id: 's1', name: 'Otter' });
    m.deleteMany.mockResolvedValue({ count: 0 });
    m.detailFindUnique.mockResolvedValue(null);
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

  it('places the session on the detailed map part that owns the file, and falls back to its component', async () => {
    m.detailFindUnique.mockResolvedValue({
      nodes: [
        { id: 'api', type: 'groupNode', data: { codePaths: ['frontend/app/api/**'] } },
        { id: 'api__users', type: 'shapeNode', parentNode: 'api', data: { codePaths: ['frontend/app/api/users/**'] } },
      ],
    });
    await POST(req({ sessionKey: 'k', event: 'edit', files: ['frontend/app/api/users/route.ts'] }), params);
    expect(m.upsert.mock.calls[0][0].update).toMatchObject({ currentComponentId: 'api', detailComponentId: 'api__users' });

    m.detailFindUnique.mockResolvedValue({ nodes: [{ id: 'api__users', type: 'shapeNode', data: { codePaths: ['frontend/app/api/users/**'] } }] });
    await POST(req({ sessionKey: 'k', event: 'read', files: ['frontend/lib/server/auth.ts'] }), params);
    expect(m.upsert.mock.calls[1][0].update).toMatchObject({ currentComponentId: 'auth', detailComponentId: null });

    // No detailed map: the field is left alone.
    m.detailFindUnique.mockResolvedValue(null);
    await POST(req({ sessionKey: 'k', event: 'edit', files: ['frontend/lib/server/auth.ts'] }), params);
    expect(m.upsert.mock.calls[2][0].update).not.toHaveProperty('detailComponentId');
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

  it('gives a new session a name no live session on the canvas uses, and returns it', async () => {
    const { sessionNameFor } = await import('@/lib/diagram/projects/liveActivity');
    const preferred = sessionNameFor('k');
    m.findMany.mockResolvedValue([{ name: preferred }]);
    const res = await POST(req({ sessionKey: 'k', event: 'start' }), params);
    const { create, update } = m.upsert.mock.calls[0][0];
    expect(create.name).not.toBe(preferred);
    expect(update.name).toBe(create.name);
    expect((await res.json()).name).toBe('Otter');

    m.findUnique.mockResolvedValue({ touched: {}, unmappedPaths: [], currentComponentId: null, name: 'Fox' });
    await POST(req({ sessionKey: 'k', event: 'edit', files: ['frontend/app/api/x.ts'] }), params);
    expect(m.upsert.mock.calls[1][0].update.name).toBeUndefined();
  });

  it('puts new code outside the map on a construction site beside the nearest component, and leaves it on a mapped edit', async () => {
    await POST(req({ sessionKey: 'k', event: 'edit', files: ['frontend/app/exports/csv.ts'] }), params);
    let { create } = m.upsert.mock.calls[0][0];
    expect(create.siteArea).toBe('frontend/app/exports');
    expect(create.siteAnchorId).toBe('api');
    expect(create.unmappedHits).toBe(1);

    await POST(req({ sessionKey: 'k', event: 'edit', files: ['frontend/app/api/x.ts'] }), params);
    ({ create } = m.upsert.mock.calls[1][0]);
    expect(create.siteArea).toBeNull();
    expect(create.mappedHits).toBe(1);
    expect(m.upsert.mock.calls[1][0].update.mappedHits).toEqual({ increment: 1 });
  });

  it('counts only edited source files for coverage; reads and docs leave the site alone', async () => {
    await POST(req({ sessionKey: 'k', event: 'edit', files: ['docs/a.md'] }), params);
    expect(m.upsert.mock.calls[0][0].create).toMatchObject({ mappedHits: 0, unmappedHits: 0 });
    expect(m.upsert.mock.calls[0][0].create.siteArea).toBeUndefined();
    await POST(req({ sessionKey: 'k', event: 'read', files: ['frontend/app/exports/csv.ts'] }), params);
    expect(m.upsert.mock.calls[1][0].create.siteArea).toBeUndefined();
    expect(m.upsert.mock.calls[1][0].create.unmappedHits).toBe(0);
  });
});
