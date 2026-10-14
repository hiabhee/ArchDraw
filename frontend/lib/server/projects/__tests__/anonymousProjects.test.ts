import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const tx = {
    userCanvas: { updateMany: vi.fn() },
    agenticProject: { updateMany: vi.fn() },
    agenticCredential: { updateMany: vi.fn() },
    user: { delete: vi.fn() },
  };
  return {
    tx,
    findCanvas: vi.fn(),
    countProjects: vi.fn(),
    transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
});
vi.mock('@/lib/server/prisma', () => ({
  default: {
    userCanvas: { findUnique: m.findCanvas, count: m.countProjects },
    $transaction: m.transaction,
  },
}));

vi.mock('@/lib/server/agentic-auth', () => ({ hashAgenticSecret: (v: string) => `hash:${v}` }));
vi.mock('@/lib/server/projects/agenticProjects', () => ({ createAgenticProject: vi.fn() }));

import { claimAnonymousProject, isAnonymousUserId } from '../anonymousProjects';
import { createClaimSecret } from '../watchLink';

process.env.BETTER_AUTH_SECRET = 'test-secret';
const anonymous = { id: 'c1', userId: 'anon_abc', agenticProjectId: 'p1' };

describe('claimAnonymousProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.findCanvas.mockResolvedValue(anonymous);
    m.countProjects.mockResolvedValue(0);
    m.tx.userCanvas.updateMany.mockResolvedValue({ count: 1 });
  });

  it('moves the canvas, project and agent credentials to the user and drops the placeholder user', async () => {
    const result = await claimAnonymousProject('u1', 'c1', createClaimSecret('c1', 'p1')!);
    expect(result).toEqual({ ok: true, canvasId: 'c1', alreadyOwned: false });
    expect(m.tx.userCanvas.updateMany).toHaveBeenCalledWith({ where: { id: 'c1', userId: 'anon_abc' }, data: { userId: 'u1' } });
    expect(m.tx.agenticProject.updateMany).toHaveBeenCalledWith({ where: { id: 'p1', ownerId: 'anon_abc' }, data: { ownerId: 'u1' } });
    expect(m.tx.agenticCredential.updateMany).toHaveBeenCalledWith({ where: { projectId: 'p1', ownerId: 'anon_abc' }, data: { ownerId: 'u1' } });
    expect(m.tx.user.delete).toHaveBeenCalledWith({ where: { id: 'anon_abc' } });
  });

  it('rejects a wrong secret, and never moves a project that already has an account', async () => {
    expect(await claimAnonymousProject('u1', 'c1', 'nope')).toMatchObject({ ok: false, status: 403, code: 'INVALID_CLAIM' });
    m.findCanvas.mockResolvedValue({ ...anonymous, userId: 'someone' });
    expect(await claimAnonymousProject('u1', 'c1', createClaimSecret('c1', 'p1')!)).toMatchObject({ ok: false, status: 409 });
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it('is a no-op for the owner and a 404 for a missing project', async () => {
    m.findCanvas.mockResolvedValue({ ...anonymous, userId: 'u1' });
    expect(await claimAnonymousProject('u1', 'c1', 'x')).toEqual({ ok: true, canvasId: 'c1', alreadyOwned: true });
    m.findCanvas.mockResolvedValue(null);
    expect(await claimAnonymousProject('u1', 'c1', 'x')).toMatchObject({ ok: false, status: 404 });
  });

  it('respects the live project quota', async () => {
    m.countProjects.mockResolvedValue(99);
    expect(await claimAnonymousProject('u1', 'c1', createClaimSecret('c1', 'p1')!)).toMatchObject({ ok: false, code: 'PROJECT_LIMIT_EXCEEDED' });
  });

  it('loses a race cleanly', async () => {
    m.tx.userCanvas.updateMany.mockResolvedValue({ count: 0 });
    expect(await claimAnonymousProject('u1', 'c1', createClaimSecret('c1', 'p1')!)).toMatchObject({ ok: false, status: 409 });
    expect(m.tx.user.delete).not.toHaveBeenCalled();
  });

  it('recognises placeholder users', () => {
    expect(isAnonymousUserId('anon_x')).toBe(true);
    expect(isAnonymousUserId('user_anon_x')).toBe(false);
    expect(isAnonymousUserId(null)).toBe(false);
  });
});
