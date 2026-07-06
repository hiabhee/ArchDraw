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
Every edge label MUST be 3 words or fewer. No exceptions.
Valid: "sends request", "reads from db", "publishes event", "auth check", "get"
Invalid: "sends a request to the server", "asynchronously publishes event to queue" — these are TOO LONG.

══════════════════════════════════════════════════════════
HOW TO HANDLE THE USER'S PROMPT
══════════════════════════════════════════════════════════
- If the user has explicitly described an architecture, flow, or specific set of components (named services, named data stores, a described sequence of calls, etc.), you MUST prioritize and follow exactly what the user described. Do not override their structure with your own preferences.
- If the user has NOT specified how the diagram should look or flow — for example, a generic request like "describe a docker container" or "describe a load balancer" — use your own reasoning and real-world knowledge of standard, production-grade patterns to build a sensible, accurate diagram.
- If the prompt is a mix (some parts specified, some open), follow the user's explicit parts exactly and fill in only the unspecified gaps using standard real-world patterns.
- Never invent application-specific details (e.g., "stores chat history") unless the prompt names that application or the detail is a standard, necessary part of the pattern being described.

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

══════════════════════════════════════════════════════════
HOW TO REASON (fill the "reasoning" field in this order)
══════════════════════════════════════════════════════════
Step 0 — Classify the prompt: Did the user explicitly describe the architecture/flow, or is this a generic/open-ended request? State which, and explain your plan accordingly.
Step 1 — Identify actors: List every client, service, and data store implied or stated.
Step 2 — Identify the entry point: What does the client talk to first?
Step 3 — Trace the forward path: List the chain from client to the deepest backend component.
Step 4 — Trace the return path: Confirm it's the same chain in reverse. Do not invent new edges for the return leg.
Step 5 — Check conciseness: Confirm no node, edge, or tier was added that isn't implied by the prompt or the standard pattern.
Step 6 — Check edge labels: Confirm every label is 3 words or fewer. Shorten any that aren't.
Step 7 — Assign shapes and subgraphs: Match each node to its correct Mermaid shape, and assign every node — even a lone one — to a subgraph/tier.
Only after completing steps 0–7 in the reasoning field, write the final "mermaidCode".

══════════════════════════════════════════════════════════
WORKED EXAMPLE — explicit user architecture
══════════════════════════════════════════════════════════
Prompt: "A web app where users log in and view their profile. Browser talks to a load balancer, which routes to an auth server, which reads from a Postgres user DB."

{
  "reasoning": "Step 0 - User explicitly described the architecture and flow, so I follow it exactly. Step 1 - Actors: Web Browser, Load Balancer, Auth Server, User DB. Step 2 - Entry point: Load Balancer, as stated. Step 3 - Forward path: Browser -> Load Balancer -> Auth Server -> User DB. Step 4 - Return path: User DB -> Auth Server -> Load Balancer -> Browser, same chain reversed. Step 5 - Conciseness check: no extra nodes added beyond what was described. Step 6 - Edge labels: 'sends request', 'auth check', 'reads db', 'sends response' - all 3 words or fewer. Step 7 - Shapes: Browser rounded rect, Load Balancer diamond, Auth Server rect, User DB cylinder. Each node assigned its own tier: Client Layer, Gateway Layer, Service Layer, Data Layer.",
  "diagramType": "graph LR",
  "theme": "slate",
  "mermaidCode": "graph LR\\n  subgraph Client Layer\\n    A(\\"Web Browser\\")\\n  end\\n  subgraph Gateway Layer\\n    B{\\"Load Balancer\\"}\\n  end\\n  subgraph Service Layer\\n    C[\\"Auth Server\\"]\\n  end\\n  subgraph Data Layer\\n    D[(\\"User DB\\")]\\n  end\\n  A -->|sends request| B\\n  B -->|auth check| C\\n  C -->|reads db| D\\n  D -->|sends response| C\\n  C -->|sends response| B\\n  B -->|sends response| A"
}

══════════════════════════════════════════════════════════
WORKED EXAMPLE — open-ended / generic request
══════════════════════════════════════════════════════════
Prompt: "Describe a docker container."

{
  "reasoning": "Step 0 - This is a generic, open-ended request with no user-specified flow, so I use standard real-world knowledge of how a Docker container fits into a deployment. Step 1 - Actors: Developer/Client, Docker Host, Docker Container, Container Image Registry. Step 2 - Entry point: Client interacting with the Docker Host. Step 3 - Forward path: Client -> Docker Host -> Docker Container, with the container pulling from the Image Registry. Step 4 - Return path: Container -> Docker Host -> Client for status/output. Step 5 - Conciseness check: kept to only the essential components of a container's runtime relationship, no unrelated infrastructure added. Step 6 - Edge labels: 'runs command', 'pulls image', 'returns output' - all 3 words or fewer. Step 7 - Shapes: Client rounded rect, Docker Host rect, Container rect, Registry cylinder. Even the single Client node gets its own Client Layer subgraph.",
  "diagramType": "graph LR",
  "theme": "dark-minimal",
  "mermaidCode": "graph LR\\n  subgraph Client Layer\\n    A(\\"Developer Client\\")\\n  end\\n  subgraph Host Layer\\n    B[\\"Docker Host\\"]\\n  end\\n  subgraph Runtime Layer\\n    C[\\"Docker Container\\"]\\n  end\\n  subgraph Registry Layer\\n    D[(\\"Image Registry\\")]\\n  end\\n  A -->|runs command| B\\n  B -->|pulls image| D\\n  D -->|returns image| B\\n  B -->|starts container| C\\n  C -->|returns output| B\\n  B -->|returns output| A"
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
- Is every edge label 3 words or fewer?
- Does every node connect to at least one other node?
- Is every single node — including lone nodes — inside a subgraph?
- Did you avoid adding nodes/edges not implied by the prompt or the standard pattern?
- Is the output ONLY the JSON object?`;
}

function getMaxNodes(size: 'small' | 'medium' | 'large'): number {
  if (size === 'small') return 7;
  if (size === 'medium') return 12;
  return 15;
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
  model?: string
): Promise<{ formatConfig: FormatConfig; styleConfig: StyleConfig; mermaidCode: string; reasoning?: string }> {
  const maxNodes = getMaxNodes(diagramSize);
  const systemPrompt = buildSystemPrompt();

  const userPrompt = `Design a practical architecture diagram for: "${prompt}"

Target Diagram Constraints:
- Size level: ${diagramSize}
- Maximum nodes: ${maxNodes} total components (subgraphs/layers do not count towards this limit).

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
