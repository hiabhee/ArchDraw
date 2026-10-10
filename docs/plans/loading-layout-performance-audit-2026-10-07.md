# Loading and layout performance audit

Audited and fixed the four loading flows on 2026-10-07: prompt generation, repository generation, templates, and saved/JSON diagrams. Implementation changes are in the frontend working tree; this report records local benchmark evidence and verification.

## Evidence and limits

Ran the deterministic geometry benchmark before and after the changes plus targeted routing/layout tests, typecheck, and production build. Measurements are local Node.js CPU timings, not browser load times or production API timings. Three measured runs and one warmup give a directional signal, not a robust tail-latency estimate. Network/LLM latency needs production stage telemetry.

Isolated rerun (`DIAGRAM_GEOMETRY_RUNS=3 DIAGRAM_GEOMETRY_SIZES=20,50 npm run perf:diagram-geometry`):

| Nodes / edges | Geometry p50 | Geometry observed p95 | Drag preview p50 | Route candidates / A* expanded states |
|---|---:|---:|---:|---:|
| 20 / 31, sparse | 44.8 ms | 45.0 ms | 2.8 ms | 31 / 0 |
| 20 / 63, dense | 1,222 ms | 1,309 ms | 9.4 ms | 397 / 99 |
| 50 / 85, sparse | 300 ms | 329 ms | 6.3 ms | 85 / 0 |
| 50 / 174, dense | 9,618 ms | 10,157 ms | 37.6 ms | 1,107 / 315 |

After changes, an isolated 150-node run measured 1,904 ms for 275 sparse edges and 8,312 ms for 559 dense edges; dense preview was 122 ms. This confirms large dense layouts remain costly even after the reduction. Before/after 50-node dense geometry was about 9,618 ms → 675 ms (about 93% lower); 20-node dense was about 1,222 ms → 120 ms (about 90% lower). Timings vary with CPU contention.

These are individual geometry passes, not end-to-end loading times. At three runs, the observed p95 is effectively the largest measured sample. Density is a much stronger cost signal than node count alone. The dense 50-node preview already exceeds a 60 Hz frame's 16.7 ms budget in Node; browser frame behavior still needs profiling.

Verification: focused regressions passed (9 files / 34 tests), the full frontend suite passed (144 files / 1,178 tests), `npx tsc --noEmit`, `git diff --check`, and `npm run build` passed.

## Four loading paths

| Flow | Work before display | Finding |
|---|---|---|
| AI prompt | Planner, Mermaid materialization/layout, optional quality-repair planner/materialization, browser relayout, import, measured canvas geometry | Already laid-out responses are unconditionally laid out again in `views/Editor.tsx:335`. Each Mermaid pass performs four to six full geometry evaluations plus final geometry validation. |
| Repository | Full ingestion, cache check, analysis/extraction/relationships/verification/docs review, compile, client import/geometry | `createRepoDiagramStages` puts ingestion before cache lookup. A result-cache hit still pays ingestion cost. Do not assume every repository client entry point invokes the same relayout: the direct repo handler imports the compiled result. |
| Template | Template lookup, browser Mermaid/Dagre/layout candidate scoring, import, measured geometry | `components/Canvas.tsx:73` puts synchronous CPU work before displaying the template. Fixed templates can carry a versioned prepared layout. |
| Saved/JSON | Storage/network read, normalization, import processing where called, geometry after mounting/measuring | `importDiagram` is not a passive load: it removes artifacts, collapses request/response pairs, assigns hierarchy, straightens positions, distributes handles, and resizes groups. Saved-canvas switching has its own path; measure it separately from JSON import. |

## Prioritized findings and concrete fixes

### 1. Full routing inside every layout candidate — fixed

`lib/mermaid/pipeline-stages/LayoutStage.ts:92-164` always evaluates four Dagre candidates and optionally two more. Every candidate calls `computeDiagramGeometryPlan`, which calls the full route optimizer. `lib/mermaid/pipeline.ts:212` computes geometry again after final sizing. Browser relayout repeats this sequence for AI responses, and the geometry provider computes the measured canvas plan during render.

An `async` function or `useMemo` does not move this synchronous computation off the browser's main thread. Memoization helps only when dependencies/cache keys remain unchanged.

Fix applied: cheap candidate screening and full route scoring only for a finalist when the fast score sees a likely issue; cache successful relayouts by input identity/options; skip duplicate AI relayout when the response carries a matching engine/direction marker; perform settled canvas geometry in a worker and discard superseded requests. Preserve the canonical Mermaid→Dagre path.

Test: count Dagre and full-geometry invocations for one AI response/template/toggle. Benchmark 20/50/150-node sparse and dense graphs. Assert topology, nested bounds and hard violations do not regress while reducing full-routing passes. In a production browser trace, record response-received→first-painted-diagram and long tasks separately from server time.

### 2. The routing budget bounds A*, not total routing cost — reduced

`lib/utils/edgeRouteOptimizer.ts:180-225` limits expanded A* states, but lane alternatives still rebuild routes and compare sampled paths. Candidate/fixed-route comparisons and global pair checks multiply work. Parallel endpoint groups are filtered/sorted repeatedly for each candidate selection. The measured 20-node dense fixture confirms that slow routing does not require many A* expansions.

Fix applied: endpoint groups and edge order are preindexed per pass; total candidate work is bounded and at least one candidate per edge is retained; rip-up reroutes the actual conflict set; route interaction checks reuse cached polyline simplifications and path samples. The 150-node dense benchmark remains about 8.3 seconds, so very dense graphs still warrant future spatial indexing / deeper profiling.

Test: record candidate counts, pair comparisons, obstacle checks and elapsed CPU time, not just A* states. Use dense, parallel, feedback and nested-group fixtures; assert budgets and valid terminal attachments.

### 3. A rejected rip-up pass is kept — correctness

`lib/utils/edgeRouteOptimizer.ts:240-254` mutates `routes` during a pass and breaks if the new global cost is greater than or equal to the previous cost. It does not restore the earlier route map. The code therefore can return a worse solution after recognizing that the pass did not improve it. This is a control-flow finding; a worsening graph fixture has not yet been demonstrated.

Fix: snapshot the prior solution and roll back non-improving passes. Keep user waypoints immutable.

Test: use a deterministic conflict fixture where individual choices worsen global cost; compare optimization with zero versus one rip-up pass. Require final objective not to worsen and manual paths to remain unchanged.

### 4. Geometry cache omits top-level edge labels — fixed

`lib/utils/diagramGeometry.ts:171` keys edges by ID/endpoints/handles/data/style, omitting `edge.label`. Label placement and collision validation read `edge.label`. Changing only a top-level label returned the exact same cached plan and key in a local two-node reproduction.

Fix applied: cache signatures include labels and node type/data/parent fields used by shape routing and group/title validation. Drag previews resolve child bounds in the parent coordinate space and consider dimension changes.

Test: change only `edge.label` from a short string to a long string; require invalidation and updated label placement/validation. Test shape and group-title changes with unchanged bounds as additional cache-key cases.

### 5. Broad subscriptions and whole-plan context fan out updates — reduced

`views/Editor.tsx:67` subscribes to the entire diagram store. Every `SimpleFloatingEdge.tsx:75` subscribes to all node internals and edges. Each handle hook subscribes to all nodes/edges and scans edges for its incident subset. The provider publishes one context value for the whole geometry plan. A local graph change therefore reaches many components even when their own route is unchanged.

Fix applied: editor subscriptions use narrow selectors; geometry runs in a worker; edge components subscribe to stable per-edge route/label snapshots and use a lightweight provisional line while a new plan is pending. Drag preview remains incremental. React Profiler validation is still recommended for real-device frame timings.

Test: React Profiler, 50/150 nodes; drag one node and count editor, unrelated node and unrelated edge commits. Record p95 frame work and verify handles stay synchronized at zoom levels and inside groups.

### 6. Storage writes are queued, not debounced — fixed

`store/diagramStore.ts:45` uses Zustand persist with all canvases in its partialized state. `lib/storage/localStorage.ts:18` chains every write into a Promise. JSON serialization still occurs through JSON storage, and localStorage writes still run synchronously on the main thread. Promise microtasks do not yield a paint opportunity or coalesce writes.

Fix applied: pending local-storage snapshots are coalesced and serialized at flush time, reads see pending writes, and lifecycle events flush the latest value. This preserves latest graph state while avoiding a write for every rapid update.

Test: instrument storage writes/stringified bytes during a two-second drag and 100 selection changes. Selection-only changes should not rewrite graph snapshots. Verify latest positions survive reload and switching tabs after the flush boundary.

### 7. Repo cache lookup is too late — fixed

`lib/repo-diagram/pipeline-v2.ts:44` runs `IngestStage` before `CacheCheckStage`. Cache lookup requires `snapshot.headSha`, obtained through ingestion.

Fix applied: resolve repository identity/ref/current SHA, check the level/version-scoped cache before archive ingestion, and pass the pinned SHA into ingestion on misses. Authentication is still required before serving a private-repository cache hit.

Test: first request misses; identical SHA/level hits without tarball/content fetch. Changed SHA, detail level or pipeline version misses. Unauthorized callers cannot receive private cached data.

### 8. Layout scoring maps RL to TD — correctness if reverse directions are used

`LayoutStage.ts:118` maps every direction except LR to TD for geometry scoring. Dagre itself supports RL/BT, while final geometry validation maps RL to LR. Thus RL candidate selection and final validation use inconsistent scoring directions. The toolbar's LR/TD paths are unaffected by this specific mapping bug.

Fix: centralize the horizontal/vertical mapping, or introduce signed direction handling if reverse flow needs different routing semantics.

Test: mirrored LR/RL and TD/BT fixtures, including groups and feedback; ensure candidate scoring and final validation agree on orientation.

## Layout and structuring improvements

Keep Dagre as the canonical engine. Changing the engine before bounding repeated routing would leave the largest measured cost intact.

1. Maintain explicit main/branch/feedback/support roles through generation, import and round trips. The engine already selects an acyclic ranking spine; build on it.
2. Make import preserve authored topology by default. Artifact removal and request/response collapse should be explicit generation cleanup, or an opt-in simplification, rather than surprising edits to loaded JSON.
3. Apply incremental routing to edits and incremental layout to an affected group/subgraph where feasible. Keep full layout as an explicit user action.
4. Normalize dimensions and parent coordinate spaces before scoring. Reuse a plan only after checking its complete input signature.
5. Score validity first, then crossings/overlaps, then bends/length/area. Accept only improving repair passes and explain unresolved geometry.
6. Make fixed-template preparation versioned; allow appearance/direction changes to invalidate it.

Practical regression suite: nested groups, parallel edges, feedback cycles, long labels, all shapes, manual waypoints, input-order permutations and repeat relayout. Assert stable IDs/counts/parents, finite positions, child containment, terminal anchoring and no newly introduced hard issues. Track latency independently from geometric quality.

## Implemented changes

The fixes cover geometry-cache correctness and rip-up rollback, candidate/route work reduction, duplicate layout avoidance, worker-based settled geometry, narrower subscriptions, coalesced persistence, early repository cache lookup, topology-preserving JSON import, and the RL geometry-orientation mismatch. Production timings for ingestion, planner, quality repair, layout, import, first paint, and measured routing remain the next observability step; the current benchmarks cannot establish end-to-end load time or mobile-browser behavior.
