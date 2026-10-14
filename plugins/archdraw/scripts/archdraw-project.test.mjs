// Run: node --test plugins/archdraw/scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { areaOf, buildActivity, loadBinding, matchPromptToComponent, repoRoots, sessionLabel, toRepoPath } from './archdraw-project.mjs';

const SCRIPT = fileURLToPath(new URL('./archdraw-project.mjs', import.meta.url));

function makeRepo() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'ad-repo-')));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: dir });
  return dir;
}

function makeHome(projects) {
  const home = mkdtempSync(join(tmpdir(), 'ad-home-'));
  writeFileSync(join(home, 'projects.json'), JSON.stringify({ version: 1, projects }));
  return home;
}

const binding = (apiBase = 'http://127.0.0.1:1') => ({ apiBase, canvasId: 'c1', agenticProjectId: 'p', workspaceId: 'w', token: 'adp_t', linkedAt: '' });

test('toRepoPath keeps files inside the checkout only', () => {
  assert.equal(toRepoPath('/r/src/a.ts', '/r', '/r'), 'src/a.ts');
  assert.equal(toRepoPath('src/b.ts', '/r', '/r/pkg'), 'pkg/src/b.ts');
  assert.equal(toRepoPath('/elsewhere/x.ts', '/r', '/r'), null);
  assert.equal(toRepoPath(undefined, '/r', '/r'), null);
});

test('sessionLabel names repo, branch and a short session id', () => {
  assert.equal(sessionLabel('/code/app', 'feat/x', 'ab-cd-ef'), 'app (feat/x) #abcd');
  assert.equal(sessionLabel('/code/app', undefined, ''), 'app');
});

test('loadBinding is null for unlinked repos and resolves worktrees to the main repo', () => {
  const repo = makeRepo();
  assert.equal(loadBinding(repo, { ARCHDRAW_HOME: makeHome({}) }), null);

  const env = { ARCHDRAW_HOME: makeHome({ [repo]: binding() }) };
  assert.equal(loadBinding(repo, env)?.checkoutRoot, repo);

  const wt = join(realpathSync(mkdtempSync(join(tmpdir(), 'ad-wt-'))), 'wt');
  execFileSync('git', ['worktree', 'add', '-q', '-b', 'feat/wt', wt], { cwd: repo });
  assert.deepEqual(repoRoots(wt), [wt, repo]);
  const found = loadBinding(wt, env);
  assert.equal(found?.canvasId, 'c1');
  assert.equal(found?.checkoutRoot, wt);
});

test('buildActivity maps hook events', () => {
  const b = { ...binding(), checkoutRoot: '/r' };
  assert.deepEqual(
    buildActivity({ hook_event_name: 'PostToolUse', session_id: 's1', cwd: '/r', tool_input: { file_path: '/r/a/b.ts' } }, b),
    { sessionKey: 's1', event: 'edit', files: ['a/b.ts'] },
  );
  assert.equal(buildActivity({ hook_event_name: 'PostToolUse', session_id: 's1', cwd: '/r', tool_input: { file_path: '/tmp/x' } }, b), null);
  assert.deepEqual(buildActivity({ hook_event_name: 'Stop', session_id: 's1', cwd: '/r' }, b), { sessionKey: 's1', event: 'stop' });
  assert.equal(buildActivity({ hook_event_name: 'UserPromptSubmit', session_id: 's1' }, b), null);
});

function runHook(input, env) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [SCRIPT, 'hook'], { env: { ...process.env, ...env } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('close', (code) => resolvePromise({ code, out }));
    child.stdin.end(JSON.stringify(input));
  });
}

test('hook posts paths only and injects session context on start', async () => {
  const repo = makeRepo();
  const requests = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(req.url.endsWith('/diagram') ? { components: [{ id: 'a', codePaths: [] }] } : { ok: true }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const apiBase = `http://127.0.0.1:${server.address().port}`;
  const env = { ARCHDRAW_HOME: makeHome({ [repo]: binding(apiBase) }) };

  const start = await runHook({ hook_event_name: 'SessionStart', session_id: 'sess-1234', cwd: repo }, env);
  assert.equal(start.code, 0);
  const context = JSON.parse(start.out).hookSpecificOutput.additionalContext;
  assert.match(context, /session id: sess-1234/);
  assert.match(context, /no code-mapped components/);
  assert.doesNotMatch(context, /adp_t/);

  mkdirSync(join(repo, 'src'), { recursive: true });
  const edit = await runHook(
    { hook_event_name: 'PostToolUse', session_id: 'sess-1234', cwd: repo, tool_name: 'Edit', tool_input: { file_path: join(repo, 'src/a.ts'), old_string: 'SECRET', new_string: 'x' } },
    env,
  );
  assert.equal(edit.code, 0);
  assert.equal(edit.out, '');
  // Activity reports are delivered by a detached background process.
  await waitFor(() => requests.filter((r) => r.url === '/api/projects/c1/activity').length >= 2);
  server.close();

  const activity = requests.filter((r) => r.url === '/api/projects/c1/activity');
  activity.sort((x, y) => (x.body.event === 'start' ? -1 : y.body.event === 'start' ? 1 : 0));
  assert.equal(activity[0].body.event, 'start');
  assert.equal(activity[0].body.branch, 'main');
  assert.equal(activity[0].body.repoName, basename(repo));
  assert.deepEqual(activity[1].body, { sessionKey: 'sess-1234', event: 'edit', files: ['src/a.ts'] });
  assert.ok(requests.every((r) => r.auth === 'Bearer adp_t'));
  assert.ok(!JSON.stringify(requests).includes('SECRET'));
});

async function waitFor(check, timeoutMs = 5000) {
  const until = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > until) throw new Error('timed out waiting for background request');
    await new Promise((r) => setTimeout(r, 25));
  }
}

test('a slow server still records the session and never claims an empty map', async () => {
  const repo = makeRepo();
  const requests = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      requests.push({ url: req.url, body: body ? JSON.parse(body) : null });
      res.setHeader('content-type', 'application/json');
      // Slower than the hook's map budget, well within the background budget.
      setTimeout(() => res.end(JSON.stringify(req.url.endsWith('/diagram') ? { components: [] } : { ok: true })), 4_500);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const env = { ARCHDRAW_HOME: makeHome({ [repo]: binding(`http://127.0.0.1:${server.address().port}`) }) };

  const started = Date.now();
  const start = await runHook({ hook_event_name: 'SessionStart', session_id: 'slow-1', cwd: repo }, env);
  assert.ok(Date.now() - started < 6_000);
  const context = JSON.parse(start.out).hookSpecificOutput.additionalContext;
  assert.match(context, /component map not loaded yet/);
  assert.doesNotMatch(context, /no code-mapped components/);

  await waitFor(() => requests.some((r) => r.url === '/api/projects/c1/activity' && r.body?.event === 'start'), 8_000);
  server.closeAllConnections();
  server.close();
});

test('hook is a silent no-op when unlinked or the server is down', async () => {
  const repo = makeRepo();
  const unlinked = await runHook({ hook_event_name: 'SessionStart', session_id: 's', cwd: repo }, { ARCHDRAW_HOME: makeHome({}) });
  assert.deepEqual(unlinked, { code: 0, out: '' });
  const down = await runHook(
    { hook_event_name: 'PostToolUse', session_id: 's', cwd: repo, tool_input: { file_path: join(repo, 'a.ts') } },
    { ARCHDRAW_HOME: makeHome({ [repo]: binding('http://127.0.0.1:9') }) },
  );
  assert.equal(down.code, 0);
});

async function stubServer(handler) {
  const requests = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      const parsed = body ? JSON.parse(body) : null;
      requests.push({ method: req.method, url: req.url, body: parsed });
      res.setHeader('content-type', 'application/json');
      const [status, payload] = handler(req, parsed, requests.length);
      res.statusCode = status;
      res.end(JSON.stringify(payload));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, requests, apiBase: `http://127.0.0.1:${server.address().port}` };
}

function runCli(args, { cwd, env }) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], { cwd, env: { ...process.env, ...env } });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolvePromise({ code, out, err }));
  });
}

test('areaOf groups paths by their top two segments', () => {
  assert.equal(areaOf('mcp-server/src/cli/link.ts'), 'mcp-server/src');
  assert.equal(areaOf('README.md'), 'README.md');
});

test('a new unmapped file nudges the agent once per area; edits never do', async () => {
  const repo = makeRepo();
  const { server, apiBase } = await stubServer((req, body) => [200, { ok: true, unmapped: body?.files ?? [] }]);
  const env = { ARCHDRAW_HOME: makeHome({ [repo]: binding(apiBase) }) };
  const sessionId = `nudge-${Date.now()}`;
  const write = (file, tool = 'Write') =>
    runHook({ hook_event_name: 'PostToolUse', session_id: sessionId, cwd: repo, tool_name: tool, tool_input: { file_path: join(repo, file) } }, env);

  const first = await write('services/billing/index.ts');
  assert.match(JSON.parse(first.out).hookSpecificOutput.additionalContext, /services\/billing\/index\.ts is not part of any component/);
  assert.equal((await write('services/billing/util.ts')).out, '');
  assert.equal((await write('workers/email.ts', 'Edit')).out, '');
  assert.notEqual((await write('workers/email.ts')).out, '');
  server.close();
});

test('mermaid --out writes the diagram and paths; publish sends session and relayout', async () => {
  const repo = makeRepo();
  const { server, requests, apiBase } = await stubServer((req) =>
    req.method === 'GET'
      ? [200, { mermaid: 'graph LR\n  api["API"]', componentPaths: { api: ['server/**'] } }]
      : [200, { summary: 'Added Queue', mode: 'merge', componentCount: 2, mappedCount: 1, warnings: [] }],
  );
  const env = { ARCHDRAW_HOME: makeHome({ [repo]: binding(apiBase) }) };
  const out = join(realpathSync(mkdtempSync(join(tmpdir(), 'ad-out-'))), 'diagram');

  const exported = await runCli(['mermaid', '--out', out, '--direction', 'TD'], { cwd: repo, env });
  assert.equal(exported.code, 0, exported.err);
  assert.equal(requests[0].url, '/api/projects/c1/diagram?format=mermaid&direction=TD');
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'paths.json'), 'utf8')), { api: ['server/**'] });

  const published = await runCli(
    ['publish', '--session', 'sess-1', '--relayout', '--mermaid', join(out, 'diagram.mmd'), '--paths', join(out, 'paths.json')],
    { cwd: repo, env },
  );
  assert.equal(published.code, 0, published.err);
  assert.match(published.out, /Added Queue \(layout kept\)/);
  assert.deepEqual(requests[1].body, {
    mermaid: 'graph LR\n  api["API"]\n',
    componentPaths: { api: ['server/**'] },
    sessionKey: 'sess-1',
    relayout: true,
  });
  server.close();
});

test('publish retries once on a concurrent-edit conflict', async () => {
  const repo = makeRepo();
  const { server, requests, apiBase } = await stubServer((req, body, n) =>
    n === 1 ? [409, { error: 'changed', code: 'CANVAS_CONFLICT' }] : [200, { summary: 'No structural changes', mode: 'merge', componentCount: 1, mappedCount: 0 }],
  );
  const env = { ARCHDRAW_HOME: makeHome({ [repo]: binding(apiBase) }) };
  const file = join(repo, 'd.mmd');
  writeFileSync(file, 'graph LR\n  a["A"]');
  const result = await runCli(['publish', '--mermaid', file], { cwd: repo, env });
  assert.equal(result.code, 0, result.err);
  assert.equal(requests.length, 2);
  server.close();
});

test('reads, searches and permission prompts become read/wait events', () => {
  const b = { ...binding(), checkoutRoot: '/r' };
  assert.deepEqual(
    buildActivity({ hook_event_name: 'PostToolUse', tool_name: 'Read', session_id: 's1', cwd: '/r', tool_input: { file_path: '/r/src/auth.ts' } }, b),
    { sessionKey: 's1', event: 'read', files: ['src/auth.ts'] },
  );
  assert.deepEqual(
    buildActivity({ hook_event_name: 'PostToolUse', tool_name: 'Grep', session_id: 's1', cwd: '/r', tool_input: { pattern: 'SECRET', path: '/r/lib' } }, b),
    { sessionKey: 's1', event: 'read', files: ['lib'] },
  );
  assert.equal(buildActivity({ hook_event_name: 'PostToolUse', tool_name: 'Bash', session_id: 's1', cwd: '/r', tool_input: { command: 'ls' } }, b), null);
  assert.deepEqual(buildActivity({ hook_event_name: 'Notification', session_id: 's1', cwd: '/r' }, b), { sessionKey: 's1', event: 'wait' });
});

test('a task is matched to a component locally', () => {
  const components = [
    { id: 'group', label: 'Group Node' },
    { id: 'edges', label: 'Nodes / Handles / Edges' },
    { id: 'auth', label: 'Auth API' },
  ];
  assert.equal(matchPromptToComponent('Please fix the group node resizing', components), 'group');
  assert.equal(matchPromptToComponent('the auth api returns 500s', components), 'auth');
  assert.equal(matchPromptToComponent('refactor billing', components), null);
  // Every word of a name must appear: "node" alone does not pick "Nodes / Handles / Edges".
  assert.equal(matchPromptToComponent('one node is broken', components), null);
});

test('a prompt sends only the matched component id, never the text', async () => {
  const repo = makeRepo();
  const requests = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      requests.push({ url: req.url, body: body ? JSON.parse(body) : null });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(req.url.endsWith('/diagram') ? { components: [{ id: 'group', label: 'Group Node', codePaths: [] }] } : { ok: true }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const env = { ARCHDRAW_HOME: makeHome({ [repo]: binding(`http://127.0.0.1:${server.address().port}`) }) };
  const session = `prompt-${Date.now()}`;

  await runHook({ hook_event_name: 'SessionStart', session_id: session, cwd: repo }, env);
  await runHook({ hook_event_name: 'UserPromptSubmit', session_id: session, cwd: repo, prompt: 'fix the group node, token=SECRET123' }, env);
  await waitFor(() => requests.some((r) => r.body?.event === 'aim'));
  server.closeAllConnections();
  server.close();

  const aim = requests.find((r) => r.body?.event === 'aim');
  assert.deepEqual(aim.body, { sessionKey: session, event: 'aim', componentIds: ['group'] });
  assert.ok(!JSON.stringify(requests).includes('SECRET123'));
});

test('a session gets its map name in the terminal: message, session title and window title that follows its state', async () => {
  const repo = makeRepo();
  const { server, requests, apiBase } = await stubServer((req) => [200, req.url.endsWith('/diagram') ? { components: [] } : { ok: true, name: 'Otter' }]);
  const env = { ARCHDRAW_HOME: makeHome({ [repo]: binding(apiBase) }) };
  const session = `title-${Date.now()}`;

  const start = JSON.parse((await runHook({ hook_event_name: 'SessionStart', source: 'startup', session_id: session, cwd: repo }, env)).out);
  assert.match(start.systemMessage, /this session is "Otter"/);
  assert.equal(start.hookSpecificOutput.sessionTitle, 'Otter');
  assert.match(start.hookSpecificOutput.additionalContext, /this session is "Otter"/);
  assert.equal(start.terminalSequence, `\x1b]0;Otter · ${basename(repo)}\x07`);

  const ask = JSON.parse((await runHook({ hook_event_name: 'Notification', notification_type: 'permission_prompt', session_id: session, cwd: repo }, env)).out);
  assert.equal(ask.terminalSequence, '\x1b]0;● Otter needs you\x07');
  const idle = await runHook({ hook_event_name: 'Notification', notification_type: 'idle_prompt', session_id: session, cwd: repo }, env);
  assert.equal(idle.out, '');
  const resumed = JSON.parse((await runHook({ hook_event_name: 'PostToolUse', tool_name: 'Read', session_id: session, cwd: repo, tool_input: { file_path: join(repo, 'x.ts') } }, env)).out);
  assert.equal(resumed.terminalSequence, `\x1b]0;Otter · ${basename(repo)}\x07`);
  const done = JSON.parse((await runHook({ hook_event_name: 'Stop', session_id: session, cwd: repo }, env)).out);
  assert.equal(done.terminalSequence, '\x1b]0;✓ Otter · your turn\x07');

  await waitFor(() => requests.filter((r) => r.body?.event === 'stop').length >= 1);
  server.close();
  assert.equal(requests.filter((r) => r.body?.event === 'wait').length, 1, 'idle prompts are not permission requests');
});
