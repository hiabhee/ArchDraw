# Implementation Plan — Fix the 10 Codebase Problems

Guide for completing the structural cleanup started in the ArchDraw `frontend/`. This reflects **what is already done** from the recent cleanup session and what remains. Work is split into **6 phases / PRs**, ordered by risk and ROI.

**Related:** `docs/pipeline-refactor-plan.md` (pipeline architecture), `AGENTS.md` (agent rules).

---

## Status Summary

| # | Problem | Status | Remaining effort |
|---|---------|--------|------------------|
| 1 | Dead ELK layout stack | **Done** | None |
| 2 | Unused npm dependencies | **Done** | None |
| 3 | Dead frontend MCP stub | **Done** | None |
| 4 | `diagramStore.ts` god object (2,291 LOC) | **Open** | Medium–high |
| 5 | Superseded handle API + test bloat | **Mostly done** | Low |
| 6 | `pathPlanner.ts` dead code | **Done** | None |
| 7 | Fragmented edge-routing stack (~2,100 LOC) | **Open** | High |
| 8 | Stale dual-era documentation | **Open** | Low |
| 9 | MCP ↔ frontend duplication + build coupling | **Partial** | Medium |
| 10 | Overlapping test suites | **Partial** | Low–medium |

**Already removed (cleanup session):** ~3,500 LOC, 69 npm packages, `.kiro` artifacts. Full test suite: **616/616 green**.

---

## Phase 0 — Verify baseline (½ day)

**Goal:** Lock a green baseline before structural work.

**Tasks**

- [ ] Confirm `cd frontend && npm test` → 616/616
- [ ] Snapshot current `diagramStore` public API (grep `useDiagramStore` selectors + action calls)
- [ ] Document MCP deploy path separately from Next.js (`build:all` vs `build`)

**Acceptance:** No regressions from cleanup; baseline commit tagged or noted.

---

## Phase 0B — Fix pre-existing TypeScript errors in tests (1 day)

**Problem:** `npx tsc --noEmit` fails on test files (`DomainPipelineResult` narrowing, repo mock types). CI on `main` is already red for this reason.

**Tasks**

- [ ] Use `isDomainSuccess()` guards in test files before accessing `.data`
- [ ] Fix `layout-diagnostic.test.ts` cast via `unknown`
- [ ] Update repo pipeline test mocks for `repoMeta` / `RepoSnapshot` shape

**Acceptance:** `npx tsc --noEmit` green in `frontend/`.

**Run before** large refactors (diagramStore split, edge routing merge).

---

## Problem 1 — Dead ELK layout stack ✅ DONE

**Was:** `applyLayoutPresetById`, `toggleLayoutDirection`, `lib/canvas/applyLayout.ts`, `elkjs`, `ElkLayout.ts`.

**Completed**

- Deleted `lib/canvas/`
- Removed ELK from `IntegratedLayout`
- Removed dead store layout APIs
- Toolbar still uses `layoutDiagramViaMermaid` → Dagre

**No further work.**

---

## Problem 2 — Unused npm dependencies ✅ DONE

**Was:** `dom2svg`, `@modelcontextprotocol/sdk`, `elkjs`.

**Completed:** All removed from `frontend/package.json`; lockfile updated.

**Optional follow-up (Phase 5):** Run `depcheck` again for `autoprefixer` / duplicate scripts (`dev:frontend`).

---

## Problem 3 — Dead frontend MCP stub ✅ DONE

**Was:** `frontend/lib/ai/services/mcp/index.ts`.

**Completed:** Directory deleted.

**No further work** (see Problem 9 for MCP server itself).

---

## Problem 4 — `diagramStore.ts` god object

**Problem:** ~2,291 lines, ~76 actions — tabs, persistence, undo, layout state, AI streaming, quotas, handles all in one file.

### PR 4A — Extract types + pure helpers (low risk)

**Create**

```
store/diagram/
  types.ts          # DiagramState, Canvas, HistoryEntry, …
  constants.ts      # MAX_GUEST_*, RESERVED_LAYER_LABELS
  nodeHelpers.ts    # normalizeNode, collision helpers used only by store
```

**Tasks**

- [ ] Move interfaces/types out of `diagramStore.ts`
- [ ] Move pure functions (no `set`/`get`) to helpers
- [ ] Re-export from `diagramStore.ts` for backward compatibility

**Acceptance:** `diagramStore.ts` < 2,000 LOC; zero import changes for consumers.

---

### PR 4B — Split Zustand slices (medium risk)

**Target structure**

```
store/diagram/
  canvasSlice.ts      # tabs, activeCanvasId, load/save, guest caps
  historySlice.ts     # past/future, undo/redo, pushHistory
  selectionSlice.ts   # selected nodes/edges, chrome mode
  layoutSlice.ts      # activeLayoutPresetId only (direction flag)
  pipelineSlice.ts    # appendNode, pipelineStatus (AI streaming)
  diagramStore.ts     # compose slices + recalculateHandles
```

**Tasks**

- [ ] Use Zustand slice pattern or `createStore` composition (match existing `persist` middleware)
- [ ] Keep **one** persisted store key (`archdraw-diagram` or current key)
- [ ] Move `recalculateHandles` last — it touches nodes + edges

**Risks**

- `persist` + `partialize` must still serialize the same shape
- Undo/redo must snapshot the same fields

**Acceptance**

- [ ] `diagramStore.ts` < 400 LOC (composer only)
- [ ] All store tests pass
- [ ] Manual smoke: tabs, undo, layout toggle, AI generate, guest quota

**Estimate:** 2–3 days

---

## Problem 5 — Superseded handle API + test bloat

**Done**

- Removed `getDynamicHandles`, `getHandleCoordinate`
- Deleted 5 test files (~1,500 LOC)
- Kept `getObstacleAwareHandles` + `dynamicHandlesFix.test.ts`

### PR 5 — Final handle cleanup (low risk)

**Tasks**

- [ ] Confirm `getSemanticPortSide` is used (or inline/remove if dead)
- [ ] Add one integration test: `recalculateHandles` → edge handle ids match `computeEdgeRoute`
- [ ] Update `AGENTS.md` §7 to say obstacle-aware path is canonical

**Acceptance:** No `getDynamicHandles` references; handle tests < 200 LOC total.

**Estimate:** ½ day

---

## Problem 6 — `pathPlanner.ts` dead code ✅ DONE

**Completed**

- Deleted `pathPlanner.ts` + tests
- Added `lib/utils/obstacleRect.ts`

**No further work.**

---

## Problem 7 — Fragmented edge-routing stack

**Problem:** Three active modules with overlapping roles:

| Module | LOC | Role |
|--------|-----|------|
| `collisionFreeEdgePath.ts` | 1,085 | Waypoint generation, SVG path |
| `edgeRouteBuilder.ts` | 587 | Orchestrator (handles, obstacles, scoring) |
| `handlerPairScorer.ts` | 466 | Side-pair selection |

### PR 7A — Document ownership + trim dead exports (low risk)

**Tasks**

- [ ] Add module header comment in each file stating call chain:

  ```
  SimpleFloatingEdge → computeEdgeRoute (edgeRouteBuilder)
    → selectBestHandlerPair (handlerPairScorer)
    → getCollisionFreeWaypoints (collisionFreeEdgePath)
  ```

- [ ] Grep for unused exports in each file; delete or make internal
- [ ] Ensure `svgExport.ts` uses same path as canvas edges

**Acceptance:** Single documented pipeline; no behavior change.

---

### PR 7B — Consolidate routing (higher risk, optional)

**Only if Phase 7A shows clear duplication.**

**Option A (preferred):** Merge `handlerPairScorer` into `edgeRouteBuilder` (same domain).

**Option B:** Extract thin `lib/edges/routing/` package:

```
routing/
  types.ts
  pairScorer.ts
  waypoints.ts
  computeRoute.ts   # public API
```

**Do not** merge `collisionFreeEdgePath` blindly — it is large and used by SVG export.

**Acceptance**

- [ ] One public entry: `computeEdgeRoute`
- [ ] Edge + SVG export golden tests unchanged
- [ ] Net LOC reduction ≥ 300

**Estimate:** 7A = 1 day; 7B = 3–5 days

---

## Problem 8 — Stale dual-era documentation

**Problem:** `docs/pipeline-refactor-plan.md` “Current State” contradicts code (PRs 2–7 largely done; PR 8 pending).

### PR 8 — Doc realignment

**Tasks**

- [ ] Rewrite `docs/pipeline-refactor-plan.md`:
  - Mark PRs 1–7 **Done** with dates
  - Move “Current State” → “Completed architecture”
  - Leave PR 4 (AI `{} as ArchitecturePlan` placeholders) + PR 8 cleanup as **remaining**
- [ ] Update `AGENTS.md` §29: remove “dual-era” warnings that are fixed
- [ ] Add short “Layout ownership” note: Dagre only in frontend; ELK only in `mcp-server` if still true

**Acceptance:** New contributor reading docs matches `pipeline-v2.ts`, `mermaid/pipeline.ts`, `relayout.ts`.

**Estimate:** ½ day

---

## Problem 9 — MCP ↔ frontend duplication

**Problem:** `mcp-server/` (~4,700 LOC) duplicates layout/node logic; `zod@3` vs `zod@4`; no shared package.

**Partially done:** Removed `prebuild: mcp:build` from web build.

### PR 9A — Deploy separation (low risk)

**Tasks**

- [ ] CI: `npm test` + `npm run build` in `frontend/` only
- [ ] Separate workflow or job for `mcp-server` (`npm run mcp:build` + MCP tests if any)
- [ ] Document in README/AGENTS: `build:all` for full stack local dev

**Acceptance:** Next.js deploy does not compile MCP.

---

### PR 9B — Shared diagram core (medium, long-term)

**Create** `packages/diagram-core/` (or `shared/`):

```
diagram-core/
  layout/       # Dagre options, direction types
  types/        # RFNode, RFEdge minimal shapes
  validation/   # shared structural checks
```

**Tasks**

- [ ] Extract types used by both `mcp-server` and `frontend`
- [ ] MCP `elk-runner` stays in MCP; frontend stays Dagre-only
- [ ] Version as private workspace package (`npm workspaces`)

**Risks:** Tooling churn, duplicate test updates.

**Estimate:** 9A = ½ day; 9B = 1–2 weeks

---

## Problem 10 — Overlapping test suites

**Partially done:** Removed dynamicHandles bloat + `.kiro`.

### PR 10A — Merge Mermaid parse tests (low risk)

**Current:** 3 files, ~679 LOC

- `fullCoverage.test.ts` (382)
- `comprehensive.test.ts` (168)
- `parse.test.ts` (129)

**Tasks**

- [ ] Merge into `lib/mermaid/__tests__/parse.test.ts`
- [ ] Group: happy path, edge cases, subgraphs, error cases
- [ ] Delete redundant files

**Acceptance:** Same coverage; one file < 450 LOC; all mermaid tests green.

---

### PR 10B — Trim edge routing tests (medium risk)

**Current:** ~1,650 LOC across 6+ files; `handlerPairScorer.test.ts` alone is 754 lines.

**Tasks**

- [ ] Identify duplicate scenarios (same node pair, same obstacle layout)
- [ ] Keep: characterization tests + one property test for scorer
- [ ] Target: ≤ 900 LOC total for edge routing tests

**Acceptance:** Coverage on `computeEdgeRoute` paths unchanged; CI time drops.

**Estimate:** 10A = 1 day; 10B = 1–2 days

---

## Recommended PR Order

```
✅ Done     Phase 0 baseline + cleanup (ELK, deps, MCP stub, pathPlanner, .kiro)
PR 1       Phase 0B  — fix tsc in tests
PR 2       Phase 10A — merge Mermaid parse tests
PR 3       Phase 8   — doc realignment
PR 4       Phase 5   — final handle test cleanup
PR 5       Phase 9A  — MCP deploy separation in CI
PR 6       Phase 4A  — diagramStore types/helpers extract
PR 7       Phase 4B  — diagramStore slice split
PR 8       Phase 7A  — edge routing ownership docs + dead export trim
PR 9       Phase 10B — edge test consolidation
PR 10      Phase 7B  — edge routing merge (optional)
PR 11      Phase 9B  — shared diagram-core package (optional)
```

---

## Definition of Done (whole effort)

- [ ] `npm test` ≥ 616 tests green
- [ ] `npx tsc --noEmit` green
- [ ] No dead layout paths (ELK in frontend) — **done**
- [ ] `diagramStore.ts` < 500 LOC composer
- [ ] One documented edge-routing entry point
- [ ] Docs match code
- [ ] MCP builds independently of Next.js deploy

---

## What not to do

- Do not merge Problems 4 + 7 in one PR
- Do not delete `collisionFreeEdgePath` without SVG export parity tests
- Do not touch concept-template triggers or quota logic in this effort
- Do not “finish” `pipeline-refactor-plan` PR 4 (AI adapter rewrite) unless explicitly wanted — it is typing polish, not a size win

---

## Quick reference — files touched in completed cleanup

| Action | Path |
|--------|------|
| Deleted | `lib/canvas/`, `lib/ai/services/mcp/`, `lib/pipeline-shared/layout/ElkLayout.ts` |
| Deleted | `lib/features/pathPlanner.ts`, `lib/mermaid/layout.ts`, `.kiro/` |
| Deleted | 5× `dynamicHandles*.test.ts` |
| Simplified | `store/diagramStore.ts`, `lib/features/dynamicHandles.ts`, `IntegratedLayout.ts` |
| Added | `lib/utils/obstacleRect.ts` |
| Renamed usage | `relayoutCanvasViaMermaid` → `layoutDiagramViaMermaid` |
