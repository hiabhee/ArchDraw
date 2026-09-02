/**
 * Low-level measurement primitives — no heavy deps.
 * - measureBuildTime: walls `next build` via spawn
 * - measureBundle: du + gzip of .next artifacts
 * - measureEndpoint: fetch loop with p50/p95
 * - measurePage: fetch HTML + parse script counts / size
 */

import { performance } from 'node:perf_hooks';
import { execSync, spawn } from 'node:child_process';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import type { EndpointConfig } from './config.js';

const here = dirname(fileURLToPath(import.meta.url));
export const frontendDir = resolve(here, '..', '..');
export const nextDir = join(frontendDir, '.next');

// ---------- build ----------

export interface BuildMeasure {
  durationMs: number;
  exitCode: number | null;
  stderrTail?: string;
}

export async function measureBuildTime(skipBuild = false): Promise<BuildMeasure | null> {
  if (skipBuild) return null;
  const start = performance.now();
  try {
    execSync('npm run build', {
      cwd: frontendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
    });
    const durationMs = Math.round(performance.now() - start);
    return { durationMs, exitCode: 0 };
  } catch (e: any) {
    const durationMs = Math.round(performance.now() - start);
    const stderr = (e.stderr?.toString() ?? e.message ?? '').slice(-2000);
    return { durationMs, exitCode: e.status ?? 1, stderrTail: stderr };
  }
}

// ---------- bundle ----------

export interface BundleFile {
  path: string;
  rawBytes: number;
  gzipBytes: number;
}
export interface BundleMeasure {
  totalStaticRaw: number;
  totalStaticGzip: number;
  totalServerRaw: number;
  chunkCount: number;
  largestChunks: BundleFile[];
  firstLoadApproxRaw: number;
  firstLoadApproxGzip: number;
  nextDirBytes: number;
  staticDirBytes: number;
  serverDirBytes: number;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function duBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const f of walk(dir)) {
    try { total += statSync(f).size; } catch {}
  }
  return total;
}

export function measureBundle(): BundleMeasure {
  const staticDir = join(nextDir, 'static');
  const serverDir = join(nextDir, 'server');
  const chunksDir = join(staticDir, 'chunks');

  const nextDirBytes = duBytes(nextDir);
  const staticDirBytes = duBytes(staticDir);
  const serverDirBytes = duBytes(serverDir);

  const chunkFiles = existsSync(chunksDir) ? walk(chunksDir).filter(f => f.endsWith('.js')) : [];
  const chunks: BundleFile[] = chunkFiles.map(p => {
    const raw = statSync(p).size;
    let gzipBytes = raw;
    try { gzipBytes = gzipSync(readFileSync(p)).length; } catch {}
    return { path: p.replace(frontendDir + '/', ''), rawBytes: raw, gzipBytes };
  }).sort((a, b) => b.rawBytes - a.rawBytes);

  const totalStaticRaw = chunks.reduce((s, c) => s + c.rawBytes, 0);
  const totalStaticGzip = chunks.reduce((s, c) => s + c.gzipBytes, 0);
  const totalServerRaw = serverDirBytes;
  const largestChunks = chunks.slice(0, 10);

  // Heuristic first-load: sum of top 6 chunks that look like framework + main
  // More precise would be reading build-manifest.json; we provide approximation + raw chunk list for exact audit.
  const firstN = chunks.slice(0, 6);
  const firstLoadApproxRaw = firstN.reduce((s, c) => s + c.rawBytes, 0);
  const firstLoadApproxGzip = firstN.reduce((s, c) => s + c.gzipBytes, 0);

  return {
    totalStaticRaw, totalStaticGzip, totalServerRaw,
    chunkCount: chunks.length,
    largestChunks, firstLoadApproxRaw, firstLoadApproxGzip,
    nextDirBytes, staticDirBytes, serverDirBytes,
  };
}

// ---------- endpoints ----------

export interface EndpointSample {
  status: number;
  ttfbMs: number;
  totalMs: number;
  bytes: number;
  error?: string;
}

export interface EndpointStats {
  name: string;
  path: string;
  method: string;
  runs: number;
  ok: number;
  fail: number;
  statusHistogram: Record<string, number>;
  ttfb: { p50: number; p95: number; avg: number; min: number; max: number };
  total: { p50: number; p95: number; avg: number; min: number; max: number };
  bytes: { avg: number };
  samples: EndpointSample[];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export async function measureEndpoint(
  baseUrl: string,
  cfg: EndpointConfig,
  runs = 20,
  timeoutMs = 15_000
): Promise<EndpointStats> {
  const url = new URL(cfg.path, baseUrl).toString();
  const method = cfg.method ?? 'GET';
  const samples: EndpointSample[] = [];

  // Warmup: 2 requests to heat JIT / dev compilation / DB pool, results discarded
  for (let w = 0; w < 2; w++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      await fetch(url, {
        method, headers: { 'content-type': 'application/json', accept: '*/*', ...(cfg.headers ?? {}) },
        body: cfg.body ? JSON.stringify(cfg.body) : undefined,
        signal: ctrl.signal, cache: 'no-store',
      }).then(r => r.arrayBuffer().catch(()=>null));
      clearTimeout(t);
    } catch {}
    await new Promise(r => setTimeout(r, 10));
  }

  for (let i = 0; i < runs; i++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const start = performance.now();
    let ttfbMs = 0;
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'content-type': 'application/json',
          'accept': '*/*',
          ...(cfg.headers ?? {}),
        },
        body: cfg.body ? JSON.stringify(cfg.body) : undefined,
        signal: controller.signal,
        // Ensure no keep-alive reuse skew: fetch handles pooling but we measure per-request wall time.
        cache: 'no-store',
      });
      ttfbMs = Math.round(performance.now() - start);
      // drain body to measure total
      const buf = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
      const totalMs = Math.round(performance.now() - start);
      samples.push({ status: res.status, ttfbMs, totalMs, bytes: buf.byteLength });
    } catch (e: any) {
      const totalMs = Math.round(performance.now() - start);
      samples.push({ status: 0, ttfbMs: ttfbMs || totalMs, totalMs, bytes: 0, error: e?.message ?? String(e) });
    } finally {
      clearTimeout(t);
    }
    // tiny pacing to avoid thundering herd on single-threaded dev server
    if (i < runs - 1) await new Promise(r => setTimeout(r, 25));
  }

  const ttfbSorted = samples.map(s => s.ttfbMs).sort((a, b) => a - b);
  const totalSorted = samples.map(s => s.totalMs).sort((a, b) => a - b);
  const hist: Record<string, number> = {};
  for (const s of samples) hist[String(s.status)] = (hist[String(s.status)] ?? 0) + 1;
  const ok = samples.filter(s => s.error == null && s.status < 500).length;

  return {
    name: cfg.name,
    path: cfg.path,
    method,
    runs,
    ok,
    fail: samples.length - ok,
    statusHistogram: hist,
    ttfb: {
      p50: percentile(ttfbSorted, 50),
      p95: percentile(ttfbSorted, 95),
      avg: Math.round(ttfbSorted.reduce((a, b) => a + b, 0) / Math.max(1, ttfbSorted.length)),
      min: ttfbSorted[0] ?? 0,
      max: ttfbSorted[ttfbSorted.length - 1] ?? 0,
    },
    total: {
      p50: percentile(totalSorted, 50),
      p95: percentile(totalSorted, 95),
      avg: Math.round(totalSorted.reduce((a, b) => a + b, 0) / Math.max(1, totalSorted.length)),
      min: totalSorted[0] ?? 0,
      max: totalSorted[totalSorted.length - 1] ?? 0,
    },
    bytes: { avg: Math.round(samples.reduce((a, s) => a + s.bytes, 0) / Math.max(1, samples.length)) },
    samples,
  };
}

export async function measureAllEndpoints(
  baseUrl: string,
  endpoints: EndpointConfig[],
  runs: number,
  concurrency: number,
  timeoutMs: number,
  onProgress?: (done: number, total: number, name: string) => void
): Promise<EndpointStats[]> {
  const results: EndpointStats[] = [];
  let idx = 0;
  const worker = async () => {
    while (true) {
      const cur = idx++;
      if (cur >= endpoints.length) return;
      const cfg = endpoints[cur];
      const stats = await measureEndpoint(baseUrl, cfg, runs, timeoutMs);
      results[cur] = stats;
      onProgress?.(results.filter(Boolean).length, endpoints.length, cfg.name);
    }
  };
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, endpoints.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------- pages (HTML-level) ----------

export interface PageMeasure {
  name: string;
  path: string;
  status: number;
  ttfbMs: number;
  totalMs: number;
  htmlBytes: number;
  gzipBytes: number;
  scriptTagCount: number;
  linkTagCount: number;
  hasNextFont: boolean;
  error?: string;
}

export async function measurePage(baseUrl: string, path: string, name: string, timeoutMs = 15_000): Promise<PageMeasure> {
  const url = new URL(path, baseUrl).toString();
  // Warmup for page as well
  try {
    const c = new AbortController(); const tt = setTimeout(()=>c.abort(), 5000);
    await fetch(url, { signal: c.signal, cache: 'no-store', headers: { accept: 'text/html' } }).then(r=>r.text().catch(()=>'')); clearTimeout(tt);
  } catch {}
  await new Promise(r=>setTimeout(r,10));
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store', headers: { accept: 'text/html' } });
    const ttfbMs = Math.round(performance.now() - start);
    const text = await res.text();
    const totalMs = Math.round(performance.now() - start);
    const htmlBytes = Buffer.byteLength(text, 'utf8');
    let gzipBytes = htmlBytes;
    try { gzipBytes = gzipSync(Buffer.from(text)).length; } catch {}
    const scriptTagCount = (text.match(/<script\b/g) || []).length;
    const linkTagCount = (text.match(/<link\b/g) || []).length;
    const hasNextFont = text.includes('next/font') || text.includes('__next_font') || text.includes('Geist');
    return { name, path, status: res.status, ttfbMs, totalMs, htmlBytes, gzipBytes, scriptTagCount, linkTagCount, hasNextFont };
  } catch (e: any) {
    const totalMs = Math.round(performance.now() - start);
    return { name, path, status: 0, ttfbMs: totalMs, totalMs, htmlBytes: 0, gzipBytes: 0, scriptTagCount: 0, linkTagCount: 0, hasNextFont: false, error: e?.message ?? String(e) };
  } finally { clearTimeout(t); }
}

export async function measureAllPages(baseUrl: string, pages: { name: string; path: string }[], timeoutMs = 15_000): Promise<PageMeasure[]> {
  const out: PageMeasure[] = [];
  for (const p of pages) {
    out.push(await measurePage(baseUrl, p.path, p.name, timeoutMs));
    await new Promise(r => setTimeout(r, 25));
  }
  return out;
}

// ---------- a11y / token quick lint (static) ----------

export interface StaticLint {
  outlineNoneWithoutReplacement: number;
  transitionAll: number;
  hardcodedHexTokens: number;
  imgWithoutDimensions: number;
  iconButtonMissingAriaLabelEstimate: number;
}

export function quickStaticLint(): StaticLint {
  // Lightweight grep counts — not a full axe run, but catches regressions after token migration.
  const frontend = frontendDir;
  const exts = ['.tsx', '.ts', '.css'];
  const files = walk(frontend).filter(f => exts.some(e => f.endsWith(e)) && !f.includes('.next') && !f.includes('node_modules'));
  let transitionAll = 0, outlineNone = 0, hexCount = 0, imgNoDims = 0, iconNoLabel = 0;
  for (const f of files) {
    let txt: string;
    try { txt = readFileSync(f, 'utf8'); } catch { continue; }
    if (txt.includes('transition: all') || txt.includes('transition-all')) transitionAll++;
    if (txt.includes('outline-none') || txt.includes('outline: none')) outlineNone++;
    // hex token heuristic: #XXXXXX in components/ but not in stylingConstants.ts
    if (f.includes('/components/') && !f.includes('stylingConstants')) {
      const m = txt.match(/#[0-9a-fA-F]{6}\b/g);
      if (m) hexCount += m.length;
    }
    if (f.endsWith('.tsx') && txt.includes('<img')) {
      const imgs = txt.match(/<img[^>]*>/g) ?? [];
      for (const img of imgs) if (!img.includes('width=') || !img.includes('height=')) imgNoDims++;
    }
    if (f.endsWith('.tsx') && txt.includes('lucide-react')) {
      // heuristic: icon-only button with title but no aria-label
      const cand = (txt.match(/title="[^"]*"/g) ?? []).length - (txt.match(/aria-label=/g) ?? []).length;
      if (cand > 0) iconNoLabel += Math.max(0, cand);
    }
  }
  return { outlineNoneWithoutReplacement: outlineNone, transitionAll, hardcodedHexTokens: hexCount, imgWithoutDimensions: imgNoDims, iconButtonMissingAriaLabelEstimate: iconNoLabel };
}
