import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLAUDE_ARGS, checkMapping, detailPrompt, mapAndCheck, mappingPrompt, parseMapping, repairPrompt, runClaudeMapping } from './mapWithClaude.mjs';

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

test('the prompt is read-only and asks Claude to draw the map from the code alone', () => {
  const prompt = mappingPrompt();
  assert.match(prompt, /Do not modify anything/);
  assert.doesNotMatch(prompt, /folder scan/);
});

test('runs Claude in the repository with read-only tools and returns its answer', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fake-claude-'));
  const fake = join(dir, 'claude');
  writeFileSync(fake, `#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));\n`);
  chmodSync(fake, 0o755);
  const result = await runClaudeMapping(dir, 'map it', { command: fake });
  assert.equal(result.ok, true);
  const { args, cwd } = JSON.parse(result.text);
  assert.deepEqual(args, ['-p', 'map it', ...CLAUDE_ARGS]);
  assert.deepEqual(args.slice(2, 4), ['--tools', 'Read,Grep,Glob']);
  assert.equal(cwd.endsWith(dir.split('/').pop()), true);
});

test('reports a missing Claude install', async () => {
  const result = await runClaudeMapping(tmpdir(), 'x', { command: '/nonexistent/claude' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /not installed/);
});

test('the overview prompt asks for detail lines, labelled flows and separate data stores', () => {
  const prompt = mappingPrompt();
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

const FILES = ['src/api/routes.ts', 'src/api/upload.ts', 'src/worker/resize.ts', 'src/worker/queue.ts', 'src/web/App.tsx', 'README.md', 'package.json'];
const good = {
  mermaid: [
    'graph LR',
    '  subgraph serve["Serving"]',
    '    web("Web app<br/>React")',
    '    api("API<br/>Express")',
    '  end',
    '  subgraph work["Work"]',
    '    worker("Resizer<br/>sharp")',
    '    images[("Images<br/>S3")]',
    '  end',
    '  subgraph external["External"]',
    '    stripe("Stripe")',
    '  end',
    '  web -->|"uploads"| api',
    '  api --> worker',
    '  worker --> images',
    '  api --> stripe',
  ].join('\n'),
  componentPaths: { web: ['src/web/**'], api: ['src/api/**'], worker: ['src/worker/**'] },
  evidence: {
    'web -> api': 'src/web/App.tsx:12 POST /upload',
    'api -> worker': 'src/api/upload.ts:30 enqueues resize',
    'worker -> images': 'src/worker/resize.ts:8 putObject',
    'api -> stripe': 'src/api/routes.ts:40 stripe.checkout',
  },
};

test('parses {paths, evidence} answers and normalises evidence keys', () => {
  const text = '```mermaid\ngraph LR\n  a("A") --> b("B")\n```\n```json\n{"paths": {"a": ["src/a/**"], "b": ["src/b.ts"]}, "evidence": {"a --> b": "src/a/x.ts:3 calls b()"}}\n```';
  const mapping = parseMapping(text);
  assert.deepEqual(mapping.componentPaths, { a: ['src/a/**'], b: ['src/b.ts'] });
  assert.deepEqual(mapping.evidence, { 'a -> b': 'src/a/x.ts:3 calls b()' });
});

test('a map that matches the code has no problems', () => {
  assert.deepEqual(checkMapping(good, FILES), []);
});

test('finds edges to undeclared ids, stray paths, components without code and missing overview ids', () => {
  const problems = checkMapping({
    ...good,
    mermaid: `${good.mermaid}\n  api --> ghost\n  cache("Cache")`,
    componentPaths: { ...good.componentPaths, removed: ['src/api/**'] },
  }, FILES, { requiredIds: ['serve', 'billing'] });
  const text = problems.join('\n');
  assert.match(text, /"ghost", which is never declared/);
  assert.match(text, /"removed", which is not on the diagram/);
  assert.match(text, /Component "cache" has no paths/);
  assert.match(text, /Overview id "billing" is missing/);
  assert.doesNotMatch(text, /"serve" is missing/);
});

test('finds paths that match no file and source code no component owns', () => {
  const problems = checkMapping({ ...good, componentPaths: { web: ['src/web/**'], api: ['src/apis/**'], worker: ['src/worker/resize.ts'] } }, FILES);
  const text = problems.join('\n');
  assert.match(text, /Path "src\/apis\/\*\*" of "api" matches no file/);
  assert.match(text, /cover only 40% of the source files\. Not covered: src\/api\/ \(2 files\), src\/worker\/ \(1 files\)/);
});

test('every edge needs evidence that cites a real file', () => {
  const problems = checkMapping({ ...good, evidence: { ...good.evidence, 'api -> worker': 'src/api/jobs.ts:3 enqueue', 'api -> stripe': undefined } }, FILES);
  const text = problems.join('\n');
  assert.match(text, /api --> worker cites "src\/api\/jobs\.ts", which does not exist/);
  assert.match(text, /api --> stripe has no evidence/);
  // Prose like "Next.js" after the file is not a citation.
  assert.deepEqual(checkMapping({ ...good, evidence: { ...good.evidence, 'web -> api': 'src/web/App.tsx:12 fetch via Next.js' } }, FILES), []);
});

const answerFor = (mapping) => [
  '```mermaid', mapping.mermaid, '```',
  '```json', JSON.stringify({ paths: mapping.componentPaths, evidence: mapping.evidence }), '```',
].join('\n');

test('sends the problems back to Claude once and keeps the fixed answer', async () => {
  const prompts = [];
  const broken = { ...good, componentPaths: { ...good.componentPaths, api: ['src/apis/**'] } };
  const run = async (_root, prompt) => { prompts.push(prompt); return { ok: true, text: answerFor(prompts.length === 1 ? broken : good) }; };
  const repairs = [];
  const result = await mapAndCheck('/repo', 'PROMPT', FILES, { run, onRepair: (p) => repairs.push(p) });
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.mapping.componentPaths, good.componentPaths);
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /^PROMPT/);
  assert.match(prompts[1], /<previous_answer>/);
  assert.match(prompts[1], /- Path "src\/apis\/\*\*" of "api" matches no file/);
  assert.equal(repairs.length, 1);
});

test('keeps the first answer when the retry is worse or unusable, and skips the retry when nothing is wrong', async () => {
  const broken = { ...good, componentPaths: { ...good.componentPaths, api: ['src/apis/**'] } };
  let calls = 0;
  const worse = await mapAndCheck('/repo', 'P', FILES, { run: async () => ({ ok: true, text: ++calls === 1 ? answerFor(broken) : 'no blocks' }) });
  assert.equal(worse.ok, true);
  assert.deepEqual(worse.mapping.componentPaths.api, ['src/apis/**']);
  assert.equal(worse.problems.length > 0, true);

  calls = 0;
  const clean = await mapAndCheck('/repo', 'P', FILES, { run: async () => { calls++; return { ok: true, text: answerFor(good) }; } });
  assert.equal(calls, 1);
  assert.deepEqual(clean.problems, []);
});

test('prompts ask Claude to analyse the code and prove every edge', () => {
  for (const prompt of [mappingPrompt(), detailPrompt({ mermaid: 'graph LR', componentPaths: {} })]) {
    assert.match(prompt, /Step 1 — Find what runs/);
    assert.match(prompt, /Step 2 — Trace the code/);
    assert.match(prompt, /no edges from names or guesses/);
    assert.match(prompt, /"evidence" maps every edge/);
  }
  assert.match(repairPrompt('P', 'A', ['x is wrong']), /- x is wrong/);
});

test('reports a timeout even when Claude exits with its own code, and kills it if it ignores SIGTERM', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'slow-claude-'));
  const polite = join(dir, 'polite');
  writeFileSync(polite, `#!/usr/bin/env node\nprocess.on('SIGTERM', () => process.exit(143));\nsetInterval(() => {}, 1000);\n`);
  const stubborn = join(dir, 'stubborn');
  writeFileSync(stubborn, `#!/usr/bin/env node\nprocess.on('SIGTERM', () => {});\nsetInterval(() => {}, 1000);\n`);
  chmodSync(polite, 0o755);
  chmodSync(stubborn, 0o755);
  const first = await runClaudeMapping(dir, 'x', { command: polite, timeoutMs: 300 });
  assert.deepEqual(first, { ok: false, reason: 'Claude took too long; kept the quick map.' });
  const started = Date.now();
  const second = await runClaudeMapping(dir, 'x', { command: stubborn, timeoutMs: 300 });
  assert.equal(second.ok, false);
  assert.match(second.reason, /too long/);
  assert.ok(Date.now() - started < 8000);
});

test('falls back to the basic flags on a Claude Code without --tools / --effort', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'old-claude-'));
  const old = join(dir, 'claude');
  writeFileSync(old, `#!/usr/bin/env node\nconst a = process.argv.slice(2);\nif (a.includes('--tools')) { console.error("error: unknown option '--tools'"); process.exit(1); }\nprocess.stdout.write(JSON.stringify(a));\n`);
  chmodSync(old, 0o755);
  const result = await runClaudeMapping(dir, 'map it', { command: old });
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(result.text), ['-p', 'map it', '--allowedTools', 'Read,Grep,Glob', '--output-format', 'text']);
});
