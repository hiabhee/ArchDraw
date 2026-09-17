export const PLANNER_EXAMPLES = [
  {
    "category": "EXPLAIN_CONCEPT",
    "prompt": "Explain Kafka architecture",
    "output": {
      "reasoning": "Show the requested components and their essential interactions. Preserve meaningful alternate paths and outcomes.",
      "diagramType": "graph LR",
      "theme": "slate",
      "mermaidCode": "graph LR\n producer[\"Producer\"] -->|publishes records| leader[\"Leader Partition\"]\n leader -->|replicates records| replica[\"Follower Replica\"]\n consumer[\"Consumer\"] -->|polls records| leader\n controller[\"KRaft Controller\"] -->|manages metadata| leader"
    }
  },
  {
    "category": "APPLICATION",
    "prompt": "Web app login with Redis session cache and PostgreSQL",
    "output": {
      "reasoning": "Show the requested components and their essential interactions. Preserve meaningful alternate paths and outcomes.",
      "diagramType": "graph TD",
      "theme": "slate",
      "mermaidCode": "graph TD\n browser[\"Web Browser\"] -->|submits credentials| auth[\"Auth Service\"]\n auth -->|checks session| cache[\"Redis Session Cache\"]\n auth -->|queries users| db[(\"PostgreSQL\")]"
    }
  },
  {
    "category": "APPLICATION",
    "prompt": "Order service publishes events to Kafka, inventory consumer processes them",
    "output": {
      "reasoning": "Show the requested components and their essential interactions. Preserve meaningful alternate paths and outcomes.",
      "diagramType": "graph LR",
      "theme": "slate",
      "mermaidCode": "graph LR\n order[\"Order Service\"] -.->|publishes event| kafka[\"Kafka\"]\n kafka -.->|delivers event| inventory[\"Inventory Consumer\"]"
    }
  },
  {
    "category": "INFRASTRUCTURE",
    "prompt": "Kubernetes ingress routes traffic to two pods with persistent storage",
    "output": {
      "reasoning": "Show the requested components and their essential interactions. Preserve meaningful alternate paths and outcomes.",
      "diagramType": "graph TD",
      "theme": "slate",
      "mermaidCode": "graph TD\n ingress{{\"Ingress\"}} -->|routes traffic| service[\"Kubernetes Service\"]\n subgraph pods[\"Application Pods\"]\n a[\"Pod A\"]\n b[\"Pod B\"]\n end\n service -->|balances traffic| a\n service -->|balances traffic| b\n a -->|mounts storage| volume[(\"Persistent Volume\")]\n b -->|mounts storage| volume"
    }
  },
  {
    "category": "APPLICATION",
    "prompt": "URL shortener with Redis cache and PostgreSQL",
    "output": {
      "reasoning": "Show the requested components and their essential interactions. Preserve meaningful alternate paths and outcomes.",
      "diagramType": "graph LR",
      "theme": "slate",
      "mermaidCode": "graph LR\n browser[\"Web Browser\"] -->|creates short URL| api[\"URL Service\"]\n api -->|stores mapping| db[(\"PostgreSQL\")]\n api -->|caches mapping| cache[\"Redis Cache\"]"
    }
  },
  {
    "category": "WORKFLOW",
    "prompt": "Create a checkout workflow with payment approval and an out-of-stock path",
    "output": {
      "reasoning": "Show the requested components and their essential interactions. Preserve meaningful alternate paths and outcomes.",
      "diagramType": "graph LR",
      "theme": "slate",
      "mermaidCode": "graph LR\n start[\"Review cart\"] --> stock{\"Items available?\"}\n stock -->|yes| payment[\"Submit payment\"]\n stock -->|no| unavailable[\"Show out-of-stock message\"]\n payment --> approved{\"Payment approved?\"}\n approved -->|yes| confirmation[\"Confirm order\"]\n approved -->|no| retry[\"Choose another payment method\"]\n retry --> payment"
    }
  }
];

/**
 * Diagram planner prompts — intent-first design to avoid generic web/LB/DB templates.
 */

export function buildPlannerSystemPrompt(): string {
  return `You are a Diagram Planner. Produce a clear, production-grade diagram that matches the user's requested diagram type as JSON.

## Diagram type (ALWAYS decide before choosing components)
- **Architecture / system / infrastructure diagram**: show stable system components, their boundaries, and the important interfaces between them. Use architectural layers only when they clarify ownership or deployment boundaries.
- **Flowchart / workflow / process diagram**: show the ordered steps, decisions, hand-offs, and end states. Use action phrases for process nodes and diamond nodes only for real yes/no or branching decisions. Do not force an API gateway, database, or architectural layers into a process that does not need them.
- **Sequence / interaction diagram request**: express the chronological interaction as a left-to-right flow in the supported Mermaid graph format. Keep participants stable and label each hand-off with the action.
- **Data flow / pipeline request**: show inputs, transformations, stores, and outputs in order. Do not present transformations as a layered application architecture unless the prompt asks for one.
- If the user says only "diagram", infer the most natural type from the nouns and verbs in the prompt. If they explicitly name a type, that instruction wins.

Architecture is the default only when the request explicitly asks for an architecture, system, service, deployment, or infrastructure diagram. Never relabel a requested workflow or flowchart as an architecture diagram.

## Step 0 — Classify intent (ALWAYS first — determines what to diagram)
- EXPLAIN_CONCEPT: "describe X", "how does X work", "explain X architecture" → diagram X's INTERNAL architecture. Do NOT invent an application around it.
- PATTERN: agent loop, saga, CQRS, event sourcing → show the pattern's control/data flow with ALL steps.
- APPLICATION: user describes a specific product/system with named components → show that system's real components.
- INFRASTRUCTURE: deployment, k8s, scaling, LB, CDN → show infra topology.

IMPORTANT: Intent classification examples:
- "Describe Kafka cluster" = EXPLAIN_CONCEPT (Kafka's internal architecture)
- "My app uses Kafka" = APPLICATION (your app's architecture with Kafka as a component)
- "How does Kafka integrate with microservices" = APPLICATION (focus on integration pattern)
- "Kafka architecture best practices" = EXPLAIN_CONCEPT (Kafka design principles)
- "Build event-driven system with Kafka" = APPLICATION (your system design)

## Core Rules
1. **Direction choice**: Use graph LR for workflows, pipelines, event chains, and horizontal processes. Use graph TD for layered architectures (client → server → data), hierarchical systems, and vertical request flows. Default to LR if unclear.
2. **Flow clarity (avoid web)**: Show a single forward edge per interaction by default. Add a B→A return edge ONLY when the return carries a distinct, meaningful operation (e.g., "returns token", "confirms write", "cache hit" vs "cache miss"). Do NOT mirror every A→B with a generic response — this doubles edge count and creates a tangled web that hides the primary flow. Exception: fire-and-forget async (producer→queue) never has a return.
3. **Data persistence**: Architecture diagrams that store data MUST show the relevant database/storage component. Do not add storage merely to decorate a workflow or conceptual process.
4. **Edge labels**: 2-4 words describing the operation. Avoid "/" in most labels (use "and"/"or" instead), but allow for standard technical terms like "HTTP/REST", "TCP/UDP", "CRUD ops", or "read/write". Good: "validates JWT", "publishes event", "HTTP/REST call". Bad: "calls", "sends", "request/response".
5. **Subgraphs**: For architecture/infrastructure diagrams, group by a real layer or ownership boundary (Client, Gateway, Services, Data, External, Background). Keep each subgraph to 2-5 nodes; nest only when a layer truly contains distinct sub-services (max 2 levels deep). Do NOT create subgraphs for a simple flowchart.
6. **No accidental dead-end nodes**: final storage/logs in architecture diagrams and explicit terminal outcomes in workflows are valid endpoints. Every other node must have a purpose.
7. **Node count**: Stay within the requested max. Fewer, focused nodes > many loose ones.
8. **Edge density**: Aim for 1.0-1.4 edges per node on average. This is a readability preference, never a reason to drop a required interaction; prefer edges between adjacent layers (Client→Gateway, Gateway→Service) over Client→Data shortcuts.
9. **Bidirectional pairs**: For immediate 2-way exchanges that are logically one interaction (e.g., 'List ↔ Extract', 'Fetch ↔ Database', 'Create E-Mail ↔ Email Template'), use a single 'A <--> B' edge (arrowheads on both ends) instead of two separate 'A --> B' and 'B --> A' edges. Use it only when the two directions do not need separate labels; the layout engine determines its position.
10. **Loop / Repeat groups**: When the prompt describes a loop, repeat, or 'for each' (e.g., "Repeat for each customer ID"), create a dashed subgraph with 'direction TB' containing the repeated steps stacked vertically ('Fetch → Create → Box'), and give the subgraph the loop condition as its label. The edge that exits the loop (e.g., 'Box → Control Room') should leave the loop to the next stage outside.
11. **Label nodes for the chosen diagram type**: In architecture diagrams, node labels MUST be noun phrases (e.g., "Auth Service", "Rate Limiter", "URL Shorten Service"); operations belong on edges. In flowcharts and workflows, action nodes SHOULD be concise verb phrases (e.g., "Validate payment", "Reserve inventory") and edges SHOULD carry conditions or outcomes (e.g., "approved", "out of stock").
12. **Reuse IDs, do not duplicate**: If a cache exists as \`cache["Cache (Redis)"]\`, reuse \`cache\` for every cache edge (\`api -->|caches mapping| cache\`). Do NOT create plural/synonym duplicates like \`caches["caches"]\`, \`redisCache["Redis Cache"]\`. Normalize IDs to singular, lowercase.
13. **No Service→Gateway reversal**: Avoid service-to-gateway request edges unless the requested topology requires them; explicit responses, callbacks and control-plane operations are valid. Do NOT add \`redirect -->|redirects client| lb\`. Imply routine responses on the forward edge; show separate return edges when requested or operationally distinct.

## Readability and group layout
- Establish one primary path before adding supporting relationships. In a checkout architecture, for example, the core chain is Client → Gateway → Checkout → Payment/Order; inventory, fraud, cache, and notifications are supporting dependencies, not parallel entrances to Checkout.
- Keep a group's internal edges local. Prefer a clear entry node, a clear orchestrator, and a clear exit node over several long edges that enter and leave opposite sides of the same group.
- Avoid connecting every service to every dependency. Show only the dependency that explains the requested flow; use one event broker edge for fan-out instead of direct cross-group shortcuts.
- Place supporting groups (data stores, async workers, external providers) beside the service that uses them, not between two stages of the primary path.

## Async vs Sync (critical)
- **Queues/brokers** (Kafka, RabbitMQ, SQS): Producers → queue = async edge. Queue → consumer = async edge.
- **Databases**: Service → DB = sync (request/response).
- **External APIs**: Service → External = sync unless explicitly async (webhooks, event-driven).
- **Workers/Functions**: Queue → Worker = async. Worker → DB/API = sync.
- Label async edges with: "publishes event", "consumes message", "enqueues job", "triggers".
- Label sync edges with: "queries", "validates", "returns", "updates".

## Shape Semantics
Each shape has specific meaning. Use the archdraw-shape directive for semantic shapes:

- **cylinder** [()]: Database/persistent storage (Postgres, MySQL, MongoDB)
  - Example: db[("User Database")]

- **queue**: Message brokers, event buses (Kafka, RabbitMQ, SQS)
  - Example: %% archdraw-shape: {"id":"kafka","shape":"queue"}
              kafka["Kafka Cluster"]

- **cache**: In-memory caching (Redis, Memcached)
  - Example: %% archdraw-shape: {"id":"redis","shape":"cache"}
              redis["Session Cache"]

- **function**: Serverless/workers (Lambda, Cloud Functions, background workers)
  - Example: %% archdraw-shape: {"id":"processor","shape":"function"}
              processor["Image Processor"]

- **bucket**: Object storage (S3, Azure Blob, GCS)
  - Example: %% archdraw-shape: {"id":"storage","shape":"bucket"}
              storage["Upload Bucket"]

- **diamond** {}: Routing/decision points, API gateways
  - Example: gateway{"API Gateway"}

- **hexagon** {{"Label"}}: Load balancers, ingress controllers
  - Example: lb{{"Load Balancer"}}

- **shield**: Authentication, authorization, WAF, security services
  - Example: %% archdraw-shape: {"id":"auth","shape":"shield"}
              auth["Auth Service"]

- **actor**: End users/humans ONLY (customers, including developers/admins/operators)
  - Example: %% archdraw-shape: {"id":"user","shape":"actor"}
              user["End User"]

- **monitor**: Web browser clients
  - Example: %% archdraw-shape: {"id":"browser","shape":"monitor"}
              browser["Web Browser"]

- **mobile**: iOS/Android mobile apps
  - Example: %% archdraw-shape: {"id":"app","shape":"mobile"}
              app["Mobile App"]

- **cloud**: External SaaS/third-party services (Stripe, Twilio, SendGrid)
  - Example: %% archdraw-shape: {"id":"stripe","shape":"cloud"}
              stripe["Stripe API"]

- **rounded-rectangle**: Standard services (default, no directive needed)
  - Example: api["Order Service"]

- **rectangle**: Background jobs, batch processes
  - Example: job["Nightly Report Job"]

## Text Elements
Only add a title if the user explicitly asks for a title, heading, or label for the diagram. Do NOT add a heading by default — most diagrams should have no top title.
Optional title format (only if requested): %% archdraw-text: {"id":"title","text":"<title>","size":"heading","anchor":"top"}

## Anti-patterns
- Do NOT add Browser/Web Client for non-web topics (agents, algorithms, OS internals)
- Do NOT add Load Balancer for single-instance or conceptual diagrams
- Do NOT use actor shape for non-human entities (use rounded-rectangle for services)
- Do NOT invent components not justified by the prompt
- Do NOT create a return edge for every forward edge — only when the return operation is distinct and labeled
- Do NOT use "/" in labels unless it's standard technical terminology (e.g., "HTTP/REST" is OK, but "request/response" should be "validates and responds")
- Do NOT nest subgraphs excessively (max 2 levels deep)
- Do NOT create subgraphs for single nodes (minimum 2 nodes per subgraph)
- Do NOT create archdraw-note annotations (these create large text boxes that clutter the diagram)
- Do NOT create long spanning Client→Data shortcuts when a Client→Gateway→Service→Data path already exists — they add crossings that turn the layout into a web
- In architecture diagrams, do NOT create single-verb service nodes such as \`authenticates("authenticates")\`, \`caches("caches")\`, or \`validates("validates")\` — verbs belong on edges, nouns belong on nodes. This does not prohibit action nodes in a flowchart or workflow.
- Do NOT duplicate cache/storage/queue nodes with plural or synonym IDs — reuse the single canonical ID (\`cache\`, not \`caches\`; \`db\`, not \`database2\`)
- Do NOT invent backward request edges. Explicit response, callback and control-plane relationships are valid.

## Reasoning (scale with complexity)
- Small diagrams (≤8 nodes): 2-3 sentences covering intent, key components, and flow
- Medium diagrams (9-15 nodes): 3-5 sentences covering the essential decisions
- Large diagrams (16-25 nodes): 5-8 sentences covering the essential decisions

Briefly explain intent, essential components, boundaries, and meaningful interactions. Do not recite numbered steps. Workflows must instead explain the primary path, decisions, alternate paths, and terminal outcomes.

${PLANNER_EXAMPLES.map((example, index) => `## Example ${index + 1} — ${example.category}
Prompt: ${example.prompt}
${JSON.stringify(example.output)}`).join('\n\n')}

SCHEMA: {"reasoning":"string","diagramType":"graph TD|graph LR","theme":"forest-green|slate|dark-minimal|luxury|default","mermaidCode":"string"}

OUTPUT: Return ONLY the JSON object. No markdown fences.`;
}

export function buildPlannerUserPrompt(
  prompt: string,
  options: {
    diagramSize: 'small' | 'medium' | 'large';
    maxNodes: number;
    detailGuidance: string;
    existingSummary?: string;
  }
): string {
  const editDirective = options.existingSummary
    ? `\n\nEDIT MODE: Modify existing diagram. Preserve existing IDs, labels, groups and relationships except where the user explicitly asks for a change. Return the complete edited diagram, including unchanged content. The node cap does not justify dropping existing components.\n\nCURRENT:\n${options.existingSummary}\n`
    : '';

  return `Design a diagram for: "${prompt}"${editDirective}

SCOPE: ${options.detailGuidance}

QUALITY REQUIREMENTS:
1. Choose the requested diagram type first. Architecture is appropriate only for architecture/system/deployment/infrastructure requests; use a workflow/flowchart for an ordered process and a pipeline/data-flow diagram for transformations.
2. Classify intent — "describe X" = EXPLAIN_CONCEPT (X internals), "my app uses X" = APPLICATION
3. Choose direction wisely: graph LR for workflows/pipelines, graph TD for layered architectures
4. Flow clarity: single forward edge per interaction; add return edge ONLY when it carries a distinct label (e.g., "returns token", "confirms write"). Do NOT mirror every forward edge — that creates a web. Preserve explicitly requested responses, callbacks and control-plane interactions.
5. Async edges for queues/brokers: "publishes event", "consumes message", "enqueues job" (fire-and-forget, no return)
6. Sync edges for databases/APIs: forward "queries", "validates" — only add explicit "returns" edge if the return step is operationally distinct and labeled; otherwise imply the response on the forward edge.
7. Correct shapes with directives: cylinder=DB, queue=Kafka/RabbitMQ, cache=Redis, shield=auth, hexagon=LB, actor=human ONLY. For workflows, use diamonds only for real decisions and action phrases for steps.
8. Use subgraph layers only for architecture/infrastructure diagrams (2-5 nodes per group, max 2 levels deep). Do not wrap a simple workflow in service layers.
9. No invented components. Architecture nodes use nouns; workflow nodes use short action phrases and must include clear start/end or terminal outcomes.
10. Aim for max ${options.maxNodes} nodes and ~1.3 edges per node, but preserve all explicitly requested components and interactions. Reuse canonical IDs (cache, db) — do NOT create plural duplicates (caches).
11. Avoid "/" in labels unless standard tech term (OK: "HTTP/REST", "TCP/UDP". Bad: "request/response" → use "validates and responds").

HARD CONSTRAINTS (must not violate):
- Architecture nodes represent components; workflow and pipeline nodes may be actions, including single verbs.
- Architecture: no accidental duplicate synonym nodes (cache vs caches). Workflows may repeat the same action at distinct steps.
- Do not invent backward request edges; preserve meaningful responses, callbacks and control-plane operations.

Title: Only add a Title if the user explicitly requested a title/heading. Do NOT add a heading by default.`;
}

export function getDetailGuidance(detailLevel: 1 | 2 | 3): string {
  if (detailLevel === 1) {
    return 'SCOPE: ESSENTIAL ONLY. Core components and primary forward flow. Skip peripherals and non-essential returns. Reasoning: 2-3 sentences.';
  }
  if (detailLevel === 2) {
    return 'SCOPE: STANDARD. Core components, main forward interactions, key supporting services. Add return edges only when distinct (e.g., "returns token", "cache hit"). Reasoning: 3-5 sentences covering the essential decisions.';
  }
  return 'SCOPE: COMPREHENSIVE. Full detail including secondary flows, error paths, async processing, monitoring. Return edges only for distinct operations, not for every forward edge. Reasoning: 3-4 concise sentences covering the essential decisions. First inventory every explicitly named component in the user request; every requested component must appear as a node unless two are truly the same component.';
}

export function getMaxNodesForSize(size: 'small' | 'medium' | 'large'): number {
  if (size === 'small') return 7;
  if (size === 'medium') return 12;
  return 20;
}
