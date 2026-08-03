# Pipeline Architecture Refactor Plan

## Progress

| PR | Status | Notes |
|---|---|---|
| PR 1 — Characterization & inventory | In progress | Structure + cache-terminal tests added |
| PR 2 — Flatten repo mega-orchestrator | Done | Flat stage list; metadata for detailLevel/repoUrl |
| PR 3 — Mermaid uses class stages | Done | `pipeline.ts` composes `pipeline-stages/*` |
| PR 4 — AI context wiring | Partial | Real `PipelineContext` passed; adapters still accumulate state |
| PR 5 — Unify layout | Done | `applyRfLayout` canonical; mermaid/layout thin wrapper; canvas ELK documented |
| PR 6 — Split fat stages | Done | Classify/Extract/Relationships/Verify + CacheWrite; MermaidMaterializeStage |
| PR 7 — Typed contracts | Done | Domain failure contract + typed shared-data keys; tightened generics; progress aligned |
| PR 8 — Cleanup dual-era | Pending | |

---

## Goal

Finish the half-migrated pipeline architecture so that:

1. `pipeline-core` is the real execution engine (not ceremonial).
2. Each domain pipeline (Mermaid, AI Mermaid, Repo) is a flat list of typed stages.
3. Layout has one canonical owner.
4. Failure, progress, and abort contracts are consistent across entry points.
5. Dead / dual-era code is removed.

Non-goal: redesign product behavior, prompts, or diagram quality algorithms. This is a structural refactor with behavior preserved unless a bug is explicitly fixed.

---

## Current State (problems)

| Area | What’s wrong |
|---|---|
| Repo pipeline | Ingest → cache → mega `orchestrator` stage that manually runs Analysis/Baseline/LLM/Finalization |
| AI Mermaid pipeline | Typed stage classes wrapped in anonymous adapters; context passed as `{} as any` |
| Mermaid pipeline | Production uses inline lambdas in `pipeline.ts`; class stages in `pipeline-stages/` are test-only |
| Layout | Three owners: `mermaid/layout.ts`, `pipeline-shared/layout/*`, `canvas/applyLayout.ts`; `IntegratedLayoutEngine` unused |
| Typing | `Stage<any, any>`, accumulating `{ ...data }` blobs, `sharedData: Map<string, unknown>` |
| Naming / leftovers | `stage1-planner`, `stage8-score`, `repo-component-extractor-old.ts` |
| Contracts | Repo throws; AI returns `{ success: false }`; Mermaid returns empty graph |

---

## Target Architecture

```
frontend/lib/
  pipeline-core/          # Framework only: Pipeline, Stage, Context, Result
  pipeline-shared/        # Shared adapters: layout engines, ReactFlow converters, progress
  mermaid/
    pipeline.ts           # Composes mermaid/pipeline-stages/* on Pipeline
    pipeline-stages/      # Parse → Validate → Build → Layout → Size → ValidateOutput
    layout.ts             # Thin re-export or delete after migration
  ai/pipeline/mermaid-pipeline/
    pipeline-v2.ts        # Flat typed stages, real context
    stages/               # Concept → Plan → LayoutOverride → Materialize → Score → Validate
  repo-diagram/
    pipeline-v2.ts        # Flat typed stages (no mega orchestrator)
    pipeline-stages/      # Ingest → Cache → Analysis → Baseline → Classify → Extract → Relationships → Verify → Finalize → CacheWrite
```

### Principles

1. **One stage = one responsibility.** Retries, fallbacks, caching, and LLM multi-pass belong in clearly named stages or helpers — not hidden inside “Parse” / “LLM”.
2. **Typed stage IO.** Prefer `Stage<TIn, TOut>` with explicit interfaces over spreading blobs.
3. **Context is real.** Abort, progress, and metadata always flow through `PipelineContext`. No `{} as any`.
4. **Flat pipelines.** Nested “orchestrator” stages are forbidden except for short-lived migration shims.
5. **Shared layout is canonical.** Domain code calls `pipeline-shared` layout engines; no duplicated Dagre logic.
6. **Preserve behavior first.** Each PR must keep existing tests green; add characterization tests before changing wiring.

---

## PR Sequence

Do these as small, reviewable PRs in order. Do not combine phases.

---

### PR 1 — Characterization tests & inventory

**Why first:** Lock current behavior before moving wires.

**Work**

- Add / extend integration tests for:
  - `runMermaidPipeline` (happy path, parse fail, nested subgraphs)
  - `runAiMermaidPipelineV2` (fallback path, parentId validation)
  - `generateRepoArchitectureDiagramV2` (cache hit terminal path; static-only detailLevel=1)
- Document current stage order and side effects in this file’s “Inventory” section (update as you go).
- List every import of:
  - `mermaid/layout.ts`
  - `pipeline-shared/layout/*`
  - `canvas/applyLayout.ts`
  - `stage1-planner` / `stage8-score` / `*-old.ts`

**Acceptance**

- [ ] New characterization tests pass on current `main`.
- [ ] Inventory table filled (call sites + owners).
- [ ] No production behavior change.

---

### PR 2 — Flatten repo pipeline (kill mega orchestrator)

**Why:** Highest value; restores real metrics/progress/abort for the most expensive pipeline.

**Work**

- Change `repo-diagram/pipeline-v2.ts` to register:

  ```
  IngestStage
  → CacheCheckStage          # terminal on hit (already supported)
  → AnalysisStage
  → BaselineStage
  → LLMStage                 # consider splitting later (PR 6)
  → FinalizationStage
  ```

- Remove the inline `orchestrator` stage.
- Fix progress mapping so each stage name maps to the correct `PipelineProgressEvent['stage']` (not everything → `compiling`).
- Ensure `CacheCheckStage` terminal early-exit still returns `RepoPipelineResult` correctly through the core `Pipeline`.
- Keep public API: `generateRepoArchitectureDiagramV2(...)`.

**Risks**

- Stage input/output type mismatches when moving from manual chaining to Pipeline’s `currentOutput` handoff.
- Cache hit path: next stages must not run; output type is a union.

**Acceptance**

- [x] No mega orchestrator stage.
- [x] `result.metrics.stages` shows Analysis, Baseline, LLM, Finalization separately on cache miss.
- [x] Cache hit still short-circuits and returns cached diagram.
- [x] Abort signal checked between stages (core already does this).
- [x] Existing repo-diagram tests + eval smoke still pass.

---

### PR 3 — Mermaid: use class stages in production

**Why:** Eliminate dual implementation of the same parse→layout path.

**Work**

- Rewrite `mermaid/pipeline.ts` to compose stages from `mermaid/pipeline-stages/`:
  - `ParseStage` → `ValidateStage` → `BuildStage` → `LayoutStage` → `SizeStage` → `FinalValidationStage`
- Delete or shrink the inline lambda stages in `pipeline.ts` to a thin composer + result mapper.
- Keep `runMermaidPipeline(text)` signature and return shape stable.
- Align any small behavioral diffs discovered by characterization tests (prefer matching current production behavior unless a clear bug).

**Acceptance**

- [x] Production path imports stage classes; no duplicated parse/validate/build/layout/size logic in `pipeline.ts`.
- [x] All mermaid pipeline / layout / realtimeUpdate tests green.
- [x] `MermaidCodePanel`, `diagram/load`, `relayout` unchanged at call sites.

---

### PR 4 — AI Mermaid: wire stages directly (no `{} as any`)

**Why:** Make AI pipeline a real consumer of `pipeline-core` context.

**Work**

- Replace anonymous wrapper stages in `ai/.../pipeline-v2.ts` with the actual stage class instances (or thin typed adapters that accept `PipelineContext`).
- Pass the real context from `Pipeline.execute` into every stage.
- Prefer explicit intermediate types over `{ ...data }` accumulation:
  - Either a single `AiPipelineState` interface mutated only via typed fields, **or**
  - Narrow `TIn`/`TOut` per stage with a final assembly step.
- Keep `runAiMermaidPipelineV2` public return type stable for `orchestrator.ts`.
- Ensure abort/progress callbacks reach planning/parse stages if they report progress.

**Acceptance**

- [ ] Zero `{} as any` context casts in AI pipeline wiring.
- [ ] Stages receive `PipelineContext` with `executionId`, `signal`, `onProgress`.
- [ ] AI pipeline integration + concept template tests green.
- [ ] Orchestrator still produces the same `GenerationResult` shape.

---

### PR 5 — Unify layout ownership

**Why:** One place to fix compound-graph / spacing / cycle bugs.

**Work**

1. Decide canonical API (recommended):
   - **Canonical:** `pipeline-shared/layout` (`DagreLayoutEngine` + optional Elk via `IntegratedLayoutEngine`).
   - **Adapter:** Mermaid `LayoutStage` and canvas presets call into shared engines.
2. Port any Mermaid-specific behavior still only in `mermaid/layout.ts` into `DagreLayoutEngine` / `IntegratedLayoutEngine` (compound parents, cycle prevention, spacing).
3. Point `LayoutStage` at shared layout; make `mermaid/layout.ts` a deprecated thin wrapper or delete in same PR if all call sites moved.
4. Wire canvas `applyLayoutPreset` to shared engines where it currently reimplements Dagre/Elk concerns (keep UI preset selection in canvas).
5. Delete dead exports if still unused after wiring (`getIntegratedLayoutEngine` only if truly unused — or wire it and use it).

**Acceptance**

- [x] No duplicated `wouldCreateCycle` / compound Dagre setup between mermaid and pipeline-shared.
- [x] Nested subgraph layout characterization tests still pass.
- [x] Canvas layout presets still work.
- [x] One documented entry point for “layout this ReactFlow graph”.

---

### PR 6 — Split fat stages (SRP)

**Why:** After wiring is correct, shrink god-stages so ownership is obvious.

**Repo — split `LLMStage` (recommended order)**

```
ClassifyStage        # repo profile + pass-2 file gather (prefer immutable snapshot updates)
ExtractStage         # LLM / heuristic components + merge
RelationshipsStage   # edges + workflows
VerifyStage          # verifier + prune
```

Rules:

- Do **not** mutate `snapshot` in place; return an updated snapshot (or pass-2 file list) as typed output.
- Keep degraded flags and fallbacks behaviorally identical.

**AI — clarify `MermaidParseStage`**

- Rename or split into:
  - `MermaidRenderAttemptStage` (parse + retry planner)
  - `FallbackPlanStage` (optional)
- Or rename to `MermaidMaterializeStage` so the name matches responsibility.

**Repo — slim `FinalizationStage`**

- Keep sanitize + compile in finalization.
- Move cache **write** to a dedicated `CacheWriteStage` (optional, skippable on failure) so compile success isn’t entangled with Redis errors.

**Acceptance**

- [x] Each new stage has unit tests for success + primary fallback.
- [x] Repo/AI end-to-end tests unchanged in outcomes.
- [x] No stage named “parse” that calls the planner.

---

### PR 7 — Typed contracts & shared progress/error model

**Why:** Make pipelines composable and operable.

**Work**

1. **Remove `any` at pipeline boundaries** where practical:
   - `Pipeline<IngestInput, RepoPipelineResult>`
   - `Pipeline<UserIntent, AiPipelineData>`
   - `Pipeline<string, MermaidPipelineData>`
2. Restrict `sharedData` usage:
   - Prefer typed stage IO.
   - If shared bag is needed, define typed keys (e.g. const enums / branded key helpers) — do not proliferate stringly keys.
3. **Unify failure contract** at API / orchestrator edges:

   ```ts
   type DomainPipelineFailure = {
     success: false;
     error: Error;
     code: 'aborted' | 'generation_failed' | 'parse_failed' | 'ingestion_failed' | ...;
     warnings: string[];
     metrics?: PipelineMetrics;
   };
   ```

   - Repo route may still throw after mapping, but domain functions should return a result object for consistency.
4. Use stage `weight` in progress calculation (core already ignores weights and uses equal stage count).
5. Align progress event names with actual stage names (repo + AI orchestrator `phaseForStep`).

**Implementation Details**

- Added typed shared-data keys for Mermaid (`MERMAID_SHARED`) and AI (`AI_SHARED`) pipelines
- Updated `runMermaidPipeline` to return `DomainPipelineResult<PipelineResult>` instead of raw result
- Updated `runAiMermaidPipelineV2` to return `DomainPipelineResult<PipelineResult>` instead of raw result
- Updated repo pipeline to already use `DomainPipelineResult` (was already implemented)
- Changed `createMermaidPipelineStages()` to return `Stage<string, MermaidPipelineData>[]` instead of `Stage<unknown, unknown>[]`
- Changed `createStages()` in AI pipeline to return `Stage<UserIntent, AiPipelineData>[]` instead of `Stage<unknown, unknown>[]`
- Updated `createRepoDiagramStages()` to use typed generics with `pipelineStages<IngestionInput, RepoPipelineResult>`
- Updated `phaseForStep` in AI orchestrator to map actual stage names (concept-detection, planning-orchestrator, etc.)
- Updated all call sites to use `isDomainSuccess()` and access `result.data` instead of direct properties
- Updated all tests to expect `result.data.nodes` instead of `result.nodes`
- Added comprehensive tests for `DomainResult` utilities in `pipeline-core/__tests__/domain-result.test.ts`

**Acceptance**

- [x] No new `Stage<any, any>` in the three main pipelines.
- [x] Progress percentages reflect stage weights.
- [x] Callers get a predictable failure shape (document mapping in API routes).

---

### PR 8 — Cleanup dual-era & dead code

**Why:** Reduce confusion for the next senior reading the tree.

**Work**

- Rename modules to match ownership (examples):
  - `stage1-planner.ts` → `architecturePlanner.ts` (or fold into `ArchitecturePlanningStage`)
  - `stage8-score.ts` → `scoreDiagram.ts` (or fold into `ScoreStage`)
- Delete:
  - `repo-component-extractor-old.ts`
  - Unused `pipeline-shared` exports after PR 5
  - Any leftover deleted UI/`index.ts` re-exports that point at removed pipeline entrypoints
- Update README / this doc “Current State” → “Done”.
- Grep for `v1`, `old`, `TODO migrate`, `as any` in pipeline folders and clear stragglers.

**Acceptance**

- [ ] No `*-old.ts` under agents/pipeline.
- [ ] No `stageN-` filenames.
- [ ] Grep clean for known dead symbols.
- [ ] Docs match code.

---

## Out of Scope (explicit)

- Prompt / model quality tuning
- New layout algorithms beyond consolidating existing Dagre/Elk
- Rewriting agents (`repo-classifier`, etc.) internals
- Frontend UI redesign
- Changing Redis/cache TTLs or product caching policy (only stage placement)

---

## Suggested Ownership Boundaries

| Package | Owns | Must not own |
|---|---|---|
| `pipeline-core` | Execution, validation hooks, metrics, abort | Domain types, LLM calls, layout algorithms |
| `pipeline-shared` | Layout engines, RF adapters, progress helpers | Repo ingestion, Mermaid parsing, AI prompts |
| `mermaid` | Parse AST → RF objects → layout application | LLM planning |
| `ai/pipeline/mermaid-pipeline` | Intent → plan → mermaid → score/validate | GitHub ingestion |
| `repo-diagram` | Repo URL → snapshot → graph → diagram result | Generic Mermaid editing UX |

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Cache terminal path type confusion | Characterization test for cache hit; assert later stages skipped |
| Layout parity regressions | Nested subgraph + edge spacing golden tests before deleting `mermaid/layout.ts` |
| Progress UI breaks | Snapshot progress event sequences in API/streaming tests |
| Hidden behavior in mega orchestrator | Diff stage order and side effects line-by-line when flattening |
| Mutable snapshot in LLMStage | Characterization around pass-2 file counts before making immutable |

---

## Definition of Done (whole effort)

- [x] Three pipelines are flat stage lists on `pipeline-core`.
- [ ] No `{} as any` pipeline context (remaining in AI pipeline adapters)
- [x] One canonical layout implementation path.
- [x] Fat stages split or honestly named.
- [ ] Dual-era filenames and `*-old` modules gone.
- [x] Failure/progress contracts documented and consistent at domain boundaries.
- [ ] All existing pipeline tests green; characterization tests retained.

---

## Inventory (fill in during PR 1)

### Entry points

| Function | File | Callers |
|---|---|---|
| `runMermaidPipeline` | `frontend/lib/mermaid/pipeline.ts` | MermaidParseStage, MermaidCodePanel, diagram/load, relayout, tests |
| `runAiMermaidPipelineV2` | `frontend/lib/ai/pipeline/mermaid-pipeline/pipeline-v2.ts` | `ai/services/orchestrator.ts`, tests |
| `generateRepoArchitectureDiagramV2` | `frontend/lib/repo-diagram/pipeline-v2.ts` | `app/api/repo-diagram/route.ts`, eval script |

### Layout call sites

| Module | Used by | Action |
|---|---|---|
| `mermaid/layout.ts` | mermaid pipeline / LayoutStage / tests | Thin wrapper → `applyRfLayout` (PR 5 ✅) |
| `pipeline-shared/layout/*` | mermaid + shared tests | Canonical (`applyRfLayout` / `applyRfLayoutAsync`) |
| `canvas/applyLayout.ts` | diagramStore, Canvas, TemplateModal | Keep UI ELK presets; documented ownership |

### Leftovers to delete/rename

| Path | Action | PR |
|---|---|---|
| `agents/repo-component-extractor-old.ts` | Delete | 8 |
| `ai/pipeline/mermaid-pipeline/stage1-planner.ts` | Rename / fold | 8 |
| `ai/pipeline/stage8-score.ts` | Rename / fold | 8 |
| Mega `orchestrator` stage in repo `pipeline-v2.ts` | Remove | 2 ✅ |
| Inline mermaid stages in `mermaid/pipeline.ts` | Remove | 3 ✅ |
| AI anonymous adapters + `{} as any` | Remove | 4 partial (context wired; adapters remain) |

### Typed shared-data keys (PR 7)

| Domain | File | Keys |
|---|---|---|
| Mermaid | `mermaid/pipeline-stages/shared-keys.ts` | `parseWarnings`, `layoutMetadata` |
| AI | `ai/pipeline/mermaid-pipeline/shared-keys.ts` | `conceptDetection`, `plan`, `parseWarnings`, `useFallback` |
| Repo | `repo-diagram/pipeline-stages/shared-keys.ts` | `cacheWrite` |

---

## Execution Notes

- Prefer one PR per phase; keep diffs reviewable (&lt; ~400 LOC net logic change when possible).
- Do not mix cleanup (PR 8) with behavioral wiring (PRs 2–5).
- After each PR: run focused pipeline test suites + one smoke of generate-diagram and repo-diagram if keys/env allow.
- Update this document’s checkboxes as PRs land.
