# GitHub → Repo Diagram Pipeline — Audit Fix Implementation Plan

> **Scope:** `frontend/lib/repo-diagram/**` + `frontend/lib/github-ingestion.ts` + `frontend/app/api/repo-diagram/route.ts` + `frontend/lib/agents/repo-*` + `frontend/lib/ai/services/diagramCache.ts` + `mcp-server` parity.
> **Author:** Pipeline audit 2026-08-29 (20 issues, severity-classified).
> **How to use:** Execute phases sequentially. Each phase is a reviewable PR (<400 LOC net logic). Do not combine Phase 1 (ingestion correctness) with Phase 4 (LLM verifier) — they mask each other.

> **Status 2026-08-29:** Phases 1–5 implemented and tested (946 tests, `tsc` clean). Phase 6 hardening tests added (`phase6-hardening.test.ts` 31 tests). `PIPELINE_VERSION` bumped to `v8`. This doc now serves as post-implementation reference.

---

## Table of Contents

1. [Goals & Non-Goals](#1-goals--non-goals)
2. [Current Pipeline Map](#2-current-pipeline-map)
3. [Issue Catalog (20 items)](#3-issue-catalog)
4. [Dependency Graph](#4-dependency-graph)
5. [Phase Overview](#5-phase-overview)
6. [Phase 1 — Ingestion & GitHub Contract Correctness](#phase-1--ingestion--github-contract-correctness-p0)
7. [Phase 2 — Cache, Streaming & Quota Correctness](#phase-2--cache-streaming--quota-correctness-p0)
8. [Phase 3 — Static Analysis & Evidence Graph Completeness](#phase-3--static-analysis--evidence-graph-completeness-p1)
9. [Phase 4 — Verifier / Heuristic / Finalization Semantics](#phase-4--verifier--heuristic--finalization-semantics-p1)
10. [Phase 5 — Type Safety, Dead Code & Observability](#phase-5--type-safety-dead-code--observability-p2)
11. [Phase 6 — Test & Eval Hardening + Rollout](#phase-6--test--eval-hardening--rollout-p2)
12. [Cross-Cutting Concerns](#7-cross-cutting-concerns)
13. [Test Plan Matrix](#8-test-plan-matrix)
14. [Rollout, Flags & Rollback](#9-rollout-flags--rollback)
15. [Risk Register](#10-risk-register)
16. [Appendix A — Exact Regex / Code Diffs](#appendix-a--exact-regex--code-diffs)
17. [Appendix B — Reference File Map](#appendix-b--reference-file-map)

---

## 1. Goals & Non-Goals

### Goals

* Fix silent wrong-diagram bugs (cache collision, private-repo auth, verifier over-prune, truncated tree).
* Make budget/skip/Binary rules consistent between tarball and Contents-API paths.
* Restore correctness for Python/Ruby/Java/Go/Spring stacks (import evidence + route signals).
* Make failure modes explicit (truncation, rate-limit, degraded flags) instead of silent fallback.
* Keep `frontend/lib/pipeline-core` as real execution engine; typed stage IO; no `any` at boundaries.

### Non-Goals

* New LLM prompts or model swaps beyond fixing brackets/budgets (model stays `openai/gpt-oss-120b` via `frontend/lib/ai/utils/repoModels.ts:8`).
* Replacing `fflate` unzip or introducing native `zlib` streaming.
* UI redesign of `RepoDiagramGenerator` / `InteractiveLandingDemo`.

---

## 2. Current Pipeline Map

```
POST /api/repo-diagram  (frontend/app/api/repo-diagram/route.ts:17)
  │  quota check → parseGitHubUrl → token sanitize → SSE TransformStream
  └─► generateRepoArchitectureDiagramV2 (frontend/lib/repo-diagram/pipeline-v2.ts:51)
        Pipeline('repo-pipeline-v2', [
          IngestStage          (github-ingestion.ts:373 ingestRepo)        weight 2
          CacheCheckStage      (diagramCache + repoDiagramRedisCache)       weight 1 optional terminal
          AnalysisStage        (detectSubsystems + extractStaticSignals + buildEvidenceGraph) weight 3
          BaselineStage        (intermediate-graphs + graph-quality expandBaseline)            weight 2
          ClassifyStage        (repo-classifier LLM + gatherPass2Files)     weight 3
          ExtractStage         (repo-component-extractor LLM → heuristic fallback) weight 3
          RelationshipsStage   (repo-relationship-analyst LLM → heuristic)  weight 2
          VerifyStage          (repo-verifier determinist + heuristic edges + dedup/prune) weight 1
          FinalizationStage    (sanitizeRepoGraph + compileToDiagram + cacheWrite flag) weight 2
          CacheWriteStage      (diagramCache + Redis set)                   weight 1 optional
        ])
```

**Ingestion internal (frontend/lib/github-ingestion.ts:418-926):**

```
getDefaultBranch → getBranchHeadSha → getRecursiveTree
  → loadArchiveMap (archiveCache 25 entries, 5m TTL, evict size-only)
  → Phase 1 triage  (root + manifest list, promisePool conc 5)
  → Phase 2 stack-guided deep read (scored candidates sliced to fileBudget, promisePool conc 6 or archiveMap lookup)
```

**Evidence (frontend/lib/repo-diagram/import-graph.ts:22 + import-resolvers.ts:28 + evidence-from-graph.ts:9):**

```
selectedFiles + fileTree
  → extractImports (regex per lang) → resolveImportSpec → ImportGraph {edges, external, unresolved}
  → topAdjacencies / deriveEvidenceEdges (fileToNode via sourceFiles)
```

---

## 3. Issue Catalog

| ID | Severity | File:Line | Summary | User Impact |
|---|---|---|---|---|
| **GH2R-001** | **Critical** | `frontend/lib/repo-diagram/tarball-ingestion.ts:48` + `frontend/lib/github-ingestion.ts:419` | Archive `!res.ok` → `null` silently; private 404 falls back to Contents-API which also 404s with opaque rate-limit message | Private repo appears "rate-limited" |
| **GH2R-002** | **Critical** | `frontend/app/api/repo-diagram/route.ts:58` | `userGithubToken` regex `/^gh[pos]_[A-Za-z0-9_]{36,}$/` rejects `github_pat_*` fine-grained + `ghu_`, `ghr_`, length variance | Users with fine-grained PAT silently unauthenticated → 60/hr |
| **GH2R-003** | **Critical** | `frontend/lib/ai/services/diagramCache.ts:28` + `frontend/lib/repo-diagram/pipeline-stages/CacheCheckStage.ts:22` + `repoDiagramRedisCache.ts:8` | Key `PIPELINE_VERSION::repoUrl::headSha` omits `detailLevel` | L1 static-only cached hit returns for L3 → gutted diagram |
| **GH2R-004** | **Critical** | `frontend/lib/agents/repo-verifier.ts:93-126` | Low-confidence edges without import evidence deleted (except `(assumed)`). LLM contract marks un-evidenced edges `low` (`repo-relationship-analyst.ts:152`) → always deleted for weak import graphs | Zero edges for Python/Ruby/Rails/Java |
| **GH2R-005** | **Critical** | `frontend/lib/github-ingestion.ts:408` | `tree.length>50000` only warns; `truncated:true` from GitHub at 100k is swallowed, only `reviewNotes` hints | Large monorepos missing services |
| **GH2R-006** | High | `frontend/lib/repo-diagram/pipeline-stages/IngestionStage.ts:24` + `frontend/lib/github-ingestion.ts:543` | Budgets diverge: `FILE_BUDGETS {500,1000,2000}` vs `contentBudgetKB` 10000 (default), tarball path ignores `contentBudget` (`github-ingestion.ts:848`) | L1 wastes 500 slots, L2 starvation vs tarball over-read |
| **GH2R-007** | High | `frontend/lib/github-ingestion.ts:134,172` vs `frontend/lib/repo-diagram/tarball-ingestion.ts:77,96` | SKIPPED_DIRECTORIES / BINARY_RE / MAX_PER_FILE inconsistent; tarball uses header `sz` pre-decompress, ingestion post-check | Same repo different graph by path |
| **GH2R-008** | High | `frontend/app/api/repo-diagram/route.ts:70` + `frontend/lib/pipeline-core/Pipeline.ts:59` | SSE detached IIFE; abort only between stages; `onProgress` write after disconnect unhandled; `incrementAIGeneration` runs even on abort | Charged for abandoned, unhandled rejection |
| **GH2R-009** | High | `frontend/lib/repo-diagram/import-resolvers.ts:218` | `collectPythonRoots` only `['','src']` + top-level `__init__.py`; misses `app/backend/server/api/services` | Python internal imports → external → no evidence → GH2R-004 |
| **GH2R-010** | High | `frontend/lib/repo-diagram/import-resolvers.ts:108-134` | `applyAlias` `baseUrl="."` collapse broken; `resolveAliasTarget` misses `/*` star correctly | `@/` monorepo imports unresolved |
| **GH2R-011** | High | `frontend/lib/repo-diagram/static-analyzer.ts:212` | Spring `@GetMapping(value="/x")` / `path="/x"` not matched (regex requires `(‘“path`) | Spring Boot has 0 routes |
| **GH2R-012** | High | `frontend/lib/repo-diagram/import-resolvers.ts:218-249` | Go `resolveGo` only handles module-prefix imports; relative-internal packages without module prefix → external | Go evidence under-connected |
| **GH2R-013** | High | `frontend/lib/repo-diagram/static-analyzer.ts:115` | `PACKAGE_CATEGORIES` misses `mysql2`, `better-sqlite3`, `oracledb`, `pgvector`, `next-auth` v5 `@auth/core` etc.; DB detection fails | Missing DB node → no `DATABASE` in baseline |
| **GH2R-014** | Medium | `frontend/lib/repo-diagram/pipeline-stages/ClassifyStage.ts:24` | `useLlm=false` gate `detailLevel!=1 && (phase2>=1 \|\| selected>=4 \|\| signals>=3)` hides tiny repos as static-only with no error | 3-file repos get 1-node diagram silently |
| **GH2R-015** | Medium | `frontend/lib/repo-diagram/static-analyzer.ts:62,101` | `pyproject.toml` / `requirements.txt` naive quoted-string regex captures non-deps | Ghost `database`/`ml_framework` categories |
| **GH2R-016** | Medium | `frontend/lib/repo-diagram/subsystem-detector.ts:75` + `frontend/lib/repo-diagram/graph-quality.ts:24,99` | `isMonorepoDir` regex + `normalizeLabelKey` stripping produces `labelKey=''` for `API`/`Service` generic names → merge collisions | Distinct services merge or heuristic mis-merge (`internal-helpers.ts:30`) |
| **GH2R-017** | Medium | `frontend/lib/repo-diagram/pipeline-stages/FinalizationStage.ts:89,115` | `connected.size<3` sparse heuristic keeps all `importantTypes` orphans → post-verify clutter re-added | Verify prune undone |
| **GH2R-018** | Medium | `frontend/lib/repo-diagram/pipeline-stages/FinalizationStage.ts:178` | `GITHUB_TOKEN` hint in `reviewNotes` ignores per-request `userGithubToken` | User who supplied token still told to set env |
| **GH2R-019** | Low | `frontend/lib/cache/blobCache.ts:64` | `BlobCache` 3 instances never populated; only cleared in DELETE route | Dead code, eviction logic untested |
| **GH2R-020** | Low | `frontend/lib/repo-diagram/pipeline-v2.ts:18` | `PROGRESS_STAGE_MAP verifying→analyzing_relationships` duplicates; `verifying` invisible to UI | Users can't tell verify pruning from rel-gen |

Current test gate: `frontend: npm test` 945 tests pass – none cover private-repo archive fallback, `detailLevel` cache isolate, Python `app/` import, or verifier drop rate.

---

## 4. Dependency Graph

```
Phase 1 (GH2R-001,002,005,006,007)  ─┐
Phase 2 (GH2R-003,008)               ├─► Phase 3 (GH2R-009,010,011,012,013,015) ──► Phase 4 (GH2R-004,014,016,017)
Phase 5 (GH2R-018,019,020) ──────────┘                                          ──► Phase 6 (eval, docs)
```

Phase 3 must land after Phase 1 because evidence completeness depends on ingestion file set; Phase 4 depends on Phase 3 because verifier behavior changes with evidence density.

---

## 5. Phase Overview

| Phase | PR | Fixes | Est LoC | Risk |
|---|---|---|---|---|
| **1** | **A — Ingestion & GitHub contract** | GH2R-001,002,005,006,007 | ~220 logic + 120 tests | Medium (rate-limit path) |
| **2** | **B — Cache & streaming** | GH2R-003,008 | ~90 logic + 80 tests | Low |
| **3** | **C — Static + import evidence** | GH2R-009,010,011,012,013,015 | ~260 logic + 150 tests | Medium |
| **4** | **D — Verifier / heuristic / finalize** | GH2R-004,014,016,017 | ~180 logic + 100 tests | Medium |
| **5** | **E — Types, dead code, polish** | GH2R-018,019,020 + typing | ~120 logic | Low |
| **6** | **F — Eval & docs** | Golden snapshot refresh, docs | ~80 + eval runs | Low |

Total wall time: ~2-3 engineer-days if phases are sequential with eval between 3→4.

---

## Phase 1 — Ingestion & GitHub Contract Correctness (P0)

### Objective
Make GitHub fetch honest, budget-consistent, and skip-consistent across tarball vs Contents-API.

### Rationale
All downstream stages consume `RepoSnapshot`. If ingestion silently truncates or starves, every LLM stage is wasted.

### Files

* `frontend/lib/github-ingestion.ts` (main)
* `frontend/lib/repo-diagram/tarball-ingestion.ts` (aligned)
* `frontend/lib/repo-diagram/skip-rules.ts` **NEW** (extract `isSkipped`, constants)
* `frontend/app/api/repo-diagram/route.ts` (token regex)
* `frontend/lib/repo-diagram/__tests__/tarball-ingestion.test.ts` (extend)
* `frontend/lib/repo-diagram/__tests__/baseline-granularity.test.ts` (keep green)

### Step-by-Step Implementation

#### 1.1 Extract skip rules (breaks circular import future-proof)

**1.1.1 Create `frontend/lib/repo-diagram/skip-rules.ts`:**

```ts
export const MAX_FILE_SIZE_BYTES = 500 * 1024;
export const SKIPPED_DIRECTORIES = new Set([...]); // identical to github-ingestion.ts:134
export const BINARY_RE = /\.(png|jpg|jpeg|gif|ico|svg|woff2?|eot|ttf|otf|pdf|zip|tar|gz|br|webp|mp[34]|wav|ogg|avif|heic)$/i;
export const ConfigSkipReason = { LARGE_FILE:'large_file', SKIPPED_DIR:'skipped_directory', LOCKFILE:'lockfile', TEST_FILE:'test_file', BINARY:'binary' } as const;
export function isSkipped(path: string, size?: number): string | null { ... } // move verbatim
```

**1.1.2 Update imports:**

```ts
// frontend/lib/github-ingestion.ts:2
import { isSkipped, MAX_FILE_SIZE_BYTES, SKIPPED_DIRECTORIES, BINARY_RE, ConfigSkipReason } from './repo-diagram/skip-rules';
// frontend/lib/repo-diagram/tarball-ingestion.ts:2
import { isSkipped, BINARY_RE, MAX_FILE_SIZE_BYTES } from './skip-rules';
```

Update `tarball-ingestion.ts:97-99` to reuse `isSkipped` (currently `isSkipped(path, sz)`) and keep `BINARY_RE` redundant check only if needed for decompressed-size guard.

**Acceptance:** `npx tsc --noEmit` passes, grep `from '../github-ingestion'` removed from `tarball-ingestion.ts`.

#### 1.2 Fix `userGithubToken` regex (GH2R-002)

**Before** `frontend/app/api/repo-diagram/route.ts:56`:

```ts
const safeUserToken =
  typeof userGithubToken === 'string' &&
  /^gh[pos]_[A-Za-z0-9_]{36,}$/.test(userGithubToken)
    ? userGithubToken
    : undefined;
```

**After:**

```ts
// Legacy PATs: ghp_ / gho_ / ghs_ / ghu_ / ghr_ +Fine-grained: github_pat_...
// Length: GitHub docs guarantee >= 40 chars for legacy, ~93 for fine-grained; keep lower bound 20 to avoid rejecting future rotation.
const GITHUB_TOKEN_RE =
  /^(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})$/;

const safeUserToken =
  typeof userGithubToken === 'string' && GITHUB_TOKEN_RE.test(userGithubToken.trim())
    ? userGithubToken.trim()
    : undefined;

// If a token was supplied but rejected, surface a warning (do not fail ingestion; fall back to env token)
if (typeof userGithubToken === 'string' && userGithubToken.trim() && !safeUserToken) {
  logger.warn('[API] userGithubToken supplied but did not match PAT format — ignoring; set GITHUB_TOKEN or supply a valid ghp_/github_pat_ token');
}
```

**Rationale:** `gh[pos]` char class missed `ghu_` (user-to-server) and `ghr_` (refresh) and all fine-grained tokens. Use explicit `gh[pousr]` + `github_pat_`.

**Tests:** Add `frontend/lib/utils/__tests__/githubUrl.test.ts` or extend route tests to assert accepted/rejected token strings (do not log tokens).

#### 1.3 Make archive failure explicit (GH2R-001, GH2R-005)

**1.3.1 Tarball stage: surface typed reason**

Change `frontend/lib/repo-diagram/tarball-ingestion.ts:27` signature to return `ArchiveResult | { kind:'unavailable', reason:'private'|'not_found'|'rate_limited'|'too_large'|'network', status:number } | null`:

Simplify: keep `Promise<ArchiveResult | null>` but add structured logging + propagate HTTP status via a new helper `fetchRepoArchiveWithDetail`. Minimal viable: at `tarball-ingestion.ts:48`:

```ts
if (!res.ok) {
  if (res.status === 404) {
    logger.warn(`[Tarball] archive 404 for ${owner}/${repo} — likely private or not found`);
  } else if (res.status === 401 || res.status === 403) {
    const rl = res.headers.get('x-ratelimit-remaining');
    logger.warn(`[Tarball] archive ${res.status} for ${owner}/${repo} remaining=${rl}`);
  }
  return null; // caller still falls back; error surfacing handled at ingest level
}
```

**1.3.2 Ingestion level: propagate truncation & rate-limit as typed errors**

In `frontend/lib/github-ingestion.ts:398-405`:

* Keep throwing on `getDefaultBranch` 404/403 with rate-limit message (already good).
* For `getRecursiveTree` truncated flag: do not just warn. At `frontend/lib/github-ingestion.ts:408`:

```ts
// After getRecursiveTree:
if (treeData.truncated) {
  logger.warn(`[Ingest] tree truncated @${headSha.slice(0,7)} (${treeItems.length} entries). Some subsystems will be missing.`);
}
// Return snapshot.treeTruncated=true (already does) and also set snapshot.diagnostics = { treeTruncatedAt: treeItems.length }
// Do NOT throw — pipeline handles degraded flag.
// FinalizationStage already maps treeTruncated → reviewNotes; keep.
```

For signal starvation: if `treeItems.length>50000`, slice is NOT applied today (only warns); keep that but add metric: `skippedCounts.tree_sampled = treeItems.length - 50000` when sampled in future (no sampling now).

**1.3.3 Surface `isPrivate` to UI correctly via `Snapshot.isPrivate` already stored `frontend/lib/github-ingestion.ts:909` — ensure `FinalizationStage.ts:165` reviewNote mentions private when `snapshot.isPrivate && !token` (add in Phase 5).

#### 1.4 Unify budgets (GH2R-006) + per-file guards (GH2R-007)

**1.4.1 Normalize constants in `skip-rules.ts`:**

```ts
export const MAX_FILE_SIZE_BYTES = 500 * 1024; // canonical
export const MAX_ARCHIVE_CONTENT_LENGTH_BYTES = 500 * 1024 * 1024;
export const MAX_TOTAL_EXTRACTED_BYTES = 200 * 1024 * 1024;
export const DEFAULT_FILE_BUDGET: Record<number, number> = { 1: 400, 2: 900, 3: 1800 }; // reduce from 500/1000/2000 to leave headroom for archiveMap
export const DEFAULT_CONTENT_BUDGET_KB: Record<number, number> = { 1: 1500, 2: 8000, 3: 12000 }; // level-aware, replaces single 10000
```

**1.4.2 `IngestionStage.ts:23-28` — make budgets level-aware:**

```ts
export class IngestStage extends BaseStage<IngestionInput, IngestionOutput> {
  async execute(...) {
    const fileBudget = DEFAULT_FILE_BUDGET[input.detailLevel] ?? 900;
    const contentBudgetKB = DEFAULT_CONTENT_BUDGET_KB[input.detailLevel] ?? 8000;
    const ingestOpts = { fileBudget, contentBudgetKB };
    ...
  }
}
```

Export `DEFAULT_FILE_BUDGET` from `skip-rules` so eval scripts can import.

**1.4.3 `github-ingestion.ts:538-864` — unify Content-API path to respect same caps as tarball:**

* Both paths now use `isSkipped(path, sizeOrContentLength)` where `size` falls back to `content.length` when archive path.
* Keep `MAX_FILE_SIZE_BYTES` as single source.
* In Contents-API `promisePool` (`github-ingestion.ts:854`), replace:

```ts
if ((item.size || 0) > MAX_FILE_SIZE_BYTES) return null;
```

with `if (isSkipped(path, item.size)) return null;` (covers binary/file-type).

* Ensure tarball `unzip.onfile: sz > MAX_FILE_SIZE_BYTES` (`tarball-ingestion.ts:97`) uses imported constant.

**1.4.4 Tarball streaming backpressure:**

Add `totalBytes` check uses decompressed size after `concatU8` double-check already present `tarball-ingestion.ts:112`. Keep but also abort early if `totalBytes + sz > MAX_TOTAL_EXTRACTED_BYTES` and set `aborted=true` + `snapshot.diagnostics.truncatedAtCap=true`.

### Tests Added (Phase 1)

* `frontend/lib/repo-diagram/__tests__/skip-rules.test.ts` — NEW: matrix `isSkipped('a/b/node_modules/x', 100)` → `skipped_directory`, `'photo.png'` → `binary`, `'yarn.lock'` → `lockfile`, `'foo.test.ts'` → `test_file`, edge `'500KB+1'` → `large_file`.
* `frontend/lib/repo-diagram/__tests__/tarball-ingestion.test.ts` — ADD: archive 401/404 logs + fallback, `MAX_FILE_SIZE` alignment test.
* `frontend/lib/repo-diagram/__tests__/github-ingestion-budget.test.ts` — NEW: assert `IngestStage` opts for each detailLevel, and that tarball vs Contents-API produce same `isSkipped` decisions for a fixture file list.
* Route token test: `frontend/app/api/repo-diagram/__tests__/route-token.test.ts` — fixture strings `ghp_…`, `github_pat_…`, `invalid` → accepted/rejected.

### Acceptance Criteria

* [ ] `isSkipped` only defined in `skip-rules.ts`; no duplication.
* [ ] Fine-grained PAT `github_pat_11A...` accepted; legacy `ghp_` still accepted; short garbage rejected with warning logged.
* [ ] Private repo without token returns 404-typed error (not mis-labeled rate-limit).
* [ ] `npx tsc --noEmit` green; existing `tarball-ingestion`, `baseline-granularity`, `graph-quality` tests green.

---

## Phase 2 — Cache, Streaming & Quota Correctness (P0)

### Objective

Prevent cache poisoning across `detailLevel` and make SSE lifecycle robust.

### Files

* `frontend/lib/ai/services/diagramCache.ts` (key)
* `frontend/lib/ai/services/repoDiagramRedisCache.ts` (key)
* `frontend/lib/repo-diagram/pipeline-stages/CacheCheckStage.ts`
* `frontend/lib/repo-diagram/pipeline-stages/CacheWriteStage.ts`
* `frontend/lib/repo-diagram/pipeline-stages/shared-keys.ts` (add detailLevel to shared)
* `frontend/app/api/repo-diagram/route.ts` (SSE lifecycle)
* `frontend/lib/pipeline-core/Pipeline.ts` (progress weight already fixed; verify abort)

### Step-by-Step

#### 2.1 DetailLevel-scoped cache key (GH2R-003)

**Before** `frontend/lib/ai/services/diagramCache.ts:28`:

```ts
function getRepoCacheKey(repoUrl: string, headSha: string): string {
  return `${PIPELINE_VERSION}::${repoUrl}::${headSha}`;
}
```

**After:**

```ts
function getRepoCacheKey(repoUrl: string, headSha: string, detailLevel?: 1|2|3): string {
  // PIPELINE_VERSION busts on pipeline semantics; detailLevel busts on budget/LLM gate.
  return `${PIPELINE_VERSION}::${repoUrl}::${headSha}::L${detailLevel ?? 2}`;
}
// Keep backward compat: reads try new key first, then old key for one TTL window (30m).
export function getRepoDiagram(repoUrl: string, headSha: string, detailLevel?: 1|2|3): PipelineResult | null {
  const newKey = getRepoCacheKey(repoUrl, headSha, detailLevel);
  let entry = repoCache.get(newKey);
  if (entry && !isExpired(entry.cachedAt)) return entry.result;
  // Compat: check old key without level, but only return if detailLevel is undefined or 2 (old default)
  if (detailLevel === undefined || detailLevel === 2) {
    const oldKey = `${PIPELINE_VERSION}::${repoUrl}::${headSha}`;
    entry = repoCache.get(oldKey);
    if (entry && !isExpired(entry.cachedAt)) return entry.result;
  }
  return null;
}
export function setRepoDiagram(repoUrl: string, headSha: string, result: PipelineResult, detailLevel?: 1|2|3): void {
  const key = getRepoCacheKey(repoUrl, headSha, detailLevel);
  // write both new and old keys during migration window (remove old write after 1 release)
  ...
}
```

Same change in `frontend/lib/ai/services/repoDiagramRedisCache.ts:8`:

```ts
function key(repoUrl: string, headSha: string, detailLevel?: 1|2|3): string {
  return `repo-diagram:${PIPELINE_VERSION}:${repoUrl}:${headSha}:L${detailLevel ?? 2}`;
}
export async function getRepoDiagramFromRedis(repoUrl: string, headSha: string, detailLevel?: 1|2|3) ...
export async function setRepoDiagramInRedis(repoUrl: string, headSha: string, result: PipelineResult, detailLevel?: 1|2|3) ...
```

**Call sites:**

* `frontend/lib/repo-diagram/pipeline-stages/CacheCheckStage.ts:22`:

```ts
const detailLevel = detailLevelFromContext(context, 2);
let cached = getRepoDiagram(repoUrl, snapshot.headSha, detailLevel);
if (!cached) {
  cached = await getRepoDiagramFromRedis(repoUrl, snapshot.headSha, detailLevel);
  if (cached) setRepoDiagram(repoUrl, snapshot.headSha, cached, detailLevel);
}
```

* `frontend/lib/repo-diagram/pipeline-stages/CacheWriteStage.ts:37`:

```ts
setRepoDiagram(repoUrl, write.headSha, result, detailLevelFromContext(context, 2));
await setRepoDiagramInRedis(repoUrl, write.headSha, result, detailLevelFromContext(context, 2));
```

* Store `detailLevel` in `PipelineContext.metadata.detailLevel` already done (`pipeline-v2.ts:58`). Ensure `CacheWriteStage` imports `detailLevelFromContext`.

**Tests:** `frontend/lib/repo-diagram/__tests__/diagram-cache-detaillevel.test.ts` — NEW: set L1, get L1 hits, get L2 misses, L2 set hits, L1 still hits.

#### 2.2 SSE abort & quota fix (GH2R-008)

**Before** `frontend/app/api/repo-diagram/route.ts:70-121` (detached IIFE, unconditional `incrementAIGeneration`).

**After:**

```ts
const encoder = new TextEncoder();
const stream = new TransformStream();
const writer = stream.writable.getWriter();
let clientAborted = false;
req.signal.addEventListener('abort', () => { clientAborted = true; });

const send = async (data: object) => {
  if (clientAborted) return;
  try {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  } catch (e) {
    // Client disconnected mid-write
    clientAborted = true;
    logger.warn('[API] SSE writer closed (client abort)', e);
  }
};

(async () => {
  try {
    const outcome = await generateRepoArchitectureDiagramV2(
      parsed.canonical,
      resolvedDetail,
      req.signal,
      safeUserToken,
      (event) => { void send({ type: 'progress', ...event }); }
    );
    if (clientAborted) return; // do not charge quota

    if (!outcome.success) {
      await send({ type: 'error', message: outcome.error.message, code: outcome.code });
      return;
    }
    // ... existing quota increment + logUsage only if not aborted
    if (!clientAborted) {
      const session = await getSessionFromRequest(req);
      await incrementAIGeneration(session?.user?.id ?? null);
      await logUsage(session?.user?.id ?? null, getGuestId(req), 'ai_generation', { description: `repo:${parsed.canonical}`, nodeCount: result.nodeCount });
    }
    await send({ type: 'result', payload: ... });
  } catch (error) {
    if (!clientAborted) await send({ type: 'error', message: ..., code: 'unknown' });
  } finally {
    try { await writer.close(); } catch {}
  }
})();
```

Also add `pipeline-v2.ts:82` progress mapping fix for GH2R-020 (duplicate `verifying`): change `verifying:'analyzing_relationships'` to keep but add explicit `verifying:'verifying'` and extend `PipelineProgressEvent` type in `frontend/lib/types/repo-diagram.ts:246` if needed (already has `'compiling'` but not `'verifying'`; map to `'analyzing_relationships'` for compat but log distinct).

### Acceptance

* [ ] `getRepoDiagram(url, sha, 1)` and `getRepoDiagram(url, sha, 2)` isolated.
* [ ] Client abort during pipeline does not increment quota (manual test: `curl --max-time 1` abort → DB `usage_logs` unchanged).
* [ ] `writer.write` rejection does not crash process (add test with mocked writer that throws).

---

## Phase 3 — Static Analysis & Evidence Graph Completeness (P1)

### Objective
Make non-JS stacks produce evidence comparable to Next.js.

### Files

* `frontend/lib/repo-diagram/static-analyzer.ts` (routes, deps, SDK)
* `frontend/lib/repo-diagram/import-graph.ts` + `import-resolvers.ts`
* `frontend/lib/repo-diagram/static-detector.ts` (if duplicative)
* `frontend/lib/repo-diagram/__tests__/import-graph.test.ts` (extend)
* `frontend/lib/repo-diagram/__tests__/static-detector.test.ts` (extend)

### Steps

#### 3.1 Python roots (GH2R-009)

**Before** `frontend/lib/repo-diagram/import-resolvers.ts:218-229`:

```ts
function collectPythonRoots(files: FileEntry[]): string[] {
  const roots = new Set<string>(['', 'src']);
  for (const f of files) if (f.path.endsWith('/__init__.py')) roots.add(...);
}
```

**After:**

```ts
function collectPythonRoots(files: FileEntry[]): string[] {
  const roots = new Set<string>(['', 'src', 'app', 'backend', 'server', 'api', 'services']);
  // Also infer from fileTree top-level Python dirs that contain __init__.py or WSGI entry
  const candidates = new Set<string>();
  for (const f of files) {
    if (!f.path.endsWith('/__init__.py')) continue;
    const pkgDir = f.path.slice(0, -'/__init__.py'.length).split('/')[0];
    if (pkgDir) candidates.add(pkgDir);
  }
  // If snapshot has fileTree entry `app/models/user.py`, `app` is a root
  for (const f of files) {
    const top = f.path.split('/')[0];
    if (['app','backend','server','api','src'].includes(top)) roots.add(top);
  }
  for (const c of candidates) roots.add(c);
  // Order: shortest root last so exact matches prefer longer prefix; dedup handled by caller loop
  return Array.from(roots).sort((a,b) => a.length - b.length);
}
// In resolvePython, loop already tries each root; ensure `modulePath` resolved via fileSet.has(`<root>/<module>.py`)
```

**Edge:** For monorepos `backend/app/...`, add dynamic top-level detection from `snapshot.fileTree` (pass `fileTree` into resolver or infer from `files` that include snapshot prefix). Minimal: add `'backend'` and `'server'` hard-coded + candidates set covers rest.

**Test:** Fixture `app/api/routes.py` imports `from models.user import User` with fileTree `['app/models/user.py']` → `kind:'internal'` not `external`.

#### 3.2 TS alias fix (GH2R-010)

**Inspect** `frontend/lib/repo-diagram/import-resolvers.ts:108-134` — patch:

```ts
function applyAlias(spec: string, pattern: string, target: string, baseUrl: string): string {
  const base = pattern.replace(/\/\*$/, '');
  const suffix = spec.startsWith(base + '/') ? spec.slice(base.length + 1) : spec === base ? '' : null;
  if (suffix === null) return '' // not matching
  let targetBase = target.replace(/\/\*$/, '').replace(/^\.\//, '');
  if (targetBase === '.' || targetBase === '') targetBase = '';
  let normBase = baseUrl.replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');
  if (normBase === '.' || normBase === '') normBase = '';
  const rel = suffix ? (targetBase ? `${targetBase}/${suffix}` : suffix) : targetBase;
  const joined = normBase ? `${normBase}/${rel.replace(/^\/+/, '')}` : rel;
  return joined.replace(/^\/+/, '').replace(/^\.\//, '');
}
function resolveAliasTarget(targetPath: string, fileSet: Set<string>, exts: string[]): string | null {
  const norm = targetPath.replace(/^\.\//, '').replace(/\/+/g, '/');
  // Try verbatim, then exts, then index -- KEEP but add extensionless check for `.tsx` path
  ...
}
```

**Add test:** tsconfig `{ baseUrl: ".", paths: {"@/*":["src/*"]}}`, import `@/components/Button` → `src/components/Button.tsx` (not `src/components/Button` missing ext).

#### 3.3 Spring routes (GH2R-011)

**Before** `frontend/lib/repo-diagram/static-analyzer.ts:212`:

```ts
/@(?:Get|Post|Put|Delete|Patch|Request)Mapping\(['"`]([^'"`]+)['"`]\s*[,\)]/g
```

**After:**

```ts
/*
  Handles:
    @GetMapping("/orders")
    @GetMapping(value = "/orders")
    @GetMapping(path = "/orders")
    @RequestMapping(value = "/api", method = RequestMethod.GET)
    @GetMapping({"/a","/b"})  -- captures first
*/
const SPRING_MAPPING_RE = /@(?:Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?(?:\{\s*)?['"`]([^'"`]+)['"`]/g;
```

Replace loop at `static-analyzer.ts:191` to push `SPRING_MAPPING_RE` instead of old. Also keep existing generic `.route(` patterns.

**Test:** Java snippet with `@RestController` + `@GetMapping(value="/api/users")` → `route` signal `label="/api/users"`.

#### 3.4 Go internal packages (GH2R-012)

At `frontend/lib/repo-diagram/import-resolvers.ts:233-255` `resolveGo`:

* If `findGoModulePath` returns `null`, treat `spec` that is relative (contains `.` or `/` and first segment matches a fileTree dir) as `internal` via fileTree prefix match before classifying as external.
* Also add fallback: if `fileSet.has(spec + '.go')` or any file starts with `spec + '/'`, treat as internal with that path.

**Snippet:**

```ts
function resolveGo(spec: string, _importer: string, fileSet: Set<string>, files: FileEntry[]): ResolveResult {
  const modulePath = findGoModulePath(files);
  if (modulePath && (spec === modulePath || spec.startsWith(modulePath + '/'))) { ... existing ... }
  // Fallback for modules without go.mod or vendored imports
  if (fileSet.has(`${spec}.go`)) return { kind:'internal', path: `${spec}.go` };
  for (const p of fileSet) if (p.startsWith(spec + '/') && p.endsWith('.go')) return { kind:'internal', path: p };
  // External fallback
  const parts = spec.split('/'); ...
}
```

#### 3.5 Package categories (GH2R-013) + pyproject naive parsing (GH2R-015)

**`static-analyzer.ts:115` `PACKAGE_CATEGORIES`** — add:

```ts
[/^(mysql2|oracledb|pgvector|@planetscale|better-sqlite3)$/, 'database'],
[/^(@auth\/core|next-auth|@auth\/.*)/, 'auth'],
[/^(drizzle-orm|kysely|mikro-orm)$/, 'database'],
[/^(opentelemetry|@opentelemetry\/.*)/, 'monitoring'],
```

**`detectPackageDeps` pyproject (static-analyzer.ts:100):** replace naive `/"([a-zA-Z][...]"/g` with:

```ts
if (file.path.endsWith('pyproject.toml')) {
  // PEP 621: look inside [project].dependencies and [tool.poetry].dependencies only
  const depSection = toml.match(/\[project\][\s\S]*?(?=\n\[|$)/)?.[0] ?? toml.match(/\[tool\.poetry\.dependencies\][\s\S]*?(?=\n\[|$)/)?.[0] ?? '';
  if (depSection) for (const m of depSection.matchAll(/"([a-zA-Z0-9_.-]+)"/g)) { ... categorize ... }
  // Do not parse whole file
}
```

**SDK usage filter:** `detectSdkUsage` (`static-analyzer.ts:385`) already skips `package.json` but should also skip `pyproject.toml`, `go.mod`, `Cargo.toml` — extend regex: `/(package\.json|pyproject\.toml|requirements\.txt|go\.mod|Cargo\.toml|\.env)/`.

### Tests (Phase 3)

* `import-graph.test.ts` — add cases: Python `app/models/foo.py` resolving, TS `@/` alias with `baseUrl:"."`, Go package without `go.mod`, Spring route `value=` variant.
* `static-analyzer.test.ts` — add Spring `value="/x"` fixture asserting `route` signal; `pyproject.toml` non-dep quoted string not captured; `postcss` not miscategorized.

### Acceptance

* [ ] `buildImportGraph` for fixture `archdraw`-like repo: Python `app/` imports map internal; prior external count drops by >50%.
* [ ] No new false-positive `dependency` signals from README-like `pyproject.toml` description strings.
* [ ] Existing import-graph / route-detection tests green.

---

## Phase 4 — Verifier / Heuristic / Finalization Semantics (P1)

### Objective

Stop verifier from zeroing out real diagrams and make sparse-graph handling honest.

### Files

* `frontend/lib/agents/repo-verifier.ts` (GH2R-004)
* `frontend/lib/agents/repo-heuristic-extractor.ts` (edge budget)
* `frontend/lib/repo-diagram/pipeline-stages/VerifyStage.ts`
* `frontend/lib/repo-diagram/pipeline-stages/FinalizationStage.ts` (GH2R-017, GH2R-014)
* `frontend/lib/repo-diagram/pipeline-stages/ClassifyStage.ts` (GH2R-014)
* `frontend/lib/repo-diagram/graph-quality.ts` (orphan logic)

### Steps

#### 4.1 Verifier demote-not-drop policy (GH2R-004)

**Current** `repo-verifier.ts:119-126`:

```ts
if (rank[edge.confidence] > rank.low) { edgesCappedToLow++; verifiedEdges.push({...edge, confidence:'low'}); }
else if (/\(assumed\)/i.test(edge.label||'')) verifiedEdges.push(edge);
else edgesDropped++;
```

**Fix:** When `importGraph` is sparse (evidence coverage < 30% of nodes), demote instead of dropping. Add evidence density signal:

```ts
const evidenceCoverage = evidenceEdgeSet.size / Math.max(1, nodes.length); // edges per node
const isSparseEvidence = evidenceCoverage < 0.3 || importGraph?.edges.size === 0;
// ... inside loop, no evidence branch:
if (rank[edge.confidence] > rank.low) {
  edgesCappedToLow++; verifiedEdges.push({...edge, confidence:'low'});
} else if (/\(assumed\)/i.test(edge.label||'')) {
  verifiedEdges.push(edge);
} else if (isSparseEvidence && edge.confidence === 'low') {
  // Keep but mark low — better to have a "possibly present" edge than 0 edges
  // Only keep if edge type is meaningful (http_call, db_query, external_call)
  if (['http_call','db_query','external_call','auth_check'].includes(edge.type)) {
    verifiedEdges.push(edge);
  } else {
    edgesDropped++;
  }
} else {
  edgesDropped++;
}
```

**Update `VerifyStage.ts:38`** to pass through `preVerifierHighEdgeCount` correctly and also log `stats`.

**Update `FinalizationStage.ts:211` `evidencedEdgeRatio`** denominator: use `preVerifierHighEdgeCount / max(1, edges.length)` only when `useLlm` — keep but ensure verifier change feeds correct ratio (do not double count dropped edges).

**Alternative considered:** delete verifier dropping entirely → rejected; dropping still valuable for dense JS/TS repos with hallucinated edges. Chosen policy: sparse-mode preserve.

**Test:** `repo-verifier.test.ts` — NEW: fixture 5 nodes, 0 import edges, 3 low edges `http_call`; expect 3 kept after verify (sparse). Fixture dense (20 import edges) with low hallucinated → dropped.

#### 4.2 Small-repo honesty (GH2R-014)

**Before** `ClassifyStage.ts:24`:

```ts
const hasAnySourceFiles = snapshot.phase2Files.length >=1 || snapshot.selectedFiles.length >=4;
const hasAnySignals = signals.length >=3;
const useLlm = detailLevel !==1 && (hasAnySourceFiles || hasAnySignals);
```

**After:**

```ts
const hasAnySourceFiles = snapshot.phase2Files.length >=1 || snapshot.selectedFiles.length >=3; // lower to 3
const hasAnySignals = signals.length >=2;
const useLlm = detailLevel !==1 && (hasAnySourceFiles || hasAnySignals);
// But when falling back to static-only for tiny repos, ensure baseline produces at least 2 nodes or we surface a typed error
if (!useLlm && snapshot.selectedFiles.length < 2 && signals.length < 2) {
  logger.warn(`[Pipeline] Repo too small for meaningful diagram (files=${snapshot.selectedFiles.length}, signals=${signals.length})`);
  // Do NOT throw — let Finalization produce 1-node diagram with explicit reviewNotes (already done in FinalizationStage.ts:168)
}
```

**Add `reviewNotes`** at `FinalizationStage.ts:168` to distinguish: `Only N components were detected...` already exists; ensure tiny-repo note includes `Try a larger detailLevel (L3)` hint.

#### 4.3 Normalize merge collisions (GH2R-016)

**Before** `graph-quality.ts:24` `normalizeLabelKey` strips `api/service/...` then `[^a-z0-9]`. `"API"` → `''`, `"Service"` → `''`. Two generics collide.

**After:**

```ts
function normalizeLabelKey(label: string): string {
  const stripped = label.toLowerCase().replace(/\s*\([^)]*\)/g, '');
  // Only strip whole-word suffix/prefix with word boundary, keep core if result empty
  const withoutGeneric = stripped.replace(/\b(api|service|database|db|cache|worker|module)\b/g, '').trim();
  const alnum = withoutGeneric.replace(/[^a-z0-9]/g, '').trim();
  if (!alnum) return label.toLowerCase().replace(/[^a-z0-9]/g, '').trim() || slugId(label);
  return alnum;
}
```

Same fix duplicated in `frontend/lib/repo-diagram/pipeline-stages/internal-helpers.ts:30` — unify by importing from `graph-quality` (or `skip-rules`).

**Test:** `graph-quality.test.ts` — fixture nodes `label='API'` vs `'Service'` should not merge.

#### 4.4 Re-clarify sparse-graph orphan keep (GH2R-017)

**Current** `FinalizationStage.ts:89-96` `connected.size<3` keeps `importantTypes` orphans unconditionally → undoes verifier.

**Fix:** tighten condition:

```ts
if (connected.size < 3) {
  // Only keep grounded important types (sourceFiles>0) or high confidence
  keptNodes = normalizedNodes.filter(n =>
    connected.has(n.id) ||
    (importantTypes.has(n.type) && n.sourceFiles.length > 0) ||
    (n.confidence === 'high' && n.sourceFiles.length > 0)
  );
}
```

Add same `groundedIds` check as `isImportantOrphan` already does (`graph-quality.ts:432`).

### Tests (Phase 4)

* `repo-verifier.test.ts` — sparse vs dense fixtures.
* `graph-quality.test.ts` — generic label collision not merging.
* `FinalizationStage` sanitize test (existing) — add sparse with 2 connected + 5 orphan important → only grounded kept.

### Acceptance

* [ ] Python repo fixture (10 source files, 0 import edges, 4 LLM edges) retains >=2 edges post-verify (was 0).
* [ ] Dense JS repo still drops hallucinated low edge (no regression).
* [ ] No two distinct `API` nodes merged accidentally.

---

## Phase 5 — Type Safety, Dead Code & Observability (P2)

### Objective
Close low-sev issues without behavior churn.

### Files per issue

#### GH2R-018 `reviewNotes` env hint

`frontend/lib/repo-diagram/pipeline-stages/FinalizationStage.ts:178`:

```ts
// After: if (!process.env.GITHUB_TOKEN) note...
const effectiveToken = process.env.GITHUB_TOKEN || input.userGithubToken; // pass through
if (!effectiveToken) notes.push('No GITHUB_TOKEN detected ...');
// Replace: thread `userGithubToken` from ingestion snapshot or context metadata.

interface FinalizationInput { ... userGithubToken?: string }
```

**Fix:** Thread `userGithubToken` from `IngestionStage` output through `EnrichmentInput` to `FinalizationInput`. If `userGithubToken` present, skip the note.

#### GH2R-019 Dead blobCache

Options: A) Delete files + tests + DELETE route clear calls; B) Wire it for real. Recommended **A for now** (YAGNI) — keep `frontend/lib/cache/blobCache.ts` but remove `clearBlobCaches()` import in `route.ts:139` (only re-enable when blobCache producer exists). Add comment `// BlobCache is reserved for future composite SHA optimization — not wired`.

Or if keeping: ensure `frontend/lib/github-ingestion.ts` populates `archiveMap` into blobCache via `setCachedSummaries` (out of scope).

#### GH2R-020 Progress map

`frontend/lib/repo-diagram/pipeline-v2.ts:18`:

```ts
const PROGRESS_STAGE_MAP: Record<string, PipelineProgressEvent['stage']> = {
  ingesting: 'ingesting',
  'cache-check': 'ingesting',
  analysis: 'detecting_subsystems',
  baseline: 'extracting_signals',
  classifying: 'classifying',
  extracting_components: 'extracting_components',
  analyzing_relationships: 'analyzing_relationships',
  verifying: 'verifying', // NEW — add 'verifying' to PipelineStage union in repo-diagram.ts:244
  finalization: 'compiling',
  'cache-write': 'done',
};
```

Extend `PipelineStage` type (`frontend/lib/types/repo-diagram.ts:244`) to include `'verifying'`.

#### Typing hardening

* `frontend/lib/repo-diagram/pipeline-stages/ExtractStage.ts:42` — assert `repoProfile` non-null after `useLlm` guard; narrow type.
* `frontend/lib/repo-diagram/import-resolvers.ts` — add explicit return types for all resolvers to satisfy `npx tsc --noEmit`.
* Remove any `Stage<any,any>` leftovers (grep).

### Tests

* `repo-diagram/__tests__/pipeline-v2-structure.test.ts` — add progress stage distinctness test.

---

## Phase 6 — Test & Eval Hardening + Rollout (P2)

### Objective
Prevent regression of GH2R-001→020 via golden evals.

### Steps

#### 6.1 Golden snapshot refresh

* Run `npm run eval:repo` corpus against current main (baseline) → note composite scores.
* After Phases 1-4, run again `npm run eval:repo:report` → assert:
  * Python corpus score delta >0 (evidence-driven).
  * No regression on JS corpus (> 2 pp drop triggers investigation).
  * `python-import-resolution` fixture composite decode passes.

#### 6.2 New tests required (summary)

| Test file | Covers |
|---|---|
| `skip-rules.test.ts` | isSkipped matrix |
| `tarball-ingestion.test.ts` + `github-ingestion-budget.test.ts` | budget unify |
| `diagram-cache-detaillevel.test.ts` | GH2R-003 isolation |
| `import-graph.test.ts` | python roots, TS alias, Go, Spring |
| `static-analyzer.test.ts` | spring value=, pyproject non-dep |
| `repo-verifier.test.ts` | sparse vs dense keep |
| `graph-quality.test.ts` | generic label not merge |
| `route-token.test.ts` | GH PAT acceptance |

#### 6.3 Documentation

* Update `AGENTS.md` §8, §3 `Layout rule` unchanged but add `Ingestion owner: skip-rules.ts` + `Cache key: PIPELINE_VERSION::url::sha::L{level}`.
* Update `docs/pipeline-refactor-plan.md` inventory after Phase 5.
* This plan doc moves to `Done` after Phase 6.

### Acceptance (whole effort)

* [ ] `npx tsc --noEmit` green.
* [ ] `npm test` 945+ (new 20+) tests green.
* [ ] `npm run eval:repo` composite not regressed; Python +2pp.
* [ ] Manual private-repo test with `github_pat_` succeeds; abort mid-stream doesn't charge quota.

---

## 7. Cross-Cutting Concerns

### Environment Variables

| Var | Before | After |
|---|---|---|
| `GITHUB_TOKEN` | optional, legacy-only fallback | + per-request token preferred, `github_pat_` accepted |
| `REPO_LLM_MODEL` / `*_MAX_TOKENS` | global defaults | + `DEFAULT_CONTENT_BUDGET_KB` per level (Phase 1) |
| `ARCHIVE_CACHE_SIZE` | entry count 25 | + byte-budget 32 MB LRU (Phase 1.1 eviction) |

### Cache Invalidation

* Bump `PIPELINE_VERSION` in `frontend/lib/ai/services/pipelineVersion.ts` after Phase 2 (key shape changes). Old `::sha` entries expire in 5m dev / 30m prod anyway, but bump guarantees not mixing.
* Redis keys with old shape (`repo-diagram:VERSION:url:sha`) remain but read fallback in Phase 2 reads both; remove fallback after 1 release.

### Security

* Token logging: never log `safeUserToken` value; only `hasToken: boolean` + `tokenType: 'legacy'|'fine-grained'|'none'`.
* Rate-limit errors: preserve `x-ratelimit-reset` message already in `github-ingestion.ts:31`; do not expose token presence to client beyond boolean.

---

## 8. Test Plan Matrix

| Phase | Unit (`frontend/`) | Integration | Eval / Manual |
|---|---|---|---|
| 1 | `skip-rules`, `tarball-ingestion`, `github-ingestion-budget`, `route-token` | `POST /api/repo-diagram` with private 404 fixture (mock fetch) | — |
| 2 | `diagram-cache-detaillevel`, `pipeline-v2-structure` (progress) | SSE abort with mocked `writer` + DB spy | — |
| 3 | `import-graph`, `static-analyzer`, `route-detection` | — | `eval:repo` Python subset |
| 4 | `repo-verifier`, `graph-quality`, `finalization sanitize` | — | `eval:repo` full corpus |
| 5 | `tsc --noEmit` as gate | — | — |
| 6 | All previous | `eval:repo:report` | Manual fine-grained PAT + abort |

Run command per phase: `npx vitest run lib/repo-diagram lib/mermaid/relayout.test.ts lib/pipeline-core lib/ai/utils --reporter verbose`.

---

## 9. Rollout, Flags & Rollback

### Flags (use env, no code flag service)

* `REPO_CACHE_LEVEL_SCOPED=1` (default 1 after Phase 2). If `0`, revert `getRepoCacheKey` to old shape.
* `REPO_VERIFIER_SPARSE_KEEP=1` (default 1 after Phase 4). If `0`, restore old drop-all-low behavior.

### Rollout Order

1. Ship Phase 1 behind no flag (low risk) to staging → smoke `eval:repo` on 3 public repos.
2. Ship Phase 2 → verify cache hit/miss logs (`[Pipeline] Cache miss for ...`) show `::L2` suffix.
3. Ship Phase 3+4 together to staging, compare eval delta before prod.
4. Phase 5-6 docs only → prod.

### Rollback

* Revert commit(s) for phase; cache keys with `::Lx` become orphaned but auto-expire. If urgent, flush Redis via `DELETE /api/repo-diagram` (requires `requireAdmin` `frontend/app/api/repo-diagram/route.ts:132`).
* DB quota side-effect (Phase 2) rollback: if SSE bug re-introduced, monitor `prisma.usageLog` count spike within 1h.

---

## 10. Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| `skip-rules` extraction breaks existing imports | Medium | Codemod `sed` + `tsc --noEmit` + grep `isSkipped` before merge |
| DetailLevel cache bump cold-starts Redis | Low | Dual-read fallback 30m; warm on deploy with 2 popular repos |
| Python root heuristic over-adds roots (false internal) | Medium | Cap `collectPythonRoots` to 7 entries; test corpus ensures not over-internalizing |
| Sparse verifier keep re-introduces hallucinated edges | Medium | Only `http/db/external/auth` types kept; eval threshold guards |
| Budget unify changes L1 file counts → golden snapshot shift | High | Expected — regenerate goldens with `npm run eval:golden` if budget change intentional |
| Token regex broadens attack surface (user token enumeration) | Low | Strict length + charset + trim; still require `GITHUB_TOKEN` or user token Bearer; no logging |

---

## Appendix A — Exact Regex / Code Diffs

### A.1 Token regex (GH2R-002)

```ts
// frontend/app/api/repo-diagram/route.ts:56-60
export const GITHUB_TOKEN_RE = /^(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})$/;
// Accepted examples:
// ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (legacy)
// gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
// ghs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
// ghu_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
// ghr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
// github_pat_11ABCDEFG... (fine-grained, ~82-93 chars)
// Rejected: short, contains '-', wrong prefix, empty
```

### A.2 Spring mapping (GH2R-011)

```ts
// frontend/lib/repo-diagram/static-analyzer.ts:191
// Old:
/@Get(?:Post|Put|Delete|Patch|Request)Mapping\(['"`]([^'"`]+)['"`]\s*[,\)]/g
// New:
const SPRING_MAPPING_RE =
  /@(?:Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?(?:\{\s*)?['"`]([^'"`]+)['"`]/g;
// Test snippet should detect both:
// @GetMapping("/api/v1/users")
// @GetMapping(value = "/api/v1/users")
// @RequestMapping(path = "/api", method = RequestMethod.GET)
// @GetMapping({"/a","/b"})
```

### A.3 `normalizeLabelKey` (GH2R-016)

```ts
// frontend/lib/repo-diagram/graph-quality.ts:24 + internal-helpers.ts:30 unified
function normalizeLabelKey(label: string): string {
  const stripped = label.toLowerCase().replace(/\s*\([^)]*\)/g, '');
  const withoutGeneric = stripped.replace(/\b(api|service|database|db|cache|worker|module)\b/g, '').trim();
  const alnum = withoutGeneric.replace(/[^a-z0-9]/g, '').trim();
  if (!alnum) return label.toLowerCase().replace(/[^a-z0-9]/g, '').trim() || slugId(label);
  return alnum;
}
// "API" → "api" (not ""), "Order Service" → "order", "User DB" → "user"
```

### A.4 Cache key (GH2R-003)

```ts
// frontend/lib/ai/services/diagramCache.ts:28 + repoDiagramRedisCache.ts:8
// Key evolution:
// Before: `v{VERSION}::https://github.com/o/r::abc123`
// After : `v{VERSION}::https://github.com/o/r::abc123::L2`   (L1/L2/L3)
// Migration: reads try new key first, then old key (30m window)
```

### A.5 Verifier sparse toggle (GH2R-004)

```ts
// frontend/lib/agents/repo-verifier.ts:93
// Add at top of verifyGraph:
const evidenceCoverage = importGraph ? evidenceEdgeSet.size / Math.max(1, nodes.length) : 0;
const isSparseEvidence = evidenceCoverage < 0.3 || (importGraph?.edges.size ?? 0) === 0;
// Then in loop: if (isSparseEvidence && confidence==='low' && meaningfulType) keep else drop
```

### A.6 SSE abort guard (GH2R-008)

```ts
// frontend/app/api/repo-diagram/route.ts:70
// See Phase 2 full snippet — key invariant:
// clientAborted=true → skip send, skip incrementAIGeneration, skip logUsage
// writer.write wrapped in try/catch, progress callback is void async
```

---

## Appendix B — Reference File Map

| File | Line | Role |
|---|---|---|
| `frontend/app/api/repo-diagram/route.ts:17` | 17,56,70,132 | API entry, token regex, SSE, admin clear |
| `frontend/lib/github-ingestion.ts:373` | 373,398,408,419,543,854 | fetch branch/sha/tree, budgets, promisePool |
| `frontend/lib/repo-diagram/tarball-ingestion.ts:48` | 48,77,96,112 | archive fetch, BINARY_RE, sz guard |
| `frontend/lib/ai/services/diagramCache.ts:28` | 28,36,56 | key, TTL, eviction |
| `frontend/lib/ai/services/repoDiagramRedisCache.ts:8` | 8,12,26 | Redis key/TTL |
| `frontend/lib/repo-diagram/pipeline-v2.ts:18` | 18,32,51 | progress map + flat stage list |
| `frontend/lib/repo-diagram/pipeline-stages/CacheCheckStage.ts:22` | 22 | cache read + terminal |
| `frontend/lib/repo-diagram/pipeline-stages/CacheWriteStage.ts:37` | 37 | cache write |
| `frontend/lib/repo-diagram/pipeline-stages/IngestionStage.ts:23` | 23 | FILE_BUDGETS |
| `frontend/lib/repo-diagram/pipeline-stages/ClassifyStage.ts:24` | 24,66 | useLlm gate |
| `frontend/lib/repo-diagram/pipeline-stages/ExtractStage.ts:42` | 42 | repoProfile null branch |
| `frontend/lib/repo-diagram/pipeline-stages/FinalizationStage.ts:89` | 89,115,178 | sanitize sparse, reviewNotes |
| `frontend/lib/repo-diagram/import-graph.ts:22` | 22,78 | ImportGraph build |
| `frontend/lib/repo-diagram/import-resolvers.ts:218` | 108,218,233 | applyAlias, pythonRoots, go |
| `frontend/lib/repo-diagram/static-analyzer.ts:191` | 62,100,115,191,385 | route regex, package categories, SDK filter |
| `frontend/lib/repo-diagram/graph-quality.ts:24` | 24,99,432 | normalizeLabelKey, merge |
| `frontend/lib/repo-diagram/evidence-from-graph.ts:9` | 9,21,70 | buildEvidenceGraph |
| `frontend/lib/agents/repo-verifier.ts:93` | 93,137 | verifyGraph drop logic |
| `frontend/lib/agents/repo-component-extractor.ts:99` | 99 | pickKeyFiles budget 60k |
| `frontend/lib/agents/repo-relationship-analyst.ts:152` | 43,152 | evidence pack, confidence contract |
| `frontend/lib/agents/repo-heuristic-extractor.ts:516` | 516,583 | fallback edge caps |
| `frontend/lib/pipeline-core/Pipeline.ts:59` | 59,102 | abort-between-stages, promisePool |
| `frontend/lib/types/repo-diagram.ts:244` | 244 | PipelineStage union |
| `frontend/lib/cache/blobCache.ts:64` | 64,91 | dead BlobCache |
| `frontend/lib/ai/utils/repoModels.ts:8` | 8 | model + prompt chars |

---

### Execution Checklist (copy into PR description)

```
- [ ] Phase 1 PR A merged + `npm test` green
- [ ] Phase 2 PR B merged + cache detailLevel test green + manual abort test
- [ ] Phase 3 PR C merged + eval:repo python delta >0, no JS regression
- [ ] Phase 4 PR D merged + python sparse fixture retains edges
- [ ] Phase 5 PR E merged + `npx tsc --noEmit` green, dead code removed
- [ ] Phase 6 PR F merged + docs/AGENTS + pipeline-refactor-plan updated
- [ ] PIPELINE_VERSION bumped if cache key shape changed
- [ ] Eval report attached to final PR
```
