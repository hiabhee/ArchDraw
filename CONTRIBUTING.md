# Contributing to ArchDraw

Thanks for helping. This page tells you where things live and how to check your change. Deeper references: [docs/README.md](docs/README.md) (all docs) and [AGENTS.md](AGENTS.md) (the detailed contracts and invariants).

## Set up

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in what you need; GROQ_API_KEY for AI generation
npm run dev                  # http://localhost:3000
```

The MCP server is a separate package: `cd mcp-server && npm install && npm test`.

## Where things live

| You want to change… | Look in |
| --- | --- |
| A page or API endpoint | `frontend/app/` (routes; `app/api/**/route.ts` for endpoints) |
| How nodes / edges look on the canvas | `frontend/components/canvas/` and `frontend/lib/theme/` |
| Editor chrome (toolbar, panels, modals, command palette) | `frontend/components/editor/` |
| Edge routing, handles, node sizing, geometry | `frontend/lib/diagram/` (`edges/`, `nodes/`, `geometry/`) |
| Mermaid parsing and auto-layout | `frontend/lib/diagram/mermaid/`, `frontend/lib/diagram/pipeline-shared/layout/` |
| Prompt → diagram (AI) | `frontend/lib/ai/` |
| GitHub repo → diagram | `frontend/lib/repo-diagram/` |
| PNG / SVG export | `frontend/lib/diagram/export/` |
| Auth, database, quotas, credits (server-only) | `frontend/lib/server/`, `frontend/lib/quotas/` |
| Editor state, undo/redo, saving | `frontend/store/diagram/` |
| Templates, tutorials, component catalog | `frontend/data/` |
| Database schema | `frontend/prisma/schema.prisma` (+ a migration) |
| MCP tools for AI agents | `mcp-server/src/tools/` |
| The Claude Code / Codex plugin | `plugins/archdraw/` |

Folder maps: [frontend/lib/README.md](frontend/lib/README.md) · [frontend/components/README.md](frontend/components/README.md).

## Conventions

- Import with the `@/` alias (`@/lib/diagram/edges/edgeRouteBuilder`), not long relative paths.
- Put new code in the domain folder it belongs to; don't add files to the top of `lib/` or `components/`.
- Code under `lib/server/` is server-only; never import it from a `'use client'` file. Browser-only helpers go in `lib/client/`.
- Tests sit next to the code: `__tests__/` folders or `*.test.ts` files.

## Check your change

```bash
cd frontend
npx tsc --noEmit   # typecheck
npm test           # vitest
npm run lint
```

CI runs the typecheck and tests on every PR to `main`.

## Files you can ignore

Several top-level folders are configuration for AI coding assistants, not product code: `.agents/` (apart from `.agents/plugins/`), `.github/skills/`, `.github/agents/`, `.github/hooks/`, `.codex/`, `.impeccable/`, `frontend/.agents/`, `opencode.json`, `PRODUCT.md`, and the `skills-lock.json` files. The tools read them from those exact paths, so leave them where they are.

## Design system: color tokens

To maintain design system integrity, all UI components, dashboard chrome elements, navigation shells, inputs, buttons, and landing page elements must use the centralized Tailwind CSS v4 custom color classes.

### Color palette tokens

Always use these semantic classes rather than ad-hoc hex values (`#5e6ad2`, `#828fff`, etc.) or raw HSL bindings (`hsl(var(--card))`).

| Semantic Token | Tailwind Class | Light Mode Value | Dark Mode Value |
| :--- | :--- | :--- | :--- |
| Canvas / Page | `bg-surface-page` | `#f7f7f5` | `#07080a` |
| Sidebar / Drawer | `bg-surface-panel` | `#ffffff` | `#0c0e11` |
| Node / Card Wrapper | `bg-surface-card` | `#ffffff` | `#131518` |
| Secondary Border | `border-border` | `#e4e4df` | `#1f2124` |
| Heavy Separator / Ring | `border-border-strong` | `#cbd5e1` | `#3a3c40` |
| Title / Primary Text | `text-text-primary` | `#1c1c1a` | `#ece9e2` |
| Body / Secondary Text | `text-text-secondary` | `#575752` | `#c9c5bc` |
| Subtext / Muted | `text-text-muted` | `#8a8f98` | `#94918a` |
| Brand Primary CTA | `bg-accent` / `text-accent` | `#5e6ad2` | `#5e6ad2` |
| Brand Hover State | `bg-accent-hover` / `text-accent-hover` | `#4752b4` | `#828fff` |
| Subtle Interactive Bg | `bg-accent-bg` | `rgba(94, 106, 210, 0.08)` | `rgba(130, 143, 255, 0.12)` |
| Subtle Interactive Text | `text-accent-text` | `#5e6ad2` | `#828fff` |
