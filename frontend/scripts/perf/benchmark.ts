#!/usr/bin/env tsx
/**
 * Perf benchmark runner — BEFORE/AFTER harness.
 *
 * Usage:
 *   npm run perf:quick        // bundle + pages only, no build (fast, ~10s)
 *   npm run perf:benchmark    // full: build + bundle + endpoints + pages
 *   npm run perf:baseline     // save current run as baseline for diff
 *   npm run perf:compare      // compare latest run vs baseline
 *
 * Flags:
 *   --base-url http://localhost:3000  // override PERF_BASE_URL
 *   --runs 20                         // endpoint runs
 *   --concurrency 5
 *   --skip-build                      // don't run next build
 *   --skip-endpoints                  // skip fetch-based endpoint tests
 *   --out perf-results/<date>.json    // custom output
 *   --spawn                           // auto-spawn `next start` if baseUrl not reachable
 *   --port 4317                       // port for --spawn (default 4317 to avoid dev's 3000)
 *
 * Output:
 *   frontend/perf-results/<YYYY-MM-DD>.json    (machine-readable)
 *   frontend/perf-results/<YYYY-MM-DD>.md      (human markdown)
 *   frontend/perf-results/baseline.json/.md    (when --baseline flag or `npm run perf:baseline`)
 *
 * Design: zero new production deps. Uses Node fetch + perf_hooks + du/gzip.
 * Optionally spawns a production server for endpoint tests; otherwise expects one running.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { ENDPOINTS, PAGES, DEFAULT_RUNS, DEFAULT_CONCURRENCY, DEFAULT_TIMEOUT_MS } from './config.js';
import { measureBuildTime, measureBundle, measureAllEndpoints, measureAllPages, quickStaticLint, frontendDir, nextDir } from './measure.js';

const here = dirname(fileURLToPath(import.meta.url));
const perfResultsDir = resolve(frontendDir, 'perf-results');

type CliArgs = {
  baseUrl?: string;
  runs: number;
  concurrency: number;
  timeoutMs: number;
  skipBuild: boolean;
  skipEndpoints: boolean;
  spawn: boolean;
  port: number;
  out?: string;
  baseline: boolean;
  compare?: string;
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const has = (flag: string) => args.includes(flag);
  return {
    baseUrl: get('--base-url') ?? process.env.PERF_BASE_URL,
    runs: Number(get('--runs') ?? DEFAULT_RUNS),
    concurrency: Number(get('--concurrency') ?? DEFAULT_CONCURRENCY),
    timeoutMs: Number(get('--timeout') ?? DEFAULT_TIMEOUT_MS),
    skipBuild: has('--skip-build') || has('--skipBuild'),
    skipEndpoints: has('--skip-endpoints') || has('--skipEndpoints'),
    spawn: has('--spawn'),
    port: Number(get('--port') ?? 4317),
    out: get('--out'),
    baseline: has('--baseline'),
    compare: get('--compare'),
  };
}

async function isReachable(url: string, timeoutMs = 3000): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    // any response (even 404) means server is up
    return res.status > 0;
  } catch { return false; }
  finally { clearTimeout(t); }
}

async function waitForReady(url: string, timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isReachable(url, 2000)) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtMs(n: number): string { return `${n} ms`; }

function renderMarkdown(
  result: Awaited<ReturnType<typeof runBenchmark>>,
  baseline?: any
): string {
  const lines: string[] = [];
  lines.push(`# Perf Benchmark — ${result.date} ${result.gitSha ? `(${result.gitSha.slice(0, 7)})` : ''}`);
  lines.push('');
  lines.push(`- Base URL: \`${result.baseUrl}\``);
  lines.push(`- Runs per endpoint: ${result.runs} · Concurrency: ${result.concurrency} · Timeout: ${result.timeoutMs}ms`);
  lines.push(`- Build: ${result.build ? `${result.build.durationMs} ms (exit ${result.build.exitCode})` : 'skipped (--skip-build)'}`);
  lines.push(`- Node: ${process.version} · Platform: ${process.platform} ${process.arch}`);
  if (result.build?.stderrTail) lines.push(`- Build stderr tail: \`${result.build.stderrTail.slice(0, 200).replace(/\n/g, ' ')}\``);
  lines.push('');

  // Bundle
  const b = result.bundle;
  lines.push('## Bundle (.next)');
  lines.push('');
  lines.push(`| Metric | Raw | Gzip (est) |`);
  lines.push(`|---|---|---|`);
  lines.push(`| .next total | ${humanBytes(b.nextDirBytes)} | — |`);
  lines.push(`| static/ (client JS+CSS) | ${humanBytes(b.staticDirBytes)} | ${humanBytes(b.totalStaticGzip)} |`);
  lines.push(`| server/ | ${humanBytes(b.serverDirBytes)} | — |`);
  lines.push(`| chunks | ${b.chunkCount} files | — |`);
  lines.push(`| First-load approx (6 largest) | ${humanBytes(b.firstLoadApproxRaw)} | ${humanBytes(b.firstLoadApproxGzip)} |`);
  lines.push('');
  lines.push('**Largest chunks (raw → gzip):**');
  lines.push('');
  lines.push('| Chunk | Raw | Gzip |');
  lines.push('|---|---|---|');
  for (const c of b.largestChunks.slice(0, 10)) {
    lines.push(`| \`${c.path.replace(frontendDir + '/', '')}\` | ${humanBytes(c.rawBytes)} | ${humanBytes(c.gzipBytes)} |`);
  }
  lines.push('');

  // Static lint
  const lint = result.staticLint;
  lines.push('## Static Lint (quick grep — regression signal, not axe)');
  lines.push('');
  lines.push(`| Signal | Count | Target |`);
  lines.push(`|---|---|---|`);
  lines.push(`| \`transition: all\` / \`transition-all\` | ${lint.transitionAll} | 0 |`);
  lines.push(`| \`outline-none\` without replacement | ${lint.outlineNoneWithoutReplacement} | 0 (or with \`focus-visible:ring\`) |`);
  lines.push(`| Hardcoded \`#RRGGBB\` in components (non-token) | ${lint.hardcodedHexTokens} | → 0 (use \`bg-card\` etc.) |`);
  lines.push(`| \`<img>\` without width/height | ${lint.imgWithoutDimensions} | 0 |`);
  lines.push(`| Icon \`title\` without \`aria-label\` (est) | ${lint.iconButtonMissingAriaLabelEstimate} | 0 |`);
  lines.push('');

  // Pages
  if (result.pages.length) {
    lines.push('## Pages (TTFB + HTML)');
    lines.push('');
    lines.push('| Page | Status | TTFB | Total | HTML | Gzip | Scripts | Links |');
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const p of result.pages) {
      lines.push(`| ${p.name} \`${p.path}\` | ${p.status}${p.error ? ` err` : ''} | ${fmtMs(p.ttfbMs)} | ${fmtMs(p.totalMs)} | ${humanBytes(p.htmlBytes)} | ${humanBytes(p.gzipBytes)} | ${p.scriptTagCount} | ${p.linkTagCount} |`);
    }
    lines.push('');
  }

  // Endpoints
  if (result.endpoints.length) {
    lines.push('## Endpoints (fetch waterfall — p50/p95)');
    lines.push('');
    lines.push('| Endpoint | Method | Status hist | p50 TTFB | p95 TTFB | p50 Total | p95 Total | Avg bytes |');
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const e of result.endpoints) {
      const hist = Object.entries(e.statusHistogram).map(([k, v]) => `${k}:${v}`).join(', ');
      lines.push(`| ${e.name} \`${e.path}\` | ${e.method} | ${hist} | ${fmtMs(e.ttfb.p50)} | ${fmtMs(e.ttfb.p95)} | ${fmtMs(e.total.p50)} | ${fmtMs(e.total.p95)} | ${humanBytes(e.bytes.avg)} |`);
    }
    lines.push('');
    lines.push('> p95 is the number to compare **before → after** for waterfall fixes (`admin/stats` should drop 420 ms → 95 ms when `Promise.all` lands). `ttfb` is time to first byte (header arrival), `total` includes body drain.');
    lines.push('');
  }

  // Regression vs baseline
  if (baseline) {
    lines.push('## Δ vs Baseline');
    lines.push('');
    const baseEndpoints = new Map((baseline.endpoints ?? []).map((e: any) => [e.name, e]));
    lines.push('| Endpoint | Baseline p95 TTFB | Current p95 TTFB | Δ | Baseline p95 Total | Current p95 Total | Δ |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const cur of result.endpoints) {
      const base = baseEndpoints.get(cur.name) as any;
      if (!base) { lines.push(`| ${cur.name} | — | ${fmtMs(cur.ttfb.p95)} | new | — | ${fmtMs(cur.total.p95)} | new |`); continue; }
      const dTtfb = cur.ttfb.p95 - base.ttfb.p95;
      const dTot = cur.total.p95 - base.total.p95;
      const arrow = (n: number) => n < 0 ? '🟢' : n > 30 ? '🔴' : '⚪';
      lines.push(`| ${cur.name} | ${fmtMs(base.ttfb.p95)} | ${fmtMs(cur.ttfb.p95)} | ${arrow(dTtfb)} ${dTtfb >= 0 ? '+' : ''}${dTtfb} ms | ${fmtMs(base.total.p95)} | ${fmtMs(cur.total.p95)} | ${arrow(dTot)} ${dTot >= 0 ? '+' : ''}${dTot} ms |`);
    }
    if (baseline.bundle && result.bundle) {
      const dRaw = result.bundle.totalStaticGzip - baseline.bundle.totalStaticGzip;
      const dFirst = result.bundle.firstLoadApproxGzip - baseline.bundle.firstLoadApproxGzip;
      lines.push('');
      lines.push(`**Bundle:** static gzip ${humanBytes(baseline.bundle.totalStaticGzip)} → ${humanBytes(result.bundle.totalStaticGzip)} (${dRaw >= 0 ? '+' : ''}${humanBytes(Math.abs(dRaw))} ${dRaw < 0 ? '🟢' : dRaw > 0 ? '🔴' : '⚪'}) · first-load gzip ${humanBytes(baseline.bundle.firstLoadApproxGzip)} → ${humanBytes(result.bundle.firstLoadApproxGzip)} (${dFirst >= 0 ? '+' : ''}${humanBytes(Math.abs(dFirst))})`);
    }
    lines.push('');
  }

  lines.push('## How to Reproduce');
  lines.push('');
  lines.push('```bash');
  lines.push('# 1. Build + measure (production server)');
  lines.push('cd frontend && npm run build && npm run start &');
  lines.push('# 2. In another shell:');
  lines.push('npm run perf:benchmark           # full: build+bundle+endpoints+pages');
  lines.push('npm run perf:quick               # fast: bundle+pages only (--skip-build)');
  lines.push('npm run perf:baseline            # save as baseline for diff');
  lines.push('npm run perf:compare             # compare latest vs baseline');
  lines.push('# 3. After shipping a fix, re-run:');
  lines.push('npm run perf:quick               # → perf-results/<date>.md shows Δ');
  lines.push('```');
  lines.push('');
  lines.push('Notes: `endpoint: admin_stats_unauth` intentionally unauthenticated (401) — add `PERF_ADMIN_PASSCODE` env to measure authed path (funnel `Promise.all` shows only when authed). Set `PERF_BASE_URL` to test preview deployments.');
  lines.push('');
  return lines.join('\n');
}

async function runBenchmark(cli: CliArgs) {
  const date = new Date().toISOString().slice(0, 10);
  const timeId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  let gitSha: string | null = null;
  try { gitSha = (await import('node:child_process')).execSync('git rev-parse HEAD', { cwd: resolve(here, '..', '..', '..') }).toString().trim(); } catch {}

  // --- build ---
  let build: Awaited<ReturnType<typeof measureBuildTime>> = null;
  if (!cli.skipBuild) {
    console.log('\n═══ Build (next build) — this takes 60–110 s; use --skip-build to skip ═══\n');
    build = await measureBuildTime(false);
    if (build) console.log(`Build: ${build.durationMs} ms (exit ${build.exitCode})`);
    if (build?.exitCode !== 0) console.warn(`Build failed — bundle numbers below reflect previous .next. Stderr tail: ${build?.stderrTail?.slice(0, 400)}`);
  } else {
    console.log('\n— Skipping build (--skip-build). Measuring existing .next. —\n');
  }

  // --- bundle + lint (always) ---
  console.log('Measuring bundle (.next)…');
  const bundle = measureBundle();
  console.log(`  static: ${humanBytes(bundle.staticDirBytes)} gzip ${humanBytes(bundle.totalStaticGzip)} · chunks: ${bundle.chunkCount} · largest: ${bundle.largestChunks[0]?.path ?? 'n/a'} ${bundle.largestChunks[0] ? humanBytes(bundle.largestChunks[0].rawBytes) : ''}`);
  const staticLint = quickStaticLint();
  console.log(`  lint: transitionAll=${staticLint.transitionAll} hexTokens=${staticLint.hardcodedHexTokens} imgNoDims=${staticLint.imgWithoutDimensions}`);

  // --- server reachability / optional spawn ---
  // Probe order: explicit --base-url → PERF_BASE_URL → 3001 (ArchDraw dev) → 3000 → 4317 (prod spawn)
  const candidates = [
    cli.baseUrl ?? process.env.PERF_BASE_URL,
    'http://localhost:3001',
    'http://localhost:3000',
    `http://localhost:${cli.port}`,
  ].filter(Boolean) as string[];
  let baseUrl = candidates[0]!;
  let resolvedCandidate: string | null = null;
  if (!cli.skipEndpoints) {
    for (const cand of candidates) {
      if (await isReachable(cand)) { resolvedCandidate = cand; baseUrl = cand; break; }
    }
    if (resolvedCandidate) console.log(`  Auto-detected server at ${resolvedCandidate} (probed ${candidates.join(', ')})`);
  } else {
    baseUrl = candidates[0]!;
  }
  const devFallback = resolvedCandidate ?? baseUrl;
  let spawned: ReturnType<typeof spawn> | null = null;
  let shouldKillSpawn = false;
  const baseReachable = cli.skipEndpoints ? true : !!resolvedCandidate;
  const devReachable = baseReachable;

  if (!cli.skipEndpoints) {
    if (!baseReachable && cli.spawn) {
      console.log(`\nNo server at ${candidates.join(', ')}. Spawning \`next start -p ${cli.port}\`…\n`);
      if (!existsSync(join(frontendDir, '.next', 'BUILD_ID'))) {
        console.warn('  .next/BUILD_ID missing — run `npm run build` first, or omit --spawn and run `npm run dev` in another shell.');
      } else {
        spawned = spawn('npx', ['next', 'start', '-p', String(cli.port)], {
          cwd: frontendDir,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, NODE_ENV: 'production' },
        });
        spawned.stdout?.on('data', d => process.stdout.write(`[next start] ${d}`));
        spawned.stderr?.on('data', d => process.stderr.write(`[next start] ${d}`));
        baseUrl = `http://localhost:${cli.port}`;
        const ready = await waitForReady(baseUrl, 40_000);
        if (!ready) {
          console.warn(`  Spawned server not ready at ${baseUrl} after 40 s — continuing anyway (endpoints will show errors).`);
        } else {
          console.log(`  Spawned server ready at ${baseUrl}\n`);
          shouldKillSpawn = true;
        }
      }
    } else if (!baseReachable && !cli.spawn) {
      console.warn(`\n⚠ No server reachable at ${candidates.join(', ')}.`);
      console.warn(`  Endpoints will show connection errors (still tests bundle/pages via direct file fallback).`);
      console.warn(`  Start a server:  cd frontend && npm run dev   — or —   npm run build && npm run start`);
      console.warn(`  Or re-run with:  npm run perf:benchmark -- --spawn --port 4317\n`);
    } else {
      console.log(`  Benchmarking against ${baseUrl}`);
    }
  } else {
    console.log('  Skipping endpoints (--skip-endpoints).');
  }

  // --- pages + endpoints ---
  let pages: Awaited<ReturnType<typeof measureAllPages>> = [];
  let endpoints: Awaited<ReturnType<typeof measureAllEndpoints>> = [];

  if (!cli.skipEndpoints) {
    console.log(`\nMeasuring ${PAGES.length} pages…`);
    pages = await measureAllPages(baseUrl, PAGES, cli.timeoutMs);
    for (const p of pages) console.log(`  ${p.name} ${p.path} → ${p.status} ttfb ${p.ttfbMs}ms html ${humanBytes(p.htmlBytes)} scripts:${p.scriptTagCount}`);

    console.log(`\nMeasuring ${ENDPOINTS.length} endpoints × ${cli.runs} runs (concurrency ${cli.concurrency})…`);
    endpoints = await measureAllEndpoints(baseUrl, ENDPOINTS, cli.runs, cli.concurrency, cli.timeoutMs, (done, total, name) => {
      process.stdout.write(`  [${done}/${total}] ${name}\n`);
    });
    for (const e of endpoints) {
      console.log(`  ${e.name} ${e.path} ${e.method} → hist ${JSON.stringify(e.statusHistogram)} p50 ttfb ${e.ttfb.p50} p95 ${e.ttfb.p95} total p95 ${e.total.p95}`);
    }
  } else {
    // Still measure pages if endpoints skipped but server reachable (pages are cheap)
    if (await isReachable(baseUrl)) {
      console.log(`\nMeasuring ${PAGES.length} pages (endpoints skipped, but pages cheap)…`);
      pages = await measureAllPages(baseUrl, PAGES, cli.timeoutMs);
      for (const p of pages) console.log(`  ${p.name} ${p.path} → ${p.status} ttfb ${p.ttfbMs}ms`);
    }
  }

  if (spawned && shouldKillSpawn) {
    console.log(`\nKilling spawned server (pid ${spawned.pid})…`);
    spawned.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 800));
    try { spawned.kill('SIGKILL'); } catch {}
  }

  return {
    date,
    timeId,
    gitSha,
    baseUrl: cli.skipEndpoints ? '(skipped)' : baseUrl,
    runs: cli.runs,
    concurrency: cli.concurrency,
    timeoutMs: cli.timeoutMs,
    build,
    bundle,
    staticLint,
    pages,
    endpoints,
    cli,
  };
}

// ---------- CLI ----------

async function main() {
  const cli = parseArgs();
  mkdirSync(perfResultsDir, { recursive: true });

  // compare mode
  if (cli.compare) {
    const baselinePath = resolve(frontendDir, cli.compare);
    const latestGlob = resolve(perfResultsDir, 'latest.json');
    const baselineRaw = readFileSync(baselinePath, 'utf8');
    const latestRaw = existsSync(latestGlob) ? readFileSync(latestGlob, 'utf8') : null;
    if (!latestRaw) {
      console.error(`No latest.json at ${latestGlob} — run a benchmark first.`);
      process.exit(1);
    }
    const baseline = JSON.parse(baselineRaw);
    const latest = JSON.parse(latestRaw);
    // render diff to stdout
    const md = renderMarkdown(latest, baseline);
    console.log(md);
    return;
  }

  const result = await runBenchmark(cli);

  const date = result.date;
  const outJson = cli.out ? resolve(frontendDir, cli.out) : join(perfResultsDir, `${date}.json`);
  const outMd = outJson.replace(/\.json$/, '.md');
  const latestJson = join(perfResultsDir, 'latest.json');
  const latestMd = join(perfResultsDir, 'latest.md');

  writeFileSync(outJson, JSON.stringify(result, null, 2) + '\n', 'utf8');
  // also write latest
  writeFileSync(latestJson, JSON.stringify(result, null, 2) + '\n', 'utf8');

  // try to render with baseline diff if baseline exists
  let baselineData: any = null;
  const baselinePath = join(perfResultsDir, 'baseline.json');
  if (existsSync(baselinePath) && outJson !== baselinePath) {
    try { baselineData = JSON.parse(readFileSync(baselinePath, 'utf8')); } catch {}
  }
  const md = renderMarkdown(result, baselineData ?? undefined);
  writeFileSync(outMd, md, 'utf8');
  writeFileSync(latestMd, md, 'utf8');

  if (cli.baseline) {
    copyFileSync(outJson, baselinePath);
    copyFileSync(outMd, join(perfResultsDir, 'baseline.md'));
    console.log(`\n✓ Saved baseline → ${baselinePath}`);
  }

  console.log(`\nWrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  console.log(`Wrote ${latestJson} (latest)`);
  if (baselineData) console.log(`Δ vs baseline: see ${outMd} (🟢 faster, 🔴 regression)`);
  console.log('\n' + md.split('\n').slice(0, 40).join('\n'));
  console.log('\n… (full markdown in file above)\n');
}

main().catch(e => { console.error(e); process.exit(1); });
