import { describe, it, expect } from 'vitest';
import { detectSubsystems, summarizeSubsystem } from '../subsystem-detector';
import type { RepoSnapshot } from '@/lib/types/repo-diagram';

function makeSnapshot(overrides: Partial<RepoSnapshot> = {}): RepoSnapshot {
  return {
    repoUrl: 'https://github.com/o/r',
    owner: 'o',
    repo: 'r',
    fileTree: [],
    selectedFiles: [],
    repoMeta: { hasAppDir: false, hasPagesDir: false, hasPrisma: false, hasMiddleware: false, hasEnvExample: false, packageJson: null },
    surfaceClassification: { primaryLanguage: 'unknown', detectedFrameworks: [], hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown' },
    phase1Files: [],
    phase2Files: [],
    ...overrides,
  };
}

describe('detectSubsystems', () => {
  it('returns a root subsystem for a flat tree', () => {
    const snapshot = makeSnapshot({
      fileTree: ['index.js', 'package.json', 'README.md'],
      surfaceClassification: { primaryLanguage: 'JavaScript', detectedFrameworks: [], hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown' },
    });
    const subs = detectSubsystems(snapshot);
    expect(subs).toHaveLength(1);
    expect(subs[0].name).toBe('root');
    expect(subs[0].type).toBe('application');
    expect(subs[0].language).toBe('JavaScript');
  });

  it('detects Next.js from config files', () => {
    const snapshot = makeSnapshot({
      fileTree: ['next.config.js', 'pages/index.tsx', 'package.json'],
      surfaceClassification: { primaryLanguage: 'TypeScript', detectedFrameworks: [], hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown' },
    });
    const subs = detectSubsystems(snapshot);
    expect(subs[0].detectedFramework).toBe('Next.js');
  });

  it('detects monorepo with apps/web and apps/api subsystems', () => {
    const snapshot = makeSnapshot({
      fileTree: [
        'apps/web/package.json', 'apps/web/app/page.tsx', 'apps/web/app/layout.tsx',
        'apps/api/package.json', 'apps/api/src/server.ts', 'apps/api/src/routes.ts',
        'packages/shared/src/index.ts',
        'package.json', 'pnpm-workspace.yaml',
      ],
      surfaceClassification: { primaryLanguage: 'TypeScript', detectedFrameworks: [], hasDocker: false, hasMultipleServices: false, isMonorepo: true, projectType: 'unknown' },
    });
    const subs = detectSubsystems(snapshot);
    expect(subs.length).toBeGreaterThanOrEqual(3);
    const web = subs.find((s) => s.path === 'apps/web');
    expect(web).toBeDefined();
    expect(web!.type).toBe('frontend');
    const api = subs.find((s) => s.path === 'apps/api');
    expect(api).toBeDefined();
    expect(api!.type).toBe('backend');
    const shared = subs.find((s) => s.path === 'packages/shared');
    expect(shared).toBeDefined();
    expect(shared!.type).toBe('library');
  });

  it('ignores node_modules and build dirs', () => {
    const snapshot = makeSnapshot({
      fileTree: [
        'src/index.ts', 'node_modules/react/index.js', 'dist/bundle.js', '.git/HEAD',
      ],
      surfaceClassification: { primaryLanguage: 'TypeScript', detectedFrameworks: [], hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown' },
    });
    const subs = detectSubsystems(snapshot);
    expect(subs).toHaveLength(1);
    expect(subs[0].files.every((f) => !f.startsWith('node_modules'))).toBe(true);
  });

  it('classifies infrastructure subsystems', () => {
    const snapshot = makeSnapshot({
      fileTree: ['terraform/main.tf', 'terraform/variables.tf', 'k8s/deployment.yaml'],
      surfaceClassification: { primaryLanguage: 'HCL', detectedFrameworks: [], hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown' },
    });
    const subs = detectSubsystems(snapshot);
    expect(subs).toHaveLength(1);
    expect(subs[0].type).toBe('infrastructure');
  });

  it('detects Python/Django from manage.py', () => {
    const snapshot = makeSnapshot({
      fileTree: ['manage.py', 'myapp/models.py', 'myapp/views.py', 'requirements.txt'],
      surfaceClassification: { primaryLanguage: 'Python', detectedFrameworks: [], hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown' },
    });
    const subs = detectSubsystems(snapshot);
    expect(subs[0].detectedFramework).toBe('Django');
    expect(subs[0].language).toBe('Python');
  });

  it('finds entry points', () => {
    const snapshot = makeSnapshot({
      fileTree: ['server.ts', 'src/index.ts', 'README.md'],
      surfaceClassification: { primaryLanguage: 'TypeScript', detectedFrameworks: [], hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown' },
    });
    const subs = detectSubsystems(snapshot);
    expect(subs[0].entryPoints).toContain('server.ts');
    expect(subs[0].entryPoints).toContain('src/index.ts');
  });
});

describe('summarizeSubsystem', () => {
  it('produces a compact summary', () => {
    const summary = summarizeSubsystem({
      name: 'apps/api',
      path: 'apps/api',
      type: 'backend',
      fileCount: 12,
      files: ['apps/api/src/server.ts', 'apps/api/src/routes.ts'],
      language: 'TypeScript',
      detectedFramework: 'Express',
      entryPoints: ['src/server.ts'],
    });
    expect(summary).toContain('apps/api (backend)');
    expect(summary).toContain('Language: TypeScript');
    expect(summary).toContain('Files: 12');
    expect(summary).toContain('Framework: Express');
    expect(summary).toContain('Entry: src/server.ts');
  });

  it('includes grouped signals when provided', () => {
    const summary = summarizeSubsystem(
      { name: 'root', path: '/', type: 'application', fileCount: 5, files: [], language: 'Python', detectedFramework: null, entryPoints: [] },
      [
        { type: 'dependency', label: 'fastapi' },
        { type: 'dependency', label: 'sqlalchemy' },
        { type: 'route', label: '/api/users' },
      ]
    );
    expect(summary).toContain('dependency: fastapi, sqlalchemy');
    expect(summary).toContain('route: /api/users');
  });
});
