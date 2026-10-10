# `lib/` — application logic by domain

Everything that isn't a React component or a route lives here, grouped by what it's about. Import with the `@/lib/...` alias. Put new code in the folder that owns its domain; only truly cross-cutting modules sit at the top level.

| Folder | Owns | Start with |
| --- | --- | --- |
| `diagram/` | The diagram engine — see below | `diagram/mermaid/relayout.ts` |
| `ai/` | Prompt → diagram generation: LLM planner, concept templates, model/key management | `ai/pipeline/mermaid-pipeline/pipeline-v2.ts`, `ai/services/orchestrator.ts` |
| `repo-diagram/` | GitHub repo → diagram pipeline, its LLM `agents/`, ingestion, caching, types | `repo-diagram/pipeline-v2.ts` |
| `server/` | **Server-only**: auth, database (Prisma), Redis, credits, AI quota checks, env validation | `server/quotaCheck.ts`, `server/db.ts` |
| `client/` | **Browser-only**: API client, auth client, analytics, localStorage, React Flow instance ref | `client/api-client.ts` |
| `quotas/` | Plan limits and credit policy (shared by client and server) | `quotas/userQuotas.ts` |
| `theme/` | Render styles (precision/sketch/…), color tokens, shape geometry, app theme hooks | `theme/stylingConstants.ts`, `theme/shapeGeometry/` |
| `icons/` | Icon registry, resolvers, brand/cloud icons, the custom architecture icon set | `icons/nodeIconResolver.ts` |
| `component-library/` | The palette of components: registry, ports, node factory, component knowledge | `component-library/componentRegistry.ts` |
| `tutorial/` | Guided tutorial engine and validation | `tutorial/engine.ts` |
| `site/` | Public metadata: agent discovery files (llms.txt, sitemap), OpenAPI spec | `site/discovery.ts` |
| `jev/` | Experimental architecture-spec generator (used by `/test`) | — |
| `config.ts`, `logger.ts`, `utils.ts` | App-wide config constants, logging, small shared helpers | — |

## `diagram/` — the diagram engine

| Folder | Owns |
| --- | --- |
| `mermaid/` | Mermaid parse → validate → build → layout; `relayout.ts` is the canonical layout entry point |
| `pipeline-shared/` | Dagre layout engine (`layout/`), React Flow adapters, progress reporting |
| `pipeline-core/` | Generic typed `Pipeline` / `Stage` primitives used by every pipeline |
| `edges/` | Edge routing, handle slots, labels, edge geometry |
| `nodes/` | Node sizing grid, shape registry, text layout, node validation |
| `geometry/` | Whole-diagram geometry plan (runs in a worker), collision resolution, alignment guides |
| `export/` | PNG/SVG export (`svg/` renders the same shape primitives as the canvas) |
| `canvas/` | `CanvasHostContext` (editor vs read-only viewers), drop-to-connect logic |
| `features/` | Post-processing passes: clarity compiler, main-spine detection, dynamic handles |
| `constants/` | Diagram and node-shape constants |
