import { describe, it, expect } from 'vitest';
import { buildDocsContext, validateAgainstDocs } from '../repo-docs-validator';
import type { FileEntry } from '@/lib/types/repo-diagram';

function meta(path: string, content: string): FileEntry {
  return { path, content };
}

describe('buildDocsContext', () => {
  it('puts READMEs first, then prioritized architecture docs', () => {
    const ctx = buildDocsContext([
      meta('docs/architecture.md', 'ARCH'),
      meta('README.md', 'ROOT README'),
      meta('shortcuts.md', 'not tracked (1 char)'),
      meta('README.deep/SECURITY.md', 'sec'),
    ]);
    expect(ctx).toContain('README.md');
    expect(ctx).toContain('architecture.md');
    expect(ctx.indexOf('README.md')).toBeLessThan(ctx.indexOf('architecture.md'));
    expect(ctx.indexOf('architecture.md')).toBeLessThan(ctx.indexOf('shortcuts.md'));
  });

  it('respects the README budget and stops adding readmes', () => {
    const files = Array.from({ length: 30 }, (_, i) => meta(`pkg${i}/README.md`, `readme #${i} `.repeat(1000)));
    const ctx = buildDocsContext(files);
    // 16k budget / ~8.3k per README (7000+ chars content) => at most a few READMEs
    expect(ctx.length).toBeLessThan(24_000);
  });

  it('returns empty string when no docs present', () => {
    expect(buildDocsContext([])).toBe('');
    expect(buildDocsContext([meta('docker-compose.yml', 'services: {}')])).toBe('');
  });
});

describe('validateAgainstDocs', () => {
  const base = {
    nodes: [],
    edges: [],
    workflows: [],
    fileTree: ['README.md'],
  };

  it('skips (approves) when there are no meta files', async () => {
    const res = await validateAgainstDocs({ ...base, metaFiles: [] });
    expect(res.approved).toBe(true);
    expect(res.corrections.addNodes).toEqual([]);
  });

  it('skips (approves) when meta files have no README/docs', async () => {
    const res = await validateAgainstDocs({
      ...base,
      metaFiles: [meta('package.json', '{"name":"x"}'), meta('docker-compose.yml', 'services: {}')],
    });
    expect(res.approved).toBe(true);
    expect(res.corrections.removeNodeIds).toEqual([]);
  });
});