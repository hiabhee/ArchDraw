import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  sessionFindMany: vi.fn(async () => [] as Array<{ id: string; siteArea: string; name?: string }>),
  sessionUpdate: vi.fn<(args: unknown) => Promise<object>>(async () => ({})),
  authorize: vi.fn(),
  rate: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  sessionUpsert: vi.fn(),
  detailUpsert: vi.fn(async () => ({ updatedAt: new Date(3000) })),
  historyCreateMany: vi.fn(async () => ({ count: 0 })),
}));
vi.mock('@/lib/server/projects/projectCanvas', () => ({
  authorizeAgentForCanvas: m.authorize,
  readJsonBody: async (request: Request) => ({ tooLarge: false, value: await request.json().catch(() => null) }),
}));
vi.mock('@/lib/server/redis', () => ({ checkRateLimitWithFallback: m.rate }));
vi.mock('@/lib/server/prisma', () => ({
  default: {
    userCanvas: { updateMany: m.updateMany, findUnique: m.findUnique },
    agentSession: { upsert: m.sessionUpsert, findMany: m.sessionFindMany, update: m.sessionUpdate },
    projectDetailMap: { upsert: m.detailUpsert },
    componentActivity: { createMany: m.historyCreateMany },
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

  it('stores the detailed map separately and leaves the overview canvas alone', async () => {
    const mermaid = [
      'graph LR',
      '  subgraph area["Frontend"]',
      '    subgraph web["Web"]',
      '      web__pages("Pages<br/>app/ routes")',
      '      web__api("API client")',
      '    end',
      '  end',
      '  web__pages -->|"requests"| web__api',
    ].join('\n');
    const res = await PUT(put({ level: 'detail', mermaid, componentPaths: { web__pages: ['frontend/app/**'], web: ['frontend/**'] } }), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, level: 'detail', updatedAt: 3000, mappedCount: 2 });
    expect(m.updateMany).not.toHaveBeenCalled();
    const stored = (m.detailUpsert.mock.calls[0] as unknown as [{ create: { canvasId: string; nodes: Array<{ id: string; parentNode?: string; data: { codePaths?: string[] } }> } }])[0].create;
    expect(stored.canvasId).toBe('c1');
    const pages = stored.nodes.find((n) => n.id === 'web__pages')!;
    expect(pages.parentNode).toBe('web');
    expect(pages.data.codePaths).toEqual(['frontend/app/**']);
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

  it('turns construction sites the new diagram covers into that component', async () => {
    m.sessionFindMany.mockResolvedValueOnce([{ id: 's1', siteArea: 'frontend/app/exports' }, { id: 's2', siteArea: 'tools/cli' }]);
    const res = await PUT(
      put({ mermaid: 'graph LR\n  exports["CSV export"]\n  api["API"]\n  exports --> api', componentPaths: { exports: ['frontend/app/exports/**'] } }),
      params,
    );
    expect(res.status).toBe(200);
    expect(m.sessionUpdate).toHaveBeenCalledTimes(1);
    expect(m.sessionUpdate.mock.calls[0][0]).toEqual({
      where: { id: 's1' },
      data: { siteArea: null, siteAnchorId: null, currentComponentId: 'exports' },
    });
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
    // The component's history starts with the session that added it.
    const [history] = m.historyCreateMany.mock.calls[0] as unknown as [{ data: Array<Record<string, unknown>> }];
    expect(history.data).toEqual([expect.objectContaining({ canvasId: 'c1', componentId: 'queue', sessionKey: 'sess', kind: 'added' })]);
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
