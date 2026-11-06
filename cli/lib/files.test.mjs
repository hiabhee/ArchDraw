import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFiles } from './files.mjs';

test('lists repository files and skips dependency and build folders', () => {
  const root = mkdtempSync(join(tmpdir(), 'archdraw-files-'));
  for (const path of ['src/a.ts', 'src/b/c.ts', 'node_modules/x/index.js', 'dist/out.js', 'README.md']) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), '');
  }
  assert.deepEqual(listFiles(root).sort(), ['README.md', 'src/a.ts', 'src/b/c.ts']);
});

test('the bundled hook script matches the plugin copy', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  assert.equal(
    readFileSync(join(here, '..', 'hooks', 'archdraw-project.mjs'), 'utf8'),
    readFileSync(join(here, '..', '..', 'plugins', 'archdraw', 'scripts', 'archdraw-project.mjs'), 'utf8'),
    'run: cp plugins/archdraw/scripts/archdraw-project.mjs cli/hooks/',
  );
});
