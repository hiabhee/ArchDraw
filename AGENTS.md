# AGENTS.md — ArchDraw

Guide for AI coding agents and contributors working in this repository. Prefer this file over outdated README claims when they conflict with code.

---

## 1. What ArchDraw is

ArchDraw is an **AI-assisted system architecture diagramming** product:

- Users describe a system (or paste a GitHub repo URL) and get a styled **React Flow** diagram.
- Diagrams support groups/subgraphs, floating edges, templates, tutorials, share/embed, and export (JSON / Mermaid / PNG / SVG).
- An **MCP server** exposes diagram tools to external AI assistants.

Primary app lives in `frontend/` (Next.js App Router). Companion package: `mcp-server/`.

**Stack (verify in `frontend/package.json`):** Next.js · React · TypeScript · React Flow v11 · Zustand · Dagre (+ ELK for some canvas presets) · Groq · Prisma + Neon · better-auth · Tailwind · Mermaid · Vitest.

---

## 2. Repository layout

```
ArchDraw/
├── frontend/                 # Next.js app (product + most logic)
│   ├── app/                  # Routes & API handlers
│   ├── components/           # Canvas UI, nodes, edges, landing, dashboard
│   ├── views/                # Editor shell
│   ├── store/                # Zustand stores
│   ├── lib/                  # Pipelines, layout, auth, utils
│   ├── data/                 # Templates + tutorials
│   ├── hooks/                # React hooks (handles, label edit, …)
│   ├── constants/            # Shape configs, diagram constants
│   └── prisma/               # Schema & migrations
├── mcp-server/               # Standalone MCP protocol server
├── docs/                     # Design / refactor notes (not always current)
├── SECURITY.md
├── CONTRIBUTING.md           # Design-system color tokens
└── AGENTS.md                 # This file
```

Work from `frontend/` for almost everything (`npm run dev`, `npm test`, `npx tsc --noEmit`).

---

## 3. Agent rules (must follow)

### Code change discipline

1. **Only change what the task requires.** No drive-by refactors, unrelated files, or “cleanup” PRs mixed into feature work.
2. **Match existing patterns** (naming, imports `@/…`, stage classes, store APIs) before inventing new abstractions.
3. **Do not invent secrets** or commit `.env`, credentials, or API keys. See `SECURITY.md`.
4. **Do not invent features** in docs or comments that the code does not implement.
5. Prefer **editing existing files** over adding parallel utilities.
6. **Tests:** colocated `__tests__/` or `*.test.ts` next to the module. Run Vitest for touched areas.
7. **Commits / PRs:** only when the user asks. Follow repo commit style; never force-push `main`.

### Design system

- Canvas + SVG export truth: `frontend/lib/theme/stylingConstants.ts` (optical size grid, concerns, themes).
- Chrome / dashboard: use semantic Tailwind tokens from `CONTRIBUTING.md` (`bg-surface-page`, `text-text-primary`, `bg-accent`, …). Avoid ad-hoc purple/indigo landing tropes when building branded UI from scratch; preserve existing product look when editing existing surfaces.

### Layout rule (critical)

**Canonical canvas layout** for templates, AI generation, repo diagrams, and the toolbar LR/TB toggler is:

`layoutDiagramViaMermaid` → `frontend/lib/mermaid/relayout.ts`

Path: React Flow → Mermaid → Parse → Validate → Build → **Dagre** (`pipeline-shared/layout`) → Size → map positions back.

Do **not** assume the toolbar uses ELK. ELK lives in `frontend/lib/canvas/applyLayout.ts` / `layoutPresets.ts` for alternate presets (e.g. force). See `docs/layout-toggler.md`.

### Node sizing rule

- Optical grid: **160 / 200 / 240** (`SIZE_S` / `SIZE_M` / `SIZE_L`). Default max is **SIZE_L (240)**.
- Compute sizes with `calculateNodeDimensions` in `frontend/lib/utils/nodeSizing.ts`.
- Prefer **wrapping labels** over growing past the grid. Diamonds/circles size from mid-band fractions aligned with `ShapeNode` (`0.48` band).

### Handle behavior rule

- **All shape types** (rectangle, diamond, circle, …) share the same dynamic handle system.
- When a side has only incoming **or** only outgoing edges → handle centered (offset `0`).
- When both directions share a side → ±16px slots ordered by connected-node positions (`useHandleSlotLayout`, `computeDynamicSlotOffsets`).
- Do **not** special-case diamonds to tip-only unless product explicitly reverts that decision.

### Concept-template rule

Short “what is X / describe X architecture” prompts (≤12 words, concept markers, no detail markers) hit **canned Mermaid** via `conceptTemplates.ts` and **skip the LLM planner**. That is intentional. Users who want variety must add specifics, exceed word count, use detail markers (`for`, `with my`, …), use L1 detail, or edit an existing diagram.

### Security

- Never weaken CSP, admin rate limits, or auth checks casually.
- Admin routes use passcode + session secrets (`frontend/lib/admin-auth.ts`).
- Embed domains are allowlisted via env.

---

## 4. App routes & APIs

### Pages (`frontend/app/`)

| Area | Path | Role |
|------|------|------|
| Landing | `page.tsx` | Marketing + interactive demo |
| Editor | `editor/` | Main diagramming UI (`views/Editor.tsx`) |
| Dashboard | `dashboard/` | User canvases / learn |
| Tutorials | `tutorials/` | Guided architecture lessons |
| Share / Embed | `share/`, `embed/` | Public / iframe viewers |
| Auth | `auth/`, `login/` | better-auth flows |
| Admin | `admin/` | Internal admin |
| Docs / legal | `docs/`, `privacy/`, `terms/` | Static content |

### Key API routes (`frontend/app/api/`)

| Route | Purpose |
|-------|---------|
| `generate-diagram/` (+ `streaming/`) | Prompt → AI Mermaid pipeline → RF graph |
| `repo-diagram/` | GitHub / tarball → repo pipeline |
| `diagram/` | Load / persist canvases |
| `share/`, `embed/` | Public sharing |
| `auth/` | better-auth handlers |
| `admin/` | Admin login & ops |
| `components/` | Component library / templates |
| `user/`, `track/` | Profile & analytics |

Client helper: `frontend/lib/api-client.ts`.

---

## 5. State management

| Store | File | Responsibility |
|-------|------|----------------|
| **diagramStore** | `store/diagramStore.ts` | Nodes, edges, tabs, undo/redo, import/loadTemplate, layout presets, persistence debounce, handle recalculation |
| authStore | `store/authStore.ts` | Session / user |
| tutorialStore | `store/tutorialStore.ts` | Tutorial progress |
| onboardingStore | `store/onboardingStore.ts` | First-run flows |
| modalStore | `store/modalStore.ts` | Modal visibility |
| promptHistory | `store/promptHistory.ts` | Generation prompt history |

### Important `diagramStore` APIs

- `importDiagram(nodes, edges)` — normalize + place graph on canvas (preferred after generation / relayout).
- `loadTemplate(nodes, edges)` — template load (uses same clarity path as toggler / import).
- `toggleLayoutDirection` / layered presets — should call `layoutDiagramViaMermaid`.
- `addNode` / `updateNodeData` / `setNodes` / `recalculateHandles`.

Fit-view registration: `registerFitViewCallback` in the same file.

---

## 6. Canvas & node components

### Canvas

`frontend/components/Canvas.tsx` — React Flow host: node/edge types, selection, connection drawing, template query params, fit view, collision helpers.

Editor chrome: `frontend/views/Editor.tsx`, `Toolbar.tsx`, `FloatingAIBar.tsx`, `CommandPalette.tsx`, `ComponentSidebar.tsx`, `PropertiesPanel.tsx`, `MermaidCodePanel.tsx`.

### Node types

| Component | Type id (typical) | Behavior |
|-----------|-------------------|----------|
| **SystemNode** | `systemNode` | Card UI (header/footer, accent, status). Uses `FloatingHandles`. Sized via `calculateNodeDimensions` (grid-capped). |
| **ShapeNode** | `shapeNode` | Silhouette shapes: rectangle, rounded-rectangle, **diamond**, cylinder, circle, parallelogram. Uses `NodeHandles`. Dynamic fit + mid-band label clamp. |
| **GroupNode** | `groupNode` | Subgraph / container; resizable; hosts children with parent ids. |
| **AnnotationNode** | annotation | Callouts / notes |
| **TextLabelNode** | text label | Free text on canvas |

Shape config / palette: `frontend/constants/nodeShapeConfig.ts`, `PropertiesPanel.tsx`, `ComponentSidebar.tsx`.

Icons: `NodeIcon.tsx`, `components/icons/`, `lib/nodeIconResolver.ts`.

### Node sizing

`frontend/lib/utils/nodeSizing.ts`:

- Snaps to 160/200/240; optional soft XL/XXL constants for callers that pass `maxWidth`.
- Shape text bands must stay aligned with `ShapeNode.resolveShapeSize` (`diamond`/`circle` → `0.48`).
- Used by ShapeNode, SystemNode, Mermaid build, layout utils, repo import.

Visual system comments in `stylingConstants.ts`: thin strokes, muted neutrals, five semantic **concerns** (`client`, `compute`, `data`, `async`, `external`).

---

## 7. Handles & edges

### Handles

| Module | Role |
|--------|------|
| `components/nodes/NodeHandles.tsx` | ShapeNode / Group / annotations — 2 handles per side (source + target) |
| `components/nodes/FloatingHandles.tsx` | SystemNode — invisible floating handles (`rh` CSS classes) |
| `hooks/useHandleSlotLayout.ts` | Per-side center vs ±GAP from edges + neighbor positions |
| `lib/utils/handleSlotOrder.ts` | `computeDynamicSlotOffsets` |
| `lib/utils/simpleFloatingEdge.ts` | Side resolution, `getEdgeShiftOffset`, `getBoundaryAnchor`, `INCOMING_OUTGOING_GAP = 16` |

**Behavior (all shapes, including diamond):**

1. Resolve which side each edge uses from handle ids (`source-left`, `target-top`, …).
2. If a side has only one direction → offset `0` (centered).
3. If both in + out → dynamic ordering (±16) so attachments don’t share one tip.
4. Edge routing uses the same shift via `getEdgeShiftOffset` in `edgeRouteBuilder.ts`.

Styles: `components/nodes/nodeStyles.css` (handles often opacity 0 until connection drawing).

### Edges

- Primary renderer: `components/edges/SimpleFloatingEdge.tsx`.
- Path building: `lib/utils/edgeRouteBuilder.ts` (orthogonal / collision-aware waypoints, handler pair scoring).
- Labels / toolbar: `EdgeLabel.tsx`, `EdgeToolbar`, edge type data under `data/edgeTypes` (if present).

---

## 8. Layout system

### Canonical path (prefer this)

```
layoutDiagramViaMermaid(nodes, edges, 'LR' | 'TD')
  → reactFlowToMermaid
  → runMermaidPipeline (Parse → Validate → Build → Layout → Size → FinalValidate)
  → restore original types/data + new positions/sizes
```

Files:

- `lib/mermaid/relayout.ts`
- `lib/mermaid/pipeline.ts` + `lib/mermaid/pipeline-stages/*`
- `lib/pipeline-shared/layout/IntegratedLayout.ts` (`applyRfLayout`)
- `lib/pipeline-shared/layout/DagreLayout.ts`
- `lib/pipeline-shared/layout/LayoutEngine.ts` — `defaultCompoundLayoutOptions`

**Default Dagre compound spacing (current):**

- TB: `nodeSep` 140, `rankSep` 200  
- LR: `nodeSep` 180, `rankSep` 200  
- Subgraph padding ~48–72  

### Alternate path

- ELK presets: `lib/canvas/layoutPresets.ts`, `lib/canvas/applyLayout.ts` — used for some store presets / freeform / force, **not** the Mermaid toggler.

### Landing demo

`components/landing/InteractiveLandingDemo.tsx` — hand-authored load-balancer preset + its own dagre arrange (keep spacing generous if editing).

---

## 9. AI generation pipeline

Entry: `lib/ai/pipeline/mermaid-pipeline/pipeline-v2.ts` (`runAiMermaidPipelineV2`), orchestrated from `lib/ai/generationService.ts` / `lib/ai/services/orchestrator.ts`, exposed by `app/api/generate-diagram/`.

### Stages (high level)

1. **ConceptDetection** — `ConceptDetectionStage` + `detectImplicitConceptPrompt` (`conceptTemplates.ts`).
2. **ArchitecturePlanning** — LLM planner **or** concept template Mermaid (`ArchitecturePlanningStage`).
3. **LayoutOverride** — direction / concept logging.
4. **MermaidMaterialize** — parse/build/layout into RF objects (shared Mermaid path).
5. **Score** — diagram quality score.
6. **Validation** — structural checks.

Shared engine: `lib/pipeline-core/` (`Pipeline`, `BaseStage`, typed results).

Planner prompts: `architecturePlanner.ts`. Models / keys: `lib/ai/models.ts`, `lib/ai/utils/apiKeyManager.ts`, `modelStore.ts`.

### Concept templates (same diagram every time)

`lib/ai/pipeline/mermaid-pipeline/conceptTemplates.ts`:

- Triggers on markers like “describe / explain / architecture”, ≤12 words, no detail markers.
- Domains: api-edge (load balancer, nginx, …), messaging, database, cache, docker/kafka/linux named templates, etc.
- `getConceptTemplatePlan` returns fixed Mermaid; detail L1/L2 may trim OPS bands via `trimMermaidByDetailLevel`.
- Edit mode (`existingContext` with nodes/edges) **always** uses the LLM.

---

## 10. Repo diagram pipeline

Entry: `lib/repo-diagram/pipeline-v2.ts`, API `app/api/repo-diagram/`.

Stages under `lib/repo-diagram/pipeline-stages/`:

Ingestion → Cache check → Analysis / Baseline → Classify → Extract → Relationships → Verify → Finalization → Cache write.

Supporting:

- `tarball-ingestion.ts` — fetch/unpack GitHub tarball  
- `import-graph.ts`, `import-resolvers.ts`, `graph-quality.ts`, `evidence-from-graph.ts`  
- Agents in `lib/agents/`: classifier, component extractor, relationship analyst, schema compiler, verifier, prompt utils  

UI: `components/RepoDiagramGenerator.tsx`.

---

## 11. Features (product behavior)

| Feature | Where it lives | Notes |
|---------|----------------|-------|
| **Prompt → diagram** | FloatingAIBar, generate-diagram API, AI pipeline | Detail levels L1–L3; streaming route available |
| **Repo → diagram** | RepoDiagramGenerator, repo pipeline | Needs network; quality gated by graph/agents |
| **Templates** | `data/templates/*`, TemplateModal | Load via `loadTemplate` + Mermaid layout |
| **Tutorials** | `data/tutorials/*`, `components/tutorial/*` | Step-guided component placement |
| **Mermaid panel** | MermaidCodePanel | Round-trip RF ↔ Mermaid |
| **LR / TB layout** | Toolbar + `relayout.ts` | Mermaid→Dagre, not ELK |
| **Command palette** | CommandPalette | Quick-add components (⌘K) |
| **Multi-canvas tabs** | diagramStore | Undo/redo, debounced DB save |
| **Auth** | better-auth (`lib/auth.ts`, AuthProvider) | Google / GitHub OAuth (email+password disabled) |
| **Share / embed** | ShareModal, SharedCanvasViewer, embed routes | Domain allowlist |
| **Export** | `lib/svgExport.ts`, toolbar actions | PNG/SVG/JSON/Mermaid |
| **MCP** | `mcp-server/src/tools/*` | generate, update, validate, layout, template, export, checkpoints, list-nodes |
| **Admin** | `app/admin`, admin-auth | Passcode + rate limits |
| **Landing demo** | InteractiveLandingDemo | Preset load-balancer playground |

---

## 12. MCP server

Package: `mcp-server/`. Dev: `npm run dev:mcp` from `frontend/`.

Tools (under `mcp-server/src/tools/`):

`generate-diagram`, `update-diagram`, `validate-diagram`, `fix-layout`, `apply-template`, `export-diagram`, `list-nodes`, `save-checkpoint`, `load-checkpoint`, `read-me`.

Prefer keeping tool contracts stable; change frontend pipelines carefully when tools depend on them.

---

## 13. Testing & quality

```bash
cd frontend
npm test                 # vitest --run
npm run lint
npx tsc --noEmit
```

- Unit tests next to code: `**/__tests__/**`, `*.test.ts`.
- Pipeline shared tests: `lib/pipeline-shared/__tests__/`.
- Handle/edge: `lib/utils/__tests__/handleSlot*.ts`, `edgeRouteBuilder*.ts`.
- Eval scripts (repo quality): `frontend/scripts/eval/`.

When changing layout defaults, update `pipeline-shared` tests that assert `nodeSep` / `rankSep`.

When changing sizing, update `lib/utils/__tests__/nodeSizing.test.ts`.

---

## 14. Gotchas checklist

1. **Same load-balancer diagram** → concept template, not a broken RNG. See §9.
2. **Toolbar layout ≠ ELK** → Mermaid→Dagre via `relayout.ts`.
3. **Nodes too large** → check `nodeSizing` / ShapeNode band; stay on 160–240 grid.
4. **Nodes too cramped** → compound Dagre spacing in `LayoutEngine.defaultCompoundLayoutOptions`.
5. **Handles “wrong” on diamonds** → dynamic ±16 is shared with rectangles; do not tip-lock unless asked.
6. **Group positions** → children use parent-relative coords; relayout preserves `parentNode` / `parentId`.
7. **Dual layout eras** → some docs in `docs/pipeline-refactor-plan.md` describe WIP; trust `relayout.ts` + `pipeline-shared/layout` for current truth.
8. **README pipeline “8 stages”** → AI path is the stage list in `pipeline-v2.ts`; Mermaid path is separate (`lib/mermaid/pipeline.ts`).

---

## 15. Where to change what

| Task | Start here |
|------|------------|
| Node look / shape | `ShapeNode.tsx`, `SystemNode.tsx`, `nodeStyles.css`, `stylingConstants.ts` |
| Node size | `nodeSizing.ts` |
| Handles | `NodeHandles.tsx`, `FloatingHandles.tsx`, `useHandleSlotLayout.ts` |
| Edge path | `edgeRouteBuilder.ts`, `SimpleFloatingEdge.tsx` |
| Auto layout | `relayout.ts`, `DagreLayout.ts`, `LayoutEngine.ts` |
| AI prompt quality | `architecturePlanner.ts`, `conceptTemplates.ts` |
| Skip/fix concept templates | `conceptTemplates.ts`, `ArchitecturePlanningStage.ts` |
| Repo quality | `lib/repo-diagram/*`, `lib/agents/*` |
| Persist / tabs | `diagramStore.ts`, `lib/db.ts` |
| Auth | `lib/auth.ts`, `components/AuthProvider.tsx` |
| Landing demo spacing | `InteractiveLandingDemo.tsx` |

---

## 16. Working agreement with humans

- Ask before large architectural rewrites or deleting pipelines.
- Prefer small, reviewable diffs.
- After behavior changes, note user-visible effects (regenerate diagram / hit layout toggle to refresh old canvases).
- Keep this file updated when canonical paths move (layout owner, sizing rules, concept-template contract).

---

## 17. Environment & local setup

Copy `frontend/.env.example` → `frontend/.env.local`.

| Variable | Required? | Role |
|----------|-----------|------|
| `GROQ_API_KEY` (or `GROQ_API_KEY_FOR_DESC_*`) | **Yes for AI** | LLM generations; multi-key load balancing supported |
| `OPENROUTER_API_KEY*` | Optional | Fallback LLM provider |
| `DATABASE_URL` / `DIRECT_URL` | Needed for auth, save, quotas | Prisma → Neon/Postgres |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Needed for auth | Session crypto + canonical URL |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public origin / trusted origins |
| `UPSTASH_REDIS_REST_*` | Optional | Rate limits + some caches; guests fall back to DB if Redis down |
| `GOOGLE_*` / `GITHUB_*` OAuth | Optional | Social login (omit → that provider disabled) |
| `ADMIN_PASSCODE` / `ADMIN_SESSION_SECRET` / `ALLOWED_ADMIN_EMAIL` | Optional | Admin panel |
| `ALLOWED_EMBED_DOMAINS` | Optional | Embed CSP `frame-ancestors` (default `*`) |
| `GITHUB_TOKEN` | Optional | Repo diagram / eval (higher GitHub rate limits) |
| `REPO_*` model/token knobs | Optional | Repo agent tuning |

**Degradation without infra**

- No Groq → AI generation fails.
- No DB → auth/persistence/quota paths break; canvas may still work via localStorage for guests.
- No Redis → guest AI quota uses DB `usage_logs` fail-closed; if DB also fails, guests are denied (not unlimited).
- No OAuth env → Google/GitHub sign-in disabled with a log warning.

Validation helpers: `frontend/lib/env-validation.ts`.

---

## 18. Data model (Prisma)

Schema: `frontend/prisma/schema.prisma`. Client generated to `frontend/src/generated/prisma`.

| Model | Purpose |
|-------|---------|
| `User` / `Account` / `Session` / `Verification` | better-auth identity |
| `Profile` | Display profile linked 1:1 to User |
| `UserCanvas` | Persisted canvases (`nodes`/`edges` JSON) for signed-in users |
| `SharedCanvas` | Public share payloads; default expiry ~30 days |
| `TutorialProgress` | Per-user tutorial step/canvas snapshot |
| `TutorialResponseCache` | Cached tutorial Q&A by hash |
| `UsageLog` | AI/generation telemetry for quota + analytics (`userId` or `guestId`) |
| `Visitor` / `VisitorSession` / `Event` | Anonymous analytics funnel |
| `ComponentCategory` / `ComponentTemplate` | DB-backed component library (synced into registry) |

**Guest vs persisted**

- Guests: primarily `localStorage` via `lib/storage/localStorage.ts` + `STORAGE_KEYS` in `lib/config.ts` (e.g. `guestCanvases`). Caps enforced in `diagramStore`.
- Authenticated: debounced save to `UserCanvas` through diagramStore / API.

Do not hand-edit production DB; use Prisma migrations under `frontend/prisma/migrations/`.

---

## 19. Caching

| Cache | File | Behavior |
|-------|------|----------|
| In-memory diagram / repo | `lib/ai/services/diagramCache.ts` | Prompt/repo+sha keyed; TTL 5m dev / 30m prod; `PIPELINE_VERSION` busts entries |
| Repo Redis (optional) | `lib/ai/services/repoDiagramRedisCache.ts` | Cross-instance repo results when Upstash configured |
| Blob SHA cache | `lib/cache/blobCache.ts` | Per-file parse/summary reuse for repo re-diagram |
| Tutorial responses | DB `TutorialResponseCache` | Hash → answer |
| Rate limit counters | `lib/redis.ts` + Upstash | Guest hourly AI quota |

When changing pipeline semantics, bump `PIPELINE_VERSION` (or equivalent) so stale graphs are not served.

---

## 20. Auth flows

- Library: **better-auth** (`lib/auth.ts`), Prisma adapter, 7-day sessions.
- **Email/password is disabled** (`emailAndPassword.enabled: false`).
- Social: Google and/or GitHub when env validates; otherwise those providers are off.
- Client: `lib/auth-client.ts`, `components/AuthProvider.tsx`, `SignInButtons.tsx`, `AuthModal.tsx`.
- API route: `app/api/auth/[...all]` (better-auth catch-all).
- Session on server routes: `auth.api.getSession({ headers })` (see `quotaCheck.ts`).
- `NEXT_PUBLIC_AUTH_ENABLED` can gate UI; production must set real `BETTER_AUTH_*`.

Trusted origins include localhost variants + `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL`.

---

## 21. Quotas, tiers & UpgradeModal

Source of truth: `frontend/lib/userQuotas.ts`. Enforcement: `lib/middleware/quotaCheck.ts` on generate / repo routes.

| | Guest | Authenticated |
|--|-------|-----------------|
| AI generations | **3 / hour** (IP) | **10 / day** (`User.dailyGenerations`) |
| Canvases | 1 | 5 |
| Nodes / canvas | 25 | 50 |
| Export | json, png (watermarked PNG) | json, png, svg, pdf, html-embed |
| Share / SVG / dashboard / tutorials progress | No | Yes |
| Templates | Basic allowlist only | All advanced |

UI upsell: `components/UpgradeModal.tsx` (Toolbar, TemplateModal, etc.) when guests hit gated actions.

429 responses include `code: 'QUOTA_EXCEEDED'` and optional `upgradePrompt`.

Detail levels L1–L3 map to diagram size small/medium/large in `generationService.ts` and trim concept templates / planner guidance — not a separate paid tier today.

---

## 22. CI

Workflow: `.github/workflows/ci.yml`.

- Triggers: push/PR to `main`.
- Working directory: `frontend/`.
- Steps: `npm ci` → `prisma generate` → `tsc --noEmit` → lint (`|| true`, non-blocking) → `npm test`.
- Injects dummy `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GROQ_API_KEY` for compile/test.

Agents: keep typecheck + tests green. Do not rely on lint failing the build until CI makes lint strict.

---

## 23. Hooks catalog

Under `frontend/hooks/`:

| Hook | Role |
|------|------|
| `useHandleSlotLayout` | Dynamic in/out handle offsets per side |
| `useInlineLabelEdit` | Double-click rename on nodes |
| `useCanvasInteractions` | Canvas pointer / interaction helpers |
| `useGrouping` | Group / ungroup selection |
| `useSnapping` | Snap-to-grid / guide alignment |
| `useBodyScrollLock` | Lock page scroll for modals |
| `usePageTracking` | Analytics page views |
| `use-mobile` | Responsive breakpoint helper |

Prefer extending these over duplicating interaction logic in components.

---

## 24. Component registry & ports

- **Registry:** `lib/componentRegistry.ts` — merges static JSON (`data/components.json`, `aws-components.json`, `db-components.json`, `services-components.json`) + custom localStorage + optional DB templates via `api-client`.
- **Ports (I/O hints):** `lib/componentPorts.ts` — declarative input/output counts per component key (gateway, LB, DB, …). Used for validation / connection guidance, not React Flow handle counts (handles are still 2×4 sides).
- **Palette mapping:** `ComponentSidebar.tsx`, `CommandPalette.tsx` map library ids → node `serviceType` / shapes (e.g. load balancer → diamond).
- **Factory:** `lib/factory.ts` — creates RF nodes from type ids.

When adding a palette item: update JSON or DB template, ports if needed, shape mapping, and icons.

---

## 25. Streaming generation, progress, abort & fallback

**Client:** `lib/ai/generationService.ts` → `POST /api/generate-diagram` with `stream: true`, optional `AbortSignal`.

**Routes:**

- `app/api/generate-diagram/route.ts` — primary (supports stream flag).
- `app/api/generate-diagram/streaming/route.ts` — dedicated streaming path; both run quota checks first.

**Progress:** `GenerationProgress` in `lib/ai/types` (`phase`, `message`, `progress`, …). UI: `GenerationProgress.tsx` / FloatingAIBar / Editor.

**Abort:** pass `signal` into `generateDiagramFromPrompt`; maps to `GenerationServiceError` code `aborted`.

**Planner failure:** `ArchitecturePlanningStage` errors; materialize may retry planner; `FallbackPlan.ts` / `generateFallbackPlan` for degraded Mermaid when needed.

**Orchestrator:** `lib/ai/services/orchestrator.ts` is the server-side generation entry used by API routes.

---

## 26. Import / export formats

| Format | Mechanism | Notes |
|--------|-----------|-------|
| React Flow JSON | Store + share payloads | `nodes` / `edges` arrays; preserve `type`, `data`, `parentNode` |
| Mermaid | `mermaidTranslator` / MermaidCodePanel / pipeline | Prefer `graph LR` / `graph TD` + `subgraph`; round-trip via relayout |
| PNG | Toolbar export | Guests watermarked (`shouldWatermark`) |
| SVG | `lib/svgExport.ts` (`generatePureSVG`) | Authenticated; mirrors visual system colors |
| PDF / html-embed | Quota allowlist | Gated for authenticated |

Repo import helper: `lib/utils/importRepoDiagram.ts` (sizes nodes, maps API → RF).

Do not invent export fields; match existing node `data` shapes (`label`, `subtitle`, `shape`, `category`, `color`, …).

---

## 27. Eval & golden scripts

Under `frontend/scripts/eval/`:

| Script / npm | Purpose |
|--------------|---------|
| `npm run eval:repo` | Run corpus repos through repo pipeline, score vs golden |
| `npm run eval:repo:report` | Markdown report table |
| `npm run eval:golden` | Generate/update golden graphs |
| `score.ts` | Composite accuracy scoring |
| `repo-corpus.json` + `golden/` | Fixtures |

Needs `GITHUB_TOKEN` + Groq keys. Use before/after repo-pipeline changes. Default composite threshold ~90% (`--threshold`).

---

## 28. React / Next conventions

- **App Router** under `frontend/app/`. Server Components by default; interactive UI needs `"use client"` (Canvas, stores, most editor chrome).
- **API routes** are Route Handlers (`route.ts`) with `runtime = 'nodejs'` and often high `maxDuration` for AI/repo.
- Path alias: `@/` → `frontend/`.
- Prefer existing Radix / shadcn under `components/ui/` for chrome; canvas nodes are custom.
- Zustand stores are client-only; do not import `diagramStore` into server route modules.
- Security headers / CSP set in `next.config.ts` (stricter in production; embed route has separate `frame-ancestors`).
- Prisma client: `lib/prisma` / generated client — generate after schema changes.

---

## 29. Known WIP / dual-era debt

See `docs/pipeline-refactor-plan.md` and `docs/layout-toggler-learnings.md`.

Still be aware of:

- Historical “multiple layout owners” — **canonical** is Mermaid→Dagre via `relayout.ts` + `pipeline-shared/layout`; ELK remains for some presets.
- AI pipeline stage classes vs thin adapters in `pipeline-v2.ts` — prefer typed stages + `pipeline-core`.
- Some docs/README stage counts lag code — trust `pipeline-v2.ts` and `lib/mermaid/pipeline.ts`.
- Lint is non-blocking in CI today.

Do not “finish the refactor” in an unrelated PR unless asked.

---

## 30. Do-not-touch / dangerous areas

Unless the task explicitly requires it:

1. **Auth secrets, CSP, embed headers, admin rate limits** — easy to open XSS or auth bypass.
2. **Prisma migrations / production schema** — no casual destructive migrations.
3. **Quota fail-closed guest path** — never “fix” Redis absence by allowing unlimited AI.
4. **Handle/edge slot contracts** (±16 dynamic offsets) — changes ripple through routing tests.
5. **Concept template triggers** — changing markers alters product behavior for short prompts.
6. **MCP tool schemas** — external agents depend on stable names/args.
7. **`PIPELINE_VERSION` / cache keys** — bump intentionally when invalidating.
8. **Generated Prisma client** — regenerate, don’t hand-edit `src/generated/`.

When in doubt, ask before changing security, billing/quota, or public API/MCP contracts.