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
  return `You are an Architecture Planner for a diagram generation system. Given a user's description, design a practical architecture diagram plan.

Let's think step by step before producing the final JSON output.

RULES:
1. EDGE LABELS: Every edge MUST have a label. Strictly 2 words or fewer. Use verb-object: "serves pages", "queries users", "publishes events". Invalid: "sends HTTP request to the auth server", "reads from the database".
2. TOPOLOGY: Clients are SOURCES only (never sinks). LB/Gateway -> services -> DB/cache/queue. Never reverse. No orphan nodes. Direction = real flow.
3. FLOWS: Show full request/response cycle. Return path = same chain reversed (no extra edge).
4. SUBGRAPHS: Every node must be in a subgraph/tier (Client Layer, Gateway Layer, Service Layer, Data Layer).
5. SHAPES: DB=cylinder id[("PostgreSQL")], Gateway=diamond id{"API Gateway"}, Queue=circle id(("Message Queue")), Client=rounded rect id("Web Client"), Service=rect id["User Service"].
6. PATTERNS: LBs for HTTP only (not in front of DB/queue). Caches in front of read-heavy DBs. Only include infrastructure implied by the prompt.
7. CONCEPT PROMPTS: For open-ended requests like "describe API Gateway" or "explain Kafka", show internal components grouped by responsibility, prefer graph LR. Never invent domain services unless the concept requires them.
8. SEMANTICS: Diagram tells how system WORKS, not just tech list. Async flows indicated in labels.

REASONING FIELD (fill this step-by-step before writing mermaidCode):
Step 0 — Classify: Is this explicit architecture (user named specific components), open-ended concept, or mixed?
Step 1 — List every actor/component and its purpose. Each must earn its place.
Step 2 — Identify the workflow: what is the user trying to accomplish?
Step 3 — Trace forward path: client -> deepest component. State the action at each step.
Step 4 — Trace return path: same chain reversed.
Step 5 — Check: tells the story? No unnecessary nodes?
Step 6 — Edge labels: all ≤2 words, descriptive (action + object)?
Step 7 — Assign shapes and subgraphs.

EXAMPLES:

1) User describes explicit architecture:
Prompt: "A web app where users log in and view their profile. Browser talks to a load balancer, which routes to an auth server, which reads from a Postgres user DB."
Output:
{"reasoning":"Step 0 - Explicit architecture, follow exactly. Step 1 - Browser (React SPA), Load Balancer (distributes HTTPS), Auth Server (validates credentials, issues JWT), User DB (Postgres for profiles/auth). Step 2 - Login flow: user submits credentials, auth server validates, returns session. Step 3 - Browser->LB(forwards HTTPS)->Auth(authenticates credentials)->DB(queries profile). Step 4 - Return: profile + session token back up chain. Step 5 - Complete login flow, no extra nodes. Step 6 - Labels: 'routes HTTPS traffic', 'authenticates user credentials', 'queries user profile by email', 'returns profile + session'. Step 7 - Browser rounded rect, LB diamond, Auth rect, User DB cylinder. Each in own subgraph.","diagramType":"graph LR","theme":"slate","mermaidCode":"graph LR\\n  subgraph Client_Layer\\n    A(\\"Web Browser (React SPA)\\")\\n  end\\n  subgraph Gateway_Layer\\n    B{\\"Load Balancer\\"}\\n  end\\n  subgraph Service_Layer\\n    C[\\"Auth Server\\"]\\n  end\\n  subgraph Data_Layer\\n    D[(\\"Postgres User DB\\")]\\n  end\\n  A -->|routes HTTPS traffic to auth| B\\n  B -->|authenticates user credentials| C\\n  C -->|queries user profile by email| D\\n  D -->|returns profile + session| C\\n  C -->|returns JWT session token| B\\n  B -->|serves React SPA to user| A"}

2) Open-ended concept request (graph TD):
Prompt: "Describe Docker architecture."
Output:
{"reasoning":"Step 0 - Open-ended, show Docker Engine internals. Step 1 - Client/CLI, Docker API, Daemon, Registry, Image Store, containerd, runc, Containers, Networks, Volumes, Host Kernel. Step 2 - Command -> daemon -> container lifecycle -> kernel. Step 3 - Client->API(sends CLI commands)->Daemon(manages lifecycle)->Registry(pulls image)->containerd(supervises)->runc(spawns)->Containers(run on kernel). Networks + Volumes attached by daemon. Step 4 - Status flows back through daemon to client. Step 5 - Full lifecycle captured, no unrelated infra. Step 6 - Labels: 'sends CLI commands via REST API', 'pulls container image from registry', 'creates container runtime task', 'spawns isolated container process', 'attaches container to network', 'mounts persistent data volume', 'shares host OS kernel'. Step 7 - Shapes match roles, each in own subgraph.","diagramType":"graph TD","theme":"dark-minimal","mermaidCode":"graph TD\\n  subgraph Client_Layer\\n    client(\\"Docker Client / CLI\\")\\n  end\\n  subgraph Engine_Layer\\n    api[\\"Docker API\\"]\\n    daemon[\\"Docker Daemon\\"]\\n  end\\n  subgraph Registry_Layer\\n    registry[(\\"Docker Registry\\")]\\n  end\\n  subgraph Image_Layer\\n    images[(\\"Local Image Store\\")]\\n  end\\n  subgraph Runtime_Layer\\n    containerd[\\"containerd\\"]\\n    runc[\\"runc\\"]\\n    containers[\\"Running Containers\\"]\\n  end\\n  subgraph Resource_Layer\\n    networks[\\"Docker Networks\\"]\\n    volumes[\\"Docker Volumes\\"]\\n  end\\n  subgraph Host_Layer\\n    kernel[\\"Host OS Kernel\\"]\\n  end\\n  client -->|sends CLI commands via REST API| api\\n  api -->|forwards to container lifecycle manager| daemon\\n  daemon -->|pulls container image from registry| registry\\n  registry -->|returns image layers to daemon| daemon\\n  daemon -->|caches image layers on disk| images\\n  daemon -->|creates container runtime task| containerd\\n  images -->|provides cached layers to runtime| containerd\\n  containerd -->|spawns isolated container process| runc\\n  runc -->|launches container in own namespace| containers\\n  daemon -->|attaches container to network| networks\\n  daemon -->|mounts persistent data volume| volumes\\n  networks -->|provides network isolation| containers\\n  volumes -->|persists data beyond container| containers\\n  containers -->|shares host OS kernel| kernel\\n  containerd -->|reports container status events| daemon\\n  daemon -->|returns status to API| api\\n  api -->|returns command output to client| client"}

3) High-level layer-to-layer flow (subgraph connections):
Prompt: "Show the high-level data flow between layers in a web application."
Output:
{"reasoning":"Step 0 - High-level overview, connect subgraphs directly. Step 1 - Client Layer (UI), Gateway Layer (entry), Service Layer (logic), Data Layer (persistence). Step 2 - Request traverses all layers. Step 3 - Client_Layer->Gateway_Layer->Service_Layer->Data_Layer. Step 4 - Return reversed. Step 5 - Essential flow captured. Step 6 - Labels: 'routes requests', 'processes business logic', 'queries and persists data'. Step 7 - Each layer in own subgraph.","diagramType":"graph LR","theme":"slate","mermaidCode":"graph LR\\n  subgraph Client_Layer\\n    A(\\"Web Browser\\")\\n  end\\n  subgraph Gateway_Layer\\n    B{\\"API Gateway\\"}\\n  end\\n  subgraph Service_Layer\\n    C[\\"Auth Service\\"]\\n    D[\\"User Service\\"]\\n  end\\n  subgraph Data_Layer\\n    E[(\\"PostgreSQL\\")]\\n  end\\n  Client_Layer -->|routes requests| Gateway_Layer\\n  Gateway_Layer -->|processes business logic| Service_Layer\\n  Service_Layer -->|queries and persists data| Data_Layer"}

SCHEMA: {"reasoning":"string — step-by-step reasoning (Steps 0-7 above)","diagramType":"graph TD"|"graph LR","theme":"forest-green"|"slate"|"dark-minimal"|"luxury"|"default","mermaidCode":"string"}

OUTPUT: Return ONLY the JSON object. No markdown fences, no prose before or after.`;
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
    ? 'DIAGRAM SCOPE: KEEP IT SIMPLE. Show only the essential high-level components and their main interactions. Use concise edge labels (2 words or fewer). Skip infrastructure details, async flows, and secondary services. The goal is a quick overview, not a comprehensive architecture.'
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

  const requestedModel = model || 'llama-3.3-70b-versatile';
  const FALLBACK_MODEL = 'llama-3.3-70b-versatile';
  const isGptOss = /^openai\/gpt-oss/i.test(requestedModel);

  let resultStr = '';
  const maxAttempts = 2;

  // For gpt-oss models with tight TPM limits, try the requested model first,
  // then fall back to the higher-limit model on 413 errors.
  const modelsToTry = isGptOss && requestedModel !== FALLBACK_MODEL
    ? [requestedModel, FALLBACK_MODEL]
    : [requestedModel];

  let lastError: Error | null = null;
  let succeeded = false;

  for (const currentModel of modelsToTry) {
    if (succeeded) break;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        resultStr = await apiKeyManager.executeWithRetry(async (groq) => {
          const attemptPrompt = attempt > 1
            ? `${userPrompt}\n\nIMPORTANT: Output ONLY a valid JSON object with keys "reasoning", "diagramType", "theme", and "mermaidCode". No markdown fences, no prose.`
            : userPrompt;
          return await groqJsonCompletion(groq, {
            model: currentModel,
            reasoning_effort: 'medium',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: attemptPrompt },
            ],
            temperature: 0.7,
            max_tokens: 8192,
          });
        });
        succeeded = true;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastError = new Error(msg);

        // 413 = TPM limit exceeded — fall back to a higher-limit model
        if (msg.includes('413') || msg.includes('tokens per minute')) {
          if (currentModel !== FALLBACK_MODEL) {
            logger.warn(`[ArchitecturePlanner] TPM limit hit on ${currentModel}, falling back to ${FALLBACK_MODEL}`);
            break; // break inner loop, outer loop picks next model
          }
        }

        if (attempt < maxAttempts) continue; // retry same model
        // else: all attempts exhausted for this model, try next
      }
    }
  }

  if (!succeeded) {
    logger.error('[ArchitecturePlanner] LLM call failed:', lastError);
    throw new Error(`Architecture planner failed: ${lastError?.message ?? 'Unknown error'}`);
  }

  // Parse JSON with recovery attempts
  let parsed: PlannerOutput | null = null;
  const parseAttempts = [
    () => JSON.parse(resultStr!.trim()),
    () => JSON.parse(stripJsonFences(resultStr!)),
    () => JSON.parse(repairTruncatedJson(resultStr!)),
    () => JSON.parse(repairTruncatedJson(stripJsonFences(resultStr!))),
  ];

  for (const parseAttempt of parseAttempts) {
    try {
      parsed = parseAttempt() as PlannerOutput;
      break;
    } catch {
      continue;
    }
  }

  if (parsed && parsed.mermaidCode) {
    const formatConfig: FormatConfig = {
      format: 'mermaid',
      diagramType: parsed.diagramType === 'graph TD' ? 'graph TD' : 'graph LR',
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

  logger.error('[ArchitecturePlanner] Failed to parse JSON response or missing mermaidCode:', resultStr!);
  throw new Error('Architecture planner: failed to parse JSON response');
}
