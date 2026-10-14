import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ rate: vi.fn(), create: vi.fn() }));
vi.mock('@/lib/server/redis', () => ({ checkRateLimitWithFallback: m.rate }));
vi.mock('@/lib/server/projects/anonymousProjects', () => ({ createAnonymousProject: m.create }));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { POST } from '../route';

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/projects/quickstart', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));

const mermaid = 'graph LR\n  c_api["API routes"]\n  c_db[("Database")]\n  c_api --> c_db\n';

describe('POST /api/projects/quickstart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rate.mockResolvedValue({ allowed: true });
    m.create.mockResolvedValue({ canvasId: 'c1', agenticProjectId: 'p1', workspaceId: 'w1', token: 'adp_x', watchPath: '/live/c1.sig', claimSecret: 's' });
  });

  it('lays out the diagram, attaches code paths and creates the project', async () => {
    const res = await post({ repoName: 'shop', mermaid, componentPaths: { c_api: ['app/api/**'] } });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ canvasId: 'c1', token: 'adp_x', watchPath: '/live/c1.sig', componentCount: 2 });
    const input = m.create.mock.calls[0][0];
    expect(input.name).toBe('shop');
    const api = input.nodes.find((n: { id: string }) => n.id === 'c_api');
    expect(api.data.codePaths).toEqual(['app/api/**']);
    expect(input.edges).toHaveLength(1);
  });

  it('rejects bad payloads and rate-limits per IP', async () => {
    expect((await post({ repoName: '', mermaid })).status).toBe(400);
    m.rate.mockResolvedValue({ allowed: false });
    expect((await post({ repoName: 'shop', mermaid })).status).toBe(429);
    expect(m.create).not.toHaveBeenCalled();
  });
});
