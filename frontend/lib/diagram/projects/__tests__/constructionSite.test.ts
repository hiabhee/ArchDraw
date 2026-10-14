import { describe, expect, it } from 'vitest';
import { isSourcePath, siteAnchorFor, siteAreaFor, siteLabel } from '../constructionSite';

const node = (id: string, codePaths: string[]) => ({ id, data: { label: id, codePaths } });
const nodes = [node('data', ['src/data/**']), node('training', ['src/training/**']), node('entry', ['main.py'])];

describe('siteAreaFor', () => {
  it('is the outermost folder no component covers', () => {
    expect(siteAreaFor('src/export/formats/csv.py', nodes)).toBe('src/export');
    expect(siteAreaFor('api/routes/users.ts', nodes)).toBe('api');
  });

  it('is null for mapped code, root files, loose files in a mapped folder, tests and non-code', () => {
    expect(siteAreaFor('src/data/load.py', nodes)).toBeNull();
    expect(siteAreaFor('setup.py', nodes)).toBeNull();
    expect(siteAreaFor('src/helpers.py', nodes)).toBeNull();
    expect(siteAreaFor('src/export/__tests__/csv.test.ts', nodes)).toBeNull();
    expect(siteAreaFor('docs/guide.md', nodes)).toBeNull();
  });
});

describe('siteAnchorFor', () => {
  it('picks the component with the nearest code', () => {
    expect(siteAnchorFor('src/export', nodes)).toBe('data');
    expect(siteAnchorFor('src/training/v2', nodes)).toBe('training');
  });

  it('falls back when nothing shares a folder', () => {
    expect(siteAnchorFor('api', nodes, 'entry')).toBe('entry');
    expect(siteAnchorFor('api', nodes)).toBeNull();
  });
});

describe('helpers', () => {
  it('labels and classifies', () => {
    expect(siteLabel('src/export')).toBe('export');
    expect(isSourcePath('src/a.tsx')).toBe(true);
    expect(isSourcePath('README.md')).toBe(false);
  });
});
