import { describe, it, expect } from 'vitest';
import {
  isArchitectureMetaFile,
  MAX_README_FILES,
  MAX_META_FILES,
  MAX_META_CONTENT_BYTES,
  ARCHITECTURE_META_FILE_RE,
} from '../skip-rules';

describe('isArchitectureMetaFile (GH2R-024 meta-first read)', () => {
  it('recognizes READMEs at any depth', () => {
    expect(isArchitectureMetaFile('README.md')).toBe('well_known');
    expect(isArchitectureMetaFile('apps/web/README.md')).toBe('well_known');
    expect(isArchitectureMetaFile('docs/README.rst')).toBe('well_known');
  });

  it('recognizes manifests that imply architecture', () => {
    expect(isArchitectureMetaFile('package.json')).toBe('well_known');
    expect(isArchitectureMetaFile('apps/api/package.json')).toBe('well_known');
    expect(isArchitectureMetaFile('docker-compose.yml')).toBe('well_known');
    expect(isArchitectureMetaFile('k8s/docker-compose.yaml')).toBe('well_known');
    expect(isArchitectureMetaFile('Cargo.toml')).toBe('well_known');
    expect(isArchitectureMetaFile('pyproject.toml')).toBe('well_known');
    expect(isArchitectureMetaFile('schema.prisma')).toBe('well_known');
    expect(isArchitectureMetaFile('Makefile')).toBe('well_known');
  });

  it('recognizes infrastructure + CI as explicit architecture evidence', () => {
    expect(isArchitectureMetaFile('infra/main.tf')).toBe('terraform');
    expect(isArchitectureMetaFile('main.tfvars')).toBe('terraform');
    expect(isArchitectureMetaFile('.github/workflows/ci.yml')).toBe('ci_workflow');
    expect(isArchitectureMetaFile('.github/workflows/deploy.yaml')).toBe('ci_workflow');
    expect(isArchitectureMetaFile('.gitlab-ci.yml')).toBe('well_known');
    expect(isArchitectureMetaFile('docs/architecture.md')).toBe('docs');
  });

  it('ignores source code, lockfiles and generated artifacts', () => {
    expect(isArchitectureMetaFile('src/index.ts')).toBeNull();
    expect(isArchitectureMetaFile('app/api/route.ts')).toBeNull();
    expect(isArchitectureMetaFile('package-lock.json')).toBeNull();
    expect(isArchitectureMetaFile('node_modules/foo/package.json')).toBeNull();
    expect(isArchitectureMetaFile('yarn.lock')).toBeNull();
  });
});

describe('meta budgets', () => {
  it('keeps the meta read small relative to source budgets', () => {
    expect(MAX_README_FILES).toBe(40);
    expect(MAX_META_FILES).toBeGreaterThan(MAX_README_FILES);
    expect(MAX_META_CONTENT_BYTES).toBeLessThanOrEqual(256 * 1024);
  });

  it('never matches lockfiles', () => {
    expect(ARCHITECTURE_META_FILE_RE.test('package-lock.json')).toBe(false);
    expect(ARCHITECTURE_META_FILE_RE.test('npm-shrinkwrap.json')).toBe(false);
  });
});