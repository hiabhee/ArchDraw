# Edge routing and layout audit — 2026-10-04

Scope: current working tree, including existing uncommitted changes. No implementation files changed. Static tracing plus focused Vitest execution and isolated geometry probes; no browser visual audit, production generation sample, or performance benchmark. Findings below distinguish demonstrated behavior from architectural risks.

## Conclusion

The main reliability gap is that node layout, terminal selection, edge routing, label placement, and quality assessment do not consume one final geometry plan. Local heuristics can each succeed while the complete diagram remains ambiguous. Changing colors or increasing spacing cannot resolve this gap.

The system already has useful infrastructure: canonical Mermaid/Dagre layout, compound layout, weighted rank constraints, two layout candidates, obstacle avoidance, shared label caching, and bounded AI quality repair. Extend these through small migrations rather than replacing the entire pipeline.

## Findings

### 1. Layout and routing optimize different pictures — high priority

- `frontend/lib/pipeline-shared/layout/IntegratedLayout.ts:130` returns the original edges, discarding the layout result's edge geometry and warnings.
- `frontend/lib/pipeline-shared/layout/CompoundLayout.ts:908` explicitly leaves edge points undefined.
- `frontend/lib/utils/edgeRouteBuilder.ts:543` routes each edge independently. Other relationships influence handle slots and reciprocal lanes, but their routed segments are not obstacles or a global crossing/congestion cost.

Consequence: a node arrangement that looks good to Dagre can produce shared trunks, crossings, and detours when the independent router draws it. Discarding Dagre points alone is not inherently wrong; the missing piece is feedback from the replacement router into layout selection.

Fix: evaluate complete node-and-route candidates; share an immutable geometry result among handles, renderer, labels, export, and diagnostics. Keep Dagre as the initial placement engine.

### 2. Distinct parallel relationships can become one visible line — reproduced

`simpleFloatingEdge.ts:99` centers handles when only one direction occupies a side. The final route offset in `edgeRouteBuilder.ts:928` separates reciprocal connections, not arbitrary same-direction parallel edges.

Probe: two distinct A→B edges both returned exactly `M 212,50 L 588,50`.

This is distinct from deliberate bundling: the router provides no explicit junction/bundle contract identifying the shared wire. Separate labels do not guarantee a reader can distinguish the connections.

Fix: assign stable branch lanes after the shared terminal stub, or intentionally bundle with explicit membership and unambiguous branching. Preserve the current centered / ±16 incoming-outgoing handle rule. Introducing per-edge ports would be a separate product decision.

### 3. Obstacle avoidance has no trustworthy success contract — reproduced boundary case

`edgeRouting/waypoints.ts:790` and equivalent branches use default bends when safe candidates and A* fail. The final check at line 863 checks self-intersection, not complete obstacle clearance. Even the last fallback returns a candidate without a failure status.

Probe: a target inside a foreign obstacle returned a straight line intersecting that obstacle. This deliberately impossible input demonstrates failure reporting, not that every routable diagram will collide.

Additional unchecked paths: self-loop construction returns before ordinary obstacle routing; custom waypoints check orthogonality but not foreign obstacles. `edgeRouteBuilder.ts:942` enables terminal trust whenever a measured-anchor object exists, even if its coordinates were rejected earlier as stale.

Fix: validate final geometry after every adjustment. Return `ok`, `degraded`, or `unroutable` plus violations. Automatic generation must repair placement or clearly retain diagnostics, never silently call an intersecting route collision-free. Handle user-pinned routes explicitly rather than silently destroying edits.

### 4. The quality score cannot certify what is drawn — code confirmed

`layoutQuality.ts:45` builds straight node-center segments. It does not measure final orthogonal routes, shared segment length, bends, detour ratio, or actual label boxes. Shared-endpoint pairs are excluded from crossing estimates.

`LayoutStage.ts:29` tries only original and reversed node ordering, stopping at zero estimated penalty. `scoreDiagram.ts:219` uses the same estimate without a direction and caps its penalty at 25. A theoretical 100-point graph can therefore retain 75 despite arbitrarily severe geometry penalties; `QualityRepairStage.ts:19` permits score >=65 without semantic issues to skip repair.

Fix: hard geometry violations must be separate from semantic scores. Score actual routes after final dimensions and group bounds. Optimize avoidable crossings, unexplained shared wires, bends, and viewport readability; some crossings are unavoidable and should not be treated as universal failure.

### 5. Layout heuristics can misidentify the principal flow — reproduced

- `LayoutEngine.ts:198` reduces infrastructure/async relationships to at most 1.5, even when importance is explicitly `primary` (5). Probe confirmed primary async → 1.5.
- `CompoundLayout.ts:433` treats infrastructure node types as candidates for side placement. A queue or database may actually be a central stage in an event or data pipeline.
- `LayoutEngine.ts:250` breaks equal-weight cycle choices using array order. Probe: reversing `[a,b]` to `[b,a]` changed the selected rank edge from A→B to B→A without changing graph semantics.
- Mermaid serialization preserves arrow style and label but not arbitrary explicit edge importance. Restoring original edge data after relayout is too late to make it guide ranking during that relayout.

Fix: carry explicit graph-local roles such as main flow, branch, feedback, and supporting dependency through layout. Explicit intent must outrank service-type guesses. Define stable cycle handling and canonical ordering. Preserve semantic metadata through the existing canonical Mermaid path, using a sidecar or supported directives.

### 6. Manual sides are overridden by reciprocal-edge inference — reproduced

`edgeRouteBuilder.ts:714` reads manual sides, then overwrites them with inferred facing sides when a reverse edge exists. Matching behavior appears in the handle-side resolver.

Probe: A→B with explicit top/top plus B→A rendered right/left.

Fix: define one precedence policy: explicit user pin, then intentional layout constraint, then automatic preference. Test both handle positions and actual route endpoints against it.

### 7. Canvas, label planning, and export use different geometry inputs — code confirmed

- `SimpleFloatingEdge.tsx:104` supplies render style, icon mode, and measured anchors to the route computation.
- `edgeLabelLayout.ts:675` recomputes routes without icon mode or measured anchors; obstacle sizes at line 659 use stored dimensions. Group headers are not reserved as label obstacles.
- `SimpleFloatingEdge.tsx:401` projects the chosen label fraction onto the actual canvas path without rechecking clearance.
- `svg-export/index.ts:202` computes routes without render style or icon mode, although the label planner receives render style.

Risk: labels certified against one path are displayed on another, and exported geometry can differ from the canvas. Some dimensions are preprocessed for export, so this is a confirmed input-contract divergence, not a claim that every export is visually broken.

Fix: labels and export consume the same resolved route and dimension snapshot as the canvas. Reserve group title strips separately from passable group interiors. Label fallback must report unresolved collisions.

### 8. Duplicated geometry decisions increase regression and performance risk

`useHandleSlotLayout.ts` duplicates absolute-coordinate traversal, obstacle collection, side scoring, and terminal guards from `edgeRouteBuilder.ts`. `SimpleFloatingEdge.tsx` subscribes to the full node/edge collections; side resolution repeatedly scans edges and nodes. Labels have shared memoization already, but still perform a second route pass.

Fix: resolve node bounds and side assignments once per geometry revision, cache routes, and track affected edges/obstacles during edits. Benchmark before claiming a particular speedup. Consider moving heavy settled-diagram planning to a worker only after measuring it.

## Verification performed

Focused Vitest run: **10 files, 168 tests passed** covering routing, obstacles, labels, reciprocal links, handle ordering, scorer, relayout, and pipeline-shared tests.

The passing suite does not invalidate the findings. In particular, `edgeRouteBuilder.snap.test.ts:68` claims parallel separation but computes only one route and asserts more than two waypoints. It never compares the two paths.

Isolated probes demonstrated:

1. Same-direction parallel paths are identical.
2. Equal-weight cycle ranking changes with node array order.
3. Explicit primary async edges are assigned weight 1.5.
4. An impossible obstacle configuration returns intersecting geometry without failure status.
5. A reciprocal edge causes explicit top/top sides to become right/left.

Re-run the focused tests from `frontend/`:

```sh
npx vitest --run lib/utils/__tests__/edgeRouteBuilder.snap.test.ts lib/utils/__tests__/edgeRouteGroupAvoidance.test.ts lib/utils/__tests__/collisionFreeEdgePath.test.ts lib/utils/__tests__/edgeLabelLayout.test.ts lib/utils/__tests__/bidirectionalEdges.test.ts lib/utils/__tests__/handleSlotOrder.test.ts lib/utils/__tests__/handleSlotSwap.test.ts lib/utils/__tests__/handlerPairScorer.test.ts lib/mermaid/relayout.test.ts lib/pipeline-shared/__tests__
```

## Recommended repair sequence

1. **Establish evidence:** turn the five probes into regression tests; collect representative generated diagrams and save their graph payloads, dimensions, and screenshots. Include flat/grouped, LR/TB, all render styles, and real problem prompts.
2. **Unify geometry and validity:** a shared geometry snapshot, final-path validation, explicit failure states, manual-pin precedence, and canvas/export agreement. Keep the current public diagram/tool contracts.
3. **Plan the entire graph:** preserve main-flow semantics, stable cycle handling, joint port/branch ordering, globally allocated route lanes, feedback corridors, and controlled group boundary crossings. Route high-priority relationships first; use bounded rerouting when congestion appears.
4. **Choose readable complete candidates:** assess placement, routes, labels, and viewport legibility together. Adjust order/spacing when routing fails. Preserve all semantic relationships; never improve a score by deleting required edges.
5. **Add presentation levels:** an overview should expose the entry point, main sequence, branches, and outcomes. Detailed dependency views remain available. Large arbitrary graphs cannot reliably communicate every relationship in a few seconds; the overview needs intentional abstraction.
6. **Gate releases:** geometry invariants, golden visual fixtures, deterministic/property checks, performance budgets, and route-versioned telemetry. Re-run quality checks for new graph features and dimension-changing styles. Bump relevant cache versions for changed layout semantics.

## Practical acceptance tests

| Fixture/action | Required result |
|---|---|
| Linear A→B→C→D, LR and TB | Main flow is monotonic; no unnecessary bends or reverse excursions |
| Diamond split/join and 1→8 fan-out | Branch identities remain traceable; shared trunks are intentional and visually explicit |
| Two distinct A→B relationships | Separate identifiable lanes or an explicit bundle; never accidental exact overdraw |
| A→B and B→A with pinned top/top | Pins respected; feedback distinguishable from forward flow |
| Queue-centered pipeline with primary async links | Queue stays on the principal sequence; explicit priority survives round-trip |
| Same graph with shuffled serialization order | Same semantic backbone and stable normalized geometry; deliberate user ordering remains supported |
| Foreign obstacle blocks route, including impossible enclosure | Clear path or typed failure; never an unreported collision |
| Nested groups with cross-group edges | No foreign-node collisions, illegal group traversal, or label overlap with group titles |
| Theme/icon changes, zoom, drag, undo, save/reload | Endpoints remain attached; labels use final routes; graph identity preserved |
| SVG export of the same settled graph | Equivalent node bounds, route endpoints, bends, and label placement |
| 20/50/150-node sparse and dense fixtures | Measure route latency, drag frame times, memory and candidate-search limits on a declared baseline device |
| Five-second user comprehension trial | Proposed target: at least 90% identify entry point, main path and outcome; validate with users rather than a geometry score alone |

No implementation can responsibly promise years without review. A durable target is stable contracts and automated evidence that catches regressions before users do. The implementation should be considered reliable only when its supported graph classes and failure behavior are explicit and these release gates pass.

## Implementation status — 2026-10-06

The current working tree now includes a shared canvas/export geometry plan, rendered-path validation for orthogonal paths and cubic loops, route and label diagnostics, stable parallel lanes, manual-side precedence, semantic metadata round-tripping, deterministic multi-candidate Dagre scoring, non-destructive Overview/Details projection, and pipeline geometry warnings. The first several reproduced defects above have regression coverage. `npm test` and `npx tsc --noEmit` passed during this implementation session.

The route allocator remains a bounded lane-and-reroute heuristic over per-edge A* routes. It does not yet implement the plan's graph-wide shared visibility grid or explicit total search-state budget across every route candidate. Per-route A* limits are configurable and the optimizer reports aggregate expanded states. Further dense-graph profiling is required before treating these limits as a release gate.

The new `npm run perf:diagram-geometry` benchmark was smoke-run on a local Darwin arm64 machine with Node v22.22.1, one warmup, and three measurements. Results varied between runs; one representative run reported:

| Fixture | Optimizer p50 / p95 | Full plan p50 / p95 | Drag preview p50 / p95 | Routes evaluated | A* states |
|---|---:|---:|---:|---:|---:|
| 20 nodes / 31 edges, sparse | 49 / 50 ms | 43 / 92 ms | 2.7 / 2.9 ms | 31 | 0 |
| 20 nodes / 63 edges, dense | 1,220 / 1,271 ms | 1,231 / 1,310 ms | 9.6 / 10.6 ms | 397 | 99 |

The dense fixture misses the proposed 100 ms p95 ceiling by more than an order of magnitude. These are post-change measurements, not a before/after baseline, and the machine model was not recorded. Do not use them as a CI gate yet.

Still outstanding: full 20/50/150-node sparse and dense measurements on the named CI/release host; deterministic geometry and SVG goldens across supported styles and nested groups; comprehensive canvas/export parity fixtures; a browser visual pass across LR/TB and render styles; and the five-second comprehension study. The user study needs human participants and has not been performed. Existing Overview intentionally falls back to the full graph when flow classification is ambiguous.
