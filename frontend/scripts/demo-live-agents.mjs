#!/usr/bin/env node
// Drive simulated coding-agent sessions on a linked ArchDraw live project, for
// demos and for checking the Agent Atlas. Uses the same agent API (and the
// same `~/.archdraw/projects.json` link) as the Claude Code hooks; sends only
// what the hooks send: session ids, events, repo-relative paths, component ids.
//
//   node scripts/demo-live-agents.mjs [--agents 5] [--minutes 3] [--repo /path/to/linked/checkout] [--api http://localhost:3000]
//
// Sessions are named `demo-…` and end themselves when the run finishes (Ctrl+C too).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const AGENTS = Math.min(Math.max(Number(args.agents ?? 5), 1), 12);
const MINUTES = Math.max(Number(args.minutes ?? 3), 0.5);

function repoRoot(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return cwd;
  }
}

const projects = JSON.parse(readFileSync(join(process.env.ARCHDRAW_HOME || join(homedir(), '.archdraw'), 'projects.json'), 'utf8')).projects ?? {};
const root = repoRoot(args.repo ?? process.cwd());
const binding = projects[root] ?? Object.values(projects)[0];
if (!binding) {
  console.error('No linked checkout found. Run `npx -y @hiabhee/archdraw-mcp-server link --api <ArchDraw URL>` first.');
  process.exit(1);
}
const apiBase = (args.api ?? binding.apiBase).replace(/\/+$/, '');
const base = `${apiBase}/api/projects/${encodeURIComponent(binding.canvasId)}`;
const headers = { Authorization: `Bearer ${binding.token}`, 'Content-Type': 'application/json' };

async function send(payload) {
  const res = await fetch(`${base}/activity`, { method: 'POST', headers, body: JSON.stringify(payload) }).catch(() => null);
  if (!res?.ok) console.warn(`  ! ${payload.event} failed (${res?.status ?? 'network'})`);
}

/** A concrete file inside a component's path/glob, so it maps back to that component. */
function fileIn(codePath) {
  const p = codePath.replace(/\/+$/, '');
  if (p.endsWith('/**')) return `${p.slice(0, -3)}/index.ts`;
  if (p.includes('*')) return p.replace(/\*\*\/?/g, '').replace(/\*/g, 'index');
  return /\.[a-z0-9]+$/i.test(p) ? p : `${p}/index.ts`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const map = await (await fetch(`${base}/diagram`, { headers })).json();
const components = (map.components ?? []).filter((c) => c.codePaths?.length && c.type !== 'groupNode');
if (components.length < 2) {
  console.error('The project needs at least two components with code paths. Ask an agent to map the codebase first.');
  process.exit(1);
}
const neighbours = new Map(); // filled lazily from shared parents (good-enough "nearby")
for (const c of components) neighbours.set(c.id, components.filter((o) => o.id !== c.id && o.parentId && o.parentId === c.parentId));

const BRANCHES = ['feat/checkout-flow', 'fix/auth-timeout', 'refactor/canvas-store', 'feat/live-cursors', 'chore/deps-bump', 'fix/export-png', 'feat/billing-webhooks', 'perf/edge-routing', 'feat/onboarding', 'fix/rate-limits', 'docs/api-guide', 'feat/search'];
const repo = basename(root);
const deadline = Date.now() + MINUTES * 60_000;
const sessions = [];

async function agent(i) {
  const sessionKey = `demo-${Math.random().toString(36).slice(2, 10)}`;
  const branch = BRANCHES[i % BRANCHES.length];
  sessions.push(sessionKey);
  await sleep(i * 2500); // arrive one by one
  await send({ sessionKey, event: 'start', branch, label: `${repo} (${branch}) #${sessionKey.slice(5, 9)}` });
  console.log(`+ ${branch} arrived`);

  while (Date.now() < deadline) {
    const target = pick(components);
    await sleep(jitter(2500, 4500));
    await send({ sessionKey, event: 'aim', componentIds: [target.id] });

    // Explore: read a neighbour or two, then the target.
    const around = (neighbours.get(target.id) ?? []).slice(0, 2);
    for (const c of [...around, target]) {
      await sleep(jitter(2000, 3500));
      await send({ sessionKey, event: 'read', files: [fileIn(pick(c.codePaths))] });
    }

    // Edit for a while; sometimes ask for permission in the middle.
    const edits = Math.round(jitter(4, 9));
    for (let n = 0; n < edits && Date.now() < deadline; n++) {
      await sleep(jitter(1500, 3000));
      await send({ sessionKey, event: 'edit', files: [fileIn(pick(target.codePaths))] });
      if (n === 2 && Math.random() < 0.35) {
        await send({ sessionKey, event: 'wait' });
        await sleep(jitter(5000, 8000));
      }
    }
    await send({ sessionKey, event: 'stop' }); // "your turn"
    await sleep(jitter(5000, 10000));
  }
  await send({ sessionKey, event: 'end' });
}

let ending = false;
async function endAll() {
  if (ending) return;
  ending = true;
  await Promise.all(sessions.map((sessionKey) => send({ sessionKey, event: 'end' })));
}
process.on('SIGINT', async () => {
  console.log('\nEnding demo sessions…');
  await endAll();
  process.exit(0);
});

console.log(`Driving ${AGENTS} demo agents on ${apiBase}/editor?canvas=${binding.canvasId} for ${MINUTES} min (Ctrl+C to stop).`);
await Promise.all(Array.from({ length: AGENTS }, (_, i) => agent(i)));
await endAll();
console.log('Done.');
