// Ask the user's own Claude Code (`claude -p`, read-only tools) to read the
// repository and draw an accurate architecture map. The folder scan is only a
// starting point; Claude analyses what the code does and how the parts talk,
// and backs every edge with the code that proves it. The answer is checked
// against the repository (`checkMapping`) and sent back once with the problems
// found (`repairPrompt`). Runs on this machine with the user's Claude
// account; only the resulting diagram and paths are sent, never the evidence.

import { spawn } from 'node:child_process';

export const MAP_TIMEOUT_MS = 8 * 60 * 1000;

const READ_ONLY = 'Use only Read, Grep and Glob. Do not modify anything.';

/** How to analyse a codebase before drawing it. Shared by both prompts. */
const ANALYSIS = [
  'Accuracy matters more than polish: every box, edge and path must be true to the code. Work through these steps before you answer.',
  'Work efficiently: you have about 6 minutes. Search the whole repository with Grep (one pattern per kind of boundary, e.g.',
  '`fetch\\(|axios|requests\\.`) and Glob instead of opening files one by one; open only manifests, entry points and the files your searches point to.',
  '',
  'Step 1 — Find what runs. Read the README and every manifest (package.json, pyproject.toml, go.mod, Cargo.toml, pom.xml, …) and the run/deploy files',
  '(Dockerfile, docker-compose, Procfile, vercel.json, serverless or terraform files, CI workflows). List the processes that really run: web or API servers,',
  'frontends, workers, scheduled jobs, CLIs, pipelines. Find each one’s entry point (main file, server start, route or job registration).',
  '',
  'Step 2 — Trace the code. From each entry point follow imports and calls into the modules that do the work. Grep for the boundaries between parts:',
  '- HTTP: route definitions, and the clients that call them (fetch/axios/requests to internal URLs or API paths).',
  '- Queues and events: publish/enqueue and subscribe/consume calls, topic and queue names.',
  '- Data: database clients and ORMs (Prisma, SQLAlchemy, Mongoose, …), caches, files and buckets read or written, and who reads vs who writes.',
  '- Third parties: SDK imports and API base URLs (Stripe, OpenAI, S3, …) and the env vars that configure them.',
  'For each connection note the file and line that proves it.',
  '',
  'Step 3 — Group into components. A component has one job and other parts talk to it (a service, an app, a worker, a pipeline stage).',
  'Name it for what it does, not for its folder. Merge small helpers into the component they serve; shared libraries go in the component that uses them most.',
  'Tests, fixtures, docs and build config belong to the component they test or build, never a box of their own.',
  '',
  'Step 4 — Check before you answer:',
  '- every edge is a call, import, request, queue message or read/write you saw in the code; no edges from names or guesses;',
  '- the direction is the way data moves (producer → consumer, caller → callee);',
  '- every path in the JSON exists (Glob it) and together the paths cover all source code;',
  '- data stores and external services appear only if the code really talks to them;',
  '- nothing from step 1 that runs is missing.',
];

/** The answer format both prompts share (the JSON part). */
const JSON_BLOCK = (ids) => [
  `2. \`\`\`json — {"paths": {...}, "evidence": {...}}.`,
  `   "paths" maps every ${ids} to the repo-relative folders or files it owns, as globs like "src/api/**" or exact files. External services get [].`,
  '   "evidence" maps every edge, written "from -> to", to the code that proves it, at most 15 words:',
  '   `"api -> jobs_queue": "src/api/upload.ts:42 enqueues resize job"`.',
];

export function mappingPrompt(scan) {
  return [
    'Map the architecture of the repository in the current directory for ArchDraw, a live architecture diagram that shows coding agents on the component they work on.',
    READ_ONLY,
    '',
    ...ANALYSIS,
    '',
    'This is the overview (high-level design): readable at a glance, like a whiteboard diagram, but specific to this codebase.',
    'Answer with exactly two fenced code blocks and nothing after them:',
    '1. ```mermaid — `graph LR`, 3–6 `subgraph`s, one per stage or layer, written in the order data flows through the system',
    '   (e.g. sources → ingest → processing → serving), so the diagram reads left to right. External services are the only extra area.',
    '   8–16 components in total (fewer for small repos), ids in snake_case. Merge small helpers into the component they serve.',
    '   Label every component with its name (1–3 plain words) and a short detail line after <br/>: what it is built with or does, at most 5 words,',
    '   e.g. `scene_prep("Scene prep<br/>rasterio · Sentinel-2 L2A")`, `api("REST API<br/>FastAPI · JWT auth")`.',
    '   Each real data store is its own node with its technology: `raw_rasters[("Raw rasters<br/>GeoTIFF on disk")]`, `users_db[("Users<br/>Postgres")]`.',
    '   Put each data store in the stage that writes it. Never make an area that only collects data stores, helpers or "shared" code:',
    '   things used by several stages go in the stage of their main user.',
    '   Third-party services (Stripe, OpenAI, a cloud bucket, a public API, …) are nodes in one "External" subgraph, labelled the same way.',
    '   Edges: the main calls and data flow only, at most about 1.5 per component, pointing the way data moves (producer → consumer)',
    '   so most of them run left to right. At most one direction between two components. An orchestrator or runner connects to the',
    '   first component it starts, not to every stage. Label the edges of the main flow with what moves, 1–3 words:',
    '   `scene_prep -->|"scene tiles"| model`. Leave obvious edges unlabelled.',
    ...JSON_BLOCK('component id'),
    '',
    'A quick folder scan found this. It is a rough starting point drawn from folder names and imports, not the truth: improve on it freely.',
    '```mermaid',
    scan.mermaid.trim(),
    '```',
  ].join('\n');
}

/**
 * The detailed map: the overview with each component opened up into its
 * parts. Keeps the overview's ids (areas and components become nested
 * boxes), so agents shown on a component stay on its box.
 */
export function detailPrompt(overview) {
  return [
    'Draw the detailed architecture map of the repository in the current directory for ArchDraw.',
    READ_ONLY,
    'Below is the overview map that is already published, with the code each component owns. Read that code: for each component,',
    'open its entry files, follow its imports and calls, and find its main parts and how they hand work to each other and to other components.',
    '',
    ...ANALYSIS,
    '',
    'Answer with exactly two fenced code blocks and nothing after them:',
    '1. ```mermaid — `graph LR` that keeps every overview area subgraph (same id and label) and, inside it,',
    '   turns every component into a nested `subgraph` with the SAME id and label, containing its 2–6 main parts:',
    '   modules, classes, services, jobs or key files. Part ids are `<component_id>__<part>` in snake_case,',
    '   labels are the part name plus a detail line, e.g. `model__trainer("Trainer<br/>train.py · PyTorch Lightning")`.',
    '   A component with a single obvious part stays a plain node with its overview id. Data stores and external services stay single nodes with their overview ids.',
    '   25–60 parts in total. Keep the overview areas in the same order. Edges: the real calls and data flow between parts',
    '   (also across components), at most about 1.5 per part, pointing the way data moves (producer → consumer), at most one',
    '   direction between two parts, labelled with what moves when it is not obvious: `a -->|"masks"| b`.',
    ...JSON_BLOCK('part id AND every component id (parts are more specific than their component)'),
    '',
    'Overview map:',
    '```mermaid',
    overview.mermaid.trim(),
    '```',
    'Code each overview component owns:',
    '```json',
    JSON.stringify(overview.componentPaths ?? {}, null, 2),
    '```',
  ].join('\n');
}

/** The same task again, with the previous answer and what is wrong with it. */
export function repairPrompt(prompt, answer, problems) {
  return [
    prompt,
    '',
    'You already answered this once. Your answer:',
    '<previous_answer>',
    String(answer).trim(),
    '</previous_answer>',
    '',
    'Checking it against the repository found these problems:',
    ...problems.map((problem) => `- ${problem}`),
    '',
    'Look at the code again where needed and fix every problem. Keep what was right.',
    'Answer again in exactly the same format: the two fenced code blocks and nothing after them.',
  ].join('\n');
}

function cleanPaths(paths) {
  const componentPaths = {};
  for (const [id, list] of Object.entries(paths)) {
    if (!Array.isArray(list)) continue;
    const clean = list.filter((p) => typeof p === 'string' && p.trim() && !p.startsWith('/') && !p.includes('..')).map((p) => p.trim().slice(0, 512));
    if (clean.length) componentPaths[id] = clean.slice(0, 50);
  }
  return componentPaths;
}

/**
 * The diagram, component paths and edge evidence from Claude's answer, or
 * null. Accepts `{"paths", "evidence"}` or a bare id → paths object.
 */
export function parseMapping(text) {
  const blocks = [...String(text).matchAll(/```(\w+)?[^\n]*\n([\s\S]*?)```/g)].map((m) => ({ lang: (m[1] || '').toLowerCase(), body: m[2].trim() }));
  const mermaid = blocks.find((b) => b.lang === 'mermaid' || /^(graph|flowchart)\s+(LR|TD|TB|RL|BT)\b/.test(b.body))?.body;
  const json = blocks.find((b) => b.lang === 'json' || b.body.startsWith('{'))?.body;
  if (!mermaid || !json || !/^(graph|flowchart)\s/.test(mermaid)) return null;
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const wrapped = parsed.paths && typeof parsed.paths === 'object' && !Array.isArray(parsed.paths);
  const componentPaths = cleanPaths(wrapped ? parsed.paths : parsed);
  if (Object.keys(componentPaths).length === 0) return null;
  const evidence = {};
  if (wrapped && parsed.evidence && typeof parsed.evidence === 'object') {
    for (const [edge, proof] of Object.entries(parsed.evidence)) {
      const ends = edge.match(/^\s*(\S+?)\s*[-=.]+>\s*(\S+?)\s*$/);
      if (ends && typeof proof === 'string' && proof.trim()) evidence[`${ends[1]} -> ${ends[2]}`] = proof.trim().slice(0, 300);
    }
  }
  return { mermaid: mermaid.replace(/^flowchart\s/, 'graph '), componentPaths, evidence };
}

// ── Checking an answer against the repository ────────────────────────────

const ID = '[A-Za-z_][\\w-]*';
const SHAPE_OPEN = /^(\[\(|\(\(|\[\[|\{\{|\[\/|\[\\|\[|\(|\{|>)/;
const ARROW = /\s*(?:<?-{2,}>|<?={2,}>|-\.+->|-{3,}|={3,}|-\.+-|~~~)\s*(?:\|[^|]*\|\s*)?/;

/** Drop node bodies (`["…"]`, `("…")`, …) and edge labels so only ids and arrows remain. */
function stripBodies(line) {
  return line
    .replace(/\|[^|]*\|/g, ' ')
    .replace(/"[^"]*"/g, '""')
    .replace(/(\[\(|\(\(|\[\[|\{\{|\[|\(|\{)[^\]\)\}]*(\)\]|\)\)|\]\]|\}\}|\]|\)|\})/g, '');
}

/**
 * Ids, areas and edges of a Mermaid `graph`. Good enough for maps Claude
 * writes (one statement per line, `a --> b`, `a -->|"x"| b`, chains, `&`).
 * `undeclared` lists ids used by edges but never given a label.
 */
export function readMermaid(mermaid) {
  const nodes = new Map(); // id → { store, area }
  const areas = new Map(); // id → label
  const edges = [];
  const used = new Set();
  const stack = [];
  const idOnly = new RegExp(`^${ID}$`);
  for (const raw of String(mermaid).split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('%%') || /^(graph|flowchart)\s/.test(line) || /^(classDef|class|style|linkStyle|click)\s/.test(line)) continue;
    const sub = line.match(new RegExp(`^subgraph\\s+(${ID})\\s*(?:\\[\\s*"?([^"\\]]*)"?\\s*\\])?`));
    if (sub) {
      areas.set(sub[1], sub[2] ?? sub[1]);
      stack.push(sub[1]);
      continue;
    }
    if (line === 'end') {
      stack.pop();
      continue;
    }
    const area = stack.at(-1) ?? null;
    // Quoted label text can hold anything ("rasterio (x)"); ids never do.
    const bare = line.replace(/"[^"]*"/g, '""');
    for (const m of bare.matchAll(new RegExp(`(?:^|[\\s&>|-])(${ID})(?=\\s*(\\[\\(|\\(\\(|\\[\\[|\\{\\{|\\[|\\(|\\{|>))`, 'g'))) {
      if (!nodes.has(m[1])) nodes.set(m[1], { store: m[2] === '[(', area });
    }
    const parts = stripBodies(bare).split(ARROW).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const ids = parts.map((p) => p.split('&').map((x) => x.trim()).filter((x) => idOnly.test(x)));
      for (let i = 0; i + 1 < ids.length; i++) {
        for (const from of ids[i]) for (const to of ids[i + 1]) edges.push({ from, to });
      }
      for (const group of ids) for (const id of group) used.add(id);
    } else if (!SHAPE_OPEN.test(line) && idOnly.test(line)) {
      if (!nodes.has(line)) nodes.set(line, { store: false, area });
    }
  }
  const undeclared = [...used].filter((id) => !nodes.has(id) && !areas.has(id));
  return { nodes, areas, edges, undeclared };
}

// Repo-relative glob match, same rules as the server (frontend pathMatcher):
// a plain path matches the file or everything under it; `**` crosses folders.
function compilePattern(raw) {
  const pattern = raw.trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '');
  if (!pattern) return null;
  if (!/[*?]/.test(pattern)) {
    const dir = pattern.replace(/\/+$/, '');
    return (path) => path === dir || path.startsWith(`${dir}/`);
  }
  const source = pattern
    .split(/(\*\*\/|\*\*|\*|\?)/)
    .map((part) => ({ '**/': '(?:.*/)?', '**': '.*', '*': '[^/]*', '?': '[^/]' })[part] ?? part.replace(/[.+^${}()|[\]\\]/g, '\\$&'))
    .join('');
  const re = new RegExp(`^${source}$`);
  return (path) => re.test(path);
}

const SOURCE_EXT = /\.(m?[jt]sx?|cjs|py|go|rs|java|kt|kts|scala|rb|php|cs|swift|m|mm|c|cc|cpp|h|hpp|ex|exs|erl|clj|dart|lua|vue|svelte|astro|sql|prisma|graphql|proto|tf|sh)$/i;
const NOT_SOURCE = /(^|\/)(node_modules|dist|build|out|coverage|vendor|\.next|\.git|__snapshots__|fixtures?|migrations)(\/|$)|\.(d\.ts|min\.js|lock)$/i;
const MAX_PROBLEMS = 25;

function topFolder(path, depth = 2) {
  const parts = path.split('/');
  return parts.length > depth ? `${parts.slice(0, depth).join('/')}/` : parts.length > 1 ? `${parts.slice(0, -1).join('/')}/` : path;
}

/**
 * Problems with a parsed answer, checked against the repository's files:
 * edges to unknown ids, paths for ids not on the diagram, components with no
 * code, paths that match no file, uncovered source code, edges without
 * evidence and, for the detailed map, overview ids that went missing.
 * Returns plain sentences, at most 25, ready for `repairPrompt`.
 */
export function checkMapping(mapping, files, { requiredIds = [], minCoverage = 0.85 } = {}) {
  const problems = [];
  const { nodes, areas, edges, undeclared } = readMermaid(mapping.mermaid);
  const known = new Set([...nodes.keys(), ...areas.keys()]);
  const externalArea = [...areas].find(([id, label]) => /extern|third.?party/i.test(`${id} ${label}`))?.[0];
  const isExternal = (id) => externalArea !== undefined && nodes.get(id)?.area === externalArea;

  for (const id of undeclared) {
    problems.push(`An edge uses "${id}", which is never declared with a label. Declare it or fix the id.`);
  }
  for (const id of requiredIds) {
    if (!known.has(id)) problems.push(`Overview id "${id}" is missing. Keep every overview area and component id.`);
  }
  for (const id of Object.keys(mapping.componentPaths)) {
    if (!known.has(id)) problems.push(`"paths" has "${id}", which is not on the diagram.`);
  }
  for (const [id, info] of nodes) {
    if (info.store || isExternal(id) || mapping.componentPaths[id]) continue;
    problems.push(`Component "${id}" has no paths. Give it the files it owns, or merge it into the component that owns them.`);
  }

  const owned = [];
  for (const [id, list] of Object.entries(mapping.componentPaths)) {
    for (const raw of list) {
      const test = compilePattern(raw);
      if (!test) continue;
      if (files.some(test)) owned.push(test);
      else problems.push(`Path "${raw}" of "${id}" matches no file in the repository. Glob for the real location.`);
    }
  }
  const source = files.filter((f) => SOURCE_EXT.test(f) && !NOT_SOURCE.test(f));
  const uncovered = source.filter((f) => !owned.some((test) => test(f)));
  if (source.length >= 5 && uncovered.length / source.length > 1 - minCoverage) {
    const byFolder = new Map();
    for (const f of uncovered) byFolder.set(topFolder(f), (byFolder.get(topFolder(f)) ?? 0) + 1);
    const top = [...byFolder].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([dir, n]) => `${dir} (${n} files)`);
    problems.push(`The paths cover only ${Math.round((1 - uncovered.length / source.length) * 100)}% of the source files. Not covered: ${top.join(', ')}. Give this code to the components that own it.`);
  }

  const evidence = mapping.evidence ?? {};
  const fileSet = new Set(files);
  for (const edge of edges) {
    const proof = evidence[`${edge.from} -> ${edge.to}`];
    if (!proof) {
      problems.push(`Edge ${edge.from} --> ${edge.to} has no evidence. Find the call or data flow in the code, or remove the edge.`);
      continue;
    }
    // The proof starts with the file it cites: "src/api/upload.ts:42 enqueues …".
    const cited = proof.match(/^`?([\w@.-][\w@./-]*\.[A-Za-z0-9]+)(?=[:`\s#]|$)/)?.[1];
    if (cited && !fileSet.has(cited) && !files.some((f) => f.endsWith(`/${cited}`))) {
      problems.push(`The evidence for ${edge.from} --> ${edge.to} cites "${cited}", which does not exist. Check the edge in the code.`);
    }
  }
  return problems.length > MAX_PROBLEMS ? [...problems.slice(0, MAX_PROBLEMS), `…and ${problems.length - MAX_PROBLEMS} more of the same kinds.`] : problems;
}

/**
 * How Claude is started. `--tools` makes only the read-only tools exist
 * (`--allowedTools` alone just skips their prompts; user settings could still
 * allow Bash). Sonnet at medium effort reads a repo in minutes; the default
 * model at high effort can think for longer than the whole time budget.
 */
export const CLAUDE_ARGS = ['--tools', 'Read,Grep,Glob', '--allowedTools', 'Read,Grep,Glob', '--model', 'sonnet', '--effort', 'medium', '--output-format', 'text'];
/** For Claude Code versions without `--tools` / `--effort`. */
export const CLAUDE_ARGS_BASIC = ['--allowedTools', 'Read,Grep,Glob', '--output-format', 'text'];

function runOnce(root, prompt, args, { onTick, timeoutMs, command }) {
  return new Promise((resolvePromise) => {
    let child;
    try {
      // Own process group, so a timeout also stops the tools Claude started
      // (they keep the output pipe open and would hold the CLI otherwise).
      child = spawn(command, ['-p', prompt, ...args], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    } catch {
      resolvePromise({ ok: false, reason: 'Claude Code could not be started.' });
      return;
    }
    const stop = (signal) => {
      try {
        process.kill(-child.pid, signal);
      } catch {
        child.kill(signal);
      }
    };
    let out = '';
    let err = '';
    const started = Date.now();
    const ticker = setInterval(() => onTick?.(Math.round((Date.now() - started) / 1000)), 1000);
    // Claude Code may exit with a code of its own when stopped, so remember why.
    let timedOut = false;
    let killer;
    const timer = setTimeout(() => {
      timedOut = true;
      stop('SIGTERM');
      killer = setTimeout(() => stop('SIGKILL'), 5000);
    }, timeoutMs);
    const done = (result) => {
      clearInterval(ticker);
      clearTimeout(timer);
      clearTimeout(killer);
      resolvePromise(result);
    };
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', () => done({ ok: false, reason: 'Claude Code is not installed (npm install -g @anthropic-ai/claude-code).' }));
    child.on('close', (code, signal) => {
      if (signal || timedOut) done({ ok: false, reason: 'Claude took too long; kept the quick map.' });
      else if (code !== 0) done({ ok: false, reason: (err.trim().split('\n').pop() || `Claude exited with code ${code}`).slice(0, 300), stderr: err });
      else done({ ok: true, text: out });
    });
  });
}

/**
 * Run `claude -p` in `root` with read-only tools. Resolves { ok, text } or
 * { ok: false, reason }. `onTick(seconds)` is called every second while it runs.
 */
export async function runClaudeMapping(root, prompt, { onTick, timeoutMs = MAP_TIMEOUT_MS, command = 'claude' } = {}) {
  const result = await runOnce(root, prompt, CLAUDE_ARGS, { onTick, timeoutMs, command });
  if (!result.ok && /unknown option|unrecognized|invalid (model|effort)/i.test(result.stderr ?? '')) {
    return runOnce(root, prompt, CLAUDE_ARGS_BASIC, { onTick, timeoutMs, command });
  }
  delete result.stderr;
  return result;
}

/**
 * Ask Claude for a map, check it against the repository and, if it has
 * problems, ask once more with them listed. Resolves { ok, mapping,
 * problems } with the better of the two answers, or { ok: false, reason }.
 */
export async function mapAndCheck(root, prompt, files, { onTick, onRepair, run = runClaudeMapping, requiredIds } = {}) {
  const first = await run(root, prompt, { onTick });
  if (!first.ok) return first;
  const mapping = parseMapping(first.text);
  const problems = mapping ? checkMapping(mapping, files, { requiredIds }) : ['The answer did not contain the mermaid block and the JSON block in the format asked for.'];
  if (problems.length === 0) return { ok: true, mapping, problems };
  onRepair?.(problems);
  const second = await run(root, repairPrompt(prompt, first.text, problems), { onTick });
  const repaired = second.ok ? parseMapping(second.text) : null;
  const left = repaired ? checkMapping(repaired, files, { requiredIds }) : null;
  if (repaired && (!mapping || left.length <= problems.length)) return { ok: true, mapping: repaired, problems: left };
  if (mapping) return { ok: true, mapping, problems };
  return { ok: false, reason: second.ok ? 'Claude answered without a usable diagram.' : second.reason };
}
