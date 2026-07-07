import { describe, it, expect } from 'vitest';
import { parseGitHubUrl, isGitHubRepoUrl } from '../githubUrl';

describe('parseGitHubUrl', () => {
  it('parses standard GitHub URLs', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo');
    expect(result).toEqual({ owner: 'owner', repo: 'repo', canonical: 'https://github.com/owner/repo' });
  });

  it('accepts http scheme', () => {
    const result = parseGitHubUrl('http://github.com/owner/repo');
    expect(result?.canonical).toBe('https://github.com/owner/repo');
  });

  it('accepts www subdomain', () => {
    const result = parseGitHubUrl('https://www.github.com/owner/repo');
    expect(result?.canonical).toBe('https://github.com/owner/repo');
  });

  it('strips .git suffix', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo.git');
    expect(result?.repo).toBe('repo');
    expect(result?.canonical).toBe('https://github.com/owner/repo');
  });

  it('strips trailing slash', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo/');
    expect(result?.canonical).toBe('https://github.com/owner/repo');
  });

  it('rejects branch URLs', () => {
    expect(parseGitHubUrl('https://github.com/owner/repo/tree/main')).toBeNull();
  });

  it('rejects blob URLs', () => {
    expect(parseGitHubUrl('https://github.com/owner/repo/blob/main/readme.md')).toBeNull();
  });

  it('rejects issue URLs', () => {
    expect(parseGitHubUrl('https://github.com/owner/repo/issues/1')).toBeNull();
  });

  it('rejects PR URLs', () => {
    expect(parseGitHubUrl('https://github.com/owner/repo/pull/1')).toBeNull();
  });

  it('rejects non-GitHub URLs', () => {
    expect(parseGitHubUrl('https://gitlab.com/owner/repo')).toBeNull();
  });

  it('rejects empty strings', () => {
    expect(parseGitHubUrl('')).toBeNull();
  });

  it('handles repo names with dots and dashes', () => {
    const result = parseGitHubUrl('https://github.com/my-org/my-repo.v2');
    expect(result?.owner).toBe('my-org');
    expect(result?.repo).toBe('my-repo.v2');
  });
});

describe('isGitHubRepoUrl', () => {
  it('returns true for valid URLs', () => {
    expect(isGitHubRepoUrl('https://github.com/owner/repo')).toBe(true);
    expect(isGitHubRepoUrl('https://github.com/owner/repo.git')).toBe(true);
  });

  it('returns false for invalid URLs', () => {
    expect(isGitHubRepoUrl('not a url')).toBe(false);
    expect(isGitHubRepoUrl('https://gitlab.com/owner/repo')).toBe(false);
  });
});
