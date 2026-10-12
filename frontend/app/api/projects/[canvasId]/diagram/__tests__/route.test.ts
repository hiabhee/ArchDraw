import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  authorize: vi.fn(),
  rate: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  sessionUpsert: vi.fn(),
}));
vi.mock('@/lib/server/projects/projectCanvas', () => ({
  authorizeAgentForCanvas: m.authorize,
  readJsonBody: async (request: Request) => ({ tooLarge: false, value: await request.json().catch(() => null) }),
}));
vi.mock('@/lib/server/redis', () => ({ checkRateLimitWithFallback: m.rate }));
vi.mock('@/lib/server/prisma', () => ({
  default: {
    userCanvas: { updateMany: m.updateMany, findUnique: m.findUnique },
    agentSession: { upsert: m.sessionUpsert },
  },
}));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { GET, PUT } from '../route';

const params = { params: Promise.resolve({ canvasId: 'c1' }) };
const put = (body: unknown) =>
  new NextRequest('http://localhost/api/projects/c1/diagram', {
    method: 'PUT',
    headers: { authorization: 'Bearer adp_x', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const canvas = {
  id: 'c1',
  userId: 'u1',
  name: 'Repo',
  updatedAt: new Date(1000),
  nodes: [
    { id: 'g', type: 'groupNode', data: { label: 'Frontend', codePaths: ['frontend'] } },
    { id: 'web', type: 'shapeNode', parentId: 'g', data: { label: 'Web' } },
  ],
  edges: [],
};

describe('/api/projects/[canvasId]/diagram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.authorize.mockResolvedValue({ canvas, principal: { userId: 'u1', credentialId: 'cred' } });
    m.rate.mockResolvedValue({ allowed: true });
    m.updateMany.mockResolvedValue({ count: 1 });
    m.findUnique.mockResolvedValue({ updatedAt: new Date(2000) });
    m.sessionUpsert.mockResolvedValue({ id: 's1' });
  });

  it('GET returns a compact component map', async () => {
    const res = await GET(new NextRequest('http://localhost/api/projects/c1/diagram'), params);
    expect(await res.json()).toMatchObject({
      canvasId: 'c1',
      components: [
        { id: 'g', label: 'Frontend', codePaths: ['frontend'], parentId: null },
        { id: 'web', label: 'Web', codePaths: [], parentId: 'g' },
      ],
    });
  });

  it('rejects unauthorized agents', async () => {
    m.authorize.mockResolvedValue(null);
    expect((await PUT(put({ mermaid: 'graph LR\n a-->b' }), params)).status).toBe(401);
  });

  it('requires exactly one of mermaid or nodes', async () => {
    expect((await PUT(put({}), params)).status).toBe(400);
    expect((await PUT(put({ mermaid: 'graph LR\n a-->b', nodes: [], edges: [] }), params)).status).toBe(400);
  });

  it('lays out Mermaid and attaches componentPaths by node id', async () => {
    const res = await PUT(
      put({
        mermaid: 'graph LR\n  subgraph fe["Frontend"]\n    web["Web App"]\n  end\n  api["API"]\n  web --> api',
        componentPaths: { web: ['frontend/app/**'], api: ['frontend/app/api'], ghost: ['x'] },
      }),
      params,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mappedCount).toBe(2);
    expect(body.warnings.join(' ')).toContain('ghost');
    const saved = m.updateMany.mock.calls[0][0].data.nodes as Array<{ id: string; data: { codePaths?: string[] } }>;
    expect(saved.find((n) => n.id === 'web')?.data.codePaths).toEqual(['frontend/app/**']);
    expect(saved.find((n) => n.id === 'fe')?.data.codePaths).toBeUndefined();
  });

  it('returns 409 when the canvas changed since baseUpdatedAt', async () => {
    const res = await PUT(put({ nodes: [{ id: 'a' }], edges: [], baseUpdatedAt: 500 }), params);
    expect(res.status).toBe(409);
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it('always writes against the exact version it merged from (a future baseUpdatedAt cannot skip the check)', async () => {
    m.updateMany.mockResolvedValue({ count: 0 });
    const res = await PUT(put({ nodes: [{ id: 'a' }], edges: [], baseUpdatedAt: 9_999_999_999_999 }), params);
    expect(res.status).toBe(409);
    expect(m.updateMany.mock.calls[0][0].where.updatedAt).toEqual(canvas.updatedAt);
  });

  it('GET ?format=mermaid returns Mermaid and the componentPaths map', async () => {
    const res = await GET(new NextRequest('http://localhost/api/projects/c1/diagram?format=mermaid'), params);
    const body = await res.json();
    expect(body.mermaid).toMatch(/^graph LR/);
    expect(body.componentPaths).toEqual({ g: ['frontend'] });
  });

  it('merges into the existing canvas, guards against concurrent saves and records the change', async () => {
    const existing = {
      ...canvas,
      nodes: [{ id: 'api', type: 'shapeNode', position: { x: -400, y: -400 }, width: 160, height: 80, data: { label: 'API', codePaths: ['server/**'] } }],
    };
    m.authorize.mockResolvedValue({ canvas: existing, principal: { userId: 'u1', credentialId: 'cred' } });
    const res = await PUT(put({ mermaid: 'graph LR\n  api["API"]\n  queue["Queue"]\n  api --> queue', sessionKey: 'sess' }), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('merge');
    expect(body.summary).toBe('Added Queue');

    const { where, data } = m.updateMany.mock.calls[0][0];
    expect(where.updatedAt).toEqual(existing.updatedAt);
    const api = data.nodes.find((n: { id: string }) => n.id === 'api');
    expect(api.position).toEqual({ x: -400, y: -400 });
    expect(api.data.codePaths).toEqual(['server/**']);

    const upsert = m.sessionUpsert.mock.calls[0][0];
    expect(upsert.where.canvasId_sessionKey).toEqual({ canvasId: 'c1', sessionKey: 'sess' });
    expect(upsert.update.lastChange.added).toEqual([{ id: 'queue', label: 'Queue' }]);
  });

  it('does not record a session change when nothing structural changed', async () => {
    const res = await PUT(put({ nodes: canvas.nodes, edges: [], sessionKey: 'sess' }), params);
    expect(res.status).toBe(200);
    expect(m.sessionUpsert).not.toHaveBeenCalled();
  });

  it('rate-limits publishes per credential', async () => {
    m.rate.mockResolvedValue({ allowed: false });
    expect((await PUT(put({ nodes: [], edges: [] }), params)).status).toBe(429);
  });
});
