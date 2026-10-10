# Readable Diagram Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated and relaid-out diagrams communicate their principal flow quickly while keeping every relationship, manual edit, and supported rendering style reliable.

**Architecture:** Retain Mermaid and Dagre for canonical graph layout. Introduce a derived, shared geometry plan that resolves sides, lanes, routes, labels, and diagnostics for each candidate layout; score and validate those actual paths, then let the canvas and SVG export consume the same plan. Preserve all graph data and user edits, and add an overview/detail presentation projection that never deletes or mutates the full graph.

**Tech Stack:** Next.js, TypeScript, React Flow v11, Dagre, Zustand, Vitest.

**Spec:** `docs/plans/edge-routing-layout-audit-2026-10-04.md` and the user's implementation request in this conversation.

## Global Constraints

- Keep Mermaid → Dagre as the canonical frontend layout path; do not add a second layout engine.
- Keep graph topology, IDs, edge data, group membership, undo history, and custom waypoints intact unless the user explicitly edits them.
- Preserve current centered handles and the ±16px in/out slots; parallel route lanes begin after the shared terminal stub.
- Derived geometry is ephemeral and keyed by graph revision plus dimensions, direction, render style, and icon mode; do not persist it as diagram truth.
- Explicit user/planner edge importance and flow roles take precedence over inferred roles. Record provenance so the inferred classifier can never masquerade as explicit intent.
- Main-flow selection keeps intermediate infrastructure on the backbone when the graph topology says it is required; service type alone cannot demote or hide a queue, database, gateway, or worker.
- Failed search means “no valid route found within the declared budget,” never a proof that no route exists. Report the failure cause and keep the user graph editable.
- Overview is a view projection. The full graph remains available in Details; overview scoring must never delete graph elements.
- Layout and geometry changes alter generation output; bump `PIPELINE_VERSION` once when the new geometry planner becomes active so cached old layouts are not served as new results.
- No new runtime dependency.
- Preserve existing uncommitted user changes in the working tree. Do not commit unless asked.

## Review Focus

- Parallel same-direction edges with identical endpoints remain traceable after lane allocation; assert route separation after common terminal stubs.
- A manually pinned side on one direction of a reciprocal pair remains pinned while automatic inference assigns only unpinned sides.
- Invalid, enclosed, self-loop, and custom-waypoint routes report their final obstacle/terminal violations rather than silently appearing valid.
- Group-relative child geometry and nested group title strips use the same absolute bounds in canvas, labels, validation, and export.
- Sparse, dense, cyclic, and input-order-shuffled graphs remain deterministic without dropping edges or expanding to unreasonable bounds.

---

## File and Interface Map

| File | Responsibility after the plan |
|---|---|
| `frontend/lib/utils/edgeRouteBuilder.ts` | Route one edge under resolved side/lane constraints; expose geometry status and violations. |
| `frontend/lib/utils/edgeRouting/waypoints.ts` | Produce a detailed route outcome and validate the final obstacle-aware path. |
| `frontend/lib/utils/geometryTypes.ts` *(new)* | Define shared geometry statuses, severity-bearing violations, points, and rectangles without introducing import cycles. |
| `frontend/lib/utils/diagramGeometry.ts` *(new)* | Build and memoize the shared derived geometry plan for a graph snapshot. |
| `frontend/lib/utils/edgeRouteOptimizer.ts` *(new)* | Route the full edge set with deterministic corridor occupancy, crossing/overlap costs, and bounded reroute passes. |
| `frontend/lib/utils/edgePathGeometry.ts` *(new)* | Produce the exact rendered line/arc/cubic path, adaptive samples, arc-length lookup, and conservative stroke/marker bounds consumed by labels, collision checks, canvas, and export. |
| `frontend/lib/utils/edgeLabelLayout.ts` | Place labels against supplied final routes and effective node/group bounds. |
| `frontend/components/edges/DiagramGeometryProvider.tsx` *(new)* | Own the canvas snapshot inside the existing `ReactFlowProvider`; publish one plan through React context to nodes and edges. |
| `frontend/hooks/useHandleSlotLayout.ts` | Read the provider plan's side/slot assignment rather than reimplementing route scoring. |
| `frontend/components/edges/SimpleFloatingEdge.tsx` | Render the shared plan's edge route and label placement, including diagnostic state. |
| `frontend/lib/svg-export/index.ts` | Use the same effective dimensions, route plan, and label plan as the canvas. |
| `frontend/lib/pipeline-shared/layout/LayoutEngine.ts` | Respect explicit primary async importance/flow role and stable ties. |
| `frontend/lib/pipeline-shared/layout/layoutQuality.ts` | Score actual route paths, edge lanes, label boxes, and hard geometry violations. |
| `frontend/lib/pipeline-shared/layout/IntegratedLayout.ts` | Keep the canonical node output and expose enough layout result context for candidate evaluation without substituting Dagre points for routed points. |
| `frontend/lib/mermaid/pipeline-stages/LayoutStage.ts` | Generate bounded stable candidates, build final geometry for each, and select only a valid/readable candidate. |
| `frontend/lib/mermaid/relayout.ts` | Carry original semantic metadata into layout and preserve it when restoring edges. |
| `frontend/lib/mermaid/edgeFlowSemantics.ts` *(new)* | Resolve explicit/inferred edge roles, confidence, source/sink backbone, branches, and feedback deterministically. |
| `frontend/lib/ai/pipeline/scoreDiagram.ts` and `.../stages/ValidationStage.ts` | Keep semantic score separate from hard geometry violations; prevent geometry failures passing by score cap. |
| `frontend/components/Toolbar.tsx` plus a focused overview control/projection module *(new only if no suitable existing control exists)* | Default generated views to Overview with an explicit Details switch; never remove source nodes/edges. |
| `frontend/lib/ai/services/pipelineVersion.ts` | Bust generated-diagram cache exactly once for the new semantic/layout behavior. |
| Colocated `*.test.ts` files named below | Regression and property tests for geometry contracts and visual projection. |

### Shared geometry interface

Create shared primitive types in `frontend/lib/utils/geometryTypes.ts`; route and label types remain owned by their current modules. Create the planner function in `frontend/lib/utils/diagramGeometry.ts`:

```ts
export type GeometryStatus = 'ok' | 'degraded' | 'invalid' | 'failed';
export interface Point { x: number; y: number }
export type FlowRole = 'main' | 'branch' | 'feedback' | 'supporting';
export interface Rect { x: number; y: number; width: number; height: number }
export type EdgePathInput =
  | { kind: 'orthogonal'; waypoints: readonly Point[]; cornerRadius: number }
  | { kind: 'cubic'; start: Point; control1: Point; control2: Point; end: Point };
export type GeometryViolation =
  | { severity: 'hard'; code: 'NODE_COLLISION'; nodeId: string; otherNodeId: string }
  | { severity: 'hard'; code: 'OBSTACLE_INTERSECTION'; edgeId: string; obstacleId: string }
  | { severity: 'hard'; code: 'TERMINAL_INTERSECTION'; edgeId: string; nodeId: string }
  | { severity: 'soft'; code: 'EDGE_CROSSING'; edgeId: string; otherEdgeId: string }
  | { severity: 'soft'; code: 'PRIVATE_ROUTE_OVERLAP'; edgeId: string; otherEdgeId: string; length: number }
  | { severity: 'hard'; code: 'LABEL_COLLISION'; edgeId: string; withId: string };

export type RouteFailureReason = 'no-path-found' | 'search-budget-exceeded' | 'invalid-terminal';

export interface DiagramGeometryPlan {
  key: string;
  status: GeometryStatus;
  routes: ReadonlyMap<string, EdgeRouteResult>;
  paths: ReadonlyMap<string, RenderedEdgePath>;
  labels: ReadonlyMap<string, EdgeLabelAnchor>;
  sourceSides: ReadonlyMap<string, Position>;
  targetSides: ReadonlyMap<string, Position>;
  violations: readonly GeometryViolation[];
  quality: LayoutGeometryQuality;
}

export function computeDiagramGeometryPlan(
  nodes: Node[], edges: Edge[], options: DiagramGeometryOptions,
): DiagramGeometryPlan;
```

`EdgeRouteResult` remains exported by `edgeRouteBuilder.ts` and gains authoritative `path: EdgePathInput`, `status: GeometryStatus`, `failureReason?: RouteFailureReason`, and `violations: readonly GeometryViolation[]`. Route-level `status` is `ok` for a valid path and `failed` when search cannot provide one; whole-plan validation may subsequently set plan status to `invalid`. `EdgeLabelAnchor` remains exported by `edgeLabelLayout.ts`. `LayoutGeometryQuality` is exported by `layoutQuality.ts`. Define `DiagramGeometryOptions` in `diagramGeometry.ts` with `direction: EdgeRouteDirection`, optional `renderStyleId`, optional `iconMode`, and optional `ReadonlyMap<string, EdgeRouteHandleAnchors>`.

Add `EdgeRouteOptions` to `edgeRouteBuilder.ts` as the final argument after existing inputs: `{ sourceSide?: Position; targetSide?: Position; laneOffset?: number; handleAnchors?: EdgeRouteHandleAnchors }`. Existing arguments, including `iconMode`, retain their current position so callers migrate incrementally.

`edgePathGeometry.ts` owns `RenderedEdgePath = { d: string; commands: readonly PathCommand[]; samples: readonly Point[]; length: number; bounds: Rect }`, with `PathCommand = { kind: 'line'; from: Point; to: Point } | { kind: 'arc'; from: Point; to: Point; radius: number; sweep: 0 | 1 } | { kind: 'cubic'; from: Point; control1: Point; control2: Point; to: Point }`. It exports `buildEdgePathGeometry(input: EdgePathInput): RenderedEdgePath`, `pointAtRenderedPath(path, distanceFraction): Point`, and `validateRenderedPath(path, obstacles, clearance): PathViolation[]`. Canvas, labels, crossing checks, and SVG export consume the same object. Corner radius comes from the same resolved render-style token; self-loops retain their cubic commands instead of being approximated from endpoint waypoints. `EdgeRouteResult.path` is the authoritative `EdgePathInput`; legacy `svgPath` is derived from `RenderedEdgePath.d` during migration, then removed only after all callers use the shared path.

`PathViolation` is `{ code: 'PATH_OBSTACLE_INTERSECTION'; obstacleId: string } | { code: 'PATH_SELF_INTERSECTION' }`. Obstacles passed to `validateRenderedPath` are `{ id: string; rect: Rect }[]`; marker radius and stroke width are incorporated in `clearance` before validation.

`edgeRouteOptimizer.ts` exports `optimizeEdgeRoutes(input: RouteOptimizationInput): RouteOptimizationResult`. `RouteOptimizationInput` is `{ nodes: readonly Node[]; edges: readonly Edge[]; bounds: ReadonlyMap<string, Rect>; sideAssignments: ReadonlyMap<string, { source: Position; target: Position }>; semantics: ResolvedFlowSemantics; direction: EdgeRouteDirection; pinnedRoutes: ReadonlyMap<string, readonly Point[]>; searchBudget?: { perRouteStates: number; totalStates: number; ripUpPasses: number } }`. `RouteOptimizationResult` is `{ routes: ReadonlyMap<string, EdgeRouteResult>; diagnostics: readonly GeometryViolation[]; stats: { expandedStates: number; ripUpPasses: number } }`. Default budgets are 12,000 states per route, 400,000 per diagram plan, and two rip-up passes.

`edgeFlowSemantics.ts` exports `resolveEdgeFlowSemantics(nodes, edges): ResolvedFlowSemantics`. `ResolvedFlowSemantics` is `{ assignments: ReadonlyMap<string, { role: FlowRole; source: 'explicit' | 'inferred'; confidence: number }>; entryNodeIds: readonly string[]; outcomeNodeIds: readonly string[] }`. `LayoutEdge` adds `importanceSource` and optional `flowRole`, `flowRoleSource`, and `flowRoleConfidence`. The stable per-runtime map key is the original edge ID; Mermaid sidecars use `SemanticEdgeKey` only while IDs are temporarily encoded.

`DiagramGeometryPlan` is the path geometry input; its `quality` field is produced only after calling `measureLayoutQuality` with `Omit<DiagramGeometryPlan, 'quality'>`, avoiding a circular quality input. Status is derived from violations: `ok` has no violations; `degraded` has only soft edge crossings/private overlaps and every route is valid; `invalid` has at least one hard geometric violation such as intersecting nodes, obstacle/terminal intersection, or label collision; `failed` has at least one required edge with no valid route within the bounded search. Search exhaustion is not proof that no route exists. Invalid/failed plans are never accepted as clean. The memoized reader accepts a stable measured-geometry revision from the provider so all canvas consumers share the same immutable snapshot.

The lower-level waypoint API must not import `diagramGeometry.ts`: it returns a local `RoutePathOutcome` with `status: 'ok' | 'no-path-found' | 'search-budget-exceeded' | 'invalid-terminal'`, `waypoints`, and violated obstacle IDs. `edgeRouteBuilder.ts` maps that result into `GeometryStatus`/`GeometryViolation` entries keyed by edge ID. This keeps the dependency graph acyclic.

### Route allocation and bounded search

`edgeRouteOptimizer.ts` receives all nodes, semantic edge metadata, fixed user paths, and terminal sides before producing any automatic route. It builds a deterministic rectilinear visibility grid from: terminal stub coordinates; each expanded obstacle boundary (`20px` clearance for ordinary edges, renderer stroke width + marker radius + `2px` for rendered-path validation); existing fixed route segments; and two outer feedback corridors beyond the node bounds. Coordinates are sorted and deduplicated at `0.5px` tolerance. Nodes and non-passable group bodies are hard obstacles; an edge's endpoint groups are passable; group header strips remain obstacles to labels.

Search state is `(xIndex, yIndex, incomingDirection)` so turn count is explicit. Use Dijkstra/A* with deterministic heap ties (f-score, g-score, x, y, direction, stable edge key) and these cost units: `1px` per traveled pixel, `32px` per bend, `320px` per proper crossing, and `8px` per `10px` of shared private route. Node interiors are never soft costs. Same-pair parallel edges receive consecutive, symmetric lanes before search; reciprocal edges get separate direction lanes; branch lanes are ordered by connected-node projection on the terminal tangent. Every intentional shared segment is tagged with its owner edge IDs.

Routing order is fixed user-pinned/custom paths first, then explicit/inferred main-flow edges, branches, supporting edges, and feedback edges in outer corridors; ties use canonical endpoint tuple, normalized label, relationship type, and stable edge key. Auto routes treat already-routed paths as weighted occupancy. After the first pass, run at most two rip-up passes: re-route the lowest-priority conflicting auto edge first; never move a manual path or a higher-priority edge to improve a lower-priority one. Stop when the lexicographic global score no longer improves.

Bound each route to `12,000` expanded states and the whole plan to `400,000`; bound total rip-up to `2 × edgeCount`. On budget exhaustion retain the best valid route found so far and mark unresolved edges `failed/search-budget-exceeded`. If no path is found after exhaustively searching the bounded visibility graph, report `failed/no-path-found`; do not return a colliding route with `ok`. These are explicit product limits, adjustable only with benchmark evidence. Geometry validation samples rendered curves adaptively to a maximum `1px` chord error and inflates obstacles by stroke and marker extents.

### Main-flow semantics and presentation

Add `importanceSource: 'explicit' | 'inferred'` and `flowRoleSource: 'explicit' | 'inferred'` to optional edge data. Existing data without provenance is treated as inferred unless a user pin/edit marks it explicit. `edgeFlowSemantics.ts` resolves every graph after edge construction and before layout:

1. Preserve explicit roles exactly; explicit role/importance always outrank service-type guesses.
2. Find entry candidates from actor/client/ingress types; if none exist, use zero-in-degree nodes. Find outcomes from response/output nodes; if none exist, use reachable sinks.
3. Form a stable DAG candidate by sorting inferred edges by inferred importance, protocol/action label evidence, then canonical edge key and greedily excluding cycle-closing constraints for ranking only. Never remove those edges from the diagram. Rank weights are `primary=5`, `secondary=3`, `supporting=1.5`, `diagnostic=0.5`, `optional=0.25`. `async` never multiplies or caps an existing importance weight. Existing return/callback/ack keywords mark a feedback candidate; service type can add a small prior only for entry/outcome discovery, never override edge importance.
4. For every entry/outcome pair, use DAG dynamic programming to find the maximum-sum path; choose the global maximum, breaking ties lexicographically by the stable node-ID sequence. A queue, database, or worker on that path receives `main`; off-path edges that branch from or rejoin the backbone receive `branch`; edges that close a directed cycle receive `feedback`; remaining inferred relationships receive `supporting`.
5. A service type never forces an edge on the chosen path to supporting. Explicit-role confidence is `1`. Inferred confidence is `clamp((bestScore - secondBestScore) / max(abs(bestScore), 1), 0, 1)` across distinct entry/outcome paths; if no competing path exists, cap inferred confidence at `0.8` so Overview does not hide dependencies based on absence of alternatives alone.

Overview may hide an inferred supporting/diagnostic/optional edge only if confidence is at least `0.85`, no explicit role protects it, and removing it preserves reachability from every selected entry to every selected outcome. Keep every main/branch edge, all endpoint nodes, and any node whose removal disconnects a selected path. Lower-confidence or topology-ambiguous graphs remain fully visible in Overview. Details always renders the original graph. This provides a readable default where evidence supports it without hiding an uncertain dependency.

### Geometry ownership and invalidation

`DiagramGeometryProvider` is mounted around the `ReactFlow` tree inside its existing `ReactFlowProvider`. It alone subscribes to React Flow `nodeInternals`, store edges, direction, render style, icon mode, and active drag state. It publishes one plan through React context to edge renderers and `useHandleSlotLayout`; no node/edge child independently rebuilds the all-edges plan. The provider builds effective dimensions from the same shape sizing helper for each style/icon mode and absolute positions from `positionAbsolute` with cycle-safe parent fallback.

The provider snapshot key is `(nodeInternals revision, edge array revision, layout direction, render style, icon mode, layout revision)`. Increment/recompute when a node position, measured size, parent/group bound, edge data/path, style, icon mode, or direction changes. Do not include viewport transform/zoom because geometry is in canvas coordinates. Assert React Flow replaces or versions measured internals on each such change; if it mutates the map in place, the provider must derive an explicit monotonic geometry revision from the subscribed store update before memoizing. Cache at most 8 settled plans. During drag, calculate only incident/obstacle-affected edge previews as `degraded/provisional`, keep fixed paths stable, and never insert preview snapshots into the settled cache. On drag stop, run one full plan and publish final status. Export and layout candidate evaluation call the same pure planner with explicit bounds and no UI store dependency.

## Implementation Tasks

## Seven Design Gaps Addressed in This Revision

1. **Global route allocation:** specifies deterministic visibility-grid search, explicit cost units, priority order, parallel/reciprocal lanes, occupancy, bounded rip-up, and honest budget exhaustion.
2. **Semantic backbone:** defines entry/outcome selection, cycle handling, stable maximum-weight path selection, role provenance/confidence, and reachability-preserving overview filtering; async classification cannot demote explicit primary flow.
3. **Geometry lifecycle:** defines one immutable plan, its owner, invalidation inputs, drag preview behavior, cache bounds, and canvas/export consumers.
4. **Rendered-curve truth:** defines a shared line/arc/cubic path representation and adaptive obstacle validation including stroke and marker clearance; labels validate against that same path.
5. **Stable metadata identity:** defines reversible temporary node IDs and semantic edge sidecars for duplicates, so Mermaid round trips do not rely on array order or hashes.
6. **Bounded repair and failure behavior:** defines four layout candidates, two repair passes, immutable user decisions, lexicographic candidate selection, and distinct `invalid` versus `failed` statuses.
7. **Enforceable release gates:** defines permutation/property fixtures, canvas/export checks, named-host performance measurement, visual review, and the five-second comprehension trial.

### Task 1: Pin all reproduced defects with regression tests

**Files:**
- Modify: `frontend/lib/utils/__tests__/edgeRouteBuilder.snap.test.ts`
- Modify: `frontend/lib/utils/__tests__/collisionFreeEdgePath.test.ts`
- Modify: `frontend/lib/utils/__tests__/handlerPairScorer.test.ts`
- Create: `frontend/lib/pipeline-shared/layout/__tests__/layoutQuality.test.ts`
- Create: `frontend/lib/pipeline-shared/layout/__tests__/layoutSemantics.test.ts`
- Create: `frontend/lib/mermaid/__tests__/geometry-pipeline-regressions.test.ts`
- Modify: `frontend/lib/utils/__tests__/edgeLabelLayout.test.ts`

**Interfaces:** Characterization only; use current public functions. Expected failures document current bugs and must not be weakened to fit implementation.

- [ ] Add a two-parallel-edge test that computes both routes and asserts private route segments differ while both endpoints meet the intended shared handle stubs; add a pair whose endpoint handles are identical and verify the divergence occurs after the handle stub, not by inventing more ports.
- [ ] Add a regression for A→B pinned top/top plus B→A; assert the pinned edge sides are top/top and route endpoints match those sides.
- [ ] Add impossible-enclosure, terminal-intersection, stale measured-anchor, self-loop obstacle, and custom-waypoint collision cases. Assert a status/diagnostic contract will be added in Task 2; initially the tests fail because it is absent.
- [ ] Add tests showing primary async importance is not downgraded; a primary Producer→Queue→Worker chain stays on the backbone; equal-weight cycles produce identical selected edges for reversed/shuffled node input; and original importance/flow role survives `layoutDiagramViaMermaid`, including identical-label parallel edges with different explicit roles.
- [ ] Add quality cases where center-to-center segments do not cross but orthogonal routed segments do, where a shared trunk is detected, and where actual label rectangles collide.
- [ ] Add a canvas/export parity fixture and nested group title-label fixture. Include a rounded-corner collision and a cubic self-loop that clears its endpoint nodes but clips a foreign obstacle.
- [ ] Run the focused tests and verify the newly added assertions fail for the identified reasons while existing tests still execute.

Run from `frontend/`:

```sh
npx vitest --run lib/utils/__tests__/edgeRouteBuilder.snap.test.ts lib/utils/__tests__/collisionFreeEdgePath.test.ts lib/utils/__tests__/handlerPairScorer.test.ts lib/utils/__tests__/edgeLabelLayout.test.ts lib/pipeline-shared/layout/__tests__ lib/mermaid/__tests__/geometry-pipeline-regressions.test.ts
```

Expected: new defect assertions fail; unrelated existing assertions pass.

### Task 2: Add final-path validation and explicit route outcomes

**Files:**
- Modify: `frontend/lib/utils/edgeRouting/waypoints.ts`
- Modify: `frontend/lib/utils/collisionFreeEdgePath.ts`
- Modify: `frontend/lib/utils/edgeRouteBuilder.ts`
- Modify: `frontend/lib/utils/__tests__/collisionFreeEdgePath.test.ts`
- Modify: `frontend/lib/utils/__tests__/edgeRouteBuilder.snap.test.ts`

**Interfaces:**
- `getCollisionFreeWaypointsDetailed(params): RoutePathOutcome` is added; `RoutePathOutcome` is local to `edgeRouting/waypoints.ts` and contains `waypoints: Point[]`, `status: 'ok' | 'no-path-found' | 'search-budget-exceeded' | 'invalid-terminal'`, and `violatedObstacleIds: string[]`. Keep `getCollisionFreeWaypoints(params): Point[]` as a compatibility wrapper for existing callers/tests, but migrate production callers to the detailed API before accepting its result.
- `EdgeRouteResult` gains `status` and `violations`; `computeEdgeRoute(...)` keeps its existing positional inputs and adds an optional final route-planning options object for fixed sides, lane offset, and measured anchors.

- [ ] Test the detailed outcome contract: legal detour is `ok`; enclosed terminals report `no-path-found`; state-limit exhaustion reports `search-budget-exceeded`; malformed anchors report `invalid-terminal`; no case reports `ok` while intersecting an obstacle or terminal. Test crossings at the graph geometry-plan layer, which has access to sibling routes.
- [ ] Implement `getCollisionFreeWaypointsDetailed(params): RoutePathOutcome` in `edgeRouting/waypoints.ts` and export it from `collisionFreeEdgePath.ts`. Keep `RoutePathOutcome` local to the edge-routing module; validate after terminal-stub enforcement, low-bend reroute, and self-intersection repair. Return the final `EdgePathInput` from `computeEdgeRoute` in the later shared-path task; do not treat a waypoint-only compatibility result as the canonical rendered route.
- [ ] Validate cubic self-loops against foreign obstacles and custom waypoints against current node/group obstacles. Preserve custom paths that are valid; report `invalid-terminal` or explicit obstacle violations when a pinned custom path is blocked. Never erase or silently reroute a user-pinned path.
- [ ] Make `computeEdgeRoute` propagate detailed status/violations, and only trust a measured anchor when the anchor was actually adopted after coordinate/side validation.
- [ ] Add regression assertions that stale anchors cannot suppress terminal validation and pinned custom paths are not silently deleted. Assert search-budget exhaustion is distinguishable from a proven closed visibility grid.
- [ ] Run collision and edge route tests; confirm compatibility wrapper keeps legacy waypoint-only call sites working.

Expected: all legal test routes are `ok`; impossible or intersecting paths are visibly diagnosed and never marked `ok`.

### Task 3: Correct side precedence and deterministic semantic ranking

**Files:**
- Modify: `frontend/lib/pipeline-shared/layout/LayoutEngine.ts`
- Modify: `frontend/lib/pipeline-shared/layout/CompoundLayout.ts`
- Modify: `frontend/lib/utils/edgeRouteBuilder.ts`
- Modify: `frontend/hooks/useHandleSlotLayout.ts`
- Modify: `frontend/lib/mermaid/relayout.ts`
- Modify: `frontend/lib/mermaid/pipeline.ts` *(only to thread typed edge semantic metadata into pipeline context)*
- Create: `frontend/lib/mermaid/edgeFlowSemantics.ts`
- Modify: `frontend/lib/mermaid/buildReactFlow.ts`
- Modify: `frontend/lib/mermaid/pipeline-stages/LayoutStage.ts`
- Modify: tests from Task 1.

**Interfaces:**
- Add optional `flowRole?: 'main' | 'branch' | 'feedback' | 'supporting'` to `LayoutEdge` and the in-memory edge data contract.
- Add `importanceSource?: 'explicit' | 'inferred'` and `flowRoleSource?: 'explicit' | 'inferred'` to in-memory edge data; default old/unmarked metadata to `inferred`.
- Add `edgeSemantics?: ReadonlyMap<SemanticEdgeKey, EdgeLayoutSemantics>` to Mermaid pipeline options. `SemanticEdgeKey` is `{ sourceLayoutId: string; targetLayoutId: string; normalizedLabel: string; normalizedType: string; duplicateOrdinal: number }`. `EdgeLayoutSemantics` contains importance, flow role, provenance, and confidence.
- Resolve sides with precedence: explicit per-end user pin → resolved plan side → reciprocal/automatic scorer. Apply the same precedence to handle layout and edge rendering.
- Rank edges with precedence: explicit flow role/importance → relationship classification fallback. Async classification never demotes an explicitly `primary` edge.

- [ ] Test that explicit primary importance and main-flow role beat async/infrastructure heuristics; inferred queue links on the selected source-to-outcome path stay main-flow; and low-confidence edges remain visible in Overview.
- [ ] Test all four manual side values independently on reciprocal edges and mixed one-pinned/one-automatic endpoints; require route and handle agreement.
- [ ] Implement `resolveEdgeFlowSemantics(nodes, edges): ResolvedFlowSemantics` in `edgeFlowSemantics.ts` using the five-step algorithm above. Test roots, multiple sinks, isolated nodes, cycles, queues, branches, explicit roles, confidence ties, and input permutations. Never use service type as a final overriding rule.
- [ ] Encode temporary layout node IDs as `layout_` plus the original ID's UTF-8 bytes in lowercase hex, and restore them using the existing reverse map. Test punctuation, Unicode, empty/long IDs, and shuffled input for collision-free identical IDs.
- [ ] Replace input-array tie-breaking with a stable comparator over explicit role, requested direction, and canonical endpoint/normalized-label/type/duplicate-ordinal tuple. Test edge and node permutations produce identical rank constraints and edge semantics.
- [ ] Build `SemanticEdgeKey` for parallel edges by grouping on source, target, normalized label, and normalized type, then sort each exact-duplicate group by original stable edge ID to assign `duplicateOrdinal`. Thread this sidecar through `layoutDiagramViaMermaid` and `runMermaidPipeline`; match by semantic key in `LayoutStage`, and restore metadata by key, not bucket insertion order. Encode temporary node IDs as `layout_` + reversible UTF-8 hex of the original ID; do not use array indices or probabilistic hashes. Test duplicate-label edges whose IDs sort in the opposite order from the input and confirm exact data returns to its original edge. Do not add new public Mermaid syntax.
- [ ] Call `resolveEdgeFlowSemantics` after `buildReactFlowObjects` assembles edges and before layout. Verify the same resolver runs for templates and repo diagrams that enter the canonical Mermaid layout path; preserve explicit role metadata supplied by callers.
- [ ] Update compound support placement so main-flow infrastructure nodes are placed with their backbone neighbors; only inferred support nodes outside the resolved backbone use support slots.
- [ ] Run layout semantics, Mermaid round-trip, handle slots, scorer, and relayout tests.

Expected: graph ordering no longer changes principal flow; explicit user and planner semantics survive layout toggles without changing the serialized Mermaid/tool contract.

### Task 4: Allocate route lanes and build one geometry plan

**Files:**
- Create: `frontend/lib/utils/diagramGeometry.ts`
- Create: `frontend/lib/utils/edgeRouteOptimizer.ts`
- Modify: `frontend/lib/utils/edgeRouteBuilder.ts`
- Modify: `frontend/lib/utils/simpleFloatingEdge.ts`
- Modify: `frontend/lib/utils/handleSlotOrder.ts`
- Modify: `frontend/lib/utils/__tests__/edgeRouteBuilder.snap.test.ts`
- Create: `frontend/lib/utils/__tests__/diagramGeometry.test.ts`
- Modify: `frontend/hooks/useHandleSlotLayout.ts`

**Interfaces:** Use `GeometryStatus`/`GeometryViolation` from `geometryTypes.ts` and the `DiagramGeometryPlan`/`computeDiagramGeometryPlan` definitions in the File and Interface Map. `EdgeRouteResult` includes status. `computeEdgeRoute` accepts fixed side/lane options as a trailing object, leaving existing callers source-compatible.

- [ ] Test lane allocation determinism, two same-direction parallel links, multiple fan-in/fan-out links, reciprocal links, self-loops, and mixed-direction side slots. Assert common terminal stubs are shared only when intentional and routes diverge after the stub.
- [ ] Test route allocation on an obstacle channel competing between main, branch, support, and feedback edges. Assert the higher-priority route remains clear, lower-priority edges move, private overlaps are penalized, and two rip-up passes stop on a non-improving global score.
- [ ] Implement `optimizeEdgeRoutes(input): RouteOptimizationResult` with the declared visibility grid, heading-aware A*, numeric route costs, tie ordering, priority order, hard manual paths, paired parallel lanes, outer feedback corridors, and two bounded rip-up passes. Test route output invariants and a synthetic state-budget exhaustion case.
- [ ] Implement a stable graph-wide side pass, then assign middle-route lane offsets by explicit/inferred flow role and stable edge key. Lane spacing must not change handle counts or the ±16px in/out slot contract.
- [ ] Implement `computeDiagramGeometryPlan` to resolve effective dimensions and absolute parent-relative bounds once; call `optimizeEdgeRoutes`; construct rendered path primitives; place labels against those paths; collect route, node, edge-crossing, and label diagnostics.
- [ ] Add a bounded identity-keyed cache (maximum 8 settled plans) keyed on provider geometry revision, edge array revision, direction, render style, icon mode, and layout revision. Do not cache a drag preview as a settled plan.
- [ ] Make `useHandleSlotLayout` read side assignments from the shared plan and remove duplicate scorer/absolute-position paths only after equivalence tests pass.
- [ ] Run geometry, edge routing, handle, bidirectional, and label tests.

Expected: canvas handles, route endpoints, and planned slots derive from the same side decision; all distinct parallel relationships have stable, traceable paths.

### Task 5: Place labels against actual routes and group title bounds

**Files:**
- Modify: `frontend/lib/utils/edgeLabelLayout.ts`
- Modify: `frontend/lib/utils/diagramGeometry.ts`
- Create: `frontend/lib/utils/edgePathGeometry.ts`
- Modify: `frontend/lib/utils/__tests__/edgeLabelLayout.test.ts`
- Modify: `frontend/lib/utils/__tests__/diagramGeometry.test.ts`

**Interfaces:** `computeEdgeLabelLayout` accepts an optional immutable `ReadonlyMap<string, EdgeRouteResult>` plus effective bounds/options. If provided, it must not reroute edges. Add `computeEdgeLabelPlan(...): { labels: ReadonlyMap<string, EdgeLabelAnchor>; violations: readonly GeometryViolation[] }` for the geometry planner. Preserve current map-only `computeEdgeLabelLayout` API for unaffected call sites until migrated.

- [ ] Test a label colliding with an orthogonal turn/crossing despite a clear center-to-center chord; test label placement on shared trunks, nested group title strips, and dense labels with no available legal candidate.
- [ ] Implement `buildEdgePathGeometry`, `pointAtRenderedPath`, and `validateRenderedPath` for straight segments, rounded arcs, and cubic self-loop paths. Use adaptive subdivision with maximum 1px chord error and conservative stroke/marker padding; test routes tangent to obstacle corners and labels placed on arcs.
- [ ] Make `computeEdgeRoute` return authoritative `EdgePathInput`; derive its compatibility `svgPath` from `buildEdgePathGeometry` so canvas and export cannot independently reconstruct rounded corners or loops.
- [ ] Refactor label layout to use `RenderedEdgePath`, provider bounds, render style, and icon mode; represent group body as passable but group title strip as an obstacle.
- [ ] Require final label validation after projection to the rendered route. If no valid position exists, report `LABEL_COLLISION`; do not silently place the pill on a node/path and report success.
- [ ] Keep user-specified `labelT` respected when clear; if pinned and blocked, report the collision without mutating the saved value.
- [ ] Run label and diagram geometry tests.

Expected: every “clear” label is clear on the actual rendered route and actual effective bounds; user pins remain intact and blocked cases are diagnosable.

### Task 6: Use actual geometry to select layouts and gate generated output

**Files:**
- Modify: `frontend/lib/pipeline-shared/layout/layoutQuality.ts`
- Modify: `frontend/lib/mermaid/pipeline-stages/LayoutStage.ts`
- Modify: `frontend/lib/ai/pipeline/scoreDiagram.ts`
- Modify: `frontend/lib/ai/pipeline/mermaid-pipeline/stages/ScoreStage.ts`
- Modify: `frontend/lib/ai/pipeline/mermaid-pipeline/stages/ValidationStage.ts`
- Modify: `frontend/lib/ai/pipeline/mermaid-pipeline/stages/QualityRepairStage.ts` only if needed so hard geometry status is not skipped at score >=65.
- Modify: corresponding layout quality, score, and quality repair tests.

**Interfaces:** Export `LayoutGeometryQuality` from `layoutQuality.ts`. `measureLayoutQuality(nodes, edges, geometry, direction): LayoutGeometryQuality` consumes final routes/labels and returns separate `hardViolations`, `softPenalty`, `crossings`, `sharedRouteLength`, `bendCount`, `detourRatio`, `labelCollisions`, and `area`. The candidate limit is `MAX_LAYOUT_CANDIDATES = 4` (baseline plus three deterministic tie-order variants).

- [ ] Test route crossings missed by chords, legitimate common endpoints, excessive shared private geometry, bend/detour penalties, label collisions, and hard collision handling independently of the semantic score.
- [ ] Implement route-based quality metrics. Exclude shared graph vertices from false crossing counts, but measure overlapping path length for separate edges and report it only when lanes are not an explicit bundle.
- [ ] Generate exactly four bounded deterministic candidates: (A) canonical node order/default spacing, (B) reverse canonical node order/default spacing, (C) canonical order with `nodeSep + 32px`, and (D) canonical order with `rankSep + 48px`. Canonical order sorts by parent depth, stable parent ID, then stable node ID. For every candidate, recompute final group bounds and all edge/label geometry. Reject hard-invalid candidates if any valid candidate exists.
- [ ] If every candidate has hard violations, run at most two repair passes in this order: reselect unpinned terminal sides for failed edges; increase only the implicated channel spacing by `24px` nodeSep or `32px` rankSep and rerun Dagre once per pass; reroute lower-priority auto edges around fixed higher-priority/manual paths. Never alter graph topology, manual sides, custom waypoints, or user label positions. Revalidate the complete geometry after each repair.
- [ ] Choose the winner by lexicographic tuple `(hardViolationCount, criticalPathDisconnectCount, unexplainedPrivateOverlapLength, weightedCrossings, labelCollisions, bendCount, detourRatio, area)`. Use semantic score only as a final tie-breaker; never let it compensate for a hard violation. Prefer any `ok`/`degraded` candidate over all `invalid`/`failed` candidates; compare invalid/failed candidates by the tuple. If all repairs fail, return the lowest-violation graph with its actual `invalid` or `failed` status and diagnostics attached to pipeline warnings; never describe it as valid. A `degraded` plan has only soft edge-edge violations and valid routes.
- [ ] Remove the geometry penalty cap as a pass condition. Keep the existing semantic score bounded 0–100, but expose geometry validity separately in `ScoreOutput`/validation. A semantic grade alone cannot certify invalid geometry.
- [ ] Make quality repair skip only when geometry status is `ok` or `degraded`. For `invalid` or `failed`, consume the deterministic repair result from `LayoutStage`; do not spend an LLM revision on route geometry. Keep any semantic LLM repair separate and do not allow it to remove required relationships to improve layout score.
- [ ] Test impossible geometry produces a typed validation issue and cannot pass as an accepted clean result; test all relationship counts/IDs remain unchanged after candidate selection.
- [ ] Run layout quality, pipeline validation, scoring, quality repair, concept-template, and AI pipeline integration tests.

Expected: candidates are judged by the picture users see; geometry failures cannot be hidden by a capped penalty or high semantic score.

### Task 7: Unify canvas and SVG export geometry

**Files:**
- Create: `frontend/components/edges/DiagramGeometryProvider.tsx`
- Modify: `frontend/components/Canvas.tsx`
- Modify: `frontend/components/edges/SimpleFloatingEdge.tsx`
- Modify: `frontend/hooks/useHandleSlotLayout.ts`
- Modify: `frontend/lib/utils/diagramGeometry.ts`
- Modify: `frontend/lib/utils/edgeLabelLayout.ts`
- Modify: `frontend/lib/svg-export/index.ts`
- Modify: SVG export and edge component tests (create colocated tests if no geometry test currently covers the renderer contract).

**Interfaces:** `DiagramGeometryProvider` wraps the ReactFlow canvas inside its existing `ReactFlowProvider`, subscribes once to measured node internals and the diagram edge array, and publishes `DiagramGeometryPlanContext`. `useDiagramGeometryPlan(): DiagramGeometryPlanContextValue` returns `{ plan, revision, isDragging, previewStatus }`. Edge components render `plan.paths.get(edgeId)` and `plan.labels.get(edgeId)`; handle hooks read the same `sourceSides`/`targetSides`. Export uses `computeDiagramGeometryPlan` with identical explicit bounds and render options, without subscribing to the React store. No child recomputes the complete route/label plan.

- [ ] Test provider invalidation on node move, measured dimension/font load, parent/group resize, edge edit, direction change, render style, and icon mode; assert viewport zoom alone does not invalidate world-coordinate geometry. Assert one full-plan computation is shared across multiple edge/node consumers.
- [ ] Test dragging computes only affected route previews, labels remain attached provisionally, no drag preview enters the settled cache, and drag-stop computes exactly one final full plan. Test an in-place internals map update is observed via store revision/version and cannot leave stale geometry.
- [ ] Replace per-edge route useMemo and per-node scorer memo with the provider plan lookup; mount provider inside the existing `ReactFlowProvider` around the ReactFlow subtree and verify all custom nodes/edges receive context.
- [ ] Test identical source/target sides, rendered path commands, endpoints, and label anchor for canvas plan and SVG export on precision, sketch, Studio, and neubrutalism styles; include icon mode and nested groups.
- [ ] Update SVG export to use render style, icon mode, group bounds, and same plan; keep SVG path rendering/strokes style-specific and geometry style-independent where appropriate.
- [ ] Surface routing diagnostics in the existing editor affordance with a concise user-facing cause and action. If a user-created graph's route search fails within budget, render its fallback path with an error treatment and diagnostic; do not label it as collision-free. If geometry is invalid despite a route being found, identify the hard violation separately. Export must carry valid computed routes and include unresolved route warnings in its result.
- [ ] Run renderer, export, render-style, shape sizing, and edge route tests.

Expected: same graph snapshot and render options produce matching route geometry in canvas and SVG; theme affects visual appearance without changing semantic flow or invalidating route contracts.

### Task 8: Add a non-destructive Overview/Details presentation

**Files:**
- Create: `frontend/lib/utils/diagramPresentation.ts`
- Modify: `frontend/components/Toolbar.tsx`
- Modify: `frontend/components/Canvas.tsx` or editor shell (select the existing projection boundary after inspection; do not filter diagramStore state).
- Modify: generation completion/view initialization path (identified in implementation by tracing `importDiagram` callers; add only the smallest default for new AI-generated diagrams).
- Create: `frontend/lib/utils/__tests__/diagramPresentation.test.ts`
- Create/update: focused component interaction test for Overview ↔ Details.

**Interfaces:** `createDiagramPresentation(nodes, edges, flowSemantics, mode): { visibleNodeIds: ReadonlySet<string>; visibleEdgeIds: ReadonlySet<string>; hiddenEdgeIds: ReadonlySet<string> }` is a pure projection. `mode` is `'overview' | 'details'`. Original nodes/edges and graph-store state are never rewritten by this function. Overview may hide only an inferred supporting/diagnostic/optional edge with confidence ≥0.85, and only if removing it preserves reachability from every selected entry to every selected outcome. Keep explicit edges, every main/branch edge, and every node required by a selected path. If roles are absent, resolve them first; if entry/outcome semantics remain ambiguous, show the full graph. No synthetic aggregate nodes or edges are introduced in this version.

- [ ] Test Overview on linear, branch, cycle, grouped, and queue-centered graphs: preserve every entry-to-outcome path, all main/branch links, and every explicit edge; test 0.84 confidence remains visible, 0.85 can hide only when all reachability invariants still hold, and missing/ambiguous flow metadata displays the full graph.
- [ ] Test Details exposes all original node/edge IDs and exact original data; toggling modes does not change undo stack, persistence payload, selection identity, or export graph.
- [ ] Implement deterministic overview projection from resolved `flowRole` semantics; when entry/outcome selection or backbone confidence remains ambiguous, show the full graph rather than guessing which nodes or relationships are safe to hide.
- [ ] Add a clear Overview/Details control. Start newly generated graphs in Overview and loaded existing graphs in Details. Keep mode in UI state outside the undoable graph and persistence payload.
- [ ] Make the Details control indicate how many relationships are hidden from the view; switching to Details restores exact node/edge IDs and allows selection/editing. Export always uses Details/full graph regardless of current presentation mode.
- [ ] Add comprehension usability protocol to the release fixture set: five-second exposure; ask participants to identify entry, main path, and outcome; target ≥90% on representative diagrams; record failures for layout/presentation iteration rather than encoding the target as an unvalidated geometry score.
- [ ] Run projection, toolbar, canvas, diagram store, persistence, and generation-flow tests.

Expected: new generated views default to a legible summary; every original relationship remains accessible and exact in Details; old saved diagrams are not silently transformed.

### Task 9: Golden, property, and performance release gates

**Files:**
- Create: representative fixture set under `frontend/lib/pipeline-shared/layout/__fixtures__/` (linear, diamond, fan-out, queue pipeline with a misleading direct shortcut, reciprocal loop, nested groups, dense service graph, impossible enclosed route, duplicate-label parallel edges).
- Create: deterministic/property tests under `frontend/lib/pipeline-shared/layout/__tests__/`.
- Create: `frontend/scripts/perf/diagram-geometry.ts` to report warm-run p50/p95 settled layout, route state expansions, preview-route time, and memory for fixed 20/50/150-node fixtures.
- Add/update screenshot or SVG golden harness only where an existing project test pattern supports deterministic rendering; avoid adding a new browser dependency solely for this work.
- Update `docs/plans/edge-routing-layout-audit-2026-10-04.md` with final behavior and known limits after implementation.

- [ ] For every fixture, assert stable normalized geometry over repeated runs and shuffled serialization order; assert node/edge/group IDs, membership, and original payload survive.
- [ ] Assert all `ok` routes clear foreign obstacles and terminals, all `ok` labels clear nodes/other routes/group titles, and all declared bundles have explicit membership.
- [ ] Record image/SVG goldens for LR/TB and supported render styles; review visual changes for unintended direction/theme coupling.
- [ ] Before implementation, capture baseline timings on the named CI/release host and verify the proposed p95 budgets are compatible with measured baseline plus planner work. Record host, runtime, fixture, and warm-run method in the benchmark output. Gate regressions against the recorded baseline and proposed ceilings (100ms/250ms/750ms settled for 20/60, 50/180, 150/600; 16ms/33ms affected-edge previews for 50/150 nodes); if a ceiling is infeasible on the supported host, revise it using measured evidence before making it a release gate. Do not silently loosen a gate after implementation.
- [ ] Run all focused tests, then the complete checks below; fix any failure before declaring completion.
- [ ] Manually inspect representative generated diagrams and perform the five-second comprehension trial described in Task 8.
- [ ] Verify final path validation uses rounded/cubic rendered curves and stroke/marker clearance; verify `failed/search-budget-exceeded` is never mislabeled as proof of no route and `degraded` always has valid route geometry.
- [ ] Verify `invalid` always includes at least one hard geometry violation, while `failed` always identifies an unresolved route and its bounded-search reason; do not conflate the two in UI, export, pipeline validation, or logs.
- [ ] Verify `git diff` contains only task files and does not overwrite pre-existing user changes. Do not commit without a separate user request.

**Cache gate:** once the geometry/semantic resolver is enabled for generation, set `PIPELINE_VERSION` from `v8` to `v9` in `frontend/lib/ai/services/pipelineVersion.ts`. Add/update the colocated diagram cache test (locate its current filename during implementation) to assert old `v8` prompt/repo cache entries are not returned as `v9` results. No further bump is needed unless a later task changes serialized/cache semantics again.

## End-to-End Verification

From `frontend/` run:

```sh
npm test
npx tsc --noEmit
npm run lint
```

Also run the focused regression command from Task 1 and inspect representative generated diagrams in the browser across LR/TB, flat/nested groups, all render styles, reciprocal links, primary async queues, and dense fan-out. `npm run lint` is recorded even though CI currently treats lint as non-blocking.

Completion requires: all graph relationships preserved; zero silent hard geometry failures; canvas/export agreement; deterministic core flow under input permutation; all automated checks green; visual fixtures reviewed; and comprehension/performance results documented with their tested limits.

## Plan Self-Review

- Audit findings 1–8 map to Tasks 4–7 and 9; findings 2–3 also have direct regression/route outcome work in Tasks 1–2; findings 5–6 are covered in Task 3; overview/detail is covered in Task 8.
- Every shared interface is named before downstream tasks consume it. Route outcome, layout semantics, geometry plan, quality metrics, and projection contract have consistent names and types.
- Review Focus inputs have owning tests in Tasks 1–5 and 9.
- Geometry invalidity and semantic quality remain separate; no task authorizes graph deletion, user-edit loss, generated topology mutation, new runtime dependency, or a renderer replacement.
- The requested implementation spans one coupled geometry boundary plus a separate presentation projection. They remain in one staged plan because Tasks 1–7 provide the reliability contract the presentation layer depends on; Task 8 is independently testable and can be reviewed as its own deliverable.
