import type {
  GoldenGraph,
  GoldenNode,
  PredictedGraph,
  PredictedNode,
  PredictedEdge,
} from './types';

// ─── Normalization helpers ────────────────────────────────────

/** Normalized id: lowercase, non-alphanumeric → '_', collapse, trim ends. */
export function normalizeId(id: string): string {
  return (
    id
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'node'
  );
}

const STOPWORDS = new Set([
  'app', 'application', 'system', 'the', 'a', 'an', 'of', 'for', 'and',
]);

/**
 * Generic type words that are redundant once the type is known — stripped before
 * label token comparison so "Order API" matches "Orders API Route".
 */
const GENERIC_TYPE_WORDS = new Set([
  'api', 'service', 'db', 'database', 'cache', 'worker', 'app',
  'application', 'system', 'route', 'routes', 'module', 'core',
  'component', 'layer', 'handler', 'controller', 'server', 'client',
]);

/** Light stemming: strip a trailing 's' on tokens longer than 3 chars to normalize plurals. */
function stem(token: string): string {
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

/** Tokenize a label into a comparable token set (stemmed, stopwords + generic words removed). */
export function labelTokens(input: string): Set<string> {
  const raw = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((t) => stem(t))
    .filter((t) => t.length > 0 && !STOPWORDS.has(t) && !GENERIC_TYPE_WORDS.has(t));
  return new Set(raw);
}

/** Tokenize for ID-style comparison (keep generic words — they discriminate ids). */
function idTokens(input: string): Set<string> {
  const raw = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((t) => stem(t))
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
  return new Set(raw);
}

/** Overlap coefficient: |A ∩ B| / min(|A|, |B|). Returns 0 for empty sets. */
export function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  for (const t of smaller) if (larger.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}

const LABEL_MATCH_THRESHOLD = 0.7;

// ─── Node matching ───────────────────────────────────────────

/**
 * Does a predicted node match a golden node?
 *
 * Match if ANY of:
 *  (a) normalized ids are equal,
 *  (b) same type AND label token-overlap >= 0.7,
 *  (c) source-file overlap >= 50% of the golden node's sourceFiles (when provided).
 */
export function nodeMatches(predicted: PredictedNode, golden: GoldenNode): boolean {
  // (a) id equality
  if (normalizeId(predicted.id) === normalizeId(golden.id)) return true;

  // (c) source-file overlap (needs golden sourceFiles)
  if (golden.sourceFiles && golden.sourceFiles.length > 0 && predicted.sourceFiles.length > 0) {
    const pSet = new Set(predicted.sourceFiles.map((p) => normalizePath(p)));
    const gSet = new Set(golden.sourceFiles.map((p) => normalizePath(p)));
    let shared = 0;
    for (const p of gSet) if (pSet.has(p)) shared++;
    if (shared / gSet.size >= 0.5) return true;
  }

  // (b) type-aware label similarity (also check against aliases)
  const candidates = [golden.label, ...(golden.aliases ?? [])];
  for (const candidate of candidates) {
    const sameType = typesCompatible(predicted.type, golden.type);
    if (sameType) {
      const to = labelTokens(candidate);
      const po = labelTokens(predicted.label);
      let best = overlapCoefficient(po, to);
      // Also try pure id-token overlap when labels are sparse (e.g. "Postgres DB"→"PostgreSQL").
      const ito = idTokens(candidate);
      const ipo = idTokens(predicted.label);
      best = Math.max(best, overlapCoefficient(ipo, ito));
      if (best >= LABEL_MATCH_THRESHOLD) return true;
    }
  }
  // Also allow id-token match against golden id (handles "Order API" predicted vs golden id "order_api")
  const gidTokens = idTokens(golden.id);
  const plid = idTokens(predicted.label);
  if (gidTokens.size > 0 && overlapCoefficient(plid, gidTokens) >= 0.85) {
    return true;
  }
  return false;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.?\//, '');
}

/**
 * Type compatibility — tolerant: matches if either is a prefix/substring of the other
 * (e.g. "API_ROUTE" vs "API_ROUTE"), or both belong to the same data/gateway family.
 */
function typesCompatible(a: string, b: string): boolean {
  const na = a.toUpperCase().replace(/[^A-Z0-9_]/g, '');
  const nb = b.toUpperCase().replace(/[^A-Z0-9_]/g, '');
  if (na === nb) return true;
  const DB_FAMILY = new Set(['DATABASE', 'CACHE', 'STORAGE', 'QUEUE']);
  const FE_FAMILY = new Set(['PAGE', 'UI_COMPONENT', 'STATE_MANAGEMENT']);
  const BE_FAMILY = new Set(['API_ROUTE', 'SERVICE', 'CONTROLLER', 'WORKER', 'CORE_MODULE']);
  if (DB_FAMILY.has(na) && DB_FAMILY.has(nb)) return true;
  if (FE_FAMILY.has(na) && FE_FAMILY.has(nb)) return true;
  if (BE_FAMILY.has(na) && BE_FAMILY.has(nb)) return true;
  return false;
}

// ─── Forbidden-node detection (hallucination traps) ──────────

export function matchesForbiddenNode(predicted: PredictedNode, forbidden: string): boolean {
  if (normalizeId(predicted.id) === normalizeId(forbidden)) return true;
  const ft = idTokens(forbidden);
  const pl = idTokens(predicted.label);
  const pi = idTokens(predicted.id);
  // Forbidden labels are usually concrete product names (e.g. "Stripe", "Redis").
  // Require a strong token match to avoid false accusations.
  return overlapCoefficient(pl, ft) >= 0.8 || overlapCoefficient(pi, ft) >= 0.8;
}

// ─── Node precision/recall ───────────────────────────────────

export type NodeMatchResult = {
  recall: number;
  precision: number;
  matchedGolden: number;
  matchedPredicted: number;
  unmatchedGolden: GoldenNode[];
  forbiddenViolations: PredictedNode[];
  nodeMapping: Map<string, string>; // goldenId → predictedId
};

export function matchNodes(
  predicted: PredictedNode[],
  golden: GoldenNode[],
  forbidden: string[]
): NodeMatchResult {
  const nodeMapping = new Map<string, string>();
  const matchedPredictedIds = new Set<number>();

  // Greedy best-match: for each golden node pick the best-scoring predicted node.
  for (const g of golden) {
    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < predicted.length; i++) {
      if (matchedPredictedIds.has(i)) continue;
      const score = nodeMatchScore(predicted[i], g);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && nodeMatches(predicted[bestIdx], g)) {
      nodeMapping.set(g.id, predicted[bestIdx].id);
      matchedPredictedIds.add(bestIdx);
    }
  }

  const matchedGolden = nodeMapping.size;
  const matchedPredicted = matchedPredictedIds.size;

  const unmatchedGolden = golden.filter((g) => !nodeMapping.has(g.id));

  const forbiddenViolations: PredictedNode[] = [];
  for (const p of predicted) {
    for (const f of forbidden) {
      if (matchesForbiddenNode(p, f)) {
        forbiddenViolations.push(p);
        break;
      }
    }
  }

  const recall = golden.length === 0 ? 1 : matchedGolden / golden.length;
  // Precision: a predicted node is "real" if it matched a golden node.
  // Forbidden matches are explicitly hallucinated → counted as false positives (already not matched).
  const precision = predicted.length === 0 ? (golden.length === 0 ? 1 : 0) : matchedPredicted / predicted.length;

  return { recall, precision, matchedGolden, matchedPredicted, unmatchedGolden, forbiddenViolations, nodeMapping };
}

/** Numeric score for ranking candidate matches (higher = better). */
function nodeMatchScore(predicted: PredictedNode, golden: GoldenNode): number {
  if (normalizeId(predicted.id) === normalizeId(golden.id)) return 100;
  let score = 0;
  if (typesCompatible(predicted.type, golden.type)) {
    const to = labelTokens(golden.label);
    const po = labelTokens(predicted.label);
    score = Math.max(score, overlapCoefficient(po, to) * 10);
    const ito = idTokens(golden.label);
    const ipo = idTokens(predicted.label);
    score = Math.max(score, overlapCoefficient(ipo, ito) * 8);
  }
  for (const alias of golden.aliases ?? []) {
    if (typesCompatible(predicted.type, golden.type)) {
      const at = labelTokens(alias);
      const po = labelTokens(predicted.label);
      score = Math.max(score, overlapCoefficient(po, at) * 10);
    }
  }
  const gidTokens = idTokens(golden.id);
  const plid = idTokens(predicted.label);
  score = Math.max(score, overlapCoefficient(plid, gidTokens) * 7);
  if (golden.sourceFiles && golden.sourceFiles.length > 0 && predicted.sourceFiles.length > 0) {
    const pSet = new Set(predicted.sourceFiles.map((p) => normalizePath(p)));
    const gSet = new Set(golden.sourceFiles.map((p) => normalizePath(p)));
    let shared = 0;
    for (const p of gSet) if (pSet.has(p)) shared++;
    score = Math.max(score, (shared / gSet.size) * 50);
  }
  return score;
}

// ─── Edge precision/recall ───────────────────────────────────

export type EdgeMatchResult = {
  recall: number;
  precision: number;
  matchedGolden: number;
  matchedPredicted: number;
};

/**
 * Edge match = both endpoints map to golden nodes (via nodeMapping) AND direction is correct.
 * Edge label/type is NOT scored.
 *
 * @param evidenceEdges optional import/compose evidence edges as (fromPredictedId,toPredictedId)
 *   pairs — predicted edges corroborated by either the golden set OR evidence count as precise.
 */
export function matchEdges(
  predicted: PredictedEdge[],
  golden: { from: string; to: string }[],
  nodeMapping: Map<string, string>,
  evidenceEdges?: Set<string>
): EdgeMatchResult {
  // Reverse mapping: predictedId → goldenId
  const predictedToGolden = new Map<string, string>();
  for (const [goldenId, predId] of nodeMapping) {
    predictedToGolden.set(predId, goldenId);
  }

  // Build golden edge keyset (in golden-id space, undirected? No — direction matters).
  const goldenKeySet = new Set<string>();
  for (const e of golden) {
    goldenKeySet.add(`${e.from}->${e.to}`);
  }

  let matchedGolden = 0;
  for (const e of golden) {
    const gFrom = e.from;
    const gTo = e.to;
    // Does any predicted edge map to this golden edge?
    const found = predicted.some((pe) => {
      const pfGolden = predictedToGolden.get(pe.from);
      const ptGolden = predictedToGolden.get(pe.to);
      return pfGolden === gFrom && ptGolden === gTo;
    });
    if (found) matchedGolden++;
  }

  let matchedPredicted = 0;
  for (const pe of predicted) {
    const pfGolden = predictedToGolden.get(pe.from);
    const ptGolden = predictedToGolden.get(pe.to);
    if (!pfGolden || !ptGolden) continue;
    const key = `${pfGolden}->${ptGolden}`;
    if (goldenKeySet.has(key)) {
      matchedPredicted++;
      continue;
    }
    if (evidenceEdges && evidenceEdges.has(`${pe.from}->${pe.to}`)) {
      matchedPredicted++;
    }
  }

  const recall = golden.length === 0 ? 1 : matchedGolden / golden.length;
  const precision = predicted.length === 0 ? (golden.length === 0 ? 1 : 0) : matchedPredicted / predicted.length;

  return { recall, precision, matchedGolden, matchedPredicted };
}

// ─── Classification scoring ──────────────────────────────────

function normalizeFramework(name: string | null): string | null {
  if (!name) return null;
  const n = name.toLowerCase().replace(/[^a-z0-9.]/g, '');
  return n || null;
}

const DB_ALIASES: [RegExp, string][] = [
  [/postgres|psql|psycopg|^pg$/, 'postgres'],
  [/mongo|mongoose/, 'mongo'],
  [/mysql|maria/, 'mysql'],
  [/sqlite/, 'sqlite'],
  [/dynamo/, 'dynamo'],
  [/redis|keydb|valkey/, 'redis'],
];

export function normalizeDatabase(name: string | null): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  for (const [re, canon] of DB_ALIASES) {
    if (re.test(n)) return canon;
  }
  return n.replace(/[^a-z0-9]/g, '');
}

function frameworkMatches(predicted: string | null, golden: string | null): boolean {
  const p = normalizeFramework(predicted);
  const g = normalizeFramework(golden);
  if (!p && !g) return true; // both unknown → don't penalize
  if (!p || !g) return false;
  return p === g || p.includes(g) || g.includes(p);
}

function databaseMatches(predicted: string | null, golden: string | null): boolean {
  const p = normalizeDatabase(predicted);
  const g = normalizeDatabase(golden);
  if (!g) return !p || true; // golden says "no DB" → pass if predicted is null/none
  if (!p) return false;
  return p === g;
}

export type ClassificationResult = {
  accuracy: number;
  repoType: boolean;
  framework: boolean;
  database: boolean;
};

export function scoreClassification(
  predicted: { repoType: string; framework: string | null; database: string | null },
  golden: { repoType: string; framework: string | null; database: string | null }
): ClassificationResult {
  const repoType = predicted.repoType === golden.repoType;
  const framework = frameworkMatches(predicted.framework, golden.framework);
  const database = databaseMatches(predicted.database, golden.database);
  const correct = [repoType, framework, database].filter(Boolean).length;
  return { accuracy: correct / 3, repoType, framework, database };
}

// ─── Aggregate per-repo score ────────────────────────────────

export type RepoScore = {
  repoId: string;
  url: string;
  nodeRecall: number;
  nodePrecision: number;
  edgeRecall: number;
  edgePrecision: number;
  classificationAccuracy: number;
  composite: number;
  forbiddenViolations: number;
  forbiddenLabels: string[];
  unmatchedGoldenLabels: string[];
  predictedNodeCount: number;
  predictedEdgeCount: number;
  goldenNodeCount: number;
  goldenEdgeCount: number;
  error?: string;
};

export type ScoreInput = {
  repoId: string;
  url: string;
  predicted: PredictedGraph;
  golden: GoldenGraph;
  evidenceEdges?: Set<string>;
};

export function scoreRepo(input: ScoreInput): RepoScore {
  const { predicted, golden, evidenceEdges } = input;

  const nm = matchNodes(predicted.nodes, golden.nodes, golden.forbiddenNodes);
  const em = matchEdges(predicted.edges, golden.edges, nm.nodeMapping, evidenceEdges);
  const cm = scoreClassification(predicted.classification, golden.classification);

  const composite =
    (nm.recall + nm.precision + em.recall + em.precision + cm.accuracy) / 5;

  return {
    repoId: input.repoId,
    url: input.url,
    nodeRecall: nm.recall,
    nodePrecision: nm.precision,
    edgeRecall: em.recall,
    edgePrecision: em.precision,
    classificationAccuracy: cm.accuracy,
    composite,
    forbiddenViolations: nm.forbiddenViolations.length,
    forbiddenLabels: nm.forbiddenViolations.map((n) => n.label),
    unmatchedGoldenLabels: nm.unmatchedGolden.map((n) => n.label),
    predictedNodeCount: predicted.nodes.length,
    predictedEdgeCount: predicted.edges.length,
    goldenNodeCount: golden.nodes.length,
    goldenEdgeCount: golden.edges.length,
  };
}

// ─── Aggregate across corpus ─────────────────────────────────

export type AggregateScore = {
  composite: number;
  nodeRecall: number;
  nodePrecision: number;
  edgeRecall: number;
  edgePrecision: number;
  classificationAccuracy: number;
  totalForbiddenViolations: number;
  repoCount: number;
  perRepo: RepoScore[];
};

export function aggregateScores(scores: RepoScore[]): AggregateScore {
  if (scores.length === 0) {
    return {
      composite: 0, nodeRecall: 0, nodePrecision: 0, edgeRecall: 0, edgePrecision: 0,
      classificationAccuracy: 0, totalForbiddenViolations: 0, repoCount: 0, perRepo: [],
    };
  }
  const mean = (f: (s: RepoScore) => number) => scores.reduce((a, s) => a + f(s), 0) / scores.length;
  return {
    composite: mean((s) => s.composite),
    nodeRecall: mean((s) => s.nodeRecall),
    nodePrecision: mean((s) => s.nodePrecision),
    edgeRecall: mean((s) => s.edgeRecall),
    edgePrecision: mean((s) => s.edgePrecision),
    classificationAccuracy: mean((s) => s.classificationAccuracy),
    totalForbiddenViolations: scores.reduce((a, s) => a + s.forbiddenViolations, 0),
    repoCount: scores.length,
    perRepo: scores,
  };
}

export function formatScoreTable(scores: RepoScore[]): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const header = ['repo', 'comp', 'nR', 'nP', 'eR', 'eP', 'cls', 'forbid', 'nodes', 'edges'];
  const rows = scores.map((s) => [
    s.repoId.length > 32 ? s.repoId.slice(0, 30) + '..' : s.repoId,
    pct(s.composite), pct(s.nodeRecall), pct(s.nodePrecision), pct(s.edgeRecall),
    pct(s.edgePrecision), pct(s.classificationAccuracy), String(s.forbiddenViolations),
    String(s.predictedNodeCount), String(s.predictedEdgeCount),
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const fmtRow = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  const lines = [fmtRow(header), fmtRow(header.map((_, i) => '-'.repeat(widths[i]))), ...rows.map(fmtRow)];
  return lines.join('\n');
}