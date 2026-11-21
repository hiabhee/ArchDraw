# Layout and edge readability investigation

Date: 2026-11-08
Status: implementation in progress. Root scoring/label/spacing fixes are implemented; two typography regressions and live interaction validation remain unresolved.

## Outcome

Yes: the current system has several concrete reasons why a technically valid diagram can be difficult to understand. It optimizes placement and routing in stages, but those stages do not consistently judge the final rendered result. Geometry correctness alone does not establish whether a reader can identify the entry point, main flow, branches, and system boundaries.

The earlier crossing and square-corner fixes address real bugs, but do not solve this broader readability problem.

## Evidence and limits

This review inspected the current working tree, including existing uncommitted changes, in the canonical Mermaid/Dagre layout, route optimizer, geometry planner, label placement, and canvas geometry provider. The prior verification run passed 292 tests and TypeScript. Those results are regression evidence, not proof of visual readability. This investigation did not inspect a supplied failing diagram, run a user comprehension study, or complete a browser screenshot audit. Findings below distinguish code behavior from hypotheses needing visual measurement.

## Findings

### 1. Layout selection and the canvas evaluate different geometry — highest priority

Evidence:
- `frontend/lib/diagram/mermaid/pipeline-stages/LayoutStage.ts`, `measureCandidate`, calls `getCachedDiagramGeometryPlan` with only `direction`.
- `frontend/components/canvas/edges/DiagramGeometryProvider.tsx` passes render style, icon mode, measured handle anchors, and `straightEdges: true`.
- `frontend/lib/diagram/geometry/diagramGeometry.ts` defaults straight routing to false.

The candidate selected for low crossings and good labels is therefore not evaluated under the same routing policy as the visible canvas. Style and measured geometry can also differ. This mismatch is confirmed; the size of its effect on individual diagrams needs measurement. A good layout score cannot currently guarantee that the visible routes retain that quality.

### 2. Fitting the graph can trade away traceable flow

Evidence: `LayoutStage.ts` tries folded layouts and mixed group directions. Fold acceptance explicitly permits additional weighted crossings through `foldCrossingAllowance`, capped at 12, in exchange for improved fit. Mixed direction candidates use the same allowance.

These features improve text size and should not simply be removed. However, serpentine rows and changes in local direction make the reader reconstruct the reading order. More readable text can coexist with a less understandable flow. The current score does not directly measure that cognitive cost.

### 3. The optimization objective is not a comprehension objective

Evidence: `LayoutStage.ts` compares candidates lexicographically by hard violations, main-path failures, private overlap, weighted crossings, label collisions, bends, path length, area, and node-quality penalty. Fit is handled through additional guards and candidate transformations, rather than a complete typography/readability acceptance contract.

Small improvements in an earlier metric can dominate large changes in later metrics. This is not inherently wrong, but the relative priorities need explicit product decisions. There is no demonstrated guarantee that a first-time reader can identify a main path at the final fit zoom.

### 4. Edge routing has a deliberately narrow search

Evidence: `frontend/lib/diagram/edges/edgeRouteOptimizer.ts` uses normal lane deltas of 0 and ±28, additional feedback deltas of ±144, two repair passes, and bounded candidate/state budgets. It routes edges sequentially, then repairs conflicts. Route cost combines length, bend cost, crossing cost, and overlap cost.

The bounds protect responsiveness. They also mean complex graphs may exhaust local alternatives without finding a globally clear arrangement. Increasing budgets indiscriminately would risk latency without fixing the objective. Measure which conflicts are caused by placement versus route choice before expanding search.

### 5. Labels can lose architectural meaning

Evidence: `composeEdgeDisplayLabel` in `frontend/lib/diagram/edges/edgeLabelLayout.ts` keeps only the first three words. Request and response labels are combined before shortening. The label placement search keeps labels on their wires (`NODE_ESCAPE_PERPS = [0]`).

A label can therefore omit the operation, destination qualifier, or response semantics that distinguish two edges. On-wire placement also has limited options on short or shared segments. Placement already checks cards, other labels, and other edges; the issue is not an absence of collision handling, but limited escape space and potentially lossy content.

Additional mismatch: `diagramGeometry.ts` estimates diagnostic label rectangles from raw label length with a capped width, while the display formatter shortens text. Share display text and metrics so the scorer judges the actual pill.

### 6. Known bad geometry can be returned successfully

Evidence: the end of `LayoutStage.ts` returns `successResult(layouted, geometryWarnings, ...)` even when geometry status reports remaining hard violations or main-path failures. The canvas provider shows a hard-issue warning suggesting moving a node or trying another layout.

This is a useful graceful fallback, but it is not a readability guarantee. The system can knowingly deliver a result that requires manual repair. Preserve the user's graph and offer a concrete recovery path; do not silently remove connections to make the warning disappear.

### 7. Fan handling had blind spots; earlier fixes need broader fixtures

The earlier changes removed the blanket crossing exemption for edges sharing a node, guarded lane separation against new sibling crossings, and preserved orthogonal bends at zero corner radius. Existing tests pass. These are foundational fixes, not evidence that dense fan-in/fan-out and feedback diagrams are now understandable.

### 8. Interaction stability needs browser verification

Evidence: the canvas provider holds a previous plan during dragging, uses per-edge fallback routes while a new worker plan is pending, and recomputes after a delay. This could produce visibly different intermediate and settled paths. Treat this as a hypothesis, not a confirmed flicker bug. Test dragging, resizing, loading saved canvases, and switching render styles.

## Repair plan

### Phase 1 — Establish a reproducible visual baseline

- Capture representative shipped templates and failing user diagrams: flat chains, grouped flows, dense branches, feedback, parallel edges, long labels, nested groups, and manually edited routes.
- Exercise LR/TD, relevant render styles, icon modes, and editor/share/export outputs.
- Save screenshots at a fixed laptop viewport and fit zoom alongside geometry metrics: node and label intersections, crossings, private overlap, bends, path length, and actual rendered title/label sizes.
- Include a simple comprehension review: identify entry point, follow the main request, locate storage and external services, explain one feedback loop.
- Preserve baseline fixtures and existing quality floors. Do not lower thresholds to accommodate a repair.

Deliverable: reproducible before/after gallery and per-fixture measurements, including at least one real failing diagram when available.

### Phase 2 — Make scoring match rendering

- Define one explicit geometry policy passed through layout evaluation, canvas, viewers, and exports, including style, icon mode, and straight/orthogonal policy.
- Use shared displayed label text and dimensions for placement and diagnostics.
- Validate the final measured canvas geometry after node sizing; avoid a recursive layout/measurement loop.
- Preserve the canonical `layoutDiagramViaMermaid` → Dagre path and manual waypoint overrides.

Acceptance: equivalent graph/style inputs produce consistent route topology and label bounds across scoring and rendering, within documented measurement tolerance.

### Phase 3 — Make main flow clarity a layout constraint

- Keep hard safety constraints first: no node overlaps, out-of-group nodes, route-through-card failures, or disconnected main path on supported regression fixtures.
- Add explicit minimum fitted typography targets, chosen from the visual baseline rather than guessed globally.
- Penalize main-path direction reversals, excessive detours, and ambiguous wrap transitions.
- Prefer a clear stage order and stable group directions. Accept folding or mixed directions only when the visible result passes readability checks; do not reward fit alone.
- For diagrams too dense to meet those constraints, propose an overview/detail workflow as a separate product decision. Never silently hide or delete relationships.

Acceptance: readers can follow the main path without guessing the next row or branch; text remains readable at the target viewport.

### Phase 4 — Repair congested routing and label space together

- Detect congested corridors and distinguish shared intentional trunks from unrelated overlapping connections.
- Allocate space based on corridor demand and label size; feed unresolved congestion back into candidate placement instead of only moving wires by fixed offsets.
- Keep fan lanes nested and feedback routes distinguishable. Preserve source/target semantics and user overrides.
- Use bounded, deterministic alternative searches focused on problematic regions; retain a candidate only when the complete visible geometry improves.
- Replace unconditional three-word shortening with deliberate label sizing/wrapping and an explicit truncation treatment when necessary; preserve complete accessible text.

Acceptance: no newly introduced crossings or card/label intersections; every visible connection remains traceable; labels retain the information distinguishing operations.

### Phase 5 — Stable interaction and actionable recovery

- Browser-test provisional versus settled geometry during drag, resize, load, and style changes. Repair stale geometry only where reproduced.
- Make remaining layout failure actionable through a bounded repair/re-layout operation, preserving manual edits and undo behavior.
- Report accurately when a graph cannot meet readability constraints instead of implying every successful generation is visually acceptable.

## Validation and rollout

Run touched Vitest suites, layout aesthetics/readability and hero regressions, TypeScript, and browser checks. Compare screenshots and metrics against Phase 1, including runtime measurements on larger fixtures. Verify export parity, read-only hosts, deterministic reruns, custom waypoints, and saved canvases. Use small independently reviewable changes in phase order; do not replace Dagre or add another layout engine before these specific mismatches are resolved.

The first implementation priority is geometry-policy parity. Tuning spacing or routing against a different picture from the one users see would make subsequent work unreliable.

## Repair model implementation (2026-11-08)

Implemented a bounded editor recovery operation in `frontend/lib/diagram/mermaid/repairLayout.ts`:

- One canonical Dagre relayout using the existing bounded candidate/spacing search, with folding and mixed group directions disabled for repair.
- Score restored nodes against the original authored edges under the canvas straight-edge policy, current render style and icon mode.
- Accept only a strict reduction in conflicts with no increase in hard violations, main-path failures, weighted crossings, private overlaps or label collisions; retain at least 90% of the prior fitted size. This 90% guard is a conservative implementation bound, not a measured typography target.
- Preserve all node identities/data and original edge objects, including manual routes; reject out-of-group results. Leave the graph unchanged if no safe improvement is found.
- Editor hard-issue notice offers **Repair layout**, records one undo step on acceptance, and rejects results if the canvas or graph changed while awaiting repair. Read-only viewers do not offer the action.
- Repair candidate scoring and final pipeline validation use straight routes and accept render-style/icon-mode inputs. Ordinary layout selection retains its existing orthogonal scoring policy: globally switching it caused fitted-text regression failures and needs a separate rollout. Visible-route label diagnostics share display text and estimated pill dimensions with placement; legacy orthogonal scoring retains its old estimates during migration.

This implements the repair mechanism and geometry-policy corrections. The visual baseline/gallery, measured typography targets, broader semantic label redesign, congestion-driven placement search and browser interaction audit remain follow-up work; the full five-phase plan is not complete.

Validation: routing/geometry/aesthetics/hero and pipeline regression run passed 299 tests; the expanded repair suite covers acceptance guards, original edge metadata, canonical Dagre repair, group containment, and unchanged-on-failure behavior. TypeScript and diff whitespace checks passed. The broader readability suite still reports fitted-title floor failures for `food_delivery:LR` (14.78 vs 14.9px) and `ecommerce:TD` (19.49 vs 20.2px) under the retained ordinary scoring policy; floors were not lowered. Browser interaction/screenshot validation has not been performed.

## Root-cause fixes and balanced spacing

Ordinary layout selection now scores the same straight-route policy as the canvas, including render style and icon mode; the legacy scoring exception has been removed. Visible label placement and diagnostics share the full displayed text and pill dimensions. Request/response labels retain all words rather than silently stopping at word three.

Candidate selection protects fitted size when only soft route metrics improve. Cosmetic group alignment cannot shrink fitted text. Spacing search compares standard, compact and independently adjusted axes, with compact node spacing bounded at the existing 40px column-corridor minimum and rank spacing at 40px plus the engine's label reservation. Congested routes trigger intermediate 16/24/32px rank-gap candidates before a 48px expansion; all alternatives are routed and scored. Crossing cost now uses both participating edges' semantic roles, making it independent of edge array order.

The repair notice also covers substantial edge congestion. Hero generation passes its actual metallic render style, and hero tests evaluate the visible routes rather than the orthogonal fallback. Existing crossing and typography thresholds were not lowered.

A reproducible export gallery and metrics runner lives at `frontend/scripts/eval/layout/run.mts`: run `npx tsx scripts/eval/layout/run.mts /tmp/archdraw-layout-audit [template-id]` from `frontend/`. It emits fixed 1280×720 views, SVGs, geometry metrics, fitted-title sizes and timing. A Food Delivery export gallery was rendered and inspected in headless Chrome. This is export/browser-render evidence; editor drag/resize/share interaction coverage and a human comprehension study remain unverified.

Final verification during this follow-up: 304 routing/geometry/repair/pipeline/aesthetics/visible-hero tests passed across 34 files, and TypeScript passed. The full typography suite still fails Netflix LR (9.204px vs 9.3px) and Food Delivery TD (11.852px vs 12.1px); the other two suite checks pass. These remain unresolved and the full plan must not be marked complete.

The local editor browser capture was attempted against port 3100 but did not finish; its headless browser was stopped. No drag/resize/reload result is claimed.

Final-pass correction: spine alignment now preserves the selected fit scale and cannot increase private route overlap. Previously its acceptance checks covered collisions/crossings and fan alignment but could still enlarge the bounding box after candidate selection. Typography and hero regressions are being checked against this correction.

Spine correction verification: hero tests pass and TypeScript passes; the two typography failures remain unchanged (Netflix LR 9.204/9.3px; Food Delivery TD 11.852/12.1px). The correction therefore does not resolve those failures.

## Consistent rounded-step routing (2026-11-09)

Product direction updated: automatic canvas, fallback, layout scoring, repair and SVG export routes now use the same rounded orthogonal policy (`straightEdges: false`). Aligned nodes have straight axis-aligned links; staggered nodes use rounded right-angle bends. Diagonal shortcuts are disabled in every production caller. Hero channel tests are restored to that routing contract. Initial verification: 304 tests across 33 files and TypeScript pass.
