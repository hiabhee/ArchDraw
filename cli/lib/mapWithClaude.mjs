// Ask the user's own Claude Code (`claude -p`, read-only tools) to read the
// repository and draw an accurate architecture map. The folder scan is only a
// starting point; Claude understands what the code does. Runs on this machine
// with the user's Claude account; only the resulting diagram is sent.

import { spawn } from 'node:child_process';

export const MAP_TIMEOUT_MS = 8 * 60 * 1000;

export function mappingPrompt(scan) {
  return [
    'Map the architecture of the repository in the current directory for ArchDraw, a live architecture diagram.',
    'Use only Read, Grep and Glob. Do not modify anything.',
    'Read the README, manifests (package.json, pyproject.toml, go.mod, …), entry points and the main folders until you understand what each part does, what it is built with, and what data moves between the parts.',
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
    '2. ```json — an object mapping every component id to the repo-relative folders or files it owns,',
    '   as globs like "src/api/**" or exact files. Together they should cover all source code; external services get [].',
    '',
    'A quick folder scan found this (a rough starting point, improve on it freely):',
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
    'Use only Read, Grep and Glob. Do not modify anything.',
    'Below is the overview map that is already published, with the code each component owns. Read that code.',
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
    '2. ```json — an object mapping every part id AND every component id to the repo-relative files or globs it owns',
    '   (parts are more specific than their component). External services get [].',
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

/** The diagram and component paths from Claude's answer, or null. */
export function parseMapping(text) {
  const blocks = [...String(text).matchAll(/```(\w+)?[^\n]*\n([\s\S]*?)```/g)].map((m) => ({ lang: (m[1] || '').toLowerCase(), body: m[2].trim() }));
  const mermaid = blocks.find((b) => b.lang === 'mermaid' || /^(graph|flowchart)\s+(LR|TD|TB|RL|BT)\b/.test(b.body))?.body;
  const json = blocks.find((b) => b.lang === 'json' || b.body.startsWith('{'))?.body;
  if (!mermaid || !json || !/^(graph|flowchart)\s/.test(mermaid)) return null;
  let paths;
  try {
    paths = JSON.parse(json);
  } catch {
    return null;
  }
  if (!paths || typeof paths !== 'object' || Array.isArray(paths)) return null;
  const componentPaths = {};
  for (const [id, list] of Object.entries(paths)) {
    if (!Array.isArray(list)) continue;
    const clean = list.filter((p) => typeof p === 'string' && p.trim() && !p.startsWith('/') && !p.includes('..')).map((p) => p.trim().slice(0, 512));
    if (clean.length) componentPaths[id] = clean.slice(0, 50);
  }
  if (Object.keys(componentPaths).length === 0) return null;
  return { mermaid: mermaid.replace(/^flowchart\s/, 'graph '), componentPaths };
}

/**
 * Run `claude -p` in `root`. Resolves { ok, text } or { ok: false, reason }.
 * `onTick(seconds)` is called every second while it runs.
 */
export function runClaudeMapping(root, prompt, { onTick, timeoutMs = MAP_TIMEOUT_MS, command = 'claude' } = {}) {
  return new Promise((resolvePromise) => {
    let child;
    try {
      child = spawn(command, ['-p', prompt, '--allowedTools', 'Read,Grep,Glob', '--output-format', 'text'], {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      resolvePromise({ ok: false, reason: 'Claude Code could not be started.' });
      return;
    }
    let out = '';
    let err = '';
    const started = Date.now();
    const ticker = setInterval(() => onTick?.(Math.round((Date.now() - started) / 1000)), 1000);
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', () => {
      clearInterval(ticker);
      clearTimeout(timer);
      resolvePromise({ ok: false, reason: 'Claude Code is not installed (npm install -g @anthropic-ai/claude-code).' });
    });
    child.on('close', (code, signal) => {
      clearInterval(ticker);
      clearTimeout(timer);
      if (signal) resolvePromise({ ok: false, reason: 'Claude took too long; kept the quick map.' });
      else if (code !== 0) resolvePromise({ ok: false, reason: (err.trim().split('\n').pop() || `Claude exited with code ${code}`).slice(0, 300) });
      else resolvePromise({ ok: true, text: out });
    });
  });
}
