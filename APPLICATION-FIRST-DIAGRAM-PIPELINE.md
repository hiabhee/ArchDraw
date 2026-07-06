# Application-First Diagram Generation Pipeline

## Purpose

ArchDraw should keep Mermaid because it gives the product a simple and powerful user-facing editing model. Users can inspect the code, modify the diagram, and regenerate the visual result without learning a proprietary format.

The problem is not Mermaid. The problem is asking a low-parameter LLM to be responsible for too much correctness.

This document proposes a new pipeline where:

- Mermaid remains the editable diagram language.
- The LLM produces a constrained Mermaid draft or structured intent.
- The application owns parsing, validation, repair, layout, routing, scoring, and rendering.
- Low-power LLMs become helpful input providers, not the bottleneck for diagram quality.

## Core Thesis

Do not trust the model to create a correct architecture diagram.

Trust the application to compile, validate, repair, and render a diagram from model output.

The model should be treated like a noisy author. The application should behave like a compiler.

```text
Prompt
  -> LLM draft
  -> Mermaid parser
  -> Architecture graph
  -> Validators
  -> Repair passes
  -> Layout graph
  -> React Flow canvas
  -> Mermaid export/edit loop
```

## Current Shape

The current generation flow is broadly:

```text
User prompt
  -> LLM creates Mermaid
  -> custom Mermaid parser
  -> Dagre layout
  -> React Flow nodes/edges
  -> canvas import
```

This is simple and product-friendly, but it puts hidden responsibility on the model:

- Choosing the right components.
- Choosing correct edge direction.
- Assigning every node to a group.
- Using syntax the custom parser supports.
- Avoiding duplicates and orphan nodes.
- Keeping node count appropriate for diagram size.
- Creating semantically useful edge labels.
- Producing topology that matches real architecture patterns.

Low-parameter models can do some of this some of the time, but they should not be the authority.

## Target Shape

The target pipeline keeps Mermaid but adds an application-owned correctness layer.

```text
1. Prompt intake
2. Domain and intent extraction
3. Mermaid draft generation
4. Mermaid linting
5. Mermaid parsing
6. ArchitectureGraph construction
7. Graph validation
8. Deterministic repair
9. Layout and routing
10. React Flow rendering
11. Quality score and warnings
12. Editable Mermaid sync
```

The most important change is step 6:

```text
Mermaid should compile into an internal ArchitectureGraph.
ArchitectureGraph should be the application correctness layer.
React Flow should be the visual layer.
Mermaid should remain the editable source layer.
```

## Key Principle: Mermaid Is The Interface, Not The Brain

Mermaid should remain the thing users edit.

But ArchDraw should not blindly trust Mermaid as a complete architecture model. Mermaid is a syntax for nodes, edges, and groups. It does not know whether:

- A load balancer is incorrectly connected to a database.
- A client is acting as a backend service.
- A queue should be async.
- A data store is missing.
- A diagram has duplicate concepts.
- A response edge should be treated differently from a request edge.
- A component belongs in the wrong layer.

Those are application-level responsibilities.

## Proposed Internal Model

Add a canonical internal graph representation between Mermaid and React Flow.

```ts
interface ArchitectureGraph {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  groups: ArchitectureGroup[];
  metadata: DiagramMetadata;
  diagnostics: GraphDiagnostic[];
}

interface ArchitectureNode {
  id: string;
  label: string;
  canonicalType: ComponentType;
  layer: LayerType;
  shape: NodeShape;
  icon: string;
  source: "explicit" | "llm_inferred" | "app_inferred" | "repaired";
  confidence: number;
}

interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  semanticType: "request" | "response" | "read" | "write" | "publish" | "consume" | "sync" | "async";
  directionConfidence: number;
  source: "explicit" | "llm_inferred" | "app_inferred" | "repaired";
}

interface ArchitectureGroup {
  id: string;
  label: string;
  layer: LayerType;
  nodeIds: string[];
}
```

The exact types can evolve, but the important idea is stable: once Mermaid is parsed, the app should have a typed graph it can reason about.

## What The LLM Should Do

Low-power LLMs should do small, bounded jobs.

### Good Jobs For A Small LLM

- Classify the domain: ecommerce, chat, SaaS, streaming, RAG, payments.
- Extract named components from the prompt.
- Extract named actors.
- Extract direct relationships described by the user.
- Generate a first Mermaid draft in a strict subset.
- Summarize user intent.

### Bad Jobs For A Small LLM

- Guarantee topology correctness.
- Decide final layout.
- Repair all syntax problems.
- Infer every missing production component.
- Decide final edge routing.
- Assign final icons, shapes, and layer semantics.
- Score its own output.

The LLM can suggest. The application should decide.

## Strict Mermaid Subset

To keep Mermaid useful and reduce parser ambiguity, the generation prompt should require a strict subset:

```text
graph LR
  subgraph CLIENT["Client Layer"]
    user("User")
  end
  subgraph GATEWAY["Gateway Layer"]
    gateway{"API Gateway"}
  end
  subgraph SERVICE["Service Layer"]
    api["API Service"]
  end
  subgraph DATA["Data Layer"]
    db[("PostgreSQL")]
  end
  user -->|request| gateway
  gateway -->|route| api
  api -->|read| db
```

Rules:

- One node declaration per line.
- One edge per line.
- No chained edges like `A --> B --> C`.
- Every subgraph uses stable ID plus quoted label: `subgraph CLIENT["Client Layer"]`.
- Every node has a stable ID.
- Every edge has a short label.
- Every node lives inside a subgraph.
- Shapes are limited to the supported ArchDraw subset.

Users can still type broader Mermaid manually, but model-generated Mermaid should stay inside the safe subset.

## Mermaid Linter

Before parsing Mermaid into React Flow, run a linter.

The linter should catch:

- Chained edges.
- Unsupported arrows.
- Unclosed subgraphs.
- Duplicate node IDs.
- Duplicate node labels with different IDs.
- Nodes outside subgraphs.
- Edges pointing to missing nodes.
- Unsupported shapes.
- Edge labels over the configured length.
- Reserved group names used as component nodes.
- Mermaid syntax supported by Mermaid.js but not by ArchDraw's compiler.

The linter should return structured diagnostics:

```ts
{
  severity: "error" | "warning" | "info";
  code: "CHAINED_EDGE" | "DUPLICATE_NODE_ID" | "NODE_OUTSIDE_GROUP";
  message: string;
  line?: number;
  repairable: boolean;
}
```

The user should see gentle warnings, not a hostile compiler wall.

## Architecture Graph Validators

Once Mermaid compiles into `ArchitectureGraph`, run architecture-specific validators.

### Topology Validators

- Clients should not initiate backend-only actions.
- Gateways should route to services, not directly to databases or queues.
- Databases should not initiate request flow unless the edge is explicitly replication, CDC, or event emission.
- Queues should normally be connected with publish/consume semantics.
- Every non-group node should connect to the graph.
- No self-loops unless explicitly created by the user.
- Request and response edges should not be collapsed into one ambiguous edge.

### Layer Validators

- Client components belong in client/presentation layers.
- Gateways/load balancers belong in gateway/edge layers.
- Services belong in service/application layers.
- Databases, caches, object storage, and warehouses belong in data layers.
- Queues, streams, and brokers belong in async/messaging layers.
- Observability belongs in observability layers.

### Size Validators

- Small diagrams should stay small.
- Medium diagrams should include enough detail without becoming crowded.
- Large diagrams should be allowed to include secondary systems.
- Group nodes should not count toward component limits.

### Semantic Validators

- Component labels should map to known component types when possible.
- Edge labels should match source/target semantics.
- Duplicate concepts should be merged or warned about.
- Generic nodes like `Service` should be renamed when the prompt gives more specific intent.

## Deterministic Repair Passes

Prefer deterministic repair over another LLM call.

Examples:

- Missing group: infer group from component type.
- Node outside group: place it in inferred layer.
- Gateway connected to database: warn, and optionally insert or route through a service.
- Long edge label: compress with a deterministic dictionary.
- Duplicate node IDs: rename deterministically.
- Duplicate labels: merge or warn.
- Orphan node: connect only if there is an obvious semantic parent; otherwise warn.
- Wrong shape: fix from component ontology.
- Wrong icon: fix from component ontology.

Repairs should be tracked:

```ts
{
  type: "REPAIRED_LAYER";
  nodeId: "redis";
  before: "Service Layer";
  after: "Data Layer";
  reason: "Redis classified as cache/data component.";
}
```

This makes the app explainable.

## Component Ontology

The application should include a canonical component ontology.

Example:

```ts
{
  aliases: ["postgres", "postgresql", "user db", "sql database"],
  canonicalType: "database",
  layer: "data",
  shape: "cylinder",
  icon: "Database",
  defaultColorCategory: "data"
}
```

Useful ontology categories:

- client
- gateway
- service
- database
- cache
- queue
- stream
- object-storage
- search
- vector-db
- auth
- payment
- cdn
- observability
- external-service
- worker
- scheduler

This ontology lets low-power LLMs be inconsistent with names while the app remains consistent with rendering.

## Layout And Routing Ownership

The LLM should not decide final layout or handles.

The app should own:

- Dagre/ELK layout direction.
- Group sizing.
- Node collision handling.
- Edge lane assignment.
- Dynamic handle selection.
- Preview rendering.
- SVG/PNG export geometry.

The same routing logic should be reused by:

- Editor canvas.
- Dashboard preview.
- Shared viewer.
- Embed viewer.
- SVG export.
- PNG export.

If the editor and export use different routing logic, users will see one diagram and download another. That breaks trust.

## Editable Mermaid Sync

Keep two related artifacts:

```ts
rawMermaid: string;
compiledGraph: ArchitectureGraph;
reactFlowState: { nodes; edges };
```

The user edits `rawMermaid`.

The application compiles it into `compiledGraph`.

The canvas renders `reactFlowState`.

Do not automatically rewrite the user's Mermaid on every render. Instead:

- Preserve raw Mermaid when possible.
- Show warnings and suggested repairs.
- Offer explicit actions:
  - Format Mermaid
  - Repair Mermaid
  - Optimize Diagram
  - Normalize IDs
  - Apply Architecture Rules

This protects user agency.

## Quality Scoring

The score should come from application checks, not the model's self-assessment.

Score dimensions:

- Parse validity.
- Architecture topology.
- Layer correctness.
- Edge direction quality.
- Node completeness.
- Diagram size fit.
- Visual layout quality.
- Edge crossing/overlap count.
- Label clarity.
- Mermaid editability.

Example output:

```ts
{
  score: 86,
  grade: "B",
  issues: [
    "One orphan observability node.",
    "Gateway connects directly to Redis.",
    "Two edge labels are longer than recommended."
  ],
  repairs: [
    "Moved Redis from Service Layer to Data Layer.",
    "Normalized subgraph ID Client Layer -> CLIENT."
  ]
}
```

## Suggested New Pipeline

### Stage 1: Prompt Intake

Normalize the user's prompt.

Extract:

- requested diagram size
- requested orientation
- cloud provider preference
- explicit components
- explicit flows
- domain hints

### Stage 2: LLM Draft

Ask the LLM for Mermaid using the strict subset.

The prompt should say:

- Use only supported syntax.
- Do not chain edges.
- Use stable IDs.
- Keep all nodes in subgraphs.
- Keep edge labels short.
- Do not add components unless implied or standard for the pattern.

### Stage 3: Mermaid Lint

Run syntax and subset checks.

If the Mermaid has hard syntax errors, either:

- deterministically repair if obvious, or
- retry the LLM with the exact lint errors.

### Stage 4: Parse To Mermaid AST

Use the custom parser or Mermaid's parser as appropriate, but compile into a normalized AST owned by ArchDraw.

### Stage 5: Build ArchitectureGraph

Convert nodes, edges, and subgraphs into typed architecture entities.

Classify each component through the ontology.

### Stage 6: Validate

Run graph validators.

Split results into:

- hard errors
- warnings
- suggestions
- auto-repairable issues

### Stage 7: Repair

Apply deterministic repairs.

Record every repair.

### Stage 8: Layout

Run Dagre/ELK from the repaired graph.

Layout should know groups, node sizes, and expected flow direction.

### Stage 9: Route Edges

Use one shared routing engine for editor, preview, and export.

### Stage 10: Render

Convert graph/layout/routing output into React Flow nodes and edges.

### Stage 11: Score And Explain

Return:

- nodes
- edges
- raw Mermaid
- normalized Mermaid
- diagnostics
- repairs
- quality score

## Migration Plan

### Phase 1: Make Current Mermaid Safer

- Strengthen model prompt to use the strict Mermaid subset.
- Add Mermaid linter diagnostics.
- Fix parser gaps for generated Mermaid.
- Stop dropping parser warnings from pipeline diagnostics.
- Keep raw Mermaid and compiled output separate.

### Phase 2: Add ArchitectureGraph

- Define the internal graph types.
- Convert Mermaid AST into ArchitectureGraph.
- Move component classification into graph construction.
- Add ontology-backed node classification.
- Add graph validators.

### Phase 3: Add Deterministic Repairs

- Start with safe repairs:
  - node outside group
  - wrong shape
  - missing icon/category
  - duplicate IDs
  - reserved layer nodes
- Track repairs in diagnostics.
- Surface them in UI as non-blocking warnings.

### Phase 4: Make Routing Shared

- Extract a shared edge routing module.
- Use it in:
  - editor
  - dashboard preview
  - share viewer
  - embed viewer
  - SVG export
- Make stored handles either real source-of-truth or remove them from the mental model.

### Phase 5: Reduce LLM Responsibility

- Split LLM jobs into small tasks only where useful.
- Use deterministic templates for common architectures.
- Let the model customize a pattern instead of inventing the whole diagram.
- Add confidence metadata for inferred components and edges.

## What This Enables

### Better Low-Power LLM Performance

The model no longer needs to perfectly reason about architecture. It only needs to provide a draft that the app can compile.

### More Stable Diagrams

The same prompt should produce similar structure because deterministic validators and repairs reduce variance.

### Better User Editing

Users still edit Mermaid, but the app can explain problems and suggest repairs.

### Better Exports

Editor, preview, share, embed, SVG, and PNG can all use the same compiled graph and routing decisions.

### Better Debugging

When something goes wrong, diagnostics can say which stage failed:

- LLM draft
- Mermaid lint
- parse
- graph validation
- repair
- layout
- routing
- rendering

## Non-Goals

- Do not remove Mermaid.
- Do not make users edit JSON.
- Do not make the LLM perform more retries for every problem.
- Do not block users from intentionally creating unusual diagrams.
- Do not auto-rewrite user Mermaid without permission.

## Final Recommendation

Keep Mermaid as the editable source.

Add an ArchitectureGraph as the correctness layer.

Move architectural intelligence into deterministic application code:

- ontology
- validators
- repairs
- layout
- routing
- scoring

Then use the LLM as a draft generator, not as the final authority.

That is the path where ArchDraw remains simple for users, works with low-power LLMs, and still produces professional diagrams.
