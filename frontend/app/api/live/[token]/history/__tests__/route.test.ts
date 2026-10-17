import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  rate: vi.fn(),
  canvasFindUnique: vi.fn(),
  historyFindMany: vi.fn(),
  verify: vi.fn(),
}));
vi.mock('@/lib/server/redis', () => ({ checkRateLimitWithFallback: m.rate }));
vi.mock('@/lib/server/ip', () => ({ getClientIP: () => '1.2.3.4' }));
vi.mock('@/lib/server/projects/watchLink', () => ({
  parseWatchToken: (token: string) => (token.includes('.') ? { canvasId: token.split('.')[0], signature: 'sig' } : null),
  verifyWatchToken: m.verify,
}));
vi.mock('@/lib/server/prisma', () => ({
  default: {
    userCanvas: { findUnique: m.canvasFindUnique },
    componentActivity: { findMany: m.historyFindMany },
    projectDetailMap: { findUnique: vi.fn() },
  },
}));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { GET } from '../route';

const get = (query: string) => GET(
  new NextRequest(`http://localhost/api/live/c1.sig/history${query}`),
  { params: Promise.resolve({ token: 'c1.sig' }) },
);

describe('GET /api/live/[token]/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rate.mockResolvedValue({ allowed: true });
    m.verify.mockReturnValue(true);
    m.canvasFindUnique.mockResolvedValue({
      id: 'c1',
      agenticProjectId: 'p1',
      nodes: [{ id: 'api' }, { id: 'payments', parentNode: 'api' }],
    });
    m.historyFindMany.mockResolvedValue([{
      id: 'h1', componentId: 'payments', detailComponentId: null, sessionKey: 'k', sessionName: 'Otter', kind: 'edit',
      intent: 'Add refund retries', files: ['server/pay/refund.ts', 'server/pay/retry.ts'], edits: 4,
      startedAt: new Date(1000), lastAt: new Date(2000),
    }]);
  });

  it('returns an area\'s history without file paths, only how many files', async () => {
    const res = await get('?component=api');
    expect(res.status).toBe(200);
    const { entries } = await res.json();
    expect(entries).toEqual([expect.objectContaining({ sessionName: 'Otter', intent: 'Add refund retries', files: [], fileCount: 2, edits: 4 })]);
    const where = m.historyFindMany.mock.calls[0][0].where;
    expect(where.OR[0].componentId.in.sort()).toEqual(['api', 'payments']);
  });

  it('rejects a bad link and an unknown component', async () => {
    m.verify.mockReturnValue(false);
    expect((await get('?component=api')).status).toBe(404);
    m.verify.mockReturnValue(true);
    expect((await (await get('?component=nope')).json()).entries).toEqual([]);
    expect((await get('')).status).toBe(400);
  });
});
