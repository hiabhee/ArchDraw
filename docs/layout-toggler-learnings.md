# Layout toggler technique — implementation notes

Date: 2026-08-03  
Goal: Make template load and diagram generation use the same layout path as the toolbar LR/TB layout toggler, which manual testing showed produces the clearest architecture flow.

## What the layout toggler actually does

The toolbar button is `LayoutToggleButton` in `frontend/components/Toolbar.tsx`. It does **not** use the ELK canvas presets in `applyLayoutPreset`. It calls:

`relayoutCanvasViaMermaid` → same implementation as `layoutDiagramViaMermaid` in `frontend/lib/mermaid/relayout.ts`.

That function:

1. Serializes the current React Flow graph to Mermaid via `reactFlowToMermaid` (`graph LR` or `graph TD`, with `subgraph` for groups).
2. Runs `runMermaidPipeline`:
   - Parse → Validate → Build → **Layout** (`applyRfLayout` / compound **Dagre**) → **Size** (`sizeSubgraphs`) → Validate output.
3. Maps pipeline positions/sizes back onto the original nodes while preserving original `type`, `data`, `parentNode` / `parentId`, and styles.
4. Writes the result through `importDiagram` (toggle) and updates `activeLayoutPresetId`.

Canonical sketch: [`layout-toggler.md`](./layout-toggler.md).

## Why templates looked cluttered before toggle

ArchDraw’s hand-authored template (`frontend/data/templates/archdraw.ts`) has fixed positions that pack many groups tightly. Edges still cross in ways that make flow hard to read.

The toggler re-ranks nodes from **edge structure**, so left→right / top→bottom flow becomes obvious even when the bounding box grows.

Important distinction discovered while probing:

- Store APIs `toggleLayoutDirection` / `applyLayoutPresetById` previously used **ELK** (`frontend/lib/canvas/applyLayout.ts`).
- The **visible** toolbar toggler used **Mermaid → Dagre**.
- Those are different engines. The “good” layout from manual testing is the Mermaid path.

## What was already wired

Prior WIP already called `layoutDiagramViaMermaid` from:

- `TemplateModal` (template picker)
- `Canvas` (`?template=` URL load)
- `Editor` (AI generation after nodes/edges arrive)

## What I changed

1. **`diagramStore` layered presets** — `layered-lr` / `layered-tb` (and `toggleLayoutDirection`) now call `layoutDiagramViaMermaid`, matching the toolbar. Force/freeform still use their previous behavior (ELK / no-op).
2. **`loadTemplate`** — now delegates to `importDiagram` (same clarity + handle distribution path as the toggler) instead of `resolveNodeCollisions`, which could fight a compound layout on smaller templates.
3. **`reactFlowToMermaid`** — parent resolution now checks `parentNode`, `parentId`, and `data.parentId` so normalized store nodes still serialize as subgraphs.
4. **Docs** — this file + `layout-toggler.md`.

## Files read / touched

| Area | Files |
|------|--------|
| Toggler UI | `frontend/components/Toolbar.tsx` |
| Canonical API | `frontend/lib/mermaid/relayout.ts` |
| Mermaid pipeline | `frontend/lib/mermaid/pipeline.ts`, `pipeline-stages/LayoutStage.ts`, `SizeStage.ts`, `subgraphSizing.ts` |
| Dagre engine | `frontend/lib/pipeline-shared/layout/DagreLayout.ts`, `IntegratedLayout.ts` |
| RF → Mermaid | `frontend/lib/ai/pipeline/mermaid-pipeline/mermaidTranslator.ts` |
| Template load | `frontend/components/TemplateModal.tsx`, `frontend/components/Canvas.tsx`, `frontend/data/templates/archdraw.ts` |
| Generation | `frontend/views/Editor.tsx` |
| Store | `frontend/store/diagramStore.ts` |
| Alternate (not toggler) | `frontend/lib/canvas/applyLayout.ts` (ELK), `frontend/lib/layoutUtils.ts` (older dagre helper for repo import) |

## Probe findings (ArchDraw template)

Vitest probe against `archdrawNodes` / `archdrawEdges`:

- Mermaid layout **succeeds** (56 nodes, 52 edges).
- Parent relationships survive the round-trip (`parentMismatch: 0`).
- Compound Dagre can **stretch** groups that have many cross-group edges (e.g. `grp_client` became very wide because its children were ranked far apart). Flow readability still improved vs hand-authored packing; further tightening of cluster layout is a follow-up, not required to share the toggler path.
- LR → TD → LR round-trip is stable (same bbox after returning to LR).

## Call-site contract going forward

Any code that puts a full architecture on the canvas should:

```ts
const { nodes, edges, success } = await layoutDiagramViaMermaid(nodes, edges, 'LR' | 'TD');
// then importDiagram / setNodes with the result (fallback to input if !success)
```

Do **not** assume hand-authored template coordinates or raw AI coordinates are final.

## Follow-ups (not done here)

- Migrate repo-diagram import (`importRepoDiagram.ts` → `getLayoutedElements`) onto `layoutDiagramViaMermaid` (needs async API).
- Improve compound Dagre cluster compactness when children have many external edges.
- Optionally bake a Mermaid-laid snapshot into large templates so first paint needs no async layout.
