import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  getAgenticPrincipal: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock('@/lib/server/prisma', () => ({ default: { userCanvas: { findUnique: m.findUnique } } }));
vi.mock('@/lib/server/agentic-auth', () => ({ getAgenticPrincipal: m.getAgenticPrincipal }));
vi.mock('@/lib/server/auth', () => ({ auth: { api: { getSession: m.getSession } } }));

import { authorizeAgentForCanvas, getOwnedCanvas } from '../projectCanvas';

const canvas = { id: 'c1', userId: 'u1', agenticProjectId: 'p1', nodes: [], name: 'X', updatedAt: new Date() };
const req = (authorization?: string) =>
  new Request('http://localhost/api/projects/c1/activity', { headers: authorization ? { authorization } : {} });

describe('authorizeAgentForCanvas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires an Authorization header (no browser-session fallback)', async () => {
    expect(await authorizeAgentForCanvas(req(), 'c1')).toBeNull();
    expect(m.findUnique).not.toHaveBeenCalled();
  });

  it('rejects canvases that are not projects', async () => {
    m.findUnique.mockResolvedValue({ ...canvas, agenticProjectId: null });
    expect(await authorizeAgentForCanvas(req('Bearer adp_x'), 'c1')).toBeNull();
    expect(m.getAgenticPrincipal).not.toHaveBeenCalled();
  });

  it('checks the credential against the canvas project and owner', async () => {
    m.findUnique.mockResolvedValue(canvas);
    m.getAgenticPrincipal.mockResolvedValue({ userId: 'u1', credentialId: 'cred' });
    const result = await authorizeAgentForCanvas(req('Bearer adp_x'), 'c1');
    expect(result?.canvas.id).toBe('c1');
    expect(m.getAgenticPrincipal.mock.calls[0][1]).toBe('p1');
  });

  it('rejects an invalid, revoked or wrong-owner credential', async () => {
    m.findUnique.mockResolvedValue(canvas);
    m.getAgenticPrincipal.mockResolvedValueOnce(null);
    expect(await authorizeAgentForCanvas(req('Bearer adp_x'), 'c1')).toBeNull();
    m.getAgenticPrincipal.mockResolvedValueOnce({ userId: 'someone-else', credentialId: 'cred' });
    expect(await authorizeAgentForCanvas(req('Bearer adp_x'), 'c1')).toBeNull();
    m.getAgenticPrincipal.mockResolvedValueOnce({ userId: 'u1' });
    expect(await authorizeAgentForCanvas(req('Bearer adp_x'), 'c1')).toBeNull();
  });
});

describe('getOwnedCanvas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hides canvases owned by another user', async () => {
    m.getSession.mockResolvedValue({ user: { id: 'u2' } });
    m.findUnique.mockResolvedValue(canvas);
    expect(await getOwnedCanvas(req(), 'c1')).toEqual({ userId: 'u2', canvas: null });
  });

  it('returns no user when signed out', async () => {
    m.getSession.mockResolvedValue(null);
    expect(await getOwnedCanvas(req(), 'c1')).toEqual({ userId: null, canvas: null });
  });
});
