# Implementation Plan — Tutorials Feature Hardening & Content Quality

Guide for taking ArchDraw tutorials from **credible MVP** to **flagship learning product**. Based on a codebase audit (Aug 2026). Work is split into **7 phases / PRs**, ordered by risk and ROI.

**Related:** `AGENTS.md` §11 (tutorials), `frontend/data/tutorials/`, `frontend/store/tutorialStore.ts`, `frontend/lib/tutorial/`.

---

## Status Summary

| Area | Current state | Target |
|------|---------------|--------|
| Platform (engine, canvas, validation) | Solid | Stable + tested |
| Completion & progress loop | **Broken / inconsistent** | Reliable end-to-end |
| Catalog UX (`/tutorials`) | Basic grid, no search | Parity with dashboard Learn |
| Content depth | 3–27 steps, avg ~7.4 | Min 8–10 steps, consistent pedagogy |
| Pedagogy richness | `whyItMatters` / `tradeoff` unused | On every teaching phase |
| Difficulty ladder | 1 beginner, 14 intermediate, 7 advanced | Balanced funnel |
| Guest vs auth | Local-only guests, unclear upsell | Clear value prop + migration |
| Test coverage | Schema validation only | Engine + validation + E2E smoke |
| AI explain | `explainCount` in DB, no UI | Optional Phase 6+ |

**Inventory today:** 22 tutorials · 163 total steps · ~18h estimated content (sum of `estimatedMinutes`).

---

## Goals

1. **Fix the completion loop** so users see celebration, badges, analytics, and cross-session progress.
2. **Raise content quality floor** so tutorials teach system design, not just component placement.
3. **Unify discovery UX** between public `/tutorials` and `/dashboard/learn`.
4. **Add tests** around the tutorial engine and validation paths touched by every session.
5. **Clarify guest vs authenticated** tutorial experience without blocking trial usage.

## Non-Goals (this plan)

- Replacing the step builder or Mermaid/AI generation for tutorial content.
- Building a full Grokking-style quiz/certification system.
- Rewriting all 22 tutorials in one PR (content work is incremental).
- Changing quota tiers or pricing (only UX around existing `allowTutorialProgress`).

---

## Architecture Reference

```
data/tutorials/*.ts          → TutorialDefinition (content)
lib/tutorial/
  schema.ts                → PhaseName, ValidationRule, TutorialStep
  builder.ts                 → defineTutorial, step(), level()
  engine.ts                  → session advance, isTutorialComplete
  detection.ts               → evaluateValidationRule
lib/tutorialValidation.ts    → validateStep, getStepRequirements
store/tutorialStore.ts       → Zustand + localStorage + DB sync
components/tutorial/
  TutorialCanvas.tsx         → React Flow host, highlighting
  GuidePanel.tsx             → Phase UI, checklist, hints
  IntroCardFlow.tsx          → Onboarding cards
  CompletionCardFlow.tsx     → End-of-tutorial flow
app/tutorials/               → Public catalog + [id] player
app/dashboard/learn/         → Authenticated catalog (LearnClient)
app/api/user/tutorial/       → Progress CRUD
```

**Canonical session flow per step:**

```
context → intro → teaching → action → connecting → celebration → (next step)
```

Validation runs in `action` and `connecting` phases. `GuidePanel` uses `useTutorialHelpers()` (engine-derived). `TutorialPageClient` currently reads store `isComplete` (broken — see Phase 1).

---

## Known Bugs (fix first)

| Bug | Symptom | Root cause | File(s) |
|-----|---------|------------|---------|
| Completion overlay never shows | No `CompletionCardFlow` after last step | `TutorialPageClient` uses `useTutorialStore().isComplete`; `completeTutorial()` never called | `TutorialPageClient.tsx`, `tutorialStore.ts` |
| Catalog “Completed” badge never appears | `completedTutorials` always `[]` | Same — `completeTutorial()` unused; not persisted | `tutorialStore.ts`, `app/tutorials/page.tsx` |
| Catalog progress ring unreliable | `isInProgress` often false | Reads legacy `tutorialProgress[id]` (never written); only `richProgress` updated | `app/tutorials/page.tsx` |
| `tutorial_completed` analytics missing | Event never fires | `useEffect` gated on store `isComplete` | `TutorialPageClient.tsx` |
| Progress % wrong on multi-level tutorials | Inaccurate ring on cards | Assumes all levels have same step count | `app/tutorials/page.tsx` `accuratePercent` |
| Level-complete overlay may not fire | Stuck between levels | `isLevelComplete` set in `advanceStep` but player uses `advanceManually` / `advancePhase` | `tutorialStore.ts`, `TutorialPageClient.tsx` |

---

## Phase 1 — Fix completion & progress loop (1–2 days)

**Goal:** One source of truth for tutorial completion and catalog progress.

**Priority:** P0 — blocks retention metrics and user satisfaction.

### PR 1A — Unify completion detection

**Tasks**

- [ ] Add `deriveTutorialStatus(session, tutorial)` helper in `lib/tutorial/engine.ts`:
  - `isComplete: boolean` — `isTutorialComplete(session, tutorial)`
  - `progressPercent: number` — `completedStepIds.length / totalSteps`
  - `completedLevelIds`, `currentLevel`, `currentStep`
- [ ] In `tutorialStore`, subscribe completion side effects when session advances:
  - When `engine.isTutorialComplete(session, tutorial)` → call internal `markTutorialComplete(tutorialId)`
  - Set `isComplete: true` on store (for `TutorialPageClient`)
  - Append to `completedTutorials` (dedupe)
- [ ] Persist `completedTutorials` in `partialize` (localStorage) alongside `richProgress`
- [ ] On `markTutorialComplete`, trigger `syncToDb` with a `completedAt` flag if we add it (optional column) OR infer completion when `currentStep === totalSteps && phase === 'celebration'`

**Alternative (simpler):** Replace store `isComplete` usage in `TutorialPageClient` with `useTutorialHelpers().isComplete` and call `completeTutorial()` from `GuidePanel` when helpers report complete.

**Files**

- `frontend/lib/tutorial/engine.ts`
- `frontend/store/tutorialStore.ts`
- `frontend/app/tutorials/[id]/TutorialPageClient.tsx`
- `frontend/components/tutorial/GuidePanel.tsx`

**Acceptance**

- Finishing last step of ChatGPT tutorial shows `CompletionCardFlow`.
- `analytics.track({ event_type: 'tutorial_completed' })` fires once per completion.
- Refreshing page after completion still shows “Redo” on catalog (from persisted `completedTutorials`).

---

### PR 1B — Fix catalog progress display

**Tasks**

- [ ] Remove reads of legacy `tutorialProgress` from `app/tutorials/page.tsx`
- [ ] Derive card state from `richProgress[tutorial.id]`:
  - **Not started:** no entry or `currentStep === 1 && currentLevel === 1 && canvas empty`
  - **In progress:** has entry, not in `completedTutorials`
  - **Completed:** `completedTutorials.includes(id)`
- [ ] Fix `accuratePercent` using engine `getProgress()` logic (sum steps across all levels, not `levels[0].steps.length`)
- [ ] Extract shared `getTutorialProgressMeta(tutorial, richProgress, completedTutorials)` to `lib/tutorial/progress.ts` for reuse in `LearnClient`

**Files**

- `frontend/app/tutorials/page.tsx`
- `frontend/components/dashboard/LearnClient.tsx` (consume shared helper)
- `frontend/lib/tutorial/progress.ts` (new)

**Acceptance**

- Mid-tutorial user sees correct % on `/tutorials` and `/dashboard/learn`.
- Completed tutorial shows green check; reset clears both `richProgress` and `completedTutorials`.

---

### PR 1C — Level-complete overlay wiring

**Tasks**

- [ ] Audit when `isLevelComplete` should be true (last step of level N, before level N+1).
- [ ] Set `isLevelComplete` inside `advanceManually` / engine `moveToNextStep` when crossing level boundary (not in unused `advanceStep`).
- [ ] Ensure `dismissLevelComplete` + `advanceLevel` preserve canvas nodes/edges.

**Acceptance**

- 3-level tutorials (e.g. Netflix) show `LevelCompleteScreen` between levels.
- “Save & come back later” persists canvas + position.

---

### Tests (Phase 1)

- [ ] `lib/tutorial/__tests__/engine.test.ts` — `isTutorialComplete`, `moveToNextStep` on last step, progress percent
- [ ] `lib/tutorial/__tests__/progress.test.ts` — catalog meta derivation
- [ ] Manual: complete URL shortener end-to-end, verify catalog + analytics

---

## Phase 2 — Catalog UX parity (1 day)

**Goal:** Public `/tutorials` matches dashboard Learn quality.

### PR 2A — Shared catalog component

**Tasks**

- [ ] Extract `TutorialCatalog` from `LearnClient.tsx`:
  - Search (title, description, tags)
  - Difficulty filters (all / beginner / intermediate / advanced)
  - Sort: recommended (default), shortest, alphabetical
  - `TutorialCard` with progress ring, difficulty pill, tags, time/steps
- [ ] Use in:
  - `app/tutorials/page.tsx` (public; no auth required)
  - `components/dashboard/LearnClient.tsx` (pass `showDashboardChrome={false}` wrapper)
- [ ] Keep public page header (back to dashboard optional for guests → link to `/` or `/editor`)

**Files**

- `frontend/components/tutorial/TutorialCatalog.tsx` (new)
- `frontend/components/tutorial/TutorialCard.tsx` (new, split from page)
- `frontend/app/tutorials/page.tsx`
- `frontend/components/dashboard/LearnClient.tsx`

**Acceptance**

- Search “kafka” surfaces Discord, Uber, etc.
- Filter “Beginner” shows only `url-shortener-architecture` (until Phase 4 adds more).
- No duplicate card logic between routes.

---

### PR 2B — Guest sign-in upsell (lightweight)

**Tasks**

- [ ] On tutorial player, if guest and `!canUseFeature('tutorialProgress')`, show dismissible banner:
  - “Sign in to save progress across devices”
  - Link to auth modal (existing `AuthModal` pattern)
- [ ] Do **not** block playing tutorials for guests (localStorage `richProgress` still works).
- [ ] On auth, existing `AuthProvider` `migrateGuestProgress` already runs — verify it includes `completedTutorials` after Phase 1.

**Files**

- `frontend/app/tutorials/[id]/TutorialPageClient.tsx`
- `frontend/components/AuthProvider.tsx` (extend migration if needed)
- `frontend/lib/userQuotas.ts` (reference only)

**Acceptance**

- Guest can finish a tutorial; signed-in user sees same progress after login on another browser (DB sync).

---

## Phase 3 — Canvas & pedagogy UX (2–3 days)

**Goal:** Diagrams stay readable; teaching phases feel intentional.

### PR 3A — Auto-layout after each validated step

**Tasks**

- [ ] After successful validation in `action`/`connecting` (before advancing phase), call `layoutDiagramViaMermaid` on current `nodes`/`edges` (canonical path per `AGENTS.md`).
- [ ] Apply laid-out positions via `setNodes` / `setEdges` in `tutorialStore`.
- [ ] `fitView({ maxZoom: 0.7 })` after layout (already used in `TutorialCanvas`).
- [ ] Gate with `tutorialLayoutEnabled` default `true`; skip for steps with `noConnect` only if layout breaks positions (test first).

**Files**

- `frontend/components/tutorial/GuidePanel.tsx` or `TutorialCanvas.tsx`
- `frontend/lib/mermaid/relayout.ts`

**Acceptance**

- 8+ node ChatGPT level-1 diagram auto-arranges after each connection step.
- Manual node drags before validation are preserved until step completes (layout runs on advance).

---

### PR 3B — Teaching phase enrichment (builder + content contract)

**Tasks**

- [ ] Extend `step()` builder in `lib/tutorial/builder.ts`:
  - Auto-populate `whyItMatters` from `COMPONENT_TOOLTIPS` when present (`data/componentTooltips.ts`)
  - Optional `tradeoff` field on `StepConfig`; fallback to tooltip `tradeoff`
- [ ] Add content lint script: `scripts/lint-tutorials.ts`
  - Fail if any step missing `whyItMatters` OR `tradeoff` in teaching phase (after migration grace period)
  - Warn if tutorial `< 8` steps
  - Warn if duplicate first-step `nodeType` across tutorials (optional)
- [ ] Update `validateTutorials.test.ts` to check teaching enrichment

**Content contract (all tutorials)**

Every `teaching` phase must include:

```ts
teaching: {
  heading: '...',
  body: '...',           // 2–4 sentences, product-specific
  whyItMatters: '...',   // "Without X, Y breaks"
  tradeoff: '...',       // One real architectural tradeoff
}
```

**Acceptance**

- `npm run lint:tutorials` passes for migrated tutorials.
- `GuidePanel` shows amber/blue callouts on teaching phases.

---

### PR 3C — “Continue anyway” policy

**Tasks**

- [ ] Change default `continueAfterMs` from `20000` → `45000` for connection steps.
- [ ] Per-step override: simple `node_exists` steps stay at `15000`.
- [ ] Log `tutorial_step_skipped` analytics when user clicks “Continue anyway” (payload: `tutorial_id`, `step_id`).
- [ ] Optional: require at least one hint display before showing “Continue anyway”.

**Files**

- `frontend/components/tutorial/GuidePanel.tsx`
- `frontend/lib/tutorial/builder.ts` (defaults)
- `frontend/lib/analytics.ts`

**Acceptance**

- Users still unstuck after timeout; product gets skip telemetry.

---

## Phase 4 — Content quality program (ongoing, 2–4 weeks)

**Goal:** No tutorial below minimum depth; balanced difficulty.

### Content tiers

| Tier | Steps | Levels | Difficulty | Examples |
|------|-------|--------|------------|----------|
| **Starter** | 8–10 | 1 | beginner | URL shortener (expand), new “Todo API”, “Rate Limiter” |
| **Core** | 10–15 | 2–3 | intermediate | Instagram, Stripe, WhatsApp |
| **Advanced** | 15–25 | 3 | advanced | ChatGPT, Netflix, Discord |

### PR 4A — Raise the floor (stub tutorials)

**Priority tutorials to expand** (currently ≤4 steps):

| Tutorial | Current steps | Target | Notes |
|----------|---------------|--------|-------|
| `openclaw-architecture` | 3 | 10 | Add Kafka, analytics DB, dashboard, alerting |
| `figma-architecture` | 4 | 12 | CRDT/sync, WebSocket, object storage |
| `linkedin-architecture` | 4 | 12 | Feed, graph DB, search |
| `doordash-architecture` | 4 | 12 | Dispatch, geo, payments |
| `zoom-architecture` | 4 | 12 | SFU, signaling, TURN |

**Tasks per tutorial**

- [ ] Add missing levels using `level()` pattern from ChatGPT/Netflix.
- [ ] Unique `context` copy (not generic “Level 1: Step N”).
- [ ] Domain-specific `whyItMatters` / `tradeoff` per component.
- [ ] Update `estimatedMinutes` to reflect step count (~3–4 min/step).

---

### PR 4B — Beginner funnel

**Tasks**

- [ ] Add 2 new beginner tutorials:
  1. **Rate Limiter** — client → gateway → Redis → API (8 steps)
  2. **Todo REST API** — client → LB → service → PostgreSQL (8 steps)
- [ ] Mark URL shortener, Rate Limiter, Todo API as `recommendedOrder: 1|2|3` in `data/tutorials/index.ts`
- [ ] `TutorialCatalog` “Start here” section for beginners

---

### PR 4C — Reduce template fatigue

**Tasks**

- [ ] Audit shared openers (15/22 start with Mobile Client).
- [ ] Vary entry components where realistic:
  - Batch jobs: start with Cron / Queue
  - B2B APIs: start with Web Client only
  - Streaming: start with CDN or Ingest
- [ ] Document patterns in `data/tutorials/AUTHORING.md` (new, short)

---

## Phase 5 — Test & observability (1–2 days)

### Unit tests

| Module | Cases |
|--------|-------|
| `engine.ts` | Phase advance, `skipPhases`, last-step completion, level rollover |
| `detection.ts` | Each `ValidationRule` type, `aliases`, label matching |
| `tutorialValidation.ts` | `getStepRequirements`, `isEdgeMet` with multiple nodes |
| `progress.ts` | Catalog percent, completed vs in-progress |

### Integration / smoke

- [ ] Vitest + RTL smoke: mount `GuidePanel` with mock session at `action` phase, add node, validate.
- [ ] Optional Playwright (if e2e exists): open `/tutorials/url-shortener-architecture`, add first component.

### Observability

- [ ] Ensure events: `tutorial_started`, `tutorial_completed`, `tutorial_step_skipped`, `tutorial_level_completed`
- [ ] Admin or analytics dashboard: completion rate per tutorial (future)

---

## Phase 6 — AI explain (optional, 3–5 days)

**Goal:** Use existing `explainCount` + `TutorialResponseCache` schema.

**Scope (if prioritized)**

- [ ] “Explain differently” button on `intro` / `teaching` phases
- [ ] API route: `POST /api/tutorials/explain` — hash `(tutorialId, stepId, phase, explainCount)` → cache in `TutorialResponseCache`
- [ ] Groq prompt: simplify teaching body for current component; max 150 words
- [ ] Increment `explainCount` in progress save; cap at 3 per step for quota
- [ ] Guest: allow 1 explain per tutorial (local counter); auth: 3 per step

**Non-goal:** Free-form chat during tutorial (scope creep).

---

## Phase 7 — Polish & SEO (1 day)

- [ ] OG images per tutorial (`thumbnail` field in schema — generate or hand-made)
- [ ] `app/tutorials/[id]/page.tsx` metadata from `tutorial.title` / `description`
- [ ] “Next tutorial” graph: expand `getNextTutorial()` in `TutorialPageClient` to use `recommendedOrder` + difficulty
- [ ] Export finished tutorial diagram to editor (“Open in Editor” — `handleGoToCanvas` already exists; verify node types transfer)

---

## File Change Matrix

| Phase | New files | Modified files |
|-------|-----------|----------------|
| 1 | `lib/tutorial/progress.ts`, `__tests__/engine.test.ts`, `__tests__/progress.test.ts` | `tutorialStore.ts`, `TutorialPageClient.tsx`, `tutorials/page.tsx`, `GuidePanel.tsx` |
| 2 | `TutorialCatalog.tsx`, `TutorialCard.tsx` | `LearnClient.tsx`, `tutorials/page.tsx` |
| 3 | `scripts/lint-tutorials.ts` | `GuidePanel.tsx`, `TutorialCanvas.tsx`, `builder.ts`, `relayout.ts` |
| 4 | `data/tutorials/*.ts`, `AUTHORING.md` | `data/tutorials/index.ts` |
| 5 | test files | `analytics` payloads |
| 6 | `app/api/tutorials/explain/route.ts` | `GuidePanel.tsx`, `tutorialStore.ts` |
| 7 | OG assets | `tutorials/[id]/page.tsx` |

---

## Suggested PR Order & Timeline

| Week | PR | Outcome |
|------|-----|---------|
| 1 | Phase 1 (1A–1C) | Completion loop works |
| 1 | Phase 2A | Unified catalog |
| 2 | Phase 3A–3C | Layout + pedagogy UX |
| 2–3 | Phase 4A (batch 1) | 5 stub tutorials expanded |
| 3 | Phase 4B | Beginner funnel |
| 3 | Phase 5 | Tests green |
| 4+ | Phase 4C, 6, 7 | Content + polish |

**Minimum shippable improvement:** Phase 1 + Phase 2A (~2–3 days).

**Flagship learning product:** Phase 1–5 + Phase 4 content (~4–6 weeks part-time).

---

## Success Metrics

| Metric | Baseline | Target (90 days) |
|--------|----------|----------------|
| Tutorial start → complete rate | Unknown (analytics broken) | Measure; target >25% on beginner |
| `tutorial_completed` events / starts | ~0% (bug) | >15% overall |
| Avg steps completed per session | Unknown | >5 |
| Tutorials with ≥8 steps | 14/22 | 22/22 |
| Tutorials with teaching callouts | 0/22 | 22/22 |
| Unit tests for tutorial lib | 1 file | ≥4 files, >30 cases |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Auto-layout jarring on manual edits | Run layout only on step advance, not on every node add |
| Content expansion is slow | Builder + tooltips auto-fill; hire/template domain outlines |
| DB schema change for `completedAt` | Infer completion from progress JSON first; migrate later |
| `completedTutorials` out of sync with DB | On login, merge DB `completedStepIds` length vs total steps |
| Regression in editor if export-to-canvas broken | Test `handleGoToCanvas` with ShapeNode + SystemNode |

---

## Manual QA Checklist (run after Phase 1–3)

- [ ] Guest: start URL shortener, add 3 components, refresh — progress restored from localStorage
- [ ] Auth: same flow on browser A, open browser B — DB progress restored
- [ ] Complete URL shortener — `CompletionCardFlow` appears, catalog shows completed
- [ ] Reset tutorial — progress cleared locally and via API
- [ ] Multi-level (Netflix): level-complete modal between levels
- [ ] Search on `/tutorials` finds “RAG”
- [ ] ChatGPT step 10+: auto-layout keeps diagram readable
- [ ] `cd frontend && npm test` green

---

## Appendix A — Tutorial inventory (Aug 2026)

| ID | Steps | Levels | Difficulty | Notes |
|----|-------|--------|------------|-------|
| `url-shortener-architecture` | ~8 | 1 | beginner | Only beginner; keep as funnel entry |
| `openclaw-architecture` | 3 | 1 | intermediate | **Expand** |
| `figma-architecture` | 4 | 1 | intermediate | **Expand** |
| `linkedin-architecture` | 4 | 1 | intermediate | **Expand** |
| `doordash-architecture` | 4 | 1 | intermediate | **Expand** |
| `zoom-architecture` | 4 | 3 | intermediate | **Expand** steps per level |
| `chatgpt-architecture` | 27 | 3 | intermediate | Reference quality |
| `netflix-architecture` | 12 | 3 | advanced | Good template |
| `discord-architecture` | 13 | 3 | advanced | Good template |
| Others | 5–11 | 1–3 | mixed | Add callouts + depth as needed |

---

## Appendix B — `completeTutorial` fix (recommended approach)

**Option A (preferred):** Engine-derived completion everywhere.

```ts
// TutorialPageClient.tsx — replace store isComplete with:
const { isComplete } = useTutorialHelpers();

// tutorialStore.ts — in advanceManually/advancePhase after session update:
if (engine.isTutorialComplete(newSession, activeTutorial)) {
  get().markTutorialComplete(activeTutorial.id);
}
```

**Option B:** Call `completeTutorial()` from `GuidePanel` when `useTutorialHelpers().isComplete` becomes true (`useEffect`).

Persist `completedTutorials` in Zustand `partialize`. Sync to DB by setting `currentPhase: 'completed'` or adding optional `completedAt` to `TutorialProgress` Prisma model (migration in separate PR).

---

## Appendix C — Authoring snippet

```ts
step({
  component: 'Redis Cache',
  nodeType: 'in_memory_cache',
  parent: 'API Gateway',
  phases: {
    teaching: {
      heading: 'Deep dive: Redis Cache',
      body: 'Redis stores hot keys in memory for sub-millisecond reads...',
      whyItMatters: 'Without a cache, every request hits the database — latency spikes and DB cost explodes under load.',
      tradeoff: 'In-memory cache is fast but volatile; you need TTL + cache invalidation or users see stale data.',
    },
  },
}),
```

---

*Last updated: Aug 2026. Revisit after Phase 1 ships; update Status Summary and metrics.*
