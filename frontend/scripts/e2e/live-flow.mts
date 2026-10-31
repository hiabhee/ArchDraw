/**
 * End-to-end check of the live-project flow, with no browser and no Claude
 * account: the real `archdraw-live` CLI and the real hook script run in an
 * isolated temp home against a running ArchDraw server, and the result is read
 * back from the database.
 *
 *   npx tsx scripts/e2e/live-flow.mts [--api http://localhost:3100] [--keep]
 *
 * Checks, in order: setup creates a project and installs the hooks; a session
 * start is registered; an edit lands on the right component; a Stop report
 * carries token counts read from a transcript (and is not double counted);
 * two sessions on one component are flagged as contested; the public watch
 * link shows both sessions but no spend; stopping disconnects the checkout.
 *
 * The server must be running and share this machine's DATABASE_URL
 * (.env.local). Everything the run creates (the anonymous user, its canvas and
 * sessions) is deleted at the end, unless --keep.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, '..', '..');
const repoRoot = resolve(frontendRoot, '..');
config({ path: join(frontendRoot, '.env.local'), override: true, quiet: true });

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const apiArg = args.indexOf('--api');
const API = (apiArg >= 0 ? args[apiArg + 1] : process.env.ARCHDRAW_E2E_API) || 'http://localhost:3100';

const { default: prisma } = await import('../../lib/server/prisma');
const { queryLiveSessions, toLiveSession } = await import('../../lib/server/projects/liveSessions');
const { buildNodeActivity } = await import('../../lib/diagram/projects/liveActivity');
const { isAnonymousUserId } = await import('../../lib/server/projects/anonymousUser');

let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? `\n    ${detail}` : ''}`);
  if (!ok) failures += 1;
};
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Poll `read` until `done` accepts it (hooks deliver reports from a detached process). */
async function until<T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (!done(value) && Date.now() < deadline) {
    await sleep(400);
    value = await read();
  }
  return value;
}

// Real path: on macOS the temp folder is a symlink, and links are keyed by the checkout's real path.
const sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'archdraw-e2e-')));
const home = join(sandbox, 'home');
const claudeDir = join(sandbox, 'claude');
const repo = join(sandbox, 'shop');
mkdirSync(home, { recursive: true });
mkdirSync(claudeDir, { recursive: true });
const env = {
  ...process.env,
  HOME: sandbox,
  ARCHDRAW_HOME: home,
  CLAUDE_CONFIG_DIR: claudeDir,
  NO_COLOR: '1',
  // Never let the sandbox's hooks talk to a real project.
  ARCHDRAW_API: API,
};

function run(command: string, argv: string[], opts: { cwd?: string; input?: string } = {}) {
  return spawnSync(command, argv, { cwd: opts.cwd ?? repo, env, input: opts.input, encoding: 'utf8', timeout: 120_000 });
}

function makeRepo() {
  mkdirSync(repo, { recursive: true });
  const files: Record<string, string> = {
    'api/server.ts': "import { db } from '../db/client';\nexport const server = db;\n",
    'api/routes.ts': "import { server } from './server';\nexport const routes = [server];\n",
    'web/app.ts': "import { routes } from '../api/routes';\nexport const app = routes;\n",
    'web/page.ts': "import { app } from './app';\nexport const page = app;\n",
    'db/client.ts': 'export const db = {};\n',
    'db/schema.ts': 'export const schema = {};\n',
    'README.md': '# shop\n',
  };
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), body);
  }
  run('git', ['init', '-q', '-b', 'main']);
  run('git', ['add', '.']);
  run('git', ['-c', 'user.email=e2e@test', '-c', 'user.name=e2e', 'commit', '-q', '-m', 'init']);
}

const hookCommand = () => join(home, 'hooks', 'archdraw-project.mjs');
function hook(event: Record<string, unknown>) {
  return run(process.execPath, [hookCommand(), 'hook'], { input: JSON.stringify({ cwd: repo, ...event }) });
}

const assistantLine = (id: string, output: number) =>
  `${JSON.stringify({
    type: 'assistant',
    message: {
      id,
      model: 'claude-opus-5-5',
      content: [{ type: 'text', text: 'private reply that must never be sent' }],
      usage: { input_tokens: 10, output_tokens: output, cache_creation_input_tokens: 500, cache_read_input_tokens: 4000, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 500 } },
    },
  })}\n`;

let canvasOwner: string | null = null;
let watchLink: string | null = null;

async function main() {
  console.log(`ArchDraw e2e against ${API}\n`);
  const ping = await fetch(`${API}/api/projects/00000000-0000-0000-0000-000000000000/activity`, { method: 'POST' }).catch(() => null);
  check(ping !== null && ping.status === 401, 'server answers the activity route (401 without a token)', `got ${ping?.status ?? 'no response'}; is the ArchDraw dev server running on ${API}?`);
  if (!ping || ping.status !== 401) return;

  makeRepo();

  // 1. Setup
  const setup = run(process.execPath, [join(repoRoot, 'cli', 'bin', 'archdraw-live.mjs'), '--api', API, '--no-open', '--no-map']);
  check(setup.status === 0, 'archdraw-live setup exits cleanly', (setup.stderr || setup.stdout).slice(-400));
  check(/open another terminal/i.test(setup.stdout) && /restart/i.test(setup.stdout), 'next steps mention a second terminal and restarting open sessions');
  const settingsPath = join(claudeDir, 'settings.json');
  const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {};
  check(Boolean(settings.hooks?.Stop && settings.hooks?.PostToolUse && settings.hooks?.SessionStart), 'Claude Code hooks installed (SessionStart, PostToolUse, Stop)');
  check(existsSync(hookCommand()), 'hook script copied outside the repo');

  const projects = JSON.parse(readFileSync(join(home, 'projects.json'), 'utf8')).projects ?? {};
  const binding = Object.values(projects)[0] as { canvasId: string; token: string; watchUrl: string; apiBase: string } | undefined;
  check(Boolean(binding?.canvasId && binding?.token), 'project link saved with a token');
  if (!binding) return;
  watchLink = binding.watchUrl;
  check(binding.apiBase === API, 'link points at the server under test', `${binding.apiBase} != ${API}`);

  const canvas = await prisma.userCanvas.findUnique({ where: { id: binding.canvasId }, select: { userId: true, nodes: true } });
  canvasOwner = canvas?.userId ?? null;
  check(Boolean(canvas && isAnonymousUserId(canvas.userId)), 'project belongs to a placeholder user (no account needed)');

  const mapRes = await fetch(`${API}/api/projects/${binding.canvasId}/diagram`, { headers: { Authorization: `Bearer ${binding.token}` } });
  const map = (await mapRes.json()) as { components?: Array<{ id: string; codePaths?: string[] }> };
  const apiComponent = map.components?.find((c) => c.codePaths?.some((p) => p.startsWith('api')));
  check((map.components?.length ?? 0) >= 2, 'the folder scan produced components', `got ${map.components?.length ?? 0}`);
  check(Boolean(apiComponent), 'a component owns the api/ folder');
  if (!apiComponent) return;

  // 2. Session A: start, edit, stop with a transcript
  const sessionA = 'e2e-session-a';
  const start = hook({ hook_event_name: 'SessionStart', session_id: sessionA, source: 'startup' });
  const startOut = start.stdout ? JSON.parse(start.stdout) : {};
  check(start.status === 0 && /ArchDraw/.test(startOut.hookSpecificOutput?.additionalContext ?? ''), 'SessionStart hook injects the project note');
  check(Boolean(startOut.systemMessage), 'SessionStart names the session on the map', JSON.stringify(startOut).slice(0, 200));

  hook({ hook_event_name: 'PostToolUse', tool_name: 'Edit', session_id: sessionA, tool_input: { file_path: join(repo, 'api', 'server.ts') } });
  const afterEdit = await until(
    () => prisma.agentSession.findUnique({ where: { canvasId_sessionKey: { canvasId: binding.canvasId, sessionKey: sessionA } } }),
    (row) => Boolean(row?.currentComponentId),
  );
  check(afterEdit?.currentComponentId === apiComponent.id, 'an edit lands on the component that owns the file', `got ${afterEdit?.currentComponentId}`);

  const transcript = join(sandbox, 'session-a.jsonl');
  writeFileSync(transcript, assistantLine('m1', 200) + assistantLine('m1', 200) + assistantLine('m2', 300));
  hook({ hook_event_name: 'Stop', session_id: sessionA, transcript_path: transcript });
  const withUsage = await until(
    () => prisma.agentSession.findUnique({ where: { canvasId_sessionKey: { canvasId: binding.canvasId, sessionKey: sessionA } } }),
    (row) => Boolean(row?.model),
  );
  const usage = withUsage?.usage as Record<string, number> | undefined;
  // Two messages (the streamed duplicate counts once): 2 x (10 in, 500 write, 4000 read), 200 + 300 out.
  check(withUsage?.model === 'claude-opus-5-5', 'the model name is stored');
  check(usage?.input === 20 && usage?.output === 500 && usage?.cacheWrite1h === 1000 && usage?.cacheRead === 8000, 'token counts match the transcript, streamed duplicate counted once', JSON.stringify(usage));
  const byComponent = withUsage?.usageByComponent as Record<string, Record<string, number>> | undefined;
  check(byComponent?.[apiComponent.id]?.output === 500, 'tokens are booked on the component the session was at', JSON.stringify(byComponent));
  check(!JSON.stringify(withUsage).includes('private reply'), 'no transcript content reached the database');

  hook({ hook_event_name: 'Stop', session_id: sessionA, transcript_path: transcript });
  await sleep(2500);
  const again = await prisma.agentSession.findUnique({ where: { canvasId_sessionKey: { canvasId: binding.canvasId, sessionKey: sessionA } } });
  check((again?.usage as Record<string, number>)?.output === 500, 'a repeated Stop does not double count');

  // 3. Session B on the same component
  const sessionB = 'e2e-session-b';
  hook({ hook_event_name: 'SessionStart', session_id: sessionB, source: 'startup' });
  hook({ hook_event_name: 'PostToolUse', tool_name: 'Edit', session_id: sessionB, tool_input: { file_path: join(repo, 'api', 'routes.ts') } });
  hook({ hook_event_name: 'PostToolUse', tool_name: 'Edit', session_id: sessionA, tool_input: { file_path: join(repo, 'api', 'server.ts') } });
  const now = Date.now();
  const rows = await until(
    () => queryLiveSessions(binding.canvasId, now),
    // Session A's edit is delivered by a detached process after its earlier Stop, so wait until it is active again.
    (list) => list.filter((r) => r.status === 'active' && (r.touched as Record<string, unknown>)?.[apiComponent.id]).length >= 2,
  );
  const sessions = rows.map((row) => toLiveSession(row, Date.now()));
  check(sessions.length === 2, 'both sessions are in the live snapshot', `got ${sessions.length}`);
  const activity = buildNodeActivity(sessions, Date.now());
  check(activity[apiComponent.id]?.contested === true, 'two sessions editing one component are flagged as contested', JSON.stringify(activity[apiComponent.id]));
  check(new Set(sessions.map((s) => s.name)).size === 2, 'the sessions have distinct names', sessions.map((s) => s.name).join(', '));

  // 4. The public watch link: sessions yes, spend no
  const watch = await fetch(binding.watchUrl.replace(/\/live\//, '/api/live/'));
  const watchBody = (await watch.json()) as { sessions?: Array<{ usage?: unknown; model?: unknown; usageByComponent?: Record<string, unknown>; unmappedPaths?: unknown[] }> };
  check(watch.status === 200 && (watchBody.sessions?.length ?? 0) === 2, 'the watch link shows both sessions', `status ${watch.status}`);
  check(watchBody.sessions?.every((s) => s.usage === undefined && !s.model && Object.keys(s.usageByComponent ?? {}).length === 0) ?? false, 'the watch link hides spend and model');

  // 5. Stop
  const stop = run(process.execPath, [join(repoRoot, 'cli', 'bin', 'archdraw-live.mjs'), 'stop']);
  const left = JSON.parse(readFileSync(join(home, 'projects.json'), 'utf8')).projects ?? {};
  check(stop.status === 0 && Object.keys(left).length === 0, 'stop disconnects the checkout');
  const quiet = hook({ hook_event_name: 'PostToolUse', tool_name: 'Edit', session_id: 'e2e-after-stop', tool_input: { file_path: join(repo, 'api', 'server.ts') } });
  await sleep(1500);
  const ghost = await prisma.agentSession.findUnique({ where: { canvasId_sessionKey: { canvasId: binding.canvasId, sessionKey: 'e2e-after-stop' } } });
  check(quiet.status === 0 && ghost === null, 'after stop, hooks report nothing');
}

try {
  await main();
} catch (error) {
  failures += 1;
  console.error('✗ unexpected error:', error instanceof Error ? error.stack : error);
} finally {
  if (!flag('keep')) {
    if (canvasOwner && isAnonymousUserId(canvasOwner)) {
      await prisma.user.delete({ where: { id: canvasOwner } }).catch((error) => {
        failures += 1;
        console.error('✗ cleanup of the test project failed:', error instanceof Error ? error.message : error);
      });
    }
    rmSync(sandbox, { recursive: true, force: true });
  } else {
    console.log(`\nKept: ${sandbox}${canvasOwner ? ` (user ${canvasOwner})` : ''}`);
    if (watchLink) console.log(`Watch link (sessions stay "active" for about 2 minutes): ${watchLink}`);
  }
  await prisma.$disconnect().catch(() => {});
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check${failures === 1 ? '' : 's'} failed.`);
process.exit(failures === 0 ? 0 : 1);
