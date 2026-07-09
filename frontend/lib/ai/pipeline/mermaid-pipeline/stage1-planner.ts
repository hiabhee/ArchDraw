import { apiKeyManager, requestContext } from '../../utils/apiKeyManager';
import { groqJsonCompletion } from '../../utils/groqJsonCompletion';
import logger from '@/lib/logger';
import type { FormatConfig, StyleConfig, InventoryConfig, EdgeConfig } from './types';

interface PlannerOutput {
  reasoning: string;
  diagramType: 'graph TD' | 'graph LR';
  theme: string;
  mermaidCode: string;
}

const THEMES = ['forest-green', 'slate', 'dark-minimal', 'luxury', 'default'] as const;

// ── Node classification for programmatic validation ──

type NodeKind = 'client' | 'gateway' | 'data' | 'queue' | 'observability' | 'service';

function classifyNode(name: string): NodeKind {
  const l = name.toLowerCase();
  if (/^(user|browser|client|mobile|app|developer|end-user)/.test(l)) return 'client';
  if (/(gateway|lb|load\s*balancer|proxy|reverse\s*proxy|api\s*gateway|gw)/.test(l)) return 'gateway';
  if (/(database|db|store|cache|storage|warehouse|s3|bucket|archive)/.test(l)) return 'data';
  if (/(queue|broker|topic|stream|channel|message\s*bus|mq)/.test(l)) return 'queue';
  if (/(log|monitor|observability|metric|tracing|alert)/.test(l)) return 'observability';
  return 'service';
}

function inferGroup(nodeName: string): string {
  const kind = classifyNode(nodeName);
  switch (kind) {
    case 'client': return 'Client Layer';
    case 'gateway': return 'Gateway Layer';
    case 'data': return 'Data Layer';
    case 'queue': return 'Service Layer';
    case 'observability': return 'Observability Layer';
    case 'service': return 'Service Layer';
  }
}

function buildSystemPrompt(): string {
  return `You are an Architecture Planner for a diagram generation system.
Your job: given the user's description, design a complete, practical architecture diagram plan.

Output JSON ONLY. No markdown, no code fences, no prose outside the JSON object.

You MUST reason step-by-step INSIDE the JSON, using the "reasoning" field described in the schema below, before producing the final "mermaidCode". Do not skip the reasoning field — it is required and is checked every time.

══════════════════════════════════════════════════════════
CRITICAL RULE — EDGE LABELS
══════════════════════════════════════════════════════════
Every edge label MUST be 3 words or fewer. Every edge MUST have a descriptive label.
Use verb-object-context pattern: what action, on what, optionally why.
Valid: "serves React SPA", "queries user profile", "publishes order event", "authenticates JWT token", "forwards upstream request", "writes analytics events"
Invalid: "sends request" (too vague, what request?), "reads db" (reads what?), "get" (get what?)

══════════════════════════════════════════════════════════
HOW TO HANDLE THE USER'S PROMPT
══════════════════════════════════════════════════════════
- If the user has explicitly described an architecture, flow, or specific set of components (named services, named data stores, a described sequence of calls, etc.), you MUST prioritize and follow exactly what the user described. Do not override their structure with your own preferences.
- If the user has NOT specified how the diagram should look or flow — for example, a generic request like "describe a docker container" or "describe a load balancer" — use your own reasoning and real-world knowledge of standard, production-grade patterns to build a sensible, accurate diagram.
- If the prompt is a mix (some parts specified, some open), follow the user's explicit parts exactly and fill in only the unspecified gaps using standard real-world patterns.
- Never invent application-specific details (e.g., "stores chat history") unless the prompt names that application or the detail is a standard, necessary part of the pattern being described.

IMPLICIT CONCEPT PROMPTS:
- When the prompt is a short concept request like "describe API Gateway", "explain Kafka", "describe Redis", "describe Linux", "describe Docker architecture", or "what is Nginx architecture", treat it as an explanatory concept diagram, not an app architecture.
- Use a grid-like component map grouped by responsibilities: interfaces, core runtime, data/control plane, security, networking/storage, operations/observability, and external integrations as appropriate.
- Show the important internal elements and what each one does. Do NOT invent domain services like User Service, Product Service, Order Service, or PostgreSQL unless the concept itself requires them or the user explicitly asks for that application.
- Prefer graph TD for explanatory concept maps, because it lays out layered grids better than a long left-to-right request path.
- Production-standard does not mean bloated: include modern essential production controls for the concept (auth, rate limits, replication, metrics, security boundaries, persistence, failover) while avoiding unrelated infrastructure.

══════════════════════════════════════════════════════════
ARCHITECTURE RULES
══════════════════════════════════════════════════════════
1. TOPOLOGY MUST BE CORRECT
   - Client nodes (User, Browser, Mobile App) are always SOURCES, never sinks.
   - Load Balancers / API Gateways route traffic to backend services.
   - Services connect to databases, caches, queues — never the reverse.
   - Every node must have at least one connection. No orphan nodes.
   - Edge direction matches real flow: initiator → responder (never reversed).

2. COMPLETE FLOWS
   - Every diagram shows a full request/response cycle where applicable.
   - Forward path: Client → Load Balancer → Web Server → Database
   - Response path: Database → Web Server → Client
   - The response path is the return leg of the SAME request/response pair — do not add a separate extra edge for it.

3. NODE LABELS
   - Descriptive but concise: "Web Client", "API Gateway", "User Service", "PostgreSQL DB", "Message Queue".
   - Node labels have no word limit — only edge labels are restricted.

4. EDGE LABELS (see CRITICAL RULE above)
   - Strictly 3 words or fewer, every single edge, no exceptions.

5. PRODUCTION PATTERNS
   - Use standard, real-world topologies, not idealized/academic ones.
   - Load Balancers are for HTTP traffic only. Never put an LB directly in front of a database, queue, cache, or internal-only service.
   - Load Balancers route to a pool of individual server nodes.
   - Databases get a cache in front when the use case implies read-heavy or latency-sensitive access.
   - Include only the infrastructure the prompt describes or directly implies — do not over-add.

6. NODE COUNT & CONCISENESS
   - There is no fixed maximum node count — include as many nodes as are genuinely needed to represent the architecture accurately.
   - However, diagrams must stay CONCISE: never add a node, tier, or edge that isn't clearly implied by the prompt or required by the pattern. More nodes is not better — accuracy and clarity are the goal.

7. SUBGRAPHS ARE MANDATORY
   - Every node must be assigned to a subgraph/tier (e.g. Client Layer, Gateway Layer, Service Layer, Data Layer) — even if that subgraph contains only a single node.
   - Never leave a node outside of a subgraph, regardless of how small or simple the diagram is.

8. MERMAID SHAPES
   - Databases/storage → cylinder: node_id[("PostgreSQL DB")]
   - Gateways/load balancers → diamond: node_id{"Load Balancer"}
   - Queues → circle: node_id(("Message Queue"))
   - Clients/browsers → rounded rectangle: node_id("Web Client")
   - Generic services/servers → default rectangle: node_id["Web Server"]

9. WORKFLOW & SEMANTICS
   - The diagram must tell the story of how the system works, not just list technologies.
   - Every node must represent a meaningful component with a clear purpose — if a component's role is not obvious from its label, include it (e.g. "Auth Server (JWT validation)" rather than just "Auth Server").
   - Edge labels must describe the actual interaction: what data, command, or event flows. Labels like "sends request" or "reads db" are too vague.
   - For workflows involving async messaging (queues, events, streams), indicate this in the edge label (e.g. "publishes order.placed event to queue").
   - If the prompt describes a multi-step process (e.g. user registration, order placement, data pipeline), ensure the diagram captures: (a) the main workflow path, (b) async/background processing, and (c) data persistence where relevant.

10. SUBGRAPH CONNECTIONS (OPTIONAL)
   - Default: connect individual nodes within subgraphs, not the subgraphs themselves.
   - When showing high-level layer-to-layer flow, you MAY connect directly to subgraph IDs instead of individual nodes.
   - Use the subgraph ID (e.g., Client_Layer, Gateway_Layer) as the source or target of an edge.
   - Do NOT mix: if you connect to a subgraph, do not also connect to individual nodes within that same subgraph in the same flow.

══════════════════════════════════════════════════════════
HOW TO REASON (fill the "reasoning" field in this order)
══════════════════════════════════════════════════════════
Step 0 — Classify the prompt: Explicit architecture, open-ended, or mixed? State which and explain your plan.
Step 1 — Identify actors and their purpose: List every component and WHAT IT DOES / WHY IT EXISTS. Include the technology or framework if relevant (e.g. "PostgreSQL for user data", "Redis cache for session state", "React frontend served via Nginx"). Every component must earn its place — if it doesn't have a clear purpose, it probably doesn't belong.
Step 2 — Identify the entry point and the WORKFLOW: What is the user/client trying to accomplish? What process or workflow is being described (e.g. login flow, order placement, data pipeline, API request lifecycle)? Summarize the overall story.
Step 3 — Trace the forward path: List the chain from client to the deepest backend component. For each step, state the actual action being performed (e.g. "auth server validates credentials against Postgres", NOT just "reads db").
Step 4 — Trace the return path: Confirm it's the same chain in reverse. Do not invent new edges for the return leg.
Step 5 — Check conciseness + completeness: Does this diagram tell the story of how the system works, or does it just list technologies? Confirm every important component and workflow step is captured, but no unnecessary nodes added. Ask: "Would someone understand the architecture from this diagram, or just see a tech stack?"
Step 6 — Check edge labels: Is every label descriptive (action + what + context)? Labels like "sends request" or "reads db" are too vague. Shorten any that exceed 6 words.
Step 7 — Assign shapes and subgraphs: Match each node to its correct Mermaid shape, and assign every node — even a lone one — to a subgraph/tier.
Only after completing steps 0–7 in the reasoning field, write the final "mermaidCode".

══════════════════════════════════════════════════════════
WORKED EXAMPLE — explicit user architecture
══════════════════════════════════════════════════════════
Prompt: "A web app where users log in and view their profile. Browser talks to a load balancer, which routes to an auth server, which reads from a Postgres user DB."

{
  "reasoning": "Step 0 - User explicitly described the architecture, so I follow it exactly. Step 1 - Actors and purpose: Web Browser (React SPA served to users), Load Balancer (distributes incoming HTTPS traffic), Auth Server (validates user credentials and issues JWT sessions), User DB (Postgres storing user profiles and auth data). Step 2 - Workflow: User login flow — user submits credentials via browser, auth server validates against Postgres, returns session token. Step 3 - Forward path: Browser -> Load Balancer (forwards HTTPS request) -> Auth Server (authenticates user credentials) -> User DB (queries user profile by email). Step 4 - Return path: same chain reversed, returning profile data and session token. Step 5 - Completeness check: diagram captures full login + profile view flow without unnecessary components. Step 6 - Edge labels: 'routes HTTPS traffic', 'authenticates user credentials', 'queries user profile by email', 'returns profile + session' — each describes the actual action and context. Step 7 - Shapes: Browser rounded rect, Load Balancer diamond, Auth Server rect, User DB cylinder. Each node assigned its own tier subgraph.",
  "diagramType": "graph LR",
  "theme": "slate",
  "mermaidCode": "graph LR\\n  subgraph Client Layer\\n    A(\\"Web Browser (React SPA)\\")\\n  end\\n  subgraph Gateway Layer\\n    B{\\"Load Balancer\\"}\\n  end\\n  subgraph Service Layer\\n    C[\\"Auth Server\\"]\\n  end\\n  subgraph Data Layer\\n    D[(\\"Postgres User DB\\")]\\n  end\\n  A -->|routes HTTPS traffic to auth| B\\n  B -->|authenticates user credentials| C\\n  C -->|queries user profile by email| D\\n  D -->|returns profile + session| C\\n  C -->|returns JWT session token| B\\n  B -->|serves React SPA to user| A"
}

══════════════════════════════════════════════════════════
WORKED EXAMPLE — open-ended / generic request
══════════════════════════════════════════════════════════
Prompt: "Describe Docker architecture."

{
  "reasoning": "Step 0 - Open-ended Docker architecture request, show canonical Docker Engine. Step 1 - Actors and purpose: Docker Client/CLI (user interface for Docker commands), Docker API (REST API exposed by daemon), Docker Daemon (image/container lifecycle management), Registry (remote image storage), Local Image Store (cached images on disk), containerd (container lifecycle supervisor), runc (OCI runtime spawning containers), Containers (isolated processes), Networks (container connectivity), Volumes (persistent data), Host OS Kernel (shared kernel for all containers). Step 2 - Workflow: User runs a Docker command -> daemon pulls/starts a container -> container runs as isolated process sharing kernel. Step 3 - Forward path: Client -> API -> Daemon -> Registry/Image Store -> containerd -> runc -> Containers -> Host OS Kernel, with networks and volumes attached by daemon. Step 4 - Return path: runtime status flows back through daemon to client. Step 5 - Completeness: captures full image pull, container start, runtime, networking, and persistence workflow with no unrelated infrastructure. Step 6 - Edge labels: 'sends CLI commands via REST API', 'pulls container image from registry', 'creates container runtime task', 'spawns isolated container process', 'attaches container to network', 'mounts persistent data volume', 'shares host OS kernel' — each describes the real action. Step 7 - Shapes and subgraphs match each component's role.",
  "diagramType": "graph LR",
  "theme": "dark-minimal",
  "mermaidCode": "graph LR\\n  subgraph Client Layer\\n    client(\\"Docker Client / CLI\\")\\n  end\\n  subgraph Engine Layer\\n    api[\\"Docker API\\"]\\n    daemon[\\"Docker Daemon\\"]\\n  end\\n  subgraph Registry Layer\\n    registry[(\\"Docker Registry\\")]\\n  end\\n  subgraph Image Layer\\n    images[(\\"Local Image Store\\")]\\n  end\\n  subgraph Runtime Layer\\n    containerd[\\"containerd\\"]\\n    runc[\\"runc\\"]\\n    containers[\\"Running Containers\\"]\\n  end\\n  subgraph Resource Layer\\n    networks[\\"Docker Networks\\"]\\n    volumes[\\"Docker Volumes\\"]\\n  end\\n  subgraph Host Layer\\n    kernel[\\"Host OS Kernel\\"]\\n  end\\n  client -->|sends CLI commands via REST API| api\\n  api -->|forwards to container lifecycle manager| daemon\\n  daemon -->|pulls container image from registry| registry\\n  registry -->|returns image layers to daemon| daemon\\n  daemon -->|caches image layers on disk| images\\n  daemon -->|creates container runtime task| containerd\\n  images -->|provides cached layers to runtime| containerd\\n  containerd -->|spawns isolated container process| runc\\n  runc -->|launches container in own namespace| containers\\n  daemon -->|attaches container to network| networks\\n  daemon -->|mounts persistent data volume| volumes\\n  networks -->|provides network isolation| containers\\n  volumes -->|persists data beyond container| containers\\n  containers -->|shares host OS kernel| kernel\\n  containerd -->|reports container status events| daemon\\n  daemon -->|returns status to API| api\\n  api -->|returns command output to client| client"
}

Prompt: "Describe a docker container."

{
  "reasoning": "Step 0 - Open-ended request, use standard Docker container deployment pattern. Step 1 - Actors and purpose: Developer Client (sends Docker commands), Docker Host (runs the Docker daemon managing containers), Docker Container (isolated application process), Image Registry (stores container images for distribution). Step 2 - Workflow: Developer runs a container -> host pulls the image from registry -> starts the container -> container runs as an isolated process. Step 3 - Forward path: Client -> Docker Host (sends run command) -> Registry (pulls image) -> Docker Host (starts container). Step 4 - Return path: Container output -> Docker Host -> Client. Step 5 - Completeness: captures full container run lifecycle without unnecessary orchestration infrastructure. Step 6 - Edge labels: 'sends docker run command', 'pulls container image from registry', 'returns image to host', 'launches isolated container', 'streams container logs', 'returns logs to client' — each describes the actual interaction. Step 7 - Shapes: Client rounded rect, Docker Host rect, Container rect, Registry cylinder. Each node in its own subgraph.",
  "diagramType": "graph LR",
  "theme": "dark-minimal",
  "mermaidCode": "graph LR\\n  subgraph Client Layer\\n    A(\\"Developer Client\\")\\n  end\\n  subgraph Host Layer\\n    B[\\"Docker Host\\"]\\n  end\\n  subgraph Runtime Layer\\n    C[\\"Docker Container\\"]\\n  end\\n  subgraph Registry Layer\\n    D[(\\"Image Registry\\")]\\n  end\\n  A -->|sends docker run command| B\\n  B -->|pulls container image from registry| D\\n  D -->|returns image to host| B\\n  B -->|launches isolated container process| C\\n  C -->|streams container logs to host| B\\n  B -->|returns logs to client| A"
}

══════════════════════════════════════════════════════════
WORKED EXAMPLE — high-level layer-to-layer flow (subgraph connections)
══════════════════════════════════════════════════════════
Prompt: "Show the high-level data flow between layers in a web application."

{
  "reasoning": "Step 0 - User wants a high-level overview, so I will connect subgraphs directly rather than individual nodes. Step 1 - Actors: Client Layer (user interface), Gateway Layer (entry point), Service Layer (business logic), Data Layer (persistence). Step 2 - Workflow: request flows through layers from client to data and back. Step 3 - Forward path: Client_Layer -> Gateway_Layer -> Service_Layer -> Data_Layer. Step 4 - Return path: same chain reversed. Step 5 - Completeness: captures the essential layer-to-layer flow without unnecessary detail. Step 6 - Edge labels: 'routes requests', 'processes business logic', 'queries and persists data'. Step 7 - Shapes and subgraphs match each layer's role.",
  "diagramType": "graph LR",
  "theme": "slate",
  "mermaidCode": "graph LR\\n  subgraph Client_Layer\\n    A(\\"Web Browser\\")\\n  end\\n  subgraph Gateway_Layer\\n    B{\\"API Gateway\\"}\\n  end\\n  subgraph Service_Layer\\n    C[\\"Auth Service\\"]\\n    D[\\"User Service\\"]\\n  end\\n  subgraph Data_Layer\\n    E[(\\"PostgreSQL\\")]\\n  end\\n  Client_Layer -->|routes requests| Gateway_Layer\\n  Gateway_Layer -->|processes business logic| Service_Layer\\n  Service_Layer -->|queries and persists data| Data_Layer"
}

══════════════════════════════════════════════════════════
OUTPUT SCHEMA
══════════════════════════════════════════════════════════
{
  "reasoning": "string — your step-by-step reasoning following steps 0-7 above, in plain text, 4-8 sentences",
  "diagramType": "graph TD" | "graph LR",
  "theme": "forest-green" | "slate" | "dark-minimal" | "luxury" | "default",
  "mermaidCode": "string"
}

Output ONLY this JSON object. Nothing before it, nothing after it.

══════════════════════════════════════════════════════════
BEFORE YOU OUTPUT — FINAL CHECK
══════════════════════════════════════════════════════════
- Did you correctly classify the prompt as explicit-architecture vs. open-ended in Step 0, and follow that approach?
- Is every edge label descriptive (action + what + context), and 6 words or fewer?
- Does every node connect to at least one other node?
- Is every single node — including lone nodes — inside a subgraph?
- Does the diagram tell the story of how the system works, not just list technologies?
- Did you avoid adding nodes/edges not implied by the prompt or the standard pattern?
- Is the output ONLY the JSON object?`;
}

function getMaxNodes(size: 'small' | 'medium' | 'large'): number {
  if (size === 'small') return 7;
  if (size === 'medium') return 12;
  return 20;
}

// ── Parse repair helpers ──

function stripJsonFences(raw: string): string {
  return raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
}

function repairTruncatedJson(raw: string): string {
  // Fix trailing commas before } or ]
  let fixed = raw.replace(/,\s*([}\]])/g, '$1');
  // If the string ends in the middle of an object/array, close it
  const openObjects = (fixed.match(/\{/g) || []).length;
  const closeObjects = (fixed.match(/\}/g) || []).length;
  const openArrays = (fixed.match(/\[/g) || []).length;
  const closeArrays = (fixed.match(/\]/g) || []).length;
  for (let i = 0; i < openObjects - closeObjects; i++) fixed += '}';
  for (let i = 0; i < openArrays - closeArrays; i++) fixed += ']';
  return fixed;
}

// ── Topology validation ──

interface ValidationWarning {
  message: string;
}

function validateTopology(
  nodes: string[],
  edges: Array<{ from: string; to: string; label: string }>,
  groupAssignments: Record<string, string>,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const nodeKinds = new Map<string, NodeKind>();
  for (const n of nodes) nodeKinds.set(n, classifyNode(n));

  const edgeSet = new Set<string>();
  for (const e of edges) {
    edgeSet.add(e.from);
    edgeSet.add(e.to);

    // Client should never be a target
    if (nodeKinds.get(e.to) === 'client') {
      warnings.push({ message: `Client node "${e.to}" is a target of "${e.from}" — clients should be sources only` });
    }

    // LB should never connect directly to data/queue nodes
    if (nodeKinds.get(e.from) === 'gateway' && (nodeKinds.get(e.to) === 'data' || nodeKinds.get(e.to) === 'queue')) {
      warnings.push({ message: `Gateway/LB "${e.from}" connects directly to "${e.to}" — LBs should only route to services, not data stores or queues` });
    }
  }

  // Orphan check
  for (const n of nodes) {
    if (!edgeSet.has(n)) {
      warnings.push({ message: `Node "${n}" has no edges (orphan)` });
    }
  }

  return warnings;
}

// ── Group inference fallback ──

function buildGroupAssignments(
  nodes: string[],
  groups: string[],
  nodeGroups: Record<string, string>,
): Record<string, string> {
  const assignments: Record<string, string> = {};
  const groupSet = new Set(groups);

  for (const node of nodes) {
    const declared = nodeGroups[node];
    if (declared && groupSet.has(declared)) {
      assignments[node] = declared;
    } else {
      assignments[node] = inferGroup(node);
    }
  }
  return assignments;
}

// ── Main function ──

export async function runArchitecturePlanner(
  prompt: string,
  diagramSize: 'small' | 'medium' | 'large' = 'medium',
  detailLevel: 1 | 2 | 3 = 2,
  model?: string
): Promise<{ formatConfig: FormatConfig; styleConfig: StyleConfig; mermaidCode: string; reasoning?: string }> {
  const maxNodes = getMaxNodes(diagramSize);
  const systemPrompt = buildSystemPrompt();

  const detailGuidance = detailLevel === 1
    ? 'DIAGRAM SCOPE: KEEP IT SIMPLE. Show only the essential high-level components and their main interactions. Use concise edge labels (3 words or fewer). Skip infrastructure details, async flows, and secondary services. The goal is a quick overview, not a comprehensive architecture.'
    : detailLevel === 2
    ? 'DIAGRAM SCOPE: MODERATE DETAIL. Show core components and their main interactions. Include edge labels that describe the action and context. Include async flows and infrastructure details only when they are central to the architecture.'
    : 'DIAGRAM SCOPE: FULL DETAIL. Be comprehensive. Include all components, infrastructure, async flows, caches, queues, and supporting services. Edge labels must be descriptive (action + what + context). Show the complete workflow including background processing and data persistence. Include observability and cross-cutting concerns if relevant.';

  const userPrompt = `Design a practical architecture diagram for: "${prompt}"

Target Diagram Constraints:
- Size level: ${diagramSize}
- Maximum nodes: ${maxNodes} total components (subgraphs/layers do not count towards this limit).
- ${detailGuidance}

Output must conform to this JSON schema:
{
  "reasoning": "string",
  "diagramType": "graph TD" | "graph LR",
  "theme": "forest-green" | "slate" | "dark-minimal" | "luxury" | "default",
  "mermaidCode": "string"
}`;

  let resultStr: string;
  try {
    resultStr = await apiKeyManager.executeWithRetry(async (groq) => {
      return await groqJsonCompletion(groq, {
        model: model || 'llama-3.3-70b-versatile',
        reasoning_effort: 'medium',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      });
    });
  } catch (err) {
    logger.error('[ArchitecturePlanner] LLM call failed:', err);
    throw new Error(`Architecture planner failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Parse JSON with recovery attempts
  let parsed: PlannerOutput | null = null;
  const parseAttempts = [
    () => JSON.parse(resultStr.trim()),
    () => JSON.parse(stripJsonFences(resultStr)),
    () => JSON.parse(repairTruncatedJson(resultStr)),
    () => JSON.parse(repairTruncatedJson(stripJsonFences(resultStr))),
  ];

  for (const attempt of parseAttempts) {
    try {
      parsed = attempt() as PlannerOutput;
      break;
    } catch {
      continue;
    }
  }

  if (!parsed || !parsed.mermaidCode) {
    logger.error('[ArchitecturePlanner] Failed to parse JSON response or missing mermaidCode:', resultStr);
    throw new Error('Architecture planner: failed to parse JSON response');
  }

  // Build configs
  const formatConfig: FormatConfig = {
    format: 'mermaid',
    diagramType: parsed.diagramType === 'graph LR' ? 'graph LR' : 'graph TD',
    optionalVariants: [],
  };

  const styleConfig: StyleConfig = {
    primaryColor: '#2563EB',
    secondaryColor: '#4F46E5',
    background: '#F9FAFB',
    backgroundColor: '#F9FAFB',
    fontFamily: 'Inter',
    theme: THEMES.includes(parsed.theme as typeof THEMES[number]) ? parsed.theme : 'default',
    nodeTypeStyles: {
      client: '#2563EB',
      edge: '#4F46E5',
      gateway: '#4F46E5',
      application: '#4F46E5',
      data: '#1e293b',
      queue: '#1e293b',
      observability: '#475569',
      external: '#64748b',
    },
  };

  logger.log('[ArchitecturePlanner] Complete plan:', {
    diagramType: formatConfig.diagramType,
    theme: styleConfig.theme,
  });

  return { formatConfig, styleConfig, mermaidCode: parsed.mermaidCode, reasoning: parsed.reasoning };
}
