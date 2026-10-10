# Tutorial Authoring Guide

Patterns and conventions for writing ArchDraw architecture tutorials.
Keep this file in sync with `../lib/tutorial/schema.ts`, `../lib/tutorial/builder.ts`, and the component registry.

## Anatomy of a tutorial

A tutorial is a `defineTutorial({...})` config in `frontend/data/tutorials/<id>-architecture.ts`:

- `id` — kebab-case unique id (`chatgpt-architecture`).
- `levels` — 1–3 groups of steps, each with a `title`, `description`, and `steps`.
- `steps` — each a `step({...})` with `component`, `nodeType`, optional `parent`/`parents`, and `phases`.
- Register every tutorial in `frontend/data/tutorials/index.ts` (import + `TUTORIALS` array).

### Step phases

Every step has six phases (`context`, `intro`, `teaching`, `action`, `connecting`, `celebration`). The builder fills in reasonable defaults, but **author `context`, `intro`, and `teaching` explicitly** — defaults are generic and defeat the pedagogy.

The `teaching` phase should carry two callouts (use the author-authored values; the builder falls back to the shared component tooltips when omitted):

- `whyItMatters` — "Without this component, X breaks." Why does this component exist?
- `tradeoff` — the key decision / cost (e.g. "caching adds staleness").

## Depth & length

| Tier | Steps | Levels | Difficulty | Examples |
|------|-------|--------|------------|----------|
| Starter | 8–10 | 1 | beginner | URL shortener, Todo API, Rate Limiter |
| Core | 10–15 | 2–3 | intermediate | Instagram, Stripe, WhatsApp |
| Advanced | 15–25 | 3 | advanced | ChatGPT, Netflix, Discord |

- ~3–4 min per step → set `estimatedMinutes` accordingly.
- `difficulty: 'beginner' | 'intermediate' | 'advanced'`.

## Beginner funnel

Three starter tutorials are marked for the catalog "Start here" section:

- `url-shortener-architecture` → `recommendedOrder: 1`
- `rate-limiter-architecture` → `recommendedOrder: 2`
- `todo-api-architecture` → `recommendedOrder: 3`

`recommendedOrder` must be unique; keep the set small (3–4) or the section loses its point.

## Component registry contract

- `component` label and `nodeType` must exist in the registry (`frontend/data/components.json` + `aws/db/services-components.json`), validated at dev time by `registryCheck.ts`. A missing nodeType logs `[Tutorial] ... not in registry — always fails.` — an impossible step.
- The `component` label should match a tooltip key in `frontend/data/componentTooltips.ts` when possible so teaching callouts can auto-fill.
- Use `aliases` when several registry ids represent the same role.
- Prefer palette component names (labels from `ComponentSidebar`) so users can find them with ⌘K.

## Entry component fatigue (4C)

Do not start every tutorial with the same client. Match the entry point to the system:

- **Consumer web apps** → `Web Client` / `Web` (browser).
- **Mobile-first products** → `Mobile Client` (use sparingly; most can open with Web Client).
- **Batch / event-driven jobs** → start with `Cron` / `Message Queue` / ingest.
- **B2B / developer APIs** → start with `Web` only (API consumer), skip mobile.
- **Streaming / media** → start with `CDN` or ingest edge.
- **Marketplaces / logistics** → start with the supply-side app (e.g. `Driver App`, `Rider App`).

Before adding a tutorial, check existing first-step components:

```bash
for f in frontend/data/tutorials/*-architecture.ts; do
  first=$(rg -m1 -A2 "steps: \[" "$f" | rg -o "component: '[^']+'" | head -1)
  echo "$(basename $f): ${first:-none}"
done
```

## Validation

- Node/edge validation auto-generates from `component`/`nodeType` + `parent(s)`. Override with `validation` for advanced rules (`node_count`, `edge_from_type`, `all_of`, `any_of`).
- First step of a level: use `noConnect: true` and skip the edge rule.
- Keep `hints` short and actionable (`Search for "X"`, `Connect Y to it`).

## Checklist before adding a tutorial

- [ ] Unique `context` copy per step (not "Level 1: Step N").
- [ ] `whyItMatters` + `tradeoff` authored on every `teaching` phase.
- [ ] Domain entry component (not always the client).
- [ ] `nodeType` present in registry; label in `componentTooltips.ts`.
- [ ] `recommendedOrder` only for the beginner funnel set.
- [ ] Registered in `data/tutorials/index.ts`.
- [ ] `npx vitest run lib/tutorial/__tests__/validateTutorials.test.ts` passes.
- [ ] `npx tsx scripts/lint-tutorials.ts` clean.
