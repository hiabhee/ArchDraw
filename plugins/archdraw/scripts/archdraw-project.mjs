#!/usr/bin/env node
// ArchDraw live projects — Claude Code hook + agent helper. Zero dependencies.
//
//   hook                      Claude Code hook entry (reads the hook JSON on stdin)
//   map                       Print the project's component → code-path map
//   mermaid [--out DIR] [--direction LR|TD]
//                             Current diagram as Mermaid (+ paths.json with --out) to edit and republish
//   publish --mermaid FILE [--paths FILE] [--session ID] [--relayout]
//                             Update the project diagram. Keeps the user's layout: existing
//                             components stay put, new ones are placed, removed ones dropped.
//   intent --session ID TEXT  Tell the canvas what this session is working on
//   send CWD PAYLOAD          (internal) deliver one activity report in the background
//
// Reads the link written by `archdraw-mcp-server link` from ~/.archdraw/projects.json
// (ARCHDRAW_HOME overrides). Sends repository-relative file paths only — never
// file contents, diffs or prompts. Unlinked repositories: every command is a no-op.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Hooks run inline with the agent's tool loop, so only what the hook must
// answer with waits on the network; activity reports go out in the background.
const REQUEST_TIMEOUT_MS = 10_000;
const START_MAP_TIMEOUT_MS = 4_000;
const NUDGE_TIMEOUT_MS = 3_000;
const BACKGROUND_TIMEOUT_MS = 15_000;
const SCRIPT_PATH = fileURLToPath(import.meta.url);

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1500 }).trim();
  } catch {
    return '';
  }
}

/** Checkout root plus, for linked worktrees, the main repository root. */
export function repoRoots(cwd) {
  const top = git(['rev-parse', '--show-toplevel'], cwd) || resolve(cwd);
  const roots = [top];
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  if (common && basename(common) === '.git') {
    const main = dirname(common);
    if (main !== top) roots.push(main);
  }
  return roots;
}

export function loadBinding(cwd, env = process.env) {
  const file = join(env.ARCHDRAW_HOME || join(homedir(), '.archdraw'), 'projects.json');
  if (!existsSync(file)) return null;
  let projects;
  try {
    projects = JSON.parse(readFileSync(file, 'utf8')).projects || {};
  } catch {
    return null;
  }
  const roots = repoRoots(cwd);
  for (const root of roots) {
    const binding = projects[root];
    if (binding?.apiBase && binding?.canvasId && binding?.token) return { ...binding, checkoutRoot: roots[0], repoRoot: root };
  }
  return null;
}

/** Repo-relative POSIX path, or null for files outside the checkout. */
export function toRepoPath(filePath, checkoutRoot, cwd) {
  if (!filePath || typeof filePath !== 'string') return null;
  const abs = isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
  const rel = relative(checkoutRoot, abs);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null;
  return rel.split(sep).join('/');
}

export function sessionLabel(checkoutRoot, branch, sessionId) {
  const short = String(sessionId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
  return `${basename(checkoutRoot)}${branch ? ` (${branch})` : ''}${short ? ` #${short}` : ''}`;
}

async function api(binding, path, init = {}) {
  const res = await fetch(`${binding.apiBase}/api/projects/${encodeURIComponent(binding.canvasId)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${binding.token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(init.timeoutMs || REQUEST_TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

const EVENTS = { SessionStart: 'start', PostToolUse: 'edit', Stop: 'stop', SessionEnd: 'end' };

export function buildActivity(input, binding) {
  const event = EVENTS[input.hook_event_name];
  if (!event || !input.session_id) return null;
  const cwd = input.cwd || process.cwd();
  const payload = { sessionKey: String(input.session_id), event };
  if (event === 'edit') {
    const toolInput = input.tool_input || {};
    const file = toRepoPath(toolInput.file_path || toolInput.notebook_path, binding.checkoutRoot, cwd);
    if (!file) return null;
    payload.files = [file];
  }
  if (event === 'start') {
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    if (branch && branch !== 'HEAD') payload.branch = branch;
    payload.label = sessionLabel(binding.checkoutRoot, payload.branch, input.session_id);
    // Names an auto-named project canvas after the repository (the linked root,
    // so a worktree reports the main repository's name).
    payload.repoName = basename(binding.repoRoot || binding.checkoutRoot);
  }
  return payload;
}

function startContext(binding, sessionId, map) {
  const node = `node "${SCRIPT_PATH}"`;
  const url = `${binding.apiBase}/editor?canvas=${encodeURIComponent(binding.canvasId)}`;
  const components = map?.components?.length ?? 0;
  const mapped = map?.components?.filter((c) => c.codePaths?.length).length ?? 0;
  // Unknown is not empty: never ask for a fresh mapping because a request was slow.
  const summary = map ? `${components} components, ${mapped} mapped to code` : 'component map not loaded yet';
  return [
    `ArchDraw live project: this repository is linked to ${url} (${summary}).`,
    'File paths you edit are reported to it automatically (paths only), so the user can see which component each session is working on.',
    `Your ArchDraw session id: ${sessionId}`,
    `- Component map: ${node} map`,
    `- Change the architecture (you added, removed, renamed or moved a component): ${node} mermaid --out <tmp dir>, edit <tmp dir>/diagram.mmd and <tmp dir>/paths.json ({"<nodeId>": ["repo/path", "dir/**"]}), then ${node} publish --session ${sessionId} --mermaid <tmp dir>/diagram.mmd --paths <tmp dir>/paths.json. Keep existing node ids; the user's layout is preserved.`,
    `- When you start a distinct piece of work, share it in one line: ${node} intent --session ${sessionId} "<what you are doing>"`,
    !map
      ? `Run the map command before changing the diagram; the project may already be mapped.`
      : mapped === 0
        ? 'The project has no code-mapped components yet: offer to map this codebase into it (graph LR, one subgraph per area, stable ids).'
        : 'Update the diagram only for real architectural changes, not for every file.',
  ].join('\n');
}

/** Top two path segments: the unit we nudge about once per session. */
export function areaOf(path) {
  return path.split('/').slice(0, 2).join('/');
}

function nudgeStatePath(sessionId) {
  return join(tmpdir(), `archdraw-hook-${String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
}

/** Areas not yet nudged this session (and remember them). */
export function takeNewAreas(sessionId, paths) {
  const file = nudgeStatePath(sessionId);
  let seen = [];
  try {
    seen = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    // first nudge this session
  }
  const fresh = [...new Set(paths.map(areaOf))].filter((area) => !seen.includes(area));
  if (fresh.length) {
    try {
      writeFileSync(file, JSON.stringify([...seen, ...fresh]));
    } catch {
      // best effort
    }
  }
  return fresh;
}

function unmappedContext(sessionId, paths) {
  return [
    `ArchDraw: ${paths.join(', ')} is not part of any component on the linked architecture diagram.`,
    'If this is a new component or module (not a helper inside an existing one), update the diagram with the ArchDraw `mermaid` → `publish` commands from your session start note, passing --session ' + sessionId + '. Otherwise ignore this.',
  ].join(' ');
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function runHook() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    return;
  }
  const binding = loadBinding(input.cwd || process.cwd());
  if (!binding) return;
  const payload = buildActivity(input, binding);
  if (!payload) return;

  // A newly written file no component owns may be a new module: that nudge
  // needs the server's answer, so only Write waits (briefly) for its report.
  const wantsNudge = payload.event === 'edit' && input.tool_name === 'Write';
  if (!wantsNudge) sendInBackground(input.cwd || process.cwd(), payload);

  if (payload.event === 'start') {
    const map = await api(binding, '/diagram', { timeoutMs: START_MAP_TIMEOUT_MS })
      .then((r) => (r.ok ? r.body : null))
      .catch(() => null);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: startContext(binding, payload.sessionKey, map) },
    }));
    return;
  }
  if (!wantsNudge) return;

  const activity = await api(binding, '/activity', { method: 'POST', body: JSON.stringify(payload), timeoutMs: NUDGE_TIMEOUT_MS })
    .catch(() => null);
  if (!activity) {
    sendInBackground(input.cwd || process.cwd(), payload); // too slow: still record the edit
    return;
  }
  const unmapped = activity.ok && Array.isArray(activity.body.unmapped) ? activity.body.unmapped : [];
  if (unmapped.length > 0) {
    const areas = takeNewAreas(payload.sessionKey, unmapped);
    if (areas.length > 0) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: unmappedContext(payload.sessionKey, unmapped) },
      }));
    }
  }
}

/**
 * Deliver an activity report from a detached process so a slow or distant
 * server neither delays the agent nor drops the report when the hook exits.
 */
function sendInBackground(cwd, payload) {
  try {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    spawn(process.execPath, [SCRIPT_PATH, 'send', cwd, encoded], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // best effort: hooks must never fail the agent's turn
  }
}

async function runSend([cwd, encoded]) {
  const binding = loadBinding(cwd || process.cwd());
  if (!binding || !encoded) return;
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  await api(binding, '/activity', { method: 'POST', body: JSON.stringify(payload), timeoutMs: BACKGROUND_TIMEOUT_MS });
}

const BOOLEAN_FLAGS = new Set(['relayout']);

function flags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].startsWith('--') ? argv[i].slice(2) : null;
    if (name && BOOLEAN_FLAGS.has(name)) out[name] = true;
    else if (name) out[name] = argv[++i];
    else out._.push(argv[i]);
  }
  return out;
}

function requireBinding() {
  const binding = loadBinding(process.cwd());
  if (!binding) {
    console.error('This repository is not linked to an ArchDraw project. Run: npx -y @hiabhee/archdraw-mcp-server link --api <ArchDraw URL>');
    process.exit(2);
  }
  return binding;
}

async function runMap() {
  const binding = requireBinding();
  const res = await api(binding, '/diagram', { timeoutMs: 10_000 });
  if (!res.ok) throw new Error(res.body.error || `Map request failed (${res.status})`);
  process.stdout.write(`${JSON.stringify(res.body, null, 2)}\n`);
}

async function runMermaid(argv) {
  const binding = requireBinding();
  const f = flags(argv);
  const direction = f.direction === 'TD' ? 'TD' : 'LR';
  const res = await api(binding, `/diagram?format=mermaid&direction=${direction}`, { timeoutMs: 10_000 });
  if (!res.ok) throw new Error(res.body.error || `Request failed (${res.status})`);
  if (!f.out) {
    process.stdout.write(`${res.body.mermaid}\n`);
    return;
  }
  mkdirSync(f.out, { recursive: true });
  writeFileSync(join(f.out, 'diagram.mmd'), `${res.body.mermaid}\n`);
  writeFileSync(join(f.out, 'paths.json'), `${JSON.stringify(res.body.componentPaths ?? {}, null, 2)}\n`);
  process.stdout.write(`Wrote ${join(f.out, 'diagram.mmd')} and ${join(f.out, 'paths.json')}\n`);
}

async function runPublish(argv) {
  const binding = requireBinding();
  const f = flags(argv);
  if (!f.mermaid) throw new Error('publish needs --mermaid <file>');
  const body = { mermaid: readFileSync(f.mermaid, 'utf8') };
  if (f.paths) body.componentPaths = JSON.parse(readFileSync(f.paths, 'utf8'));
  if (f.session) body.sessionKey = f.session;
  if (f.relayout) body.relayout = true;
  if (f['base-updated-at']) body.baseUpdatedAt = Number(f['base-updated-at']);
  let res = await api(binding, '/diagram', { method: 'PUT', body: JSON.stringify(body), timeoutMs: 60_000 });
  // The user may have moved something meanwhile: the merge is recomputed on retry.
  if (res.status === 409 && !body.baseUpdatedAt) {
    res = await api(binding, '/diagram', { method: 'PUT', body: JSON.stringify(body), timeoutMs: 60_000 });
  }
  if (!res.ok) throw new Error(`${res.body.error || `Publish failed (${res.status})`}${res.body.warnings ? `\n${res.body.warnings.join('\n')}` : ''}`);
  const url = `${binding.apiBase}/editor?canvas=${encodeURIComponent(binding.canvasId)}`;
  process.stdout.write(
    `${res.body.summary} (${res.body.mode === 'merge' ? 'layout kept' : 'laid out fresh'}). ` +
      `${res.body.componentCount} components, ${res.body.mappedCount} mapped to code: ${url}\n` +
      (res.body.warnings?.length ? `Warnings:\n- ${res.body.warnings.join('\n- ')}\n` : ''),
  );
}

async function runIntent(argv) {
  const binding = requireBinding();
  const f = flags(argv);
  const intent = f._.join(' ').trim();
  if (!f.session || !intent) throw new Error('intent needs --session <id> "<text>"');
  const res = await api(binding, '/activity', {
    method: 'POST',
    body: JSON.stringify({ sessionKey: f.session, event: 'edit', intent: intent.slice(0, 280) }),
  });
  if (!res.ok) throw new Error(res.body.error || `Request failed (${res.status})`);
  process.stdout.write('Intent shared with the ArchDraw project.\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  const [command, ...rest] = process.argv.slice(2);
  const run = { hook: runHook, send: runSend, map: runMap, mermaid: runMermaid, publish: runPublish, intent: runIntent }[command];
  if (!run) {
    console.error('Usage: archdraw-project.mjs hook | map | mermaid [--out DIR] | publish --mermaid FILE [--paths FILE] [--session ID] [--relayout] | intent --session ID TEXT');
    process.exit(2);
  }
  run(rest).catch((error) => {
    // Hooks must never block or fail the agent's turn.
    if (command === 'hook' || command === 'send') process.exit(0);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
