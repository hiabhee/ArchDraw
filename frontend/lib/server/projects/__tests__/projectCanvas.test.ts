import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findAgenticCredential: vi.fn(),
  markAgenticCredentialUsed: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock('@/lib/server/prisma', () => ({ default: { userCanvas: { findUnique: m.findUnique } } }));
vi.mock('@/lib/server/agentic-auth', () => ({
  findAgenticCredential: m.findAgenticCredential,
  markAgenticCredentialUsed: m.markAgenticCredentialUsed,
}));
vi.mock('@/lib/server/auth', () => ({ auth: { api: { getSession: m.getSession } } }));

import { authorizeAgentForCanvas, getOwnedCanvas, readJsonBody } from '../projectCanvas';

const TOKEN = 'adp_' + 'a'.repeat(43);
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
    m.findAgenticCredential.mockResolvedValue({ id: 'cred', ownerId: 'u1', projectId: 'p1', lastUsedAt: new Date() });
    expect(await authorizeAgentForCanvas(req(`Bearer ${TOKEN}`), 'c1')).toBeNull();
  });

  it('returns the canvas and principal for a credential of the same project and owner', async () => {
    m.findUnique.mockResolvedValue(canvas);
    m.findAgenticCredential.mockResolvedValue({ id: 'cred', ownerId: 'u1', projectId: 'p1', lastUsedAt: new Date() });
    m.markAgenticCredentialUsed.mockResolvedValue(true);
    const result = await authorizeAgentForCanvas(req(`Bearer ${TOKEN}`), 'c1');
    expect(result?.canvas.id).toBe('c1');
    expect(result?.principal).toEqual({ userId: 'u1', credentialId: 'cred' });
  });

  it('looks the credential up by token alone, so it can run alongside the canvas lookup', async () => {
    m.findUnique.mockResolvedValue(canvas);
    m.findAgenticCredential.mockResolvedValue({ id: 'cred', ownerId: 'u1', projectId: 'p1', lastUsedAt: new Date() });
    await authorizeAgentForCanvas(req(`Bearer ${TOKEN}`), 'c1');
    expect(m.findAgenticCredential).toHaveBeenCalledWith(TOKEN);
  });

  it('rejects a credential of another project', async () => {
    m.findUnique.mockResolvedValue(canvas);
    m.findAgenticCredential.mockResolvedValue({ id: 'cred', ownerId: 'u1', projectId: 'other', lastUsedAt: new Date() });
    expect(await authorizeAgentForCanvas(req(`Bearer ${TOKEN}`), 'c1')).toBeNull();
  });

  it('rejects a credential owned by someone else', async () => {
    m.findUnique.mockResolvedValue(canvas);
    m.findAgenticCredential.mockResolvedValue({ id: 'cred', ownerId: 'someone-else', projectId: 'p1', lastUsedAt: new Date() });
    expect(await authorizeAgentForCanvas(req(`Bearer ${TOKEN}`), 'c1')).toBeNull();
  });

  it('rejects an unknown, revoked or expired credential', async () => {
    m.findUnique.mockResolvedValue(canvas);
    m.findAgenticCredential.mockResolvedValue(null);
    expect(await authorizeAgentForCanvas(req(`Bearer ${TOKEN}`), 'c1')).toBeNull();
  });

  it('rejects a credential revoked while the request was running', async () => {
    m.findUnique.mockResolvedValue(canvas);
    m.findAgenticCredential.mockResolvedValue({ id: 'cred', ownerId: 'u1', projectId: 'p1', lastUsedAt: null });
    m.markAgenticCredentialUsed.mockResolvedValue(false);
    expect(await authorizeAgentForCanvas(req(`Bearer ${TOKEN}`), 'c1')).toBeNull();
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

describe('readJsonBody', () => {
  const body = (text: string, length?: number) =>
    new Request('http://localhost/x', { method: 'POST', body: text, headers: length ? { 'content-length': String(length) } : {} });

  it('parses JSON within the limit and returns null for malformed JSON', async () => {
    expect(await readJsonBody(body('{"a":1}'), 100)).toEqual({ tooLarge: false, value: { a: 1 } });
    expect(await readJsonBody(body('{nope'), 100)).toEqual({ tooLarge: false, value: null });
  });

  it('refuses bodies over the limit, by header or by actual size', async () => {
    expect(await readJsonBody(body('{}', 5_000), 1_000)).toEqual({ tooLarge: true });
    expect(await readJsonBody(body(JSON.stringify({ a: 'x'.repeat(2_000) })), 1_000)).toEqual({ tooLarge: true });
  });
});
