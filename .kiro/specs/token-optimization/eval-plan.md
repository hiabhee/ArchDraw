# Eval Plan: Repo-Diagram Pipeline Token Optimization

## Goal

Verify the Phase 1-5 changes actually (a) cut tokens and (b) produce better diagrams, using real repos and concrete assertions. A passing unit test suite is necessary but not sufficient.

---

## Test Repos

| # | Repo | URL | Why |
|---|------|-----|-----|
| 1 | `rocambille/start-express-react` | `https://github.com/rocambille/start-express-react` | ~50 source files, React + Express + SQLite, TypeScript. Small but complete (auth, CRUD, DB, SSR). |
| 2 | `shadcn-ui/taxonomy` | `https://github.com/shadcn-ui/taxonomy` | 125 TS/TSX files, Next.js 13 App Router + Prisma + NextAuth + Stripe + Contentlayer. The "realistic" case. |
| 3 | Synthetic (crafted files) | Injected as `selectedFiles` into a mock snapshot | Adversarial: multi-line import, path alias, dynamic import, re-export, template-literal API call. |

---

## Implementation Steps

### Step 1: Fix `code-graph.ts` gaps (adversarial case preparation)

The adversarial audit found 3 MISSED cases and 1 degraded case:

| Case | Status | Fix needed |
|------|--------|------------|
| Multi-line import | CAPTURED | None |
| Path-aliased import (`@/lib/x`) | CAPTURED | None |
| Dynamic `import()` | CAPTURED | None |
| **Re-exports** (`export * from`, `export {...} from`) | **MISSED** | Add 2 patterns to `JS_EXPORT_PATTERNS` and a new `extractReExports()` function that generates both an export entry and an import edge |
| Template-literal API call | CAPTURED (degraded) | Log warning when target contains `${`; no regex fix possible |
| **Barrel re-export with renaming** | **MISSED** | Handled by the same re-export fix above |
| Conditional `require()` | MISSED | Inherent limitation; document as known gap |

**Changes to `lib/repo-diagram/code-graph.ts`:**
- Add to `JS_EXPORT_PATTERNS`: `/export\s+\*\s+from\s+['"]([^'"]+)['"]/g` and `/export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g`
- Add `extractReExports()` that: (a) creates an `ExportInfo` with `kind: 'reexport'`, (b) creates an `ImportEdge` from the current file to the re-exported source
- Call `extractReExports()` from `buildCodeGraph()` and add its edges to `importGraph`

### Step 2: Add `skipCodeGraph` flag to pipeline

**File:** `lib/repo-diagram-pipeline.ts`

Add optional `options?: { skipCodeGraph?: boolean }` parameter to `generateRepoArchitectureDiagram()`. When `skipCodeGraph === true`:
- Skip Step 3b (code graph + compact summaries)
- Skip Step 5 deterministic classifier (always use LLM if available, or skip entirely)
- In Step 6: pass `undefined` for `codeGraphText` → forces `pickKeyFiles()` path (raw file content, up to 8KB budget)
- In Step 7: pass `undefined` for `codeGraph` → no pre-computed edges

This gives us a clean "before" mode that replicates the pre-Phase-1 behavior.

### Step 3: Add token summary to `PipelineResult`

**Files:** `lib/types/repo-diagram.ts`, `lib/repo-diagram-pipeline.ts`

Add to `PipelineResult`:
```typescript
tokenSummary: {
  stage: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}[];
```

Populate from `getPipelineTokenSummary()` before returning.

### Step 4: Write CLI runner script

**File:** `scripts/run-pipeline-eval.ts`

Usage:
```bash
npx tsx scripts/run-pipeline-eval.ts <repo-url> [--skip-code-graph] [--detail 2]
```

Output (JSON to stdout):
```json
{
  "repoUrl": "...",
  "skipCodeGraph": false,
  "nodeCount": 12,
  "edgeCount": 8,
  "workflowCount": 3,
  "tokenSummary": [
    { "stage": "ComponentExtraction", "promptTokens": 3200, "completionTokens": 800, "totalTokens": 4000 },
    { "stage": "RelationshipAnalysis", "promptTokens": 2800, "completionTokens": 600, "totalTokens": 3400 }
  ],
  "totalTokens": 7400,
  "wallClockMs": 12345,
  "nodes": [...],
  "edges": [...],
  "workflows": [...],
  "reviewNotes": "..."
}
```

### Step 5: Write eval runner script

**File:** `scripts/eval-pipeline.ts`

Runs the pipeline twice per repo (before/after), captures metrics, runs assertions.

### Step 6: Write adversarial test

**File:** `lib/repo-diagram/__tests__/code-graph-adversarial.test.ts`

Tests `buildCodeGraph()` directly against synthetic files containing all adversarial cases. No LLM calls — pure unit test of the regex/structure extraction.

---

## Token Assertions

For repo #2 (taxonomy, ~125 files):

- [ ] **≥50% total token reduction** comparing `skipCodeGraph=true` vs `skipCodeGraph=false`
- [ ] Component extraction call (Step 6) shrinks by ≥60% (this is where raw 8KB file content is replaced by ~2KB compact summaries)
- [ ] Relationship analysis call (Step 7) shrinks by ≥30% (pre-computed edges reduce prompt verbosity)
- [ ] If total tokens don't drop ≥50%, investigate: check `pickKeyFiles()` isn't still being called, check `codeGraphText` isn't falling back to raw content

## Diagram Quality Assertions (Repo #2 — taxonomy)

Pre-verified by reading the repo structure:

1. [ ] Output contains ≥8 nodes (not collapsed into 3-5 generic blobs)
2. [ ] A node exists for NextAuth / auth system (files: `app/api/auth/[...nextauth]/route.ts`, `lib/auth.ts`)
3. [ ] A node exists for Prisma database layer (files: `prisma/schema.prisma`, `lib/db.ts`)
4. [ ] A node exists for Stripe/payments (files: `app/api/webhooks/stripe/route.ts`, `lib/stripe.ts`)
5. [ ] An edge exists connecting a frontend page/component to an API route it calls (e.g. dashboard page → posts API)
6. [ ] No node is labeled solely "React application", "backend", or "frontend" — every label names a specific component
7. [ ] Node labels reference actual file names or domain concepts (e.g. "NextAuth", "Prisma DB", "Stripe Webhook", not "Service A")
8. [ ] At least 1 workflow traces a user journey (e.g. "user logs in → NextAuth validates → session created → dashboard rendered")

## Adversarial Parser Assertions (Repo #3)

5 assertions, tested directly against `buildCodeGraph()`:

1. [ ] **Multi-line import captured**: edge exists from importing file to imported file, symbols extracted correctly
2. [ ] **Path-aliased import**: edge exists with target `@/lib/utils` (captured as-is; resolution to real file is a future enhancement)
3. [ ] **Dynamic `import()`**: edge exists with target `./heavy-module`, symbols = `['*']`
4. [ ] **Re-export** (`export * from './x'`): import edge exists from current file to `./x`; export entry exists with kind `'reexport'`
5. [ ] **Template-literal API call**: API call entry exists with target containing `${API_BASE}` (captured but flagged as dynamic)

## Known Limitations (document, don't fix)

- Conditional `require(process.env.X)` — inherent regex limitation, not worth fixing
- Template literal API calls — captured but semantically unresolved (expected)
- Path alias resolution — `@/lib/utils` is captured as-is; resolving to `lib/utils.ts` requires a tsconfig-aware resolver (future work)

---

## Reporting Format

```
=== PIPELINE EVAL RESULTS ===

Repo #1 (start-express-react, ~50 files):
  Before: X input tokens / Y output tokens / Z nodes / W edges
  After:  X input tokens / Y output tokens / Z nodes / W edges
  Token reduction: NN%

Repo #2 (taxonomy, ~125 files):
  Before: X input tokens / Y output tokens / Z nodes / W edges
  After:  X input tokens / Y output tokens / Z nodes / W edges
  Token reduction: NN%
  Per-call breakdown:
    ComponentExtraction: before=NNN → after=NNN (NN% reduction)
    RelationshipAnalysis: before=NNN → after=NNN (NN% reduction)
  Manual assertions: N/8 passed — [list any failures]

Repo #3 (adversarial):
  5 assertions: N/5 passed — [list any failures]

Known gaps: [list]
```
