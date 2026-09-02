#!/usr/bin/env tsx
/**
 * Compare two perf-result JSON files and print Δ table.
 * Usage: tsx scripts/perf/compare.ts perf-results/baseline.json perf-results/latest.json
 *   or:  npm run perf:compare
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
function fmt(n: number): string { return `${n} ms`; }
function delta(a: number, b: number): string {
  const d = b - a;
  const sign = d >= 0 ? '+' : '';
  const icon = d < -5 ? '🟢' : d > 30 ? '🔴' : '⚪';
  return `${icon} ${sign}${d} ms`;
}

const [aPath, bPath] = process.argv.slice(2);
if (!aPath || !bPath) {
  console.error('Usage: tsx scripts/perf/compare.ts <baseline.json> <current.json>');
  process.exit(1);
}
const a = JSON.parse(readFileSync(resolve(aPath), 'utf8'));
const b = JSON.parse(readFileSync(resolve(bPath), 'utf8'));

console.log(`\nCompare: ${aPath} (${a.date}) → ${bPath} (${b.date})\n`);
console.log(`Build: ${a.build?.durationMs ?? '—'} ms → ${b.build?.durationMs ?? '—'} ms ${a.build && b.build ? delta(a.build.durationMs, b.build.durationMs) : ''}`);
console.log(`Bundle static gzip: ${humanBytes(a.bundle.totalStaticGzip)} → ${humanBytes(b.bundle.totalStaticGzip)} ${delta(a.bundle.totalStaticGzip, b.bundle.totalStaticGzip)}`);
console.log(`First-load gzip: ${humanBytes(a.bundle.firstLoadApproxGzip)} → ${humanBytes(b.bundle.firstLoadApproxGzip)} ${delta(a.bundle.firstLoadApproxGzip, b.bundle.firstLoadApproxGzip)}`);
console.log(`Chunks: ${a.bundle.chunkCount} → ${b.bundle.chunkCount}`);
console.log('');

const mapA = new Map((a.endpoints ?? []).map((e: any) => [e.name, e]));
const mapB = new Map((b.endpoints ?? []).map((e: any) => [e.name, e]));
const allNames = [...new Set([...mapA.keys(), ...mapB.keys()])].sort();
console.log('| Endpoint | Baseline p95 TTFB | Current p95 TTFB | Δ TTFB | Baseline p95 Total | Current p95 Total | Δ Total |');
console.log('|---|---|---|---|---|---|---|');
for (const name of allNames) {
  const ea = mapA.get(name) as any; const eb = mapB.get(name) as any;
  if (!ea) { console.log(`| ${name} | — | ${fmt(eb.ttfb.p95)} | new | — | ${fmt(eb.total.p95)} | new |`); continue; }
  if (!eb) { console.log(`| ${name} | ${fmt(ea.ttfb.p95)} | — | removed | ${fmt(ea.total.p95)} | — | removed |`); continue; }
  console.log(`| ${name} | ${fmt(ea.ttfb.p95)} | ${fmt(eb.ttfb.p95)} | ${delta(ea.ttfb.p95, eb.ttfb.p95)} | ${fmt(ea.total.p95)} | ${fmt(eb.total.p95)} | ${delta(ea.total.p95, eb.total.p95)} |`);
}
console.log('');
const pagesA = new Map((a.pages ?? []).map((p: any) => [p.name, p]));
const pagesB = new Map((b.pages ?? []).map((p: any) => [p.name, p]));
console.log('| Page | Baseline TTFB | Current TTFB | Δ |');
console.log('|---|---|---|---|');
for (const k of new Set([...pagesA.keys(), ...pagesB.keys()])) {
  const pa = pagesA.get(k) as any; const pb = pagesB.get(k) as any;
  if (!pa || !pb) continue;
  console.log(`| ${k} | ${fmt(pa.ttfbMs)} | ${fmt(pb.ttfbMs)} | ${delta(pa.ttfbMs, pb.ttfbMs)} |`);
}
console.log('');
