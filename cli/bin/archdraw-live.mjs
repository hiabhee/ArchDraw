#!/usr/bin/env node
// archdraw-live — see your coding agents work on a live map of your codebase.
//
//   npx archdraw-live              map this repository, connect Claude Code, open the live map
//   npx archdraw-live --dry-run    show the diagram that would be sent, send nothing
//   npx archdraw-live --rescan     rebuild the diagram from the folders (keeps your layout)
//   npx archdraw-live --map        let Claude Code read the code and draw an accurate map (overview, then detailed)
//   npx archdraw-live --detail     redraw only the detailed map
//   npx archdraw-live status       where this repository's live map is
//   npx archdraw-live stop         disconnect this repository
//
// What leaves this machine: component names and repository-relative paths
// (folder globs), then — from Claude Code hooks — which files each session
// reads or edits. Never file contents, diffs or prompts.

import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { listFiles, scanRepository } from '../lib/scan.mjs';
import { bindingFilePath, getBinding, removeBinding, saveBinding } from '../lib/binding.mjs';
import { installClaudeHooks } from '../lib/claudeHooks.mjs';
import { detailPrompt, mapAndCheck, mappingPrompt, readMermaid } from '../lib/mapWithClaude.mjs';
import { createInterface } from 'node:readline/promises';

const DEFAULT_API = 'https://archdraw.hiabhee.online';
const VERSION = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')).version;

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => (color ? `\x1b[${code}m${text}\x1b[0m` : String(text));
const bold = paint(1);
const dim = paint(2);
const green = paint(32);
const yellow = paint(33);
const red = paint(31);
const ok = (text) => console.log(`${green('✓')} ${text}`);
const warn = (text) => console.log(`${yellow('!')} ${text}`);
const fail = (text) => {
  console.error(`${red('✗')} ${text}`);
  process.exit(1);
};

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) out._.push(arg);
    else if (arg.includes('=')) out[arg.slice(2, arg.indexOf('='))] = arg.slice(arg.indexOf('=') + 1);
    else if (['api'].includes(arg.slice(2))) out[arg.slice(2)] = argv[++i];
    else out[arg.slice(2)] = true;
  }
  return out;
}

function repoRoot(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return resolve(cwd);
  }
}

function apiBase(value) {
  try {
    const url = new URL(value || process.env.ARCHDRAW_API || DEFAULT_API);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function hasCommand(name) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function openBrowser(url) {
  try {
    const [cmd, args] = process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
    return true;
  } catch {
    return false;
  }
}

/** The page to open: the watch link (with the claim secret in the fragment, never sent to the server) or the editor. */
function liveUrl(binding) {
  if (binding.anonymous && binding.watchUrl) {
    return binding.claimSecret ? `${binding.watchUrl}#claim=${encodeURIComponent(binding.claimSecret)}` : binding.watchUrl;
  }
  return `${binding.apiBase}/editor?canvas=${encodeURIComponent(binding.canvasId)}`;
}

async function request(url, init, timeoutMs = 60_000) {
  let res;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    fail(`Couldn't reach ArchDraw at ${new URL(url).origin}. Check your connection and try again.`);
  }
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function connectHooks() {
  const hooks = installClaudeHooks();
  if (hooks.status === 'installed') ok(`Claude Code connected ${dim(`(hooks in ${hooks.path.replace(homedir(), '~')})`)}`);
  else if (hooks.status === 'plugin') ok('Claude Code connected through your ArchDraw plugin');
  else warn(hooks.message);
}

function nextSteps(binding, opened) {
  const url = liveUrl(binding);
  console.log('');
  console.log(opened ? `${bold('Your live map is open in the browser.')}` : `${bold('Your live map:')} ${url}`);
  if (opened) console.log(dim(`  ${binding.watchUrl ?? url}`));
  console.log('');
  console.log(`${bold('Next:')} start Claude Code in this folder${hasCommand('claude') ? ` (run ${bold('claude')})` : ''}. Each session appears as a star`);
  console.log('that moves to the part of the code it is working on.');
  console.log(`To see several at once, open another terminal in this folder and run ${bold('claude')} again.`);
  console.log(dim('Claude Code sessions that were already open may need a restart before they show up.'));
  if (!hasCommand('claude')) {
    console.log('');
    warn(`Claude Code isn't installed yet: ${bold('npm install -g @anthropic-ai/claude-code')}`);
  }
  if (binding.anonymous) {
    console.log('');
    console.log(dim('No account needed. To keep the project and edit the diagram, sign in from the live map.'));
  }
  console.log(dim('Tip: ask Claude "improve the ArchDraw diagram of this repo" for a sharper map.'));
}

async function ask(question, defaultYes = true) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    return answer === '' ? defaultYes : answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

/** Progress line while Claude reads, and a note when its answer goes back for fixes. */
function checkedRun(tty) {
  return {
    onTick: (seconds) => { if (tty) process.stdout.write(`\r  ${dim(`reading… ${seconds}s`)}   `); },
    onRepair: (problems) => {
      if (tty) process.stdout.write('\r\x1b[2K');
      console.log(dim(`Checked the map against your code: ${problems.length} problem${problems.length === 1 ? '' : 's'} (for example: ${problems[0]}). Asking Claude to fix them.`));
    },
  };
}

/** What the check still found after Claude's second try (the map is published anyway). */
function reportLeftovers(problems) {
  if (!problems.length) return;
  warn(`The map still has ${problems.length} issue${problems.length === 1 ? '' : 's'} it could not fix:`);
  for (const problem of problems.slice(0, 5)) console.log(dim(`  - ${problem}`));
}

/** Claude reads the code and publishes an accurate map (replaces the folder-based one). */
async function mapWithClaude(root, binding, scan) {
  if (!hasCommand('claude')) {
    warn(`Claude Code isn't installed, so the map stays folder-based. Install it: ${bold('npm install -g @anthropic-ai/claude-code')}`);
    return false;
  }
  console.log(dim('Claude is reading your code (read-only) to draw the map. You can watch it on the live map.'));
  const tty = process.stdout.isTTY;
  const result = await mapAndCheck(root, mappingPrompt(scan), listFiles(root), checkedRun(tty));
  if (tty) process.stdout.write('\r\x1b[2K');
  if (!result.ok) {
    warn(`${result.reason} The folder-based map stays; try \`npx archdraw-live --map\` again.`);
    return false;
  }
  const { mapping } = result;
  reportLeftovers(result.problems);
  const res = await request(`${binding.apiBase}/api/projects/${encodeURIComponent(binding.canvasId)}/diagram`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${binding.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mermaid: mapping.mermaid, componentPaths: mapping.componentPaths, relayout: true }),
  });
  if (!res.ok) {
    warn(`ArchDraw couldn't use Claude's diagram (${res.body.error || res.status}). The folder-based map stays.`);
    return false;
  }
  ok(`Claude mapped ${bold(res.body.componentCount)} components ${dim('(the live map has updated)')}`);
  return true;
}

/**
 * The detailed map: Claude opens each overview component up into its
 * modules and files. Shown with the Overview | Detailed switch on the map.
 */
async function mapDetailWithClaude(root, binding) {
  if (!hasCommand('claude')) {
    warn(`Claude Code isn't installed. Install it to draw the detailed map: ${bold('npm install -g @anthropic-ai/claude-code')}`);
    return false;
  }
  const diagramUrl = `${binding.apiBase}/api/projects/${encodeURIComponent(binding.canvasId)}/diagram`;
  const headers = { Authorization: `Bearer ${binding.token}`, 'Content-Type': 'application/json' };
  const overview = await request(`${diagramUrl}?format=mermaid`, { headers });
  if (!overview.ok || !overview.body.mermaid) {
    warn(`Couldn't read the overview map (${overview.body.error || overview.status}).`);
    return false;
  }
  console.log(dim('Now the detailed map: Claude opens each component up into its modules and files. The overview is ready to look at meanwhile.'));
  const tty = process.stdout.isTTY;
  const { nodes, areas } = readMermaid(overview.body.mermaid);
  const result = await mapAndCheck(root, detailPrompt(overview.body), listFiles(root), {
    ...checkedRun(tty),
    requiredIds: [...areas.keys(), ...nodes.keys()],
  });
  if (tty) process.stdout.write('\r\x1b[2K');
  if (!result.ok) {
    warn(`${result.reason} Try again with ${bold('npx archdraw-live --detail')}.`);
    return false;
  }
  const { mapping } = result;
  reportLeftovers(result.problems);
  const res = await request(diagramUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ level: 'detail', mermaid: mapping.mermaid, componentPaths: mapping.componentPaths }),
  });
  if (!res.ok) {
    warn(`ArchDraw couldn't use the detailed map (${res.body.error || res.status}). Try again with ${bold('npx archdraw-live --detail')}.`);
    return false;
  }
  ok(`Detailed map: ${bold(res.body.componentCount)} parts ${dim('(switch to "Detailed" at the top of the live map)')}`);
  return true;
}

/** Overview first (always), then the detailed map unless --no-detail. */
async function mapAll(root, binding, scan, flags) {
  const mapped = await mapWithClaude(root, binding, scan);
  if (mapped && !flags['no-detail']) await mapDetailWithClaude(root, binding);
  return mapped;
}

function printScan(result) {
  ok(`Mapped ${bold(result.components.length)} components${result.externals.length ? ` and ${result.externals.length} services` : ''} from ${result.fileCount} files ${dim('(on this machine)')}`);
}

async function setup(flags) {
  const base = apiBase(flags.api);
  if (!base) fail('Pass an https URL with --api (or http://localhost for development).');
  const root = repoRoot(process.cwd());
  if (root === homedir() || root === '/' || dirname(root) === root) {
    fail('Run this inside your project folder (the one with your code), not your home folder.');
  }
  const repoName = basename(root);
  const existing = getBinding(root);

  if (flags['dry-run']) {
    const result = scanRepository(root, { repoName });
    printScan(result);
    console.log('');
    console.log(dim('This is everything that would be sent (names and paths, no code):'));
    console.log(result.mermaid);
    console.log(JSON.stringify(result.componentPaths, null, 2));
    return;
  }

  if (existing && flags.map) {
    connectHooks();
    if (!flags['no-open']) openBrowser(liveUrl(existing));
    await mapAll(root, existing, scanRepository(root, { repoName }), flags);
    return;
  }

  if (flags.detail) {
    if (!existing) fail(`This repository isn't connected yet. Run ${bold('npx archdraw-live')} first.`);
    await mapDetailWithClaude(root, existing);
    return;
  }

  if (existing && !flags.rescan) {
    console.log(`${bold(repoName)} is already connected.`);
    connectHooks();
    nextSteps(existing, flags['no-open'] ? false : openBrowser(liveUrl(existing)));
    return;
  }

  console.log(`Setting up a live map for ${bold(repoName)}…`);
  const result = scanRepository(root, { repoName });
  printScan(result);

  if (existing) {
    const res = await request(`${existing.apiBase}/api/projects/${encodeURIComponent(existing.canvasId)}/diagram`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${existing.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mermaid: result.mermaid, componentPaths: result.componentPaths }),
    });
    if (!res.ok) fail(res.status === 401 ? 'This project was stopped or deleted. Run `npx archdraw-live stop`, then run this again.' : res.body.error || `Update failed (${res.status}).`);
    ok(`Diagram updated ${dim(`(${res.body.summary ?? 'layout kept'})`)}`);
    connectHooks();
    nextSteps(existing, flags['no-open'] ? false : openBrowser(liveUrl(existing)));
    return;
  }

  const res = await request(`${base}/api/projects/quickstart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': `archdraw-live/${VERSION}` },
    body: JSON.stringify({ repoName, mermaid: result.mermaid, componentPaths: result.componentPaths }),
  });
  if (!res.ok) fail(res.body.error || `ArchDraw could not create the project (${res.status}).`);
  const { canvasId, agenticProjectId, workspaceId, token, watchPath, claimSecret } = res.body;
  if (!canvasId || !token || !watchPath) fail('ArchDraw returned an incomplete project. Try again in a minute.');

  const binding = {
    apiBase: base,
    canvasId,
    agenticProjectId,
    workspaceId,
    token,
    linkedAt: new Date().toISOString(),
    anonymous: true,
    watchUrl: `${base}${watchPath}`,
    ...(claimSecret ? { claimSecret } : {}),
  };
  saveBinding(root, binding);
  ok(`Project created ${dim(`(link saved in ${bindingFilePath().replace(homedir(), '~')}, outside your repo)`)}`);
  connectHooks();
  const opened = flags['no-open'] ? false : openBrowser(liveUrl(binding));
  console.log('');
  console.log(dim('This first map is a quick guess from your folder names.'));
  const improve = flags.map || (!flags['no-map'] && hasCommand('claude')
    && await ask(`${bold('Let Claude read your code and draw an accurate map?')} The overview takes 1–3 minutes, then a detailed map follows. Uses your Claude account. [y/N] `, false));
  if (improve) await mapAll(root, binding, result, flags);
  else console.log(dim(`Later: ${bold('npx archdraw-live --map')}`));
  nextSteps(binding, opened);
}

function status() {
  const root = repoRoot(process.cwd());
  const binding = getBinding(root);
  if (!binding) {
    console.log(`${basename(root)} is not connected. Run ${bold('npx archdraw-live')} to set it up.`);
    process.exitCode = 1;
    return;
  }
  // The watch link without the claim secret: safe to paste or share.
  console.log(`${bold(basename(root))} → ${binding.anonymous && binding.watchUrl ? binding.watchUrl : liveUrl(binding)}`);
  console.log(dim(`connected ${binding.linkedAt}`));
}

function stop() {
  const root = repoRoot(process.cwd());
  const removed = removeBinding(root);
  console.log(removed
    ? `Disconnected ${bold(basename(root))}. Claude Code sessions here no longer report activity.`
    : `${basename(root)} was not connected.`);
}

const HELP = `${bold('archdraw-live')} ${VERSION} — watch your coding agents on a live map of your codebase

  npx archdraw-live              map this repository, connect Claude Code, open the live map
  npx archdraw-live --dry-run    print what would be sent (names and paths), send nothing
  npx archdraw-live --rescan     rebuild the diagram from the folders (keeps your layout)
  npx archdraw-live --map        let Claude Code read the code and draw an accurate map (overview, then detailed)
  npx archdraw-live --detail     redraw only the detailed map (each component's modules and files)
  npx archdraw-live status       show this repository's live map link
  npx archdraw-live stop         disconnect this repository

Options: --api <url> (default ${DEFAULT_API}), --no-open, --no-map (skip the Claude question), --no-detail (overview only)
Sent: component names, folder paths, and which files each session reads or edits. Never code or prompts.`;

const flags = parseArgs(process.argv.slice(2));
const [command] = flags._;
if (flags.help || command === 'help') console.log(HELP);
else if (flags.version) console.log(VERSION);
else if (command === 'status') status();
else if (command === 'stop') stop();
else if (!command) await setup(flags).catch((error) => fail(error instanceof Error ? error.message : String(error)));
else {
  console.error(HELP);
  process.exit(2);
}
