import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/prisma', () => ({ default: {} }));

import { normalizeRepositoryRemote } from '../agenticProjects';

describe('normalizeRepositoryRemote', () => {
  it('treats empty input as no remote', () => {
    expect(normalizeRepositoryRemote('')).toBeNull();
    expect(normalizeRepositoryRemote('   ')).toBeNull();
    expect(normalizeRepositoryRemote(null)).toBeNull();
  });

  it('keeps full URLs, stripping credentials', () => {
    expect(normalizeRepositoryRemote('https://user:pw@github.com/me/repo.git/')).toBe('https://github.com/me/repo.git');
    expect(normalizeRepositoryRemote('git@github.com:me/repo.git')).toBe('ssh://github.com/me/repo.git');
  });

  it('accepts hand-typed host/owner/repo and owner/repo forms', () => {
    expect(normalizeRepositoryRemote('github.com/hiabhee/ArchDraw')).toBe('https://github.com/hiabhee/ArchDraw');
    expect(normalizeRepositoryRemote('GitLab.com/group/sub/repo/')).toBe('https://gitlab.com/group/sub/repo');
    expect(normalizeRepositoryRemote('hiabhee/ArchDraw')).toBe('https://github.com/hiabhee/ArchDraw');
  });

  it('rejects things that are not remotes', () => {
    expect(normalizeRepositoryRemote('QQZQ 7RLX 8HX3')).toBeUndefined();
    expect(normalizeRepositoryRemote('ArchDraw')).toBeUndefined();
    expect(normalizeRepositoryRemote('ftp://example.com/repo')).toBeUndefined();
  });
});
