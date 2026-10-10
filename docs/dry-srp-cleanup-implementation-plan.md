# DRY and SRP Cleanup Implementation Plan

## Problem Summary

Several areas of ArchDraw currently duplicate behavior or mix too many responsibilities in one module. The highest-risk examples are sketch rendering, layout ownership, large editor/export files, tutorial/editor UI duplication, duplicate node-copy behavior, repeated repo-pipeline helpers, and scattered theme token usage.

The goal is not a broad rewrite. The goal is to reduce drift by making each important behavior have one clear owner.

## Goals

- One rendering contract for canvas and SVG export.
- One canonical layout path for production diagrams.
- Smaller modules with fewer reasons to change.
- Shared editor primitives reused by tutorial mode.
- One store/API path for duplicate-node behavior.
- Shared pipeline helper utilities instead of repeated local functions.
- Theme values resolved through tokens, not scattered hardcoded literals.

## Non-Goals

- Do not redesign the product UI.
- Do not rewrite the AI pipeline.
- Do not remove MCP behavior unless a replacement exists.
- Do not change precision mode visuals unless required by extraction.
- Do not combine this cleanup with feature work.

## Phase 1: Unify Sketch Rendering

### Current Problem

Sketch rendering logic is duplicated across:

- `frontend/components/ShapeNode.tsx`
- `frontend/components/SystemNode.tsx`
- `frontend/components/GroupNode.tsx`
- `frontend/lib/svgExport.ts`
- `frontend/lib/utils/shapeSilhouetteSvg.ts`

Canvas rendering and SVG export can drift because they assemble surfaces, fills, strokes, seeds, and sketch bodies independently.

### Implementation

Create a shared render-surface module:

```text
frontend/lib/theme/renderStyles/surface.ts
```

Suggested exports:

```ts
export interface ResolveRenderSurfaceInput {
  renderStyleId: DiagramRenderStyleId;
  isDark: boolean;
  selected?: boolean;
  accentColor?: string;
  nodeStyle?: NodeStyleConfig;
  shape?: ShapeType | string | null;
}

export function resolveRenderSurface(input: ResolveRenderSurfaceInput): RenderSurface;

export function renderSketchSurface(input: {
  primitives: ShapePrimitive[];
  surface: RenderSurface;
  seedId: string;
  isDark: boolean;
  shape?: ShapeType | string | null;
}): string;
```

Then replace local surface assembly in:

- `ShapeNode.tsx`
- `SystemNode.tsx`
- `GroupNode.tsx`
- `svgExport.ts`
- `shapeSilhouetteSvg.ts`

### Acceptance Criteria

- `resolveShapeSurface` in `ShapeNode.tsx` is deleted.
- `resolveShapeSurfaceSvg` in `svgExport.ts` is deleted.
- Sketch body construction uses one shared helper.
- Canvas and SVG export use the same fill/stroke/selection decisions.
- Precision mode output remains unchanged.

### Tests

Update or add:

- `frontend/lib/theme/renderStyles/__tests__/surface.test.ts`
- `frontend/lib/__tests__/svgExport.test.ts`
- existing sketch body tests

Run:

```bash
cd frontend
npm test -- renderStyles
npm test -- svgExport
```

## Phase 2: Consolidate Layout Ownership

### Current Problem

Layout exists in several places:

- Canonical Mermaid path: `frontend/lib/mermaid/relayout.ts`
- Shared Dagre engine: `frontend/lib/pipeline-shared/layout/DagreLayout.ts`
- Older helper: `frontend/lib/layoutUtils.ts`
- Landing demo local Dagre: `frontend/components/landing/InteractiveLandingDemo.tsx`
- MCP ELK runner: `mcp-server/src/lib/elk-runner.ts`

This creates inconsistent layout behavior by entry point.

### Implementation

1. Audit all imports of `frontend/lib/layoutUtils.ts`.
2. Migrate production callers to `layoutDiagramViaMermaid` or `applyRfLayout`.
3. If `layoutUtils.ts` is still needed, make it a thin compatibility wrapper with a deprecation comment.
4. Keep landing demo custom layout only if its preset is intentionally hand-authored. Add a comment explaining why it does not use canonical layout.
5. Keep MCP ELK isolated unless MCP contracts are being changed. Document that MCP ELK is separate protocol tooling, not frontend canvas truth.

### Acceptance Criteria

- Production app layout paths use `layoutDiagramViaMermaid` or `pipeline-shared/layout`.
- `layoutUtils.ts` has no unique layout logic, or is deleted.
- Docs clearly identify any allowed exceptions.
- No toolbar/template/tutorial layout drift.

### Tests

Run:

```bash
cd frontend
npm test -- relayout
npm test -- pipeline-shared
npx tsc --noEmit
```

## Phase 3: Split Oversized Modules By Responsibility

### Current Problem

Several files are too large and have too many reasons to change:

- `frontend/lib/svgExport.ts`
- `frontend/components/Toolbar.tsx`
- `frontend/components/ShapeNode.tsx`
- `frontend/lib/utils/collisionFreeEdgePath.ts`
- `frontend/components/landing/InteractiveLandingDemo.tsx`

### Implementation

Do this incrementally. Avoid behavior changes in the same PR as extraction.

### `svgExport.ts`

Split into:

```text
frontend/lib/export/svg/index.ts
frontend/lib/export/svg/nodeExport.ts
frontend/lib/export/svg/edgeExport.ts
frontend/lib/export/svg/groupExport.ts
frontend/lib/export/svg/textExport.ts
frontend/lib/export/svg/exportTypes.ts
frontend/lib/export/svg/exportUtils.ts
```

Keep `generatePureSVG` as the public API.

### `Toolbar.tsx`

Extract:

```text
frontend/components/toolbar/CanvasTabs.tsx
frontend/components/toolbar/ExportMenu.tsx
frontend/components/toolbar/ShareMenu.tsx
frontend/components/toolbar/LayoutControls.tsx
frontend/components/toolbar/RenderStyleToggle.tsx
frontend/components/toolbar/DeleteCanvasDialog.tsx
frontend/components/toolbar/useToolbarActions.ts
```

Keep `Toolbar.tsx` as composition only.

### `ShapeNode.tsx`

Extract:

```text
frontend/components/nodes/shape/ShapeLabel.tsx
frontend/components/nodes/shape/ShapeSurface.tsx
frontend/components/nodes/shape/shapeRenderers.tsx
frontend/components/nodes/shape/shapeSizing.ts
```

Keep shape geometry truth in `frontend/lib/theme/shapeGeometry`.

### `collisionFreeEdgePath.ts`

Extract pure helpers:

```text
frontend/lib/utils/edgePath/obstacles.ts
frontend/lib/utils/edgePath/router.ts
frontend/lib/utils/edgePath/scoring.ts
frontend/lib/utils/edgePath/types.ts
```

### Acceptance Criteria

- Public imports remain stable where possible.
- Extracted files have focused names and focused tests.
- No visual behavior changes from extraction-only PRs.
- Typecheck stays green after each extraction.

## Phase 4: Reuse Editor UI In Tutorials

### Current Problem

Tutorial UI duplicates editor UI:

- `TutorialCanvas.tsx` duplicates `Canvas.tsx`.
- `ComponentPalette.tsx` duplicates command/palette behavior.
- `NodeDetailsPanel.tsx` duplicates parts of `PropertiesPanel.tsx`.

### Implementation

Follow the direction already described in `docs/tutorials-design-refresh-plan.md`.

1. Add a `mode` or `context` prop to shared editor primitives where needed:

```ts
mode?: 'editor' | 'tutorial' | 'shared' | 'embed'
```

2. Make `Canvas` support tutorial-only affordances:

- highlighted target nodes
- limited interactions
- step validation hooks
- tutorial fit-view callback

3. Replace tutorial component drawer with filtered `CommandPalette`.
4. Add read-only/tutorial mode to `PropertiesPanel`, or extract a shared `NodeInspector`.
5. Convert `TutorialCanvas.tsx` into a thin wrapper, then delete it once parity is proven.

### Acceptance Criteria

- Tutorial player and editor use the same node/edge rendering path.
- Tutorial details panel reuses `PropertiesPanel` or shared inspector primitives.
- Tutorial palette uses shared component registry/search behavior.
- No duplicate React Flow host remains unless temporarily feature-flagged.

### Tests

Run:

```bash
cd frontend
npm test -- tutorial
npm test -- Canvas
npx tsc --noEmit
```

Manual QA:

- Start tutorial
- Add required nodes
- Connect edges
- Use hints/explain
- Complete tutorial
- Open completed tutorial in editor

## Phase 5: Centralize Node Duplication

### Current Problem

Node copy logic appears in multiple places:

- `SystemNode.tsx`
- `PropertiesPanel.tsx`
- `ContextMenu.tsx`

This can cause copied nodes to differ depending on where the user duplicates them.

### Implementation

Add one store action:

```ts
duplicateNode: (nodeId: string, options?: {
  offset?: { x: number; y: number };
  labelSuffix?: string;
}) => string | undefined;
```

Implementation belongs in the diagram store graph slice or a store helper.

It should:

- clone node data safely
- generate a new id
- apply standard offset
- clear selection or select the duplicated node consistently
- preserve shape/system node metadata
- avoid copying transient UI-only fields
- optionally duplicate selected connected edges only if explicitly requested later

Replace local duplicate handlers in:

- `SystemNode.tsx`
- `PropertiesPanel.tsx`
- `ContextMenu.tsx`

### Acceptance Criteria

- Only one implementation creates duplicated node data.
- All duplicate actions produce the same result.
- Tests cover shape nodes and system nodes.

### Tests

Add:

```text
frontend/store/diagram/slices/__tests__/duplicateNode.test.ts
```

Run:

```bash
cd frontend
npm test -- duplicateNode
```

## Phase 6: Extract Shared Repo Pipeline Context Helpers

### Current Problem

`detailLevelFromContext` is repeated in repo pipeline stages.

### Implementation

Create:

```text
frontend/lib/repo-diagram/pipeline-stages/context-utils.ts
```

Suggested exports:

```ts
export function detailLevelFromContext(
  context: PipelineContext,
  fallback?: 1 | 2 | 3,
): 1 | 2 | 3;
```

Replace local copies in:

- `ClassifyStage.ts`
- `FinalizationStage.ts`

Search for other repeated context access patterns and move only obvious duplicates.

### Acceptance Criteria

- No local copies of `detailLevelFromContext`.
- No behavior changes.
- Repo pipeline tests remain green.

### Tests

Run:

```bash
cd frontend
npm test -- repo-diagram
```

## Phase 7: Route Theme Usage Through Resolved Tokens

### Current Problem

Theme truth is scattered across:

- `stylingConstants.ts`
- `renderStyles/sketch.ts`
- `resolveTokens.ts`
- `nodeStyles.css`
- `svgExport.ts`
- node components

Some components and export paths reference raw sketch constants directly instead of consuming resolved render tokens.

### Implementation

1. Treat `resolveCanvasTokens` as the main entry point for render style × color theme × light/dark.
2. Add shared helpers for node, group, edge, and label surfaces if needed:

```text
frontend/lib/theme/renderStyles/surfaces/
```

Potential helpers:

```ts
resolveNodeSurface()
resolveGroupSurface()
resolveEdgeSurface()
resolveEdgeLabelSurface()
resolveSelectionSurface()
```

3. Replace direct sketch color usage in components/export unless the constant is part of the token resolver itself.
4. Keep CSS variables as the bridge for runtime styling.

### Acceptance Criteria

- Sketch constants are mostly used inside token/surface resolution modules.
- Components consume resolved values or CSS vars.
- SVG export consumes the same resolved values as canvas rendering.
- Dark and light mode behavior comes from one resolver.

### Tests

Run:

```bash
cd frontend
npm test -- resolveTokens
npm test -- svgExport
npx tsc --noEmit
```

## Phase 8: Update Documentation And Ownership Notes

Update:

- `AGENTS.md`
- `docs/diagram-aesthetic-themes-plan.md`
- `docs/layout-toggler.md`
- `docs/layout-toggler-learnings.md`
- `docs/tutorials-design-refresh-plan.md`

Document:

- canonical render surface owner
- canonical layout owner
- allowed exceptions
- tutorial/editor shared UI direction
- node duplication store action

## Suggested PR Order

1. Repo pipeline helper extraction.
2. Node duplication store action.
3. Sketch surface resolver.
4. SVG export modular extraction.
5. ShapeNode modular extraction.
6. Toolbar modular extraction.
7. Layout helper consolidation.
8. Tutorial shared UI migration.
9. Theme token cleanup and docs pass.

This order starts with low-risk cleanup, then moves toward larger UI and rendering work.

## Risks

- SVG export can silently drift from canvas rendering.
- Tutorial migration can break progress or validation behavior.
- Layout consolidation can change old canvas positions.
- Toolbar extraction can introduce subtle menu/dialog regressions.
- Theme cleanup can affect both light and dark modes.

Mitigation:

- Keep extraction PRs behavior-preserving.
- Use targeted tests before broad tests.
- Use screenshots/manual QA for visual changes.
- Avoid mixing cleanup with visual redesign.

## Final Acceptance Criteria

- Sketch rendering has one shared surface/body path.
- Production layout behavior has one clear owner.
- `Toolbar.tsx`, `ShapeNode.tsx`, and `svgExport.ts` are materially smaller or split.
- Tutorial mode reuses editor primitives where practical.
- Node duplication is a store-level action.
- Repo pipeline repeated helpers are centralized.
- Theme constants are routed through resolvers, not scattered across components.
- Typecheck and relevant Vitest suites pass.

