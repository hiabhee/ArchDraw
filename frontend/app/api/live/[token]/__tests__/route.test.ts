import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ canvas: vi.fn(), sessions: vi.fn(), rate: vi.fn(), getSession: vi.fn() }));
vi.mock('@/lib/server/prisma', () => ({ default: { userCanvas: { findUnique: m.canvas }, agentSession: { findMany: m.sessions } } }));
vi.mock('@/lib/server/redis', () => ({ checkRateLimitWithFallback: m.rate }));
vi.mock('@/lib/server/auth', () => ({ auth: { api: { getSession: m.getSession } } }));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { GET } from '../route';
import { createWatchToken } from '@/lib/server/projects/watchLink';

process.env.BETTER_AUTH_SECRET = 'test-secret';
const canvas = {
  id: 'c1', userId: 'u1', name: 'ArchDraw', updatedAt: new Date(5000), agenticProjectId: 'p1',
  nodes: [{ id: 'api', data: { label: 'API', codePaths: ['server/**'] } }],
  edges: [{ id: 'e', source: 'api', target: 'db' }],
};
const session = {
  id: 's', sessionKey: 'k', label: 'repo (main)', branch: 'main', status: 'active', intent: 'Fix auth',
  currentComponentId: 'api', touched: { api: { count: 1, lastAt: 4000 } }, unmappedPaths: ['secret/plan.md'],
  startedAt: new Date(1000), lastSeenAt: new Date(4000), lastChange: null,
};
const get = (token: string, query = '') =>
  GET(new NextRequest(`http://localhost/api/live/${token}${query}`), { params: Promise.resolve({ token }) });

describe('GET /api/live/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rate.mockResolvedValue({ allowed: true });
    m.canvas.mockResolvedValue(canvas);
    m.sessions.mockResolvedValue([session]);
    m.getSession.mockResolvedValue(null);
  });

  it('serves the diagram and sessions to anyone with a valid link, without private paths', async () => {
    const res = await get(createWatchToken('c1', 'p1')!);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canvasName).toBe('ArchDraw');
    expect(body.nodes[0].data).toEqual({ label: 'API' });
    expect(body.sessions[0].label).toBe('repo (main)');
    expect(body.sessions[0].unmappedPaths).toEqual([]);
    expect(body.claimable).toBe(false);
  });

  it('tells a signed-in owner the project is theirs, only when asked (first load)', async () => {
    const token = createWatchToken('c1', 'p1')!;
    expect((await (await get(token)).json()).ownedByViewer).toBeUndefined();
    expect(m.getSession).not.toHaveBeenCalled();
    m.getSession.mockResolvedValue({ user: { id: 'u1' } });
    expect((await (await get(token, '?viewer=1')).json()).ownedByViewer).toBe(true);
    m.getSession.mockResolvedValue({ user: { id: 'someone-else' } });
    expect((await (await get(token, '?viewer=1')).json()).ownedByViewer).toBe(false);
  });

  it('marks projects made without an account as claimable', async () => {
    m.canvas.mockResolvedValue({ ...canvas, userId: 'anon_123' });
    expect((await (await get(createWatchToken('c1', 'p1')!)).json()).claimable).toBe(true);
  });

  it('skips the graph when the watcher already has the latest version', async () => {
    const body = await (await get(createWatchToken('c1', 'p1')!, '?since=5000')).json();
    expect(body.nodes).toBeUndefined();
    expect(body.sessions).toHaveLength(1);
  });

  it('returns 404 for a forged link or a stopped project', async () => {
    expect((await get('c1.forged')).status).toBe(404);
    m.canvas.mockResolvedValue({ ...canvas, agenticProjectId: 'p2' });
    expect((await get(createWatchToken('c1', 'p1')!)).status).toBe(404);
    m.canvas.mockResolvedValue({ ...canvas, agenticProjectId: null });
    expect((await get(createWatchToken('c1', 'p1')!)).status).toBe(404);
  });

  it('rate-limits per client IP', async () => {
    m.rate.mockResolvedValue({ allowed: false });
    expect((await get(createWatchToken('c1', 'p1')!)).status).toBe(429);
  });
});
