/**
 * Does the ArchDraw map make Claude Code cheaper? A/B benchmark.
 *
 * Runs each task in `tasks.json` with headless Claude Code from a clean git
 * worktree, once with the ArchDraw hooks linked to an eval project ("on") and
 * once with the same hooks unlinked ("off": an empty ARCHDRAW_HOME, so every
 * hook is a no-op). User settings are skipped (`--setting-sources project`) so
 * only the hooks under test run, and no MCP servers are loaded.
 *
 *   setup  --repo <name> [--repo-path DIR]
 *          Copy the repo's live map (from its ~/.archdraw link) into a new
 *          eval project via the public quick start, so test sessions never
 *          appear on the real project.
 *   run    --repo <name> [--repo-path DIR] [--tasks id,id] [--arms on,off]
 *          [--reps 3] [--model M] [--concurrency 2] [--max-budget-usd 2]
 *          [--plugin-root DIR]   hooks under test (default: plugins/archdraw here)
 *          [--resume]            skip runs already in the results file
 *          [--hide a,b]          delete these repo files in each worktree first
 *                                (e.g. AGENTS.md: a repo without hand-written docs)
 *   report --repo <name> [--file results.jsonl]
 *
 * Results: frontend/eval-results/agent-tokens/<repo>/ (gitignored; the eval
 * binding there holds an agent token). Every run bills your Claude account.
 *
 * Usage: `npm run eval:agent-tokens -- run --repo archdraw --reps 1 --tasks locate-quickstart-body`
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync, realpathSync, symlinkSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRun, summarizeArm, relativeChange, type RunMetrics } from './metrics';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..', '..');
const resultsRoot = resolve(repoRoot, 'frontend', 'eval-results', 'agent-tokens');

type Arm = 'on' | 'off';

interface Task {
  id: string;
  kind: string;
  prompt: string;
  targets: string[];
  answer?: string[];
  hiddenTest?: { path: string; content: string };
  check?: string;
}

interface RepoConfig {
  base: string;
  path?: string;
  tasks: Task[];
}

interface RunRecord {
  repo: string;
  task: string;
  kind: string;
  arm: Arm;
  rep: number;
  base: string;
  model: string | null;
  hidden: string[];
  startedAt: string;
  passed: boolean;
  checkOutput?: string;
  metrics: RunMetrics;
}

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function flags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    out[key] = value;
  }
  return out;
}

function loadRepo(name: string, f: Record<string, string>): RepoConfig & { path: string } {
  const all = JSON.parse(readFileSync(join(here, 'tasks.json'), 'utf8')).repos as Record<string, RepoConfig>;
  const repo = all[name] ?? fail(`No repo "${name}" in tasks.json (have: ${Object.keys(all).join(', ')})`);
  const path = f['repo-path'] ?? repo.path ?? (name === 'archdraw' ? repoRoot : fail(`Pass --repo-path for "${name}"`));
  return { ...repo, path: realpathSync(resolve(path)) };
}

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function repoDir(name: string): string {
  const dir = join(resultsRoot, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ── setup ────────────────────────────────────────────────────────────────

interface Binding {
  apiBase: string;
  canvasId: string;
  token: string;
  [key: string]: unknown;
}

function realBinding(path: string): Binding {
  const file = join(process.env.ARCHDRAW_HOME || join(homedir(), '.archdraw'), 'projects.json');
  const projects = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).projects ?? {} : {};
  return projects[path] ?? fail(`${path} is not linked to an ArchDraw project (${file}). Link it first.`);
}

async function setup(name: string, f: Record<string, string>) {
  const repo = loadRepo(name, f);
  const source = realBinding(repo.path);
  const headers = { Authorization: `Bearer ${source.token}` };
  const res = await fetch(`${source.apiBase}/api/projects/${encodeURIComponent(source.canvasId)}/diagram?format=mermaid&direction=LR`, { headers });
  if (!res.ok) fail(`Could not read the project map (${res.status})`);
  const { mermaid, componentPaths } = await res.json() as { mermaid: string; componentPaths?: Record<string, string[]> };
  const created = await fetch(`${source.apiBase}/api/projects/quickstart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoName: `${basename(repo.path)} token eval`, mermaid, componentPaths }),
  });
  const body = await created.json().catch(() => ({})) as Record<string, string>;
  if (!created.ok || !body.canvasId || !body.token) fail(`Quick start failed (${created.status}): ${body.error ?? ''}`);
  const binding: Binding = {
    apiBase: source.apiBase,
    canvasId: body.canvasId,
    agenticProjectId: body.agenticProjectId,
    workspaceId: body.workspaceId,
    token: body.token,
    linkedAt: new Date().toISOString(),
    anonymous: true,
    watchUrl: `${source.apiBase}${body.watchPath}`,
  };
  writeFileSync(join(repoDir(name), 'binding.json'), `${JSON.stringify(binding, null, 2)}\n`, { mode: 0o600 });
  console.log(`Eval project created with ${Object.keys(componentPaths ?? {}).length} mapped components.`);
  console.log(`Watch it: ${binding.watchUrl}`);
}

// ── run ──────────────────────────────────────────────────────────────────

function hookSettings(pluginRoot: string): string {
  const raw = readFileSync(join(pluginRoot, 'hooks', 'hooks.json'), 'utf8').replaceAll('${CLAUDE_PLUGIN_ROOT}', pluginRoot);
  return JSON.stringify({ hooks: JSON.parse(raw).hooks });
}

const ALLOWED_TOOLS = [
  'Read', 'Grep', 'Glob', 'Edit', 'Write', 'MultiEdit', 'TodoWrite',
  'Bash(cd:*)', 'Bash(ls:*)', 'Bash(find:*)', 'Bash(grep:*)', 'Bash(rg:*)', 'Bash(cat:*)', 'Bash(head:*)',
  'Bash(tail:*)', 'Bash(sed -n:*)', 'Bash(wc:*)', 'Bash(git diff:*)', 'Bash(git status:*)', 'Bash(git log:*)',
  'Bash(git grep:*)', 'Bash(npx vitest:*)', 'Bash(npm test:*)', 'Bash(node:*)',
];

const USAGE_LIMIT = /hit your (session|usage|weekly) limit|usage limit reached/i;

class UsageLimitError extends Error {}

/** Share installed dependencies with the worktree so checks and tests run. */
function linkNodeModules(source: string, worktree: string) {
  const dirs = ['.', ...readdirSync(source, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.')).map((d) => d.name)];
  for (const dir of dirs) {
    const from = join(source, dir, 'node_modules');
    const to = join(worktree, dir, 'node_modules');
    if (existsSync(from) && existsSync(join(worktree, dir)) && !existsSync(to)) symlinkSync(from, to, 'dir');
  }
}

function runCommand(command: string, cwd: string): Promise<{ code: number; output: string }> {
  return new Promise((done) => {
    const child = spawn('sh', ['-c', command], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('close', (code) => done({ code: code ?? 1, output: output.slice(-4000) }));
  });
}

function runClaude(args: string[], cwd: string, env: NodeJS.ProcessEnv, logFile: string): Promise<string[]> {
  return new Promise((done) => {
    const child = spawn('claude', args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let buffer = '';
    const lines: string[] = [];
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) if (line.trim()) lines.push(line);
    });
    child.stderr.on('data', (chunk) => appendFileSync(logFile, `# stderr: ${chunk}`));
    child.on('close', () => {
      if (buffer.trim()) lines.push(buffer);
      writeFileSync(logFile, `${lines.join('\n')}\n`, { flag: 'a' });
      done(lines);
    });
  });
}

async function runOne(opts: {
  repoName: string; repo: RepoConfig & { path: string }; task: Task; arm: Arm; rep: number;
  base: string; binding: Binding | null; settings: string; model: string | null; budget: string; hide: string[]; resultsFile: string; logDir: string;
}): Promise<RunRecord> {
  const { repo, task, arm, rep } = opts;
  const id = `${task.id}.${arm}.${rep}.${Date.now().toString(36)}`;
  const scratch = join(tmpdir(), 'archdraw-agent-tokens', id);
  mkdirSync(scratch, { recursive: true });
  const worktree = join(realpathSync(scratch), 'wt');
  git(['worktree', 'add', '--detach', worktree, opts.base], repo.path);
  try {
    linkNodeModules(repo.path, worktree);
    for (const file of opts.hide) rmSync(join(worktree, file), { force: true });
    const home = join(scratch, 'archdraw-home');
    mkdirSync(home, { recursive: true });
    if (arm === 'on' && opts.binding) {
      writeFileSync(join(home, 'projects.json'), JSON.stringify({ version: 1, projects: { [worktree]: opts.binding } }), { mode: 0o600 });
    }
    const args = [
      '-p', task.prompt,
      '--output-format', 'stream-json', '--verbose', '--include-hook-events',
      '--setting-sources', 'project',
      '--settings', opts.settings,
      '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
      '--permission-mode', 'acceptEdits',
      '--allowedTools', ...ALLOWED_TOOLS,
      '--no-session-persistence',
      '--max-budget-usd', opts.budget,
      ...(opts.model ? ['--model', opts.model] : []),
    ];
    const startedAt = new Date().toISOString();
    const lines = await runClaude(args, worktree, { ...process.env, ARCHDRAW_HOME: home }, join(opts.logDir, `${id}.jsonl`));
    const metrics = parseRun(lines, task.targets.map((t) => new RegExp(t)));
    // Not a result: the account ran out mid-benchmark. The caller stops scheduling.
    if (USAGE_LIMIT.test(metrics.finalText)) throw new UsageLimitError(metrics.finalText);

    let passed = !metrics.isError;
    let checkOutput: string | undefined;
    for (const pattern of task.answer ?? []) {
      if (!new RegExp(pattern, 'i').test(metrics.finalText)) passed = false;
    }
    if (task.hiddenTest) {
      mkdirSync(dirname(join(worktree, task.hiddenTest.path)), { recursive: true });
      writeFileSync(join(worktree, task.hiddenTest.path), task.hiddenTest.content);
    }
    if (task.check) {
      const result = await runCommand(task.check, worktree);
      if (result.code !== 0) passed = false;
      checkOutput = result.output;
    }
    const record: RunRecord = { repo: opts.repoName, task: task.id, kind: task.kind, arm, rep, base: opts.base, model: opts.model, hidden: opts.hide, startedAt, passed, checkOutput, metrics };
    appendFileSync(opts.resultsFile, `${JSON.stringify(record)}\n`);
    const cost = metrics.costUsd !== null ? `$${metrics.costUsd.toFixed(3)}` : `${Math.round(metrics.weightedTokens / 1000)}k wt`;
    console.log(`${passed ? '✓' : '✗'} ${task.id} [${arm}] #${rep}: ${cost}, ${metrics.apiCalls} calls, ${metrics.tools.locate} searches, target after ${metrics.callsBeforeTarget ?? '–'} calls`);
    return record;
  } finally {
    try {
      git(['worktree', 'remove', '--force', worktree], repo.path);
    } catch {
      // left for `git worktree prune`
    }
    rmSync(scratch, { recursive: true, force: true });
  }
}

async function run(name: string, f: Record<string, string>) {
  const repo = loadRepo(name, f);
  const dir = repoDir(name);
  const arms = (f.arms ?? 'on,off').split(',') as Arm[];
  const bindingFile = join(dir, 'binding.json');
  const binding = existsSync(bindingFile) ? JSON.parse(readFileSync(bindingFile, 'utf8')) as Binding : null;
  if (arms.includes('on') && !binding) fail(`No eval project for "${name}". Run setup first.`);
  const wanted = f.tasks ? new Set(f.tasks.split(',')) : null;
  const tasks = repo.tasks.filter((t) => !wanted || wanted.has(t.id));
  if (tasks.length === 0) fail('No tasks selected');
  const reps = Number(f.reps ?? 3);
  const base = git(['rev-parse', f.base ?? repo.base], repo.path);
  const settings = hookSettings(resolve(f['plugin-root'] ?? join(repoRoot, 'plugins', 'archdraw')));
  const logDir = join(dir, 'logs');
  mkdirSync(logDir, { recursive: true });
  const resultsFile = join(dir, f.out ?? 'results.jsonl');

  // --resume skips runs already in the results file (e.g. after a usage limit).
  const done = new Set(
    f.resume && existsSync(resultsFile)
      ? readFileSync(resultsFile, 'utf8').split('\n').filter(Boolean).map((l) => { const r = JSON.parse(l) as RunRecord; return `${r.task}.${r.arm}.${r.rep}`; })
      : [],
  );
  // Arms interleave so drift (model load, server cache) hits both alike.
  const jobs = tasks
    .flatMap((task) => Array.from({ length: reps }, (_, rep) => arms.map((arm) => ({ task, arm, rep }))))
    .flat()
    .filter((job) => !done.has(`${job.task.id}.${job.arm}.${job.rep}`));
  console.log(`${jobs.length} runs (${tasks.length} tasks × ${reps} reps × ${arms.join('/')}${done.size ? `, ${done.size} already done` : ''}) on ${base.slice(0, 8)} → ${resultsFile}`);
  const concurrency = Math.max(1, Number(f.concurrency ?? 2));
  let next = 0;
  let limited: string | null = null;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < jobs.length && !limited) {
      const job = jobs[next++];
      await runOne({
        repoName: name, repo, ...job, base, binding, settings, model: f.model ?? null,
        budget: f['max-budget-usd'] ?? '2', hide: f.hide ? f.hide.split(',') : [], resultsFile, logDir,
      }).catch((error) => {
        if (error instanceof UsageLimitError) limited = error.message;
        else console.error(`✗ ${job.task.id} [${job.arm}] #${job.rep}: ${error instanceof Error ? error.message : error}`);
      });
    }
  }));
  if (limited) {
    console.error(`\n✗ Stopped: ${limited}\n  Rerun the same command with --resume when the limit resets.\n`);
    process.exitCode = 2;
  }
  if (existsSync(resultsFile)) report(name, f);
}

// ── report ───────────────────────────────────────────────────────────────

const pct = (v: number | null) => (v === null ? '–' : `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`);

function report(name: string, f: Record<string, string>) {
  const file = join(repoDir(name), f.out ?? f.file ?? 'results.jsonl');
  if (!existsSync(file)) fail(`No results at ${file}`);
  const records = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as RunRecord);
  const byTask = new Map<string, RunRecord[]>();
  for (const r of records) byTask.set(r.task, [...(byTask.get(r.task) ?? []), r]);
  const rows: string[] = [
    '| Task | Kind | Pass off → on | Median cost off → on | Δ cost | Δ calls | Calls to target off → on | Map upkeep (wt) |',
    '|---|---|---|---|---|---|---|---|',
  ];
  const total = { off: [] as RunRecord[], on: [] as RunRecord[] };
  for (const [task, list] of byTask) {
    const off = summarizeArm(list.filter((r) => r.arm === 'off'));
    const on = summarizeArm(list.filter((r) => r.arm === 'on'));
    total.off.push(...list.filter((r) => r.arm === 'off'));
    total.on.push(...list.filter((r) => r.arm === 'on'));
    const cost = (s: typeof off) => (s.medianCostUsd !== null ? `$${s.medianCostUsd.toFixed(3)}` : `${Math.round(s.medianWeightedTokens / 1000)}k`);
    const deltaCost = relativeChange(off.medianCostUsd ?? off.medianWeightedTokens, on.medianCostUsd ?? on.medianWeightedTokens);
    rows.push(`| ${task} | ${list[0].kind} | ${off.passed}/${off.runs} → ${on.passed}/${on.runs} | ${cost(off)} → ${cost(on)} | ${pct(deltaCost)} | ${pct(relativeChange(off.medianApiCalls, on.medianApiCalls))} | ${off.medianCallsBeforeTarget ?? '–'} → ${on.medianCallsBeforeTarget ?? '–'} | ${Math.round(on.meanMapUpkeepTokens / 1000)}k |`);
  }
  const off = summarizeArm(total.off);
  const on = summarizeArm(total.on);
  const sum = (list: RunRecord[]) => list.reduce((s, r) => s + (r.metrics.costUsd ?? 0), 0);
  rows.push('');
  rows.push(`All runs: pass ${off.passed}/${off.runs} → ${on.passed}/${on.runs}; total cost $${sum(total.off).toFixed(2)} → $${sum(total.on).toFixed(2)} (${pct(relativeChange(sum(total.off), sum(total.on)))}); median calls ${off.medianApiCalls} → ${on.medianApiCalls}; mean searches ${off.meanLocate.toFixed(1)} → ${on.meanLocate.toFixed(1)}.`);
  console.log(`\n${rows.join('\n')}\n`);
}

const [command, ...rest] = process.argv.slice(2);
const f = flags(rest);
if (!f.repo) fail('Usage: run.ts setup|run|report --repo <name> (see the header comment)');
const commands: Record<string, (name: string, f: Record<string, string>) => unknown> = { setup, run, report };
const handler = commands[command] ?? fail(`Unknown command "${command}"`);
Promise.resolve(handler(f.repo, f)).catch((error) => fail(error instanceof Error ? error.message : String(error)));
