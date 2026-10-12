import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/lib/server/prisma', () => ({
  default: { userCanvas: { findUnique: m.findUnique, updateMany: m.updateMany, upsert: m.upsert } },
}));

import { CanvasConflictError, upsertUserCanvas } from '@/lib/server/db';

const data = { id: 'c1', name: 'C', nodes: [], edges: [] };

describe('upsertUserCanvas conflict detection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies a conditional update when the client sends its base version', async () => {
    m.findUnique.mockResolvedValueOnce({ userId: 'u1' }).mockResolvedValueOnce({ id: 'c1', updatedAt: new Date(2000) });
    m.updateMany.mockResolvedValue({ count: 1 });
    await upsertUserCanvas('u1', { ...data, baseUpdatedAt: 1000 });
    expect(m.updateMany.mock.calls[0][0].where).toEqual({ id: 'c1', userId: 'u1', updatedAt: { lte: new Date(1000) } });
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it('throws CanvasConflictError when the server copy is newer', async () => {
    m.findUnique.mockResolvedValueOnce({ userId: 'u1' }).mockResolvedValueOnce({ id: 'c1', updatedAt: new Date(3000) });
    m.updateMany.mockResolvedValue({ count: 0 });
    await expect(upsertUserCanvas('u1', { ...data, baseUpdatedAt: 1000 })).rejects.toBeInstanceOf(CanvasConflictError);
  });

  it('falls back to a plain upsert for new canvases and forced writes', async () => {
    m.findUnique.mockResolvedValue(null);
    await upsertUserCanvas('u1', { ...data, baseUpdatedAt: 1000 });
    m.findUnique.mockResolvedValue({ userId: 'u1' });
    await upsertUserCanvas('u1', data);
    expect(m.upsert).toHaveBeenCalledTimes(2);
    expect(m.upsert.mock.calls[0][0].create).not.toHaveProperty('baseUpdatedAt');
  });

  it('keeps a repository name on a project canvas when a stale tab saves its generated name', async () => {
    m.findUnique.mockResolvedValue({ userId: 'u1', name: 'ArchDraw', agenticProjectId: 'p1' });
    await upsertUserCanvas('u1', { ...data, name: 'Giraffe' });
    expect(m.upsert.mock.calls[0][0].update.name).toBe('ArchDraw');

    // A name the user typed always wins, and plain canvases are untouched.
    await upsertUserCanvas('u1', { ...data, name: 'Payments' });
    expect(m.upsert.mock.calls[1][0].update.name).toBe('Payments');
    m.findUnique.mockResolvedValue({ userId: 'u1', name: 'ArchDraw', agenticProjectId: null });
    await upsertUserCanvas('u1', { ...data, name: 'Giraffe' });
    expect(m.upsert.mock.calls[2][0].update.name).toBe('Giraffe');
  });
});
