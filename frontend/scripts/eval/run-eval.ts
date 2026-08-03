/**
 * Repo→diagram accuracy eval runner.
 *
 * For each corpus repo: clears caches, runs the pipeline directly at the corpus
 * detailLevel, scores the result against the golden graph, and writes a dated
 * results file + markdown table.
 *
 * Requires GITHUB_TOKEN + GROQ_API_KEY (or GROQ_API_KEY_FOR_DESC_*) in env.
 * Loads .env.local automatically so it runs identically to the app.
 *
 * Flags:
 *   --only <repoId>     run a single corpus repo
 *   --out <file>        results JSON output path (default eval-results/<date>.json)
 *   --concurrency <n>  parallel repos (default 2)
 *   --report            emit/append a markdown report table to stdout + eval-results/report.md
 *   --threshold <pct>   exit non-zero if composite < threshold (default 90)
 *
 * Usage: `npm run eval:repo` / `npm run eval:repo:report`
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePipelineResult } from './types';
import {
  scoreRepo,
  aggregateScores,
  formatScoreTable,
  type RepoScore,
  type AggregateScore,
} from './score';
import type { CorpusManifest, CorpusRepo, GoldenGraph } from './types';

const here = dirname(fileURLToPath(import.meta.url)); // .../frontend/scripts/eval
const frontendDir = resolve(here, '..', '..'); // .../frontend/
const evalResultsDir = resolve(frontendDir, 'eval-results');

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function checkEnv() {
  const hasGroq =
    !!process.env.GROQ_API_KEY ||
    Object.keys(process.env).some((k) => k.startsWith('GROQ_API_KEY_FOR_DESC_'));
  if (!hasGroq) fail('GROQ_API_KEY (or GROQ_API_KEY_FOR_DESC_*) not set. Add it to .env.local or export it.');
  if (!process.env.GITHUB_TOKEN) {
    console.warn('⚠ GITHUB_TOKEN not set — unauthenticated GitHub rate limit is 60 req/hr. Set it for the full corpus.');
  }
}

function loadCorpus(): CorpusRepo[] {
  const manifest = JSON.parse(readFileSync(resolve(here, 'repo-corpus.json'), 'utf8')) as CorpusManifest;
  return manifest.repos;
}

function loadGolden(repoId: string): GoldenGraph {
  return JSON.parse(readFileSync(resolve(here, 'golden', `${repoId}.json`), 'utf8')) as GoldenGraph;
}

type RunResult =
  | { score: RepoScore }
  | { score: RepoScore; error: string };

async function runOne(repo: CorpusRepo): Promise<RunResult> {
  const golden = loadGolden(repo.id);
  process.stdout.write(`\n▶ ${repo.id} (${repo.stack}) …\n`);
  try {
    // Clear caches so each run is a fresh pipeline execution.
    const { clear } = await import('@/lib/ai/services/diagramCache');
    clear();
    try {
      const { clearBlobCaches } = await import('@/lib/cache/blobCache');
      clearBlobCaches();
    } catch { /* blob cache clear is best-effort */ }

    const { generateRepoArchitectureDiagramV2 } = await import('@/lib/repo-diagram/pipeline-v2');
    const outcome = await generateRepoArchitectureDiagramV2(repo.url, repo.detailLevel);
    if (!outcome.success) {
      throw outcome.error;
    }
    const result = outcome.data;
    const predicted = parsePipelineResult(
      result.repoProfile,
      result.dependencyMap,
      result.nodes,
      result.edges
    );
    const score = scoreRepo({ repoId: repo.id, url: repo.url, predicted, golden });
    process.stdout.write(
      `  composite=${Math.round(score.composite * 100)}%  nodes=${score.predictedNodeCount}  edges=${score.predictedEdgeCount}` +
      `  forbid=${score.forbiddenViolations}\n`
    );
    if (score.forbiddenViolations > 0) {
      process.stdout.write(`  ⚠ forbidden hallucinations: ${score.forbiddenLabels.join(', ')}\n`);
    }
    if (score.unmatchedGoldenLabels.length > 0) {
      process.stdout.write(`  ⊘ unmatched golden nodes: ${score.unmatchedGoldenLabels.join(', ')}\n`);
    }
    return { score };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const score: RepoScore = {
      repoId: repo.id, url: repo.url,
      nodeRecall: 0, nodePrecision: 0, edgeRecall: 0, edgePrecision: 0,
      classificationAccuracy: 0, composite: 0, forbiddenViolations: 0,
      forbiddenLabels: [], unmatchedGoldenLabels: [],
      predictedNodeCount: 0, predictedEdgeCount: 0,
      goldenNodeCount: golden.nodes.length, goldenEdgeCount: golden.edges.length,
      error,
    };
    process.stdout.write(`  ✗ error: ${error}\n`);
    return { score, error };
  }
}

async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const run = async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      await worker(items[idx]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => run())
  );
}

function markdownTable(agg: AggregateScore): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const header = `| repo | composite | nR | nP | eR | eP | cls | forbid | nodes | edges |`;
  const sep = `|---|---|---|---|---|---|---|---|---|---|`;
  const rows = agg.perRepo.map((s) =>
    `| ${s.repoId} | ${pct(s.composite)} | ${pct(s.nodeRecall)} | ${pct(s.nodePrecision)} | ${pct(s.edgeRecall)} | ${pct(s.edgePrecision)} | ${pct(s.classificationAccuracy)} | ${s.forbiddenViolations} | ${s.predictedNodeCount} | ${s.predictedEdgeCount} |${s.error ? ` _err_ |` : ''}`
  );
  const summary = `| **aggregate (${agg.repoCount} repos)** | **${pct(agg.composite)}** | ${pct(agg.nodeRecall)} | ${pct(agg.nodePrecision)} | ${pct(agg.edgeRecall)} | ${pct(agg.edgePrecision)} | ${pct(agg.classificationAccuracy)} | ${agg.totalForbiddenViolations} | — | — |`;
  return [header, sep, ...rows, summary].join('\n');
}

async function main() {
  // Load env BEFORE importing the pipeline so apiKeyManager initializes with keys.
  const { config: loadEnv } = await import('dotenv');
  loadEnv({ path: resolve(frontendDir, '.env.local') });
  checkEnv();
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;
  const outIdx = args.indexOf('--out');
  const report = args.includes('--report');
  const concIdx = args.indexOf('--concurrency');
  const concurrency = concIdx >= 0 ? Math.max(1, Number(args[concIdx + 1]) || 2) : 2;
  const thrIdx = args.indexOf('--threshold');
  const threshold = thrIdx >= 0 ? Number(args[thrIdx + 1]) : 90;

  let corpus = loadCorpus();
  if (only) {
    const ids = new Set(only.split(',').map((s) => s.trim()).filter(Boolean));
    corpus = corpus.filter((r) => ids.has(r.id));
  }
  if (corpus.length === 0) fail(`No corpus repos selected (--only ${only ?? ''}).`);

  console.log(`\n═══ Repo diagram eval ═══`);
  console.log(`${corpus.length} repo(s) · concurrency ${concurrency} · threshold ${threshold}%\n`);

  const t0 = Date.now();
  const scores: RepoScore[] = [];
  await runConcurrent(corpus, concurrency, async (r) => {
    const res = await runOne(r);
    scores.push(res.score);
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const agg = aggregateScores(scores);

  console.log(`\n═══ Results (${elapsed}s) ═══\n`);
  console.log(formatScoreTable(scores));
  console.log(`\nComposite: ${(agg.composite * 100).toFixed(1)}%  | nodeR ${(agg.nodeRecall * 100).toFixed(1)}%  nodeP ${(agg.nodePrecision * 100).toFixed(1)}%  edgeR ${(agg.edgeRecall * 100).toFixed(1)}%  edgeP ${(agg.edgePrecision * 100).toFixed(1)}%  cls ${(agg.classificationAccuracy * 100).toFixed(1)}%  | forbidden ${agg.totalForbiddenViolations}\n`);

  // Persist dated results JSON.
  mkdirSync(evalResultsDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const outPath = outIdx >= 0
    ? resolve(frontendDir, args[outIdx + 1] as string)
    : resolve(evalResultsDir, `${date}.json`);
  const payload = {
    date,
    elapsedSeconds: Number(elapsed),
    threshold,
    aggregate: agg,
    scores,
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${outPath}`);

  if (report) {
    const md = `# Repo diagram eval — ${date}\n\n${markdownTable(agg)}\n`;
    const reportPath = resolve(evalResultsDir, 'report.md');
    const existing = existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : '';
    writeFileSync(reportPath, existing + '\n\n' + md, 'utf8');
    console.log(`Appended report to ${reportPath}`);
    console.log('\n' + markdownTable(agg) + '\n');
  }

  if (agg.composite * 100 < threshold) {
    console.error(`\n✗ Composite ${(agg.composite * 100).toFixed(1)}% below threshold ${threshold}%`);
    process.exit(2);
  }
  if (agg.totalForbiddenViolations > 0) {
    console.error(`\n✗ ${agg.totalForbiddenViolations} forbidden-node hallucination(s) detected`);
    process.exit(3);
  }
  console.log('\n✓ All thresholds passed.');
}

main().catch((err) => {
  console.error('Eval crashed:', err);
  process.exit(1);
});