# Diagram Store Split — Implementation Plan

Companion to [`1_codebase-cleanup-implementation-plan.md`](./1_codebase-cleanup-implementation-plan.md) (Problem 4).

**Current state:** `frontend/store/diagramStore.ts` — **~2,291 LOC**, ~43 consumer files, 3 store tests.

**Goal:** Split into focused modules without changing the public API (`useDiagramStore`, `registerFitViewCallback`, exported types). Consumers should keep importing from `@/store/diagramStore`.

**Non-goals:** New product behavior, quota rule changes, persistence schema changes, or renaming storage keys.

---

## Why split?

| Issue | Impact |
|-------|--------|
| Single file owns tabs, DB sync, undo, selection, AI streaming, grouping, handles | Hard to review, easy to break unrelated features |
| `deriveNodesAndEdges` Proxy + `wrapCreator` | Subtle; buried at bottom of 2k-line file |
| `persist.onRehydrateStorage` migration block (~150 LOC) | Risky to edit near node CRUD |
| `distributeTargetHandles` / `recalculateHandles` (~200 LOC) | Edge domain mixed with canvas domain |

---

## Architecture today (simplified)

```
useDiagramStore
  └── persist(wrapCreator(state))
        ├── canvases[]          ← source of truth per tab
        ├── activeCanvasId
        ├── nodes / edges       ← derived via Proxy from active canvas
        ├── UI chrome state
        ├── undo past/future
        └── actions (76+)

registerFitViewCallback()  ← module-level, set by Canvas.tsx
_debouncedSave()             ← module-level DB write
```

**Critical invariant:** `nodes` and `edges` on the store are **not** independent fields — they are read through `deriveNodesAndEdges` from `canvases[activeCanvasId]`. Any write must go through `syncActiveCanvas()` or update `canvases` directly.

---

## Target structure

```
frontend/store/
  diagramStore.ts              # Composer only: create(), persist, re-exports (~300 LOC)
  diagram/
    types.ts                   # DiagramState, CanvasTab, NodeData, GuideLine, …
    constants.ts               # MAX_GUEST_*, RESERVED_LAYER_LABELS, KNOWN_*_TYPES
    fitView.ts                 # registerFitViewCallback, module-level callback
    helpers/
      canvasHelpers.ts         # makeCanvas, syncActiveCanvas, mergeGuestCanvases
      nodeHelpers.ts           # normalizeNodes, stripReservedLayerNodes, sanitizeNodes
      edgeHelpers.ts           # normalizeEdge, distributeTargetHandles, getAbsolutePosition
      debounce.ts              # debounce utility
    persistence/
      dbSave.ts                # _debouncedSave, deleteCanvasFromDB
      rehydrate.ts             # onRehydrateStorage migration logic (extracted from persist config)
    slices/
      canvasSlice.ts           # tabs: add/switch/close/duplicate, openCanvasIds
      persistenceSlice.ts      # userProfile, load/save DB, savingState
      selectionSlice.ts        # selectedNodeId(s), selectedEdgeId
      uiSlice.ts               # grid, theme, sidebar, layout preset id, pen mode
      historySlice.ts          # past/future, undo/redo, pushHistory
      graphSlice.ts            # onNodesChange, addNode, importDiagram, grouping, handles
      edgeEditSlice.ts         # editingEdgeId, updateEdgeLabel, pending* ids
      pipelineSlice.ts         # pipelineStatus, appendNode/Edge, setNodes/setEdges
      sequenceSlice.ts         # sequenceDiagrams CRUD
    derive.ts                  # deriveNodesAndEdges Proxy + wrapCreator
```

**Public API unchanged:**

```ts
// Consumers keep this import path
import { useDiagramStore, registerFitViewCallback } from '@/store/diagramStore';
import type { NodeData, CanvasTab, GuideLine } from '@/store/diagramStore';
```

---

## PR sequence

Do **one PR per phase**. Keep each diff reviewable (< ~500 LOC net moves when possible).

### PR 2A — Extract types, constants, pure helpers (low risk)

**Estimated:** ½–1 day | **Risk:** Low

**Move without behavior change:**

| From `diagramStore.ts` | To |
|------------------------|-----|
| `GuideLine`, `NodeData`, `CanvasTab`, `UserProfile`, `HistoryEntry`, `DiagramState` | `diagram/types.ts` |
| `MAX_GUEST_*`, `RESERVED_LAYER_LABELS`, `KNOWN_NODE_TYPES`, `KNOWN_EDGE_TYPES` | `diagram/constants.ts` |
| `makeCanvas`, `syncActiveCanvas` | `diagram/helpers/canvasHelpers.ts` |
| `normalizeNode*`, `stripReservedLayerNodes`, `sanitizeNodes`, `validateAndFixNodes` callers | `diagram/helpers/nodeHelpers.ts` |
| `normalizeEdge`, `normalizeEdges`, `sanitizeEdges`, `getAbsolutePosition` | `diagram/helpers/edgeHelpers.ts` |
| `debounce` | `diagram/helpers/debounce.ts` |
| `registerFitViewCallback` | `diagram/fitView.ts` |

**`diagramStore.ts` re-exports types** so no consumer import changes.

**Tests**

- [ ] `npm test store/` — 3 files pass
- [ ] `npx tsc --noEmit` (after Phase 0B from plan 1)

**Acceptance:** `diagramStore.ts` < **1,900 LOC**; zero runtime behavior change.

---

### PR 2B — Extract persistence + rehydrate (medium risk)

**Estimated:** 1 day | **Risk:** Medium (guest/auth migration paths)

**Move:**

- `_debouncedSave`, `deleteCanvasFromDB` → `diagram/persistence/dbSave.ts`
- Entire `persist({ … onRehydrateStorage })` body → `diagram/persistence/rehydrate.ts` as `rehydrateDiagramState(state, version)`

**Keep in `diagramStore.ts`:**

```ts
persist(wrapCreator(composeSlices), {
  name: STORAGE_KEY,
  version: STORAGE_VERSION,
  storage: createJSONStorage(() => serializedStorage),
  partialize: (state) => ({ /* unchanged keys */ }),
  onRehydrateStorage: () => (state) => rehydrateDiagramState(state),
})
```

**Manual smoke**

- [ ] Guest: reload page → canvas restored from `localStorage`
- [ ] Auth: sign in → `loadCanvasesFromDB` populates tabs
- [ ] New session vs same session (`archdraw-session-active`)

**Acceptance:** `diagramStore.ts` < **1,600 LOC**; guest + auth persistence unchanged.

---

### PR 2C — Extract edge/handle helpers (low–medium risk)

**Estimated:** 1 day | **Risk:** Medium (edge routing regressions)

**Move to `diagram/helpers/edgeHelpers.ts`:**

- `distributeTargetHandles` (~85 LOC)
- `positionToSide`
- `recalculateHandles` implementation body (slice calls helper)

**Add test** `store/__tests__/recalculateHandles.test.ts`:

- [ ] Two nodes + one edge → handles match `source-left` / `target-right` (or similar) for LR preset
- [ ] Self-loop edge → `source-top` / `target-right`

**Acceptance:** Edge handle tests pass; `SimpleFloatingEdge` manual check on diamond + group.

---

### PR 2D — Slice split: UI + selection + history (low risk)

**Estimated:** 1 day | **Risk:** Low

**First slices** (few cross-dependencies):

| Slice | State fields | Actions |
|-------|--------------|---------|
| `uiSlice` | `guideLines`, `showGrid`, `darkMode`, `sidebarOpen`, `canvasMode`, `activeLayoutPresetId`, `detailLevel`, `diagramChromeMode`, `diagramStyleTheme`, `isPenModeActive`, `edgeAnimations`, `clarityReport` | all `set*` / `toggle*` |
| `selectionSlice` | `selectedNodeId`, `selectedNodeIds`, `selectedEdgeId` | `setSelected*` |
| `historySlice` | `past`, `future` | `pushHistory`, `undo`, `redo` |

**Pattern** (Zustand `StateCreator` slice):

```ts
// diagram/slices/uiSlice.ts
import type { StateCreator } from 'zustand';
import type { DiagramState } from '../types';

export const createUiSlice: StateCreator<DiagramState, [], [], Pick<DiagramState, …>> = (set, get) => ({
  showGrid: true,
  toggleGrid: () => set({ showGrid: !get().showGrid }),
  // …
});
```

**Composer:**

```ts
const useDiagramStoreRaw = create<DiagramState>()(
  persist(
    wrapCreator((...args) => ({
      ...createUiSlice(...args),
      ...createSelectionSlice(...args),
      ...createHistorySlice(...args),
      // …rest still inline for now
    })),
    persistConfig
  )
);
```

**Acceptance:** Undo/redo + selection + theme toggles work in editor smoke test.

---

### PR 2E — Slice split: canvas + persistence (medium risk)

**Estimated:** 1–2 days | **Risk:** Medium

| Slice | Responsibility |
|-------|----------------|
| `canvasSlice` | `canvases`, `activeCanvasId`, `openCanvasIds`, tab CRUD, `getVisibleCanvases`, guest canvas cap |
| `persistenceSlice` | `userProfile`, `loadCanvasesFromDB`, `saveCanvasToDB`, `savingState` |
| `sequenceSlice` | `sequenceDiagrams`, import/clear/set |

**Watch:** `addCanvas` calls `saveCanvasToDB` and clears `past`/`future` — document cross-slice calls explicitly.

**Acceptance:** Multi-tab switch preserves per-tab nodes; guest 1-canvas cap still enforced.

---

### PR 2F — Slice split: graph + edge edit + pipeline (highest risk)

**Estimated:** 2–3 days | **Risk:** High

| Slice | Responsibility |
|-------|----------------|
| `graphSlice` | `onNodesChange`, `onEdgesChange`, `onConnect`, `addNode`, `removeNode`, `importDiagram`, `loadTemplate`, grouping, `recalculateHandles`, `alignConnectedNodes` |
| `edgeEditSlice` | `editingEdgeId`, `pending*`, `updateEdgeLabel`, `deleteEdge`, `onReconnect` |
| `pipelineSlice` | `pipelineStatus`, `appendNode`, `appendEdge`, `setNodes`, `setEdges`, generation markers |

**Order within PR:** Extract `pipelineSlice` first (most isolated), then `edgeEditSlice`, then `graphSlice` last.

**Tests to extend**

- [ ] `diagramStore.smoke.test.ts` — importDiagram, clearDiagram
- [ ] `merge-parallel.test.ts` — still passes
- [ ] New: `importDiagram.test.ts` — parentId preserved, handles recalculated

**Manual smoke**

- [ ] AI generate (streaming appendNode)
- [ ] Template load
- [ ] Group / ungroup
- [ ] Edge label edit

**Acceptance:** `diagramStore.ts` < **400 LOC** (composer + persist config + re-exports only).

---

## Slice dependency graph

```mermaid
flowchart TD
  canvas[canvasSlice]
  persist[persistenceSlice]
  graph[graphSlice]
  history[historySlice]
  ui[uiSlice]
  pipeline[pipelineSlice]

  canvas --> persist
  graph --> canvas
  graph --> history
  graph --> ui
  pipeline --> graph
  history --> canvas
```

**Rule:** Slices must not import each other circularly. Shared logic goes in `helpers/`.

---

## `deriveNodesAndEdges` — do not break

The Proxy at the bottom of `diagramStore.ts` is load-bearing:

```ts
// diagram/derive.ts
export function deriveNodesAndEdges(state: DiagramState): DiagramState
export function wrapCreator(creator): StateCreator<…>
```

- `get().nodes` always reads from active canvas
- `cloudProvider` may also be derived (check full Proxy before moving)
- Any slice that does `set({ nodes: [...] })` without updating `canvases` will **silently fail**

**Audit checklist before merge:**

- [ ] Grep `set\(\{[^}]*nodes:` in store — each must call `syncActiveCanvas`
- [ ] Grep `set\(\{[^}]*edges:` — same

---

## Persistence `partialize` — frozen contract

Do **not** change persisted keys without a `STORAGE_VERSION` bump:

| Key | Owner slice |
|-----|-------------|
| `canvases` | canvas |
| `activeCanvasId` | canvas |
| `openCanvasIds` | canvas |
| `userProfile` | persistence |
| `diagramChromeMode`, `diagramStyleTheme`, `darkMode` | ui |
| `activeLayoutPresetId`, `detailLevel` | ui |
| `sequenceDiagrams` | sequence |

Undo history (`past`/`future`) is intentionally **not** persisted — keep that way.

---

## Consumer impact

**~43 files** import `@/store/diagramStore`. No import path changes if re-exports stay on `diagramStore.ts`.

High-traffic consumers to smoke after each PR:

| File | What it uses |
|------|----------------|
| `components/Canvas.tsx` | `onNodesChange`, `onConnect`, `fitView`, template load |
| `components/Toolbar.tsx` | layout preset, export, undo |
| `views/Editor.tsx` | AI generate, import |
| `components/FloatingAIBar.tsx` | pipeline status (via Editor) |
| `components/MermaidCodePanel.tsx` | `activeLayoutPresetId`, relayout |
| `lib/svgExport.ts` | nodes/edges snapshot |

---

## Testing strategy

### Automated (run every PR)

```bash
cd frontend
npm test -- store/
npm test -- lib/mermaid/relayout.test.ts
npm test -- lib/features/dynamicHandlesFix.test.ts
```

### Manual checklist (PR 2E + 2F)

- [ ] Create / switch / close canvas tabs
- [ ] Undo/redo after move node
- [ ] LR ↔ TB layout toggle
- [ ] AI diagram generation
- [ ] Load template from modal
- [ ] Guest: hit 25-node cap toast
- [ ] Auth: save indicator (saving → saved)

---

## Rollback plan

Each PR should be independently revertible:

1. Slices are additive files — revert PR = delete `diagram/` subfolder and restore monolith
2. Do **not** change `STORAGE_KEY` or `STORAGE_VERSION` until split is complete
3. Keep `wrapCreator` + `deriveNodesAndEdges` behavior identical until PR 2F lands

---

## Definition of done

- [ ] `diagramStore.ts` ≤ 400 LOC (composer + persist + re-exports)
- [ ] All types/actions still exported from `@/store/diagramStore`
- [ ] `store/__tests__/*` green + at least one new test per slice domain
- [ ] No `set({ nodes })` without `syncActiveCanvas`
- [ ] `AGENTS.md` §5 updated with new `store/diagram/` layout (optional doc PR)

---

## Estimated total effort

| Phase | Days |
|-------|------|
| 2A Helpers extract | 0.5–1 |
| 2B Persistence extract | 1 |
| 2C Edge helpers | 1 |
| 2D UI/selection/history slices | 1 |
| 2E Canvas/persistence slices | 1–2 |
| 2F Graph/pipeline slices | 2–3 |
| **Total** | **6.5–9 days** |

---

## Optional future (out of scope)

- Separate `authStore` overlap with `userProfile` in diagram store
- Move guest canvas caps to `lib/userQuotas.ts` enforcement layer
- Replace Proxy derivation with explicit `selectActiveGraph()` selector hook (would touch 43 consumers — major migration)
