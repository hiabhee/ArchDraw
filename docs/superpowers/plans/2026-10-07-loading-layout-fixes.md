# Loading and layout fixes

Implement the accepted performance audit without replacing the canonical Mermaid→Dagre engine or disturbing unrelated working-tree edits.

1. Add regressions for cache inputs, routing repair rollback/budgets, topology-preserving import and coalesced storage. Fix correctness first.
2. Share routing computations across a geometry pass, index endpoint groups and cache path comparisons. Bound candidate search and reroute conflict neighborhoods only. Verify deterministic paths/manual waypoints and benchmark against the audit.
3. Screen Dagre candidates cheaply; fully route finalists, consistently map reverse orientations and reuse matching final geometry. Version pipeline output and avoid redundant AI relayout.
4. Move browser relayout and settled geometry into workers, with serializable payloads, stale-result rejection, immediate provisional rendering and lifecycle cleanup. Preserve server/test synchronous fallback.
5. Narrow editor subscriptions and consume per-edge/per-node geometry snapshots; cache adjacency and coalesce local persistence with lifecycle flush.
6. Resolve authenticated repository identity/SHA before result-cache lookup and pin ingestion to that SHA. Keep version/detail scoping and verify hits skip file ingestion.
7. Run focused regressions, full frontend tests/typecheck, production build/worker checks and 20/50/150-node benchmarks. Document measured improvements and any remaining external-latency limits.

No commits or deployment requested. Tests should exercise user-visible behavior, stale result handling, preservation and quality budgets rather than mirror implementation details.
