import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detailPrompt, mappingPrompt, parseMapping, runClaudeMapping } from './mapWithClaude.mjs';

const answer = [
  'Here is the map.',
  '```mermaid',
  'flowchart LR',
  '  subgraph api["API"]',
  '    routes["HTTP routes"]',
  '  end',
  '  db[("Postgres")]',
  '  routes --> db',
  '```',
  '```json',
  '{ "routes": ["src/routes/**"], "db": [], "evil": ["/etc/passwd", "../x"] }',
  '```',
].join('\n');

test('parses the diagram and paths, dropping empty and unsafe paths', () => {
  const mapping = parseMapping(answer);
  assert.match(mapping.mermaid, /^graph LR/);
  assert.deepEqual(mapping.componentPaths, { routes: ['src/routes/**'] });
});

test('rejects answers without both blocks or with broken JSON', () => {
  assert.equal(parseMapping('no blocks here'), null);
  assert.equal(parseMapping('```mermaid\ngraph LR\n a-->b\n```'), null);
  assert.equal(parseMapping('```mermaid\ngraph LR\n a-->b\n```\n```json\n{ nope\n```'), null);
});

test('the prompt is read-only and carries the folder scan as a starting point', () => {
  const prompt = mappingPrompt({ mermaid: 'graph LR\n  c_api["API"]\n' });
  assert.match(prompt, /Do not modify anything/);
  assert.match(prompt, /c_api\["API"\]/);
});

test('runs Claude in the repository with read-only tools and returns its answer', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fake-claude-'));
  const fake = join(dir, 'claude');
  writeFileSync(fake, `#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));\n`);
  chmodSync(fake, 0o755);
  const result = await runClaudeMapping(dir, 'map it', { command: fake });
  assert.equal(result.ok, true);
  const { args, cwd } = JSON.parse(result.text);
  assert.deepEqual(args, ['-p', 'map it', '--allowedTools', 'Read,Grep,Glob', '--output-format', 'text']);
  assert.equal(cwd.endsWith(dir.split('/').pop()), true);
});

test('reports a missing Claude install', async () => {
  const result = await runClaudeMapping(tmpdir(), 'x', { command: '/nonexistent/claude' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /not installed/);
});

test('the overview prompt asks for detail lines, labelled flows and separate data stores', () => {
  const prompt = mappingPrompt({ mermaid: 'graph LR\n  a --> b' });
  assert.match(prompt, /<br\/>/);
  assert.match(prompt, /-->\|"/);
  assert.match(prompt, /data store/i);
  assert.match(prompt, /8–16 components/);
});

test('the detailed prompt keeps the overview ids and carries its code paths', () => {
  const prompt = detailPrompt({ mermaid: 'graph LR\n  subgraph ingest["Ingest"]\n    scene_prep("Scene prep")\n  end', componentPaths: { scene_prep: ['src/prep/**'] } });
  assert.match(prompt, /SAME id and label/);
  assert.match(prompt, /<component_id>__<part>/);
  assert.match(prompt, /scene_prep\("Scene prep"\)/);
  assert.match(prompt, /"src\/prep\/\*\*"/);
  assert.match(prompt, /Use only Read, Grep and Glob/);
});

test('parses a nested detailed map with labelled edges', () => {
  const text = [
    '```mermaid',
    'graph LR',
    '  subgraph ingest["Ingest"]',
    '    subgraph scene_prep["Scene prep"]',
    '      scene_prep__search("STAC search<br/>search.py")',
    '    end',
    '  end',
    '  scene_prep__search -->|"scenes"| raw',
    '```',
    '```json',
    '{"scene_prep__search": ["src/prep/search.py"], "scene_prep": ["src/prep/**"]}',
    '```',
  ].join('\n');
  const mapping = parseMapping(text);
  assert.ok(mapping);
  assert.match(mapping.mermaid, /scene_prep__search -->\|"scenes"\| raw/);
  assert.deepEqual(mapping.componentPaths, { scene_prep__search: ['src/prep/search.py'], scene_prep: ['src/prep/**'] });
});
