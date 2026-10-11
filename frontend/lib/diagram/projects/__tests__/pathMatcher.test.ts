import { describe, it, expect } from 'vitest';
import { compilePattern, createComponentMatcher, normalizeRepoPath } from '../pathMatcher';

describe('normalizeRepoPath', () => {
  it('strips leading ./ and / and converts backslashes', () => {
    expect(normalizeRepoPath('./frontend/app.ts')).toBe('frontend/app.ts');
    expect(normalizeRepoPath('/frontend//lib\\a.ts')).toBe('frontend/lib/a.ts');
  });
});

describe('compilePattern', () => {
  it('treats a plain path as file-or-directory prefix', () => {
    const p = compilePattern('frontend/lib/server')!;
    expect(p.test('frontend/lib/server')).toBe(true);
    expect(p.test('frontend/lib/server/auth.ts')).toBe(true);
    expect(p.test('frontend/lib/serverless.ts')).toBe(false);
  });

  it('supports *, ** and ?', () => {
    expect(compilePattern('app/api/**')!.test('app/api/auth/route.ts')).toBe(true);
    expect(compilePattern('app/*/route.ts')!.test('app/user/route.ts')).toBe(true);
    expect(compilePattern('app/*/route.ts')!.test('app/user/x/route.ts')).toBe(false);
    expect(compilePattern('**/*.prisma')!.test('frontend/prisma/schema.prisma')).toBe(true);
    expect(compilePattern('**/*.prisma')!.test('schema.prisma')).toBe(true);
    expect(compilePattern('v?.ts')!.test('v1.ts')).toBe(true);
  });

  it('ignores empty patterns', () => {
    expect(compilePattern('  ')).toBeNull();
  });
});

describe('createComponentMatcher', () => {
  const nodes = [
    { id: 'frontend', type: 'groupNode', data: { codePaths: ['frontend'] } },
    { id: 'auth', type: 'systemNode', data: { codePaths: ['frontend/lib/server/auth.ts', 'frontend/app/api/auth/**'] } },
    { id: 'server', type: 'systemNode', data: { codePaths: ['frontend/lib/server'] } },
    { id: 'none', type: 'systemNode', data: { label: 'no paths' } },
    { id: 'bad', type: 'systemNode', data: { codePaths: 'not-an-array' } },
  ];
  const matcher = createComponentMatcher(nodes);

  it('picks the most specific match', () => {
    expect(matcher.match('frontend/lib/server/auth.ts')).toBe('auth');
    expect(matcher.match('frontend/lib/server/db.ts')).toBe('server');
    expect(matcher.match('frontend/app/api/auth/[...all]/route.ts')).toBe('auth');
  });

  it('falls back to a group when no leaf matches', () => {
    expect(matcher.match('frontend/components/Canvas.tsx')).toBe('frontend');
  });

  it('prefers a leaf over a group on equal specificity', () => {
    const m = createComponentMatcher([
      { id: 'g', type: 'groupNode', data: { codePaths: ['mcp-server'] } },
      { id: 'leaf', type: 'shapeNode', data: { codePaths: ['mcp-server'] } },
    ]);
    expect(m.match('mcp-server/src/index.ts')).toBe('leaf');
  });

  it('returns null for unmapped paths', () => {
    expect(matcher.match('docs/README.md')).toBeNull();
    expect(matcher.match('')).toBeNull();
  });
});
