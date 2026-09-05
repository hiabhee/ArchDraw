#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { generateDiagram } from './tools/generate-diagram.js';
import { fixLayout } from './tools/fix-layout.js';
import { listNodeTypes } from './tools/list-nodes.js';
import { applyTemplate, getAvailableTemplates } from './tools/apply-template.js';
import { getReadMe } from './tools/read-me.js';
import { getDiagramState } from './lib/diagram-state.js';
import { validateDiagram } from './tools/validate-diagram.js';
import { updateDiagram } from './tools/update-diagram.js';
import { saveCheckpoint } from './tools/save-checkpoint.js';
import { loadCheckpoint } from './tools/load-checkpoint.js';
import { exportDiagram } from './tools/export-diagram.js';
import {
  GenerateDiagramInputSchema,
  FixLayoutInputSchema,
  ListNodeTypesInputSchema,
  ApplyTemplateInputSchema,
  UpdateDiagramInputSchema,
  SaveCheckpointInputSchema,
  LoadCheckpointInputSchema,
  ExportDiagramInputSchema,
} from './lib/schema.js';

const TOOLS: Tool[] = [
  {
    name: 'generate_diagram',
    description: `Generate a rich architecture diagram with groups, labeled edges, and visual hierarchy.

**IMPORTANT**: When this tool returns a 'diagramUrl', tell the user to open that URL in their browser.

**INPUT MODES — choose ONE**:

**Mode 1 (RECOMMENDED): Mermaid code** — pass a \`graph LR\` / \`graph TD\` diagram in \`mermaid\`.
This runs the same parser + layout engine the web editor uses, so output is guaranteed to match the product.
Example:
  graph LR
    subgraph client["Client Tier"]
      Web[Web App]
      Mobile[Mobile App]
    end
    subgraph edge["API Gateway Tier"]
      GW[API Gateway]
    end
    subgraph data["Data Tier"]
      DB[("PostgreSQL")]
    end
    Web --> GW
    Mobile --> GW
    GW --> DB
Use \`direction\` to pick LR (default) or TD. Any graph \`graph TD\` implies top-down.
The web parser runs Mermaid → React Flow → Dagre layout, so positions come out clean automatically.
Optional directives like \`%% archdraw-shape: {"id":"<id>","shape":"shield"}\` are supported for non-native shapes.

**Mode 2 (legacy): Structured JSON** — pass \`nodes\` and \`edges\` arrays (schemas below). Less preferred;
the JSON path uses the internal ELK layout and cannot round-trip through the product pipeline.

**ALWAYS ALSO PASS** (when you have them):
- \`userPrompt\`: the user's request verbatim — node subtitles must reflect any tech stack they named.
- \`techStack\`: explicit list of technologies (["Next.js", "PostgreSQL 15", "Redis"]).
- \`customFeatures\`: features the user explicitly asked for.

**🚨 CRITICAL SYSTEMATIC RULES — VIOLATIONS WILL BE FLAGGED:**

**RULE A — AUTH SERVICE TOPOLOGY**: The Auth Service receives arrows ONLY from login and token refresh endpoints. NO other arrows from the gateway into Auth Service are permitted. All other routes: gateway validates JWT internally and routes DIRECTLY to the target service. BEFORE FINALIZING: audit every edge targeting Auth Service — if label is not login/register/token-refresh, delete it.

**RULE B — OBJECT STORAGE IS MANDATORY FOR MEDIA DOMAINS**: For video streaming, image sharing, audio streaming, or any diagram with a CDN or Transcoding Worker — Object Storage (S3/GCS) MUST be present. Required pipeline: Upload → Object Storage (raw) → Transcoding Worker → Object Storage (output) → CDN → Client. Drawing CDN without an origin storage is architecturally invalid.

**RULE C — ANALYTICS EVENT STREAM IS CORE INFRASTRUCTURE**: For video/audio streaming, social media, e-commerce, or gaming domains — an Analytics Event Stream (Kafka/Kinesis) feeding a Recommendation Engine is mandatory. Pattern: Client → (play/click event) → Event Stream → Analytics Processor → Recommendation Engine. This is not optional logging — it is the product's primary feedback loop.

**RULE D — SECURITY SERVICES MUST NOT BYPASS THE GATEWAY**: DRM, Auth, and License Servers must NEVER connect directly to client-tier nodes. Always route through API Gateway (client → gateway → DRM). A direct client→DRM connection means unauthenticated users can request licenses.

**RULE E — EDGE DIRECTION: LEFT->RIGHT ONLY, NO STAR TOPOLOGY** THIS IS THE #1 GENERATION ERROR:
Edges MUST flow from lower-numbered tier to higher-numbered tier:
  client(0) -> edge(1) -> compute(2) -> async(3) -> data(4) -> external(5)

Client tier nodes (Web App, Mobile App) are REQUEST INITIATORS -- they are edge SOURCES, NOT targets.
- CORRECT: Web App -> API Gateway -> Order Service -> PostgreSQL
- WRONG:   Order Service -> Web App  (backward edge, FORBIDDEN)
- WRONG:   PostgreSQL -> Web App     (data to client, FORBIDDEN)
- WRONG:   10 services all -> Web App (star topology, REJECTED)

Web Client is NOT a hub. Do NOT draw edges from backend/data/service nodes back to the client.
If backend needs to push: add a WebSocket Gateway (tier:edge) or Notification Service (tier:compute) as intermediary.

DIAGRAMS WITH STAR TOPOLOGY WILL BE AUTOMATICALLY REJECTED. Fix by:
1. Reverse any edges that point TO a client-tier node FROM a backend node
2. Remove all edges where target=web_client that do not originate from another client-tier node

**MANDATORY REQUIREMENTS** — diagrams missing these will be flagged:
1. At least ONE group (a Mermaid \`subgraph\`, or \`isGroup:true\` in JSON mode) to cluster related services
2. Every node MUST have a subtitle describing its specific role
3. All async/stream/event edges MUST have a label (the event/message name)
4. Every node MUST have a tier assigned
5. Domain-specific required nodes must be present (see read_me for checklist)

**WORKFLOW**:
1. Call read_me FIRST for the full reference guide and domain checklist
2. Identify the domain and verify all required domain nodes are planned
3. Optionally call list_node_types to find icon names
4. Design the Mermaid graph: groups (subgraphs) first, then children inside them
5. Design edges: use correct communicationType, audit Auth Service edges, verify no security bypass
6. **EDGE AUDIT (mandatory)**: Before calling this tool, scan every edge you planned:
   - Does any edge have a client-tier node as the TARGET? DELETE IT (unless both source and target are client tier)
   - Does any single node receive >45% of all edges? That node is a hub -- redistribute connections
   - Do all edges flow LEFT->RIGHT (lower tier -> higher tier)? If not, fix direction.
7. Call this tool

**NODE FIELDS (JSON mode)**:
- id (required): snake_case unique ID
- label (required): 1-3 word display name
- tier (required): client | edge | compute | async | data | external | observe
- subtitle (required): specific description of what this service does
- isGroup: true = swimlane container wrapping child nodes
- parentId: ID of parent group (places this node inside that group)
- groupColor: hex background tint for group containers
- icon: lucide icon name (box, server, database, zap, shield, globe, etc.)
- accentColor: override highlight color (15 palette options)
- status: healthy | warning | error | unknown
- width/height: pixel size (groups: 400-800px wide, 200-400px tall)

**EDGE FIELDS (JSON mode)**:
- source, target (required): node IDs
- communicationType: sync | async | stream | event | dep
- label: required for async/stream/event — name the message or event
- pathType: Smoothstep | bezier | step | straight

**TIER COLORS**:
- client: #64748b (slate) — browsers, mobile apps
- edge: #6366f1 (indigo) — API gateways, load balancers, CDN
- compute: #0d9488 (teal) — microservices, workers, APIs
- async: #d97706 (amber) — queues, event buses, Kafka
- data: #3b82f6 (blue) — databases, caches, object storage
- external: #8b5cf6 (violet) — third-party APIs, payment gateways
- observe: #6b7280 (gray) — monitoring, logging, tracing`,
    inputSchema: {
      type: 'object',
      properties: {
        mermaid: {
          type: 'string',
          description: 'RECOMMENDED: Mermaid code for the diagram (graph LR or graph TD with subgraphs). Uses the web pipeline parser + Dagre layout.',
        },
        nodes: {
          type: 'array',
          description: 'Legacy JSON mode (only if not using mermaid). Array of nodes. RULES: (1) every node needs id+label+tier+subtitle, (2) include at least one isGroup:true node, (3) use parentId to nest nodes inside groups, (4) use accentColor to visually differentiate nodes in the same tier.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique snake_case identifier (e.g. "api_gateway", "postgres_db")' },
              label: { type: 'string', description: 'Short display name (1-3 words)' },
              tier: { type: 'string', description: 'Tier: client | edge | compute | async | data | external | observe' },
              layer: { type: 'string', description: 'Alias for tier' },
              subtitle: { type: 'string', description: 'REQUIRED: Specific description (e.g. "PostgreSQL 15, stores orders and users")' },
              isGroup: { type: 'boolean', description: 'true = swimlane container. Use to cluster related services.' },
              parentId: { type: 'string', description: 'ID of parent group — places this node inside that group' },
              groupColor: { type: 'string', description: 'Background hex for group containers (e.g. "#0f172a")' },
              icon: { type: 'string', description: 'Lucide icon name (server, database, zap, globe, shield, cpu, activity, box, cloud, layers, user, lock, wifi)' },
              tierColor: { type: 'string', description: 'Override tier color hex' },
              accentColor: { type: 'string', description: 'Highlight color: #3b82f6 #0ea5e9 #06b6d4 #14b8a6 #22c55e #f59e0b #f97316 #ef4444 #ec4899 #6b7280 #f43f5e #a855f7 #84cc16 #fb923c' },
              status: { type: 'string', enum: ['healthy', 'warning', 'error', 'unknown'], description: 'Status dot shown on node' },
              width: { type: 'number', description: 'Width px. Groups: 400-800. Nodes: 160-260.' },
              height: { type: 'number', description: 'Height px. Groups: 200-400. Nodes: 60-90.' },
              shape: { type: 'string', enum: ['rectangle', 'diamond', 'ellipse', 'hexagon'], description: 'Node shape' },
            },
            required: ['label'],
          },
        },
        edges: {
          type: 'array',
          description: 'Legacy JSON mode (only if not using mermaid). Array of edges. REQUIRED. Add labels to all async/event/stream edges. Do not connect data tier directly to client tier.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique edge identifier' },
              source: { type: 'string', description: 'Source node ID' },
              target: { type: 'string', description: 'Target node ID' },
              communicationType: {
                type: 'string',
                enum: ['sync', 'async', 'stream', 'event', 'dep'],
                default: 'sync',
                description: 'sync=REST/gRPC, async=queue/kafka, stream=WebSocket/SSE, event=pub-sub, dep=dependency',
              },
              pathType: {
                type: 'string',
                enum: ['smooth', 'Smoothstep', 'bezier', 'step', 'straight'],
                default: 'Smoothstep',
                description: 'Edge path style',
              },
              label: { type: 'string', description: 'Edge label. REQUIRED for async/stream/event. Describe the message or event name.' },
            },
            required: ['source', 'target'],
          },
        },
        direction: {
          type: 'string',
          enum: ['RIGHT', 'DOWN', 'LEFT', 'UP'],
          default: 'RIGHT',
          description: 'Layout direction: RIGHT (LR, default), DOWN (TB for pipelines)',
        },
        label: { type: 'string', description: 'Diagram title' },
        diagramDescription: { type: 'string', description: 'One-sentence description of what this architecture does' },
        userPrompt: { type: 'string', description: 'The user\'s original request verbatim. Subtitle content must reflect any tech stack/services the user named.' },
        techStack: { type: 'array', items: { type: 'string' }, description: 'Explicit technologies/services extracted from the prompt (e.g. ["Next.js", "PostgreSQL 15"]).' },
        customFeatures: { type: 'array', items: { type: 'string' }, description: 'Custom features/components the user explicitly requested.' },
      },
      required: [],
    },
  },
  {
    name: 'fix_layout',
    description: `Apply ELK auto-layout algorithm to existing nodes and edges.

**USE WHEN**: User provides nodes/edges that need automatic positioning
**INPUT**: Nodes with their tier assignments, plus edges between them
**OUTPUT**: Returns nodes with x,y positions computed by ELK layered algorithm

This tool does NOT generate or modify nodes/edges - it only computes optimal positions.

**INPUT**:
- nodes: Array of nodes (id, label, layer/tier required)
- edges: Array of connections between nodes
- direction: Layout direction (RIGHT is default, means left-to-right)`,
    inputSchema: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          description: 'Array of nodes with layer assignments',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique node identifier' },
              label: { type: 'string', description: 'Node label/name' },
              layer: { type: 'string', description: 'Tier layer: client, edge, compute, async, data, observe, external' },
              width: { type: 'number', default: 180, description: 'Node width' },
              height: { type: 'number', default: 70, description: 'Node height' },
            },
            required: ['id', 'label', 'layer'],
          },
        },
        edges: {
          type: 'array',
          description: 'Array of edges connecting the nodes',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique edge identifier' },
              source: { type: 'string', description: 'Source node ID' },
              target: { type: 'string', description: 'Target node ID' },
              communicationType: {
                type: 'string',
                enum: ['sync', 'async', 'stream', 'event', 'dep'],
                default: 'sync',
                description: 'Communication type between nodes',
              },
            },
            required: ['source', 'target'],
          },
        },
        direction: {
          type: 'string',
          enum: ['RIGHT', 'DOWN', 'LEFT', 'UP'],
          default: 'RIGHT',
          description: 'Layout direction',
        },
      },
      required: ['nodes'],
    },
  },
  {
    name: 'list_node_types',
    description: `List all available pre-made component types from the ArchDraw component library.

**USE WHEN**: You want to see what components are available before generating a diagram
**OUTPUT**: Categorized list of 150+ component types with their icons and descriptions

**FILTERING**:
- category: Filter by category name (e.g., "AI / ML", "Data Storage", "Compute", "Messaging & Events")
- search: Search by label, description, or category
- limit: Max results (default 50, max 200)

**CATEGORIES INCLUDE**:
- Client & Entry (CDN, Load Balancer, API Gateway)
- Compute (API Server, Auth Service, Workers, Containers)
- AI / ML (LLM Models, Vector DB, Embedding Service, RAG)
- Data Storage (PostgreSQL, MongoDB, Redis, S3)
- Messaging & Events (Kafka, RabbitMQ, SQS)
- Observability (Prometheus, Grafana, ELK Stack)
- External Services (Stripe, Twilio, SendGrid)`,
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category name (e.g., "AI / ML", "Data Storage", "Compute")',
        },
        search: {
          type: 'string',
          description: 'Search by label, description, or category',
        },
        limit: {
          type: 'number',
          default: 50,
          minimum: 1,
          maximum: 200,
          description: 'Maximum number of results',
        },
      },
    },
  },
  {
    name: 'apply_template',
    description: `Apply a pre-built architecture template with pre-defined nodes and edges.

**IMPORTANT**: When this tool returns a 'diagramUrl', you MUST tell the user to open that URL in their browser to view the diagram. The URL format is: http://localhost:3000/editor?session=<sessionId>

**USE WHEN**: User wants a common architecture pattern (e-commerce, chat app, rideshare, etc.)
**OUTPUT**: Full diagram with positioned nodes and edges from the template. Check the 'message' and 'diagramUrl' fields and tell the user to open the diagramUrl.

**AVAILABLE TEMPLATES**:
- archflow: ArchDraw's own architecture (modern SaaS)
- chatgpt: LLM chat app with RAG, vector DB, streaming
- instagram: Social platform with Kafka, media storage, search
- rideshare: Uber-like with real-time tracking and dynamic pricing
- ecommerce: Full e-commerce with cart, payments, order management

**CUSTOMIZATIONS**:
- renameNodes: Map of node ID to new label
- addNodes: Additional nodes to include`,
    inputSchema: {
      type: 'object',
      properties: {
        templateId: {
          type: 'string',
          description: 'Template identifier: archflow, chatgpt, instagram, rideshare, ecommerce',
        },
        customizations: {
          type: 'object',
          description: 'Optional customizations to apply',
          properties: {
            renameNodes: {
              type: 'object',
              description: 'Map of node ID to new label',
              additionalProperties: { type: 'string' },
            },
            addNodes: {
              type: 'array',
              description: 'Additional nodes to add',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  label: { type: 'string' },
                  category: { type: 'string' },
                  color: { type: 'string' },
                  icon: { type: 'string' },
                },
              },
            },
          },
        },
      },
      required: ['templateId'],
    },
  },
  {
    name: 'list_templates',
    description: 'List all available architecture templates with their descriptions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_me',
    description: `Returns a compact LLM-optimized reference guide for ArchDraw — tiers, node types, 
edge communication types, layout rules, and best practices. Call this FIRST before generating 
any diagram to produce accurate, professional output.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_diagram_state',
    description: `Returns the current diagram's nodes and edges as structured JSON. 
Call this before update_diagram to read what's on the canvas. 
Optionally pass a sessionId to load that diagram first (e.g. a link the user opened).`,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Optional session ID to load before returning state (e.g. from a diagramUrl the user shared).' },
      },
    },
  },
  {
    name: 'update_diagram',
    description: `Surgically modifies an existing diagram. Add nodes, remove nodes, 
add edges, remove edges, or update node properties — without regenerating the whole diagram.`,
    inputSchema: {
      type: 'object',
      properties: {
        addNodes: {
          type: 'array',
          description: 'Nodes to add',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique node identifier' },
              label: { type: 'string', description: 'Display name' },
              tier: { type: 'string', description: 'Tier: client, edge, compute, async, data, observe, external' },
              subtitle: { type: 'string', description: 'Optional short description' },
              icon: { type: 'string', description: 'Optional icon name' },
            },
            required: ['id', 'label', 'tier'],
          },
        },
        removeNodeIds: {
          type: 'array',
          description: 'Node IDs to remove',
          items: { type: 'string' },
        },
        addEdges: {
          type: 'array',
          description: 'Edges to add',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'Source node ID' },
              target: { type: 'string', description: 'Target node ID' },
              communicationType: { type: 'string', enum: ['sync', 'async', 'stream', 'event', 'dep'] },
              label: { type: 'string', description: 'Optional edge label' },
            },
            required: ['source', 'target'],
          },
        },
        removeEdgeIds: {
          type: 'array',
          description: 'Edge IDs to remove',
          items: { type: 'string' },
        },
        updateNodes: {
          type: 'array',
          description: 'Nodes to update',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Node ID to update' },
              label: { type: 'string', description: 'New label' },
              subtitle: { type: 'string', description: 'New subtitle' },
              tier: { type: 'string', description: 'New tier' },
            },
            required: ['id'],
          },
        },
      },
    },
  },
  {
    name: 'validate_diagram',
    description: `Analyses the current diagram and returns a list of structural issues 
and improvement suggestions. Use after generating to catch problems before rendering.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'save_checkpoint',
    description: `Saves the current diagram state with a named label so it can be restored later. 
Useful for multi-turn workflows: save before a major change, restore if needed.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Checkpoint name (e.g. "before-refactor")' },
        description: { type: 'string', description: 'Optional description' },
      },
      required: ['name'],
    },
  },
  {
    name: 'load_checkpoint',
    description: `Restores a previously saved diagram state by name.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Checkpoint name to restore' },
        listAvailable: { type: 'boolean', description: 'If true, list all checkpoints without restoring' },
      },
      required: ['name'],
    },
  },
  {
    name: 'export_diagram',
    description: `Export the current diagram in various formats.

**USE WHEN**: User wants to save or download the diagram
**OUTPUT**: Returns the diagram data or instructions for image export

**FORMATS**:
- json: Returns raw nodes and edges as JSON (recommended for saving)
- png: Returns instructions to export as PNG from the editor
- svg: Returns instructions to export as SVG from the editor

**REQUIREMENT**: You must have a diagram loaded (generate or apply a template first).`,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID from a previous diagram operation. Omit to use the most recent session.' },
        format: { type: 'string', enum: ['json', 'png', 'svg'], default: 'json', description: 'Export format' },
      },
      required: [],
    },
  },
];

class ArchDrawMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'archdraw-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOLS };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'generate_diagram': {
            const input = GenerateDiagramInputSchema.parse(args);
            const result = await generateDiagram(input);
            if (result.success) {
              const { setDiagramState } = await import('./lib/diagram-state.js');
              setDiagramState({ nodes: result.nodes, edges: result.edges, sessionId: result.sessionId });
            }
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({
                    success: result.success,
                    message: result.message,
                    diagramUrl: result.diagramUrl,
                    shareUrl: result.shareUrl,
                    sessionId: result.sessionId,
                    metadata: result.metadata,
                    errors: result.errors,
                    note: "Raw nodes and edges omitted for brevity."
                  }, null, 2),
                },
              ],
            };
          }

          case 'fix_layout': {
            const input = FixLayoutInputSchema.parse(args);
            const result = await fixLayout(input);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'list_node_types': {
            const input = ListNodeTypesInputSchema.parse(args ?? {});
            const result = await listNodeTypes(input);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'apply_template': {
            const input = ApplyTemplateInputSchema.parse(args);
            const result = await applyTemplate(input);
            if (result.success) {
              const { setDiagramState } = await import('./lib/diagram-state.js');
              setDiagramState({ nodes: result.nodes, edges: result.edges, sessionId: result.sessionId });
            }
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({
                    success: result.success,
                    message: result.message,
                    diagramUrl: result.diagramUrl,
                    shareUrl: result.shareUrl,
                    sessionId: result.sessionId,
                    errors: result.errors,
                    note: "Raw nodes and edges omitted for brevity."
                  }, null, 2),
                },
              ],
            };
          }

          case 'list_templates': {
            const templates = getAvailableTemplates();
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({ templates }, null, 2),
                },
              ],
            };
          }

          case 'read_me': {
            const readmeContent = getReadMe();
            return {
              content: [
                {
                  type: 'text' as const,
                  text: readmeContent,
                },
              ],
            };
          }

          case 'get_diagram_state': {
            const { sessionId } = (args ?? {}) as { sessionId?: string };
            if (typeof sessionId === 'string' && sessionId.trim().length > 0) {
              const { syncDiagramStateFromSession } = await import('./lib/diagram-state.js');
              const synced = await syncDiagramStateFromSession(sessionId.trim());
              if (!synced) {
                return {
                  content: [
                    {
                      type: 'text' as const,
                      text: JSON.stringify(
                        { error: `Could not load session '${sessionId}'. It may not exist or the frontend is unreachable.` },
                        null,
                        2
                      ),
                    },
                  ],
                  isError: true,
                };
              }
            }
            const state = getDiagramState();
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    state.nodes.length === 0 && state.edges.length === 0
                      ? { nodes: [], edges: [], message: 'No diagram loaded yet.' }
                      : state,
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case 'update_diagram': {
            const input = UpdateDiagramInputSchema.parse(args);
            const result = await updateDiagram(input);
            if (result.success) {
              const { setDiagramState } = await import('./lib/diagram-state.js');
              setDiagramState({ nodes: result.nodes, edges: result.edges, sessionId: result.sessionId });
            }
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({
                    success: result.success,
                    message: result.message,
                    error: result.error,
                    changes: result.changes,
                    diagramUrl: result.diagramUrl,
                    sessionId: result.sessionId,
                    note: "Raw nodes and edges omitted for brevity."
                  }, null, 2),
                },
              ],
            };
          }

          case 'validate_diagram': {
            const result = await validateDiagram();
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'save_checkpoint': {
            const input = SaveCheckpointInputSchema.parse(args);
            const result = await saveCheckpoint(input);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'load_checkpoint': {
            const input = LoadCheckpointInputSchema.parse(args);
            const result = await loadCheckpoint(input);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'export_diagram': {
            const input = ExportDiagramInputSchema.parse(args);
            const result = await exportDiagram(input);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Unknown tool: ${name}`,
                },
              ],
              isError: true,
            };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: error instanceof Error ? error.message : String(error),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('ArchDraw MCP server running on stdio');
  }
}

const server = new ArchDrawMCPServer();
server.run().catch(console.error);
