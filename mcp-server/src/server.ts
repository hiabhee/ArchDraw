import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { generateDiagram } from './tools/generate-diagram.js';
import { applyTemplate } from './tools/apply-template.js';
import { clearDiagramState, getDiagramState, hasDiagramState, setDiagramState, type DiagramState } from './lib/diagram-state.js';
import { clearCheckpoints, exportCheckpoints, importCheckpoints, type Checkpoint } from './lib/checkpoints.js';
import { runWithMcpContext, type McpRequestContext } from './lib/http.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { updateDiagram } from './tools/update-diagram.js';
import { drawOnCanvas } from './tools/draw-on-canvas.js';
import { layoutDiagram } from './tools/layout-diagram.js';
import {
  GenerateDiagramInputSchema,
  ApplyTemplateInputSchema,
  UpdateDiagramInputSchema,
  DrawOnCanvasInputSchema,
  LayoutDiagramInputSchema,
  CARD_SHAPES,
} from './lib/schema.js';
import { DIAGRAM_WIDGET_HTML, DIAGRAM_WIDGET_URI, PREVIEW_SVG_META_KEY } from './ui/diagram-widget.js';
import { formatPreviewLinks, imageUrlsFor } from './lib/preview-links.js';
import type { ReactFlowNode, ReactFlowEdge } from './types/index.js';

const TOOLS: Tool[] = [
  {
    name: 'generate_diagram',
    title: 'Generate an ArchDraw diagram',
    annotations: { title: 'Generate an ArchDraw diagram', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    description: `Generate a rich architecture diagram with groups, labeled edges, and visual hierarchy. Compatible chat clients display the result as an inline interactive preview; text-only clients receive a concise summary and the ArchDraw site link.

Include the returned preview link (shareUrl) and edit link (diagramUrl) in your reply: in clients without the inline preview, the links are how the user sees the diagram. Links are created by default in the same response (no extra call needed); they are unguessable, view-by-link, and expire after 7 days.

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

**Mode 2 (compatibility): Structured JSON** — pass \`nodes\` and \`edges\` arrays (schemas below). ArchDraw converts this input to Mermaid and uses the same editor pipeline.

**ALWAYS ALSO PASS** (when you have them):
- \`userPrompt\`: the user's request verbatim — node subtitles must reflect any tech stack they named.
- \`techStack\`: explicit list of technologies (["Next.js", "PostgreSQL 15", "Redis"]).
- \`customFeatures\`: features the user explicitly asked for.

**Architecture guidance, not hard rules:** use groups and concise labels where they help comprehension. Model only the components and flows supported by the user’s context. Gateways, event brokers, direct client streams, and domain-specific services are valid when the architecture calls for them.

**Privacy:** pass \`publish:false\` only if the user asks to keep the diagram private; then no link is created and the diagram stays in this MCP session. Retain and resend \`workingSessionId\` from the result when working on more than one diagram in parallel.

**WORKFLOW**:
1. Identify the user’s actual domain and constraints
2. Model only supported components and relationships
3. Design the Mermaid graph: groups (subgraphs) first, then children inside them
4. Design edges: use correct communicationType, audit Auth Service edges, verify no security bypass
5. **EDGE AUDIT (mandatory)**: Before calling this tool, scan every edge you planned:
   - Does any edge have a client-tier node as the TARGET? DELETE IT (unless both source and target are client tier)
   - Does any single node receive >45% of all edges? That node is a hub -- redistribute connections
   - Do all edges flow LEFT->RIGHT (lower tier -> higher tier)? If not, fix direction.
6. Call this tool

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
            required: ['id', 'label', 'tier', 'subtitle'],
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
            required: ['source', 'target', 'label'],
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
        publish: { type: 'boolean', default: true, description: 'Create a preview link (default true). Set false only when the user asks to keep the diagram private.' },
        workingSessionId: { type: 'string', description: 'Opaque local workspace key. Resend it to keep parallel diagrams isolated.' },
      },
      required: [],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        nodes: { type: 'array', items: { type: 'object' } },
        edges: { type: 'array', items: { type: 'object' } },
        diagramUrl: { type: 'string' },
        shareUrl: { type: 'string' },
        sessionId: { type: 'string' },
        workingSessionId: { type: 'string' },
        label: { type: 'string' },
        metadata: {
          type: 'object',
          properties: {
            nodeCount: { type: 'number' },
            edgeCount: { type: 'number' },
            layoutAlgorithm: { type: 'string' },
            direction: { type: 'string' },
            groupCount: { type: 'number' },
          },
        },
        errors: { type: 'array', items: { type: 'string' } },
      },
      required: ['success', 'nodes', 'edges', 'workingSessionId', 'metadata'],
    },
    _meta: {
      ui: { resourceUri: DIAGRAM_WIDGET_URI },
      'openai/toolInvocation/invoking': 'Generating diagram…',
      'openai/toolInvocation/invoked': 'Diagram preview ready',
    },
  },
  {
    name: 'apply_template',
    title: 'Apply an ArchDraw template',
    annotations: { title: 'Apply an ArchDraw template', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    description: `Apply a pre-built architecture template with pre-defined nodes and edges. Compatible chat clients display the result as an inline preview.

**USE WHEN**: User wants a common architecture pattern (e-commerce, chat app, rideshare, etc.)
**OUTPUT**: Full diagram with positioned nodes and edges, plus a preview link (shareUrl) and edit link (diagramUrl) created by default. Include those links in your reply. Pass publish:false only if the user asks to keep it private.

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
        publish: { type: 'boolean', default: true, description: 'Create a preview link (default true). Set false only when the user asks to keep the diagram private.' },
        workingSessionId: { type: 'string', description: 'Opaque local workspace key for isolating parallel diagrams.' },
      },
      required: ['templateId'],
    },
    _meta: {
      ui: { resourceUri: DIAGRAM_WIDGET_URI },
      'openai/toolInvocation/invoking': 'Loading template…',
      'openai/toolInvocation/invoked': 'Diagram preview ready',
    },
  },
  {
    name: 'get_diagram_state',
    title: 'Read the current ArchDraw diagram',
    annotations: { title: 'Read the current ArchDraw diagram', readOnlyHint: true, openWorldHint: false },
    description: `Returns the current diagram's nodes and edges as structured JSON. 
Call this before update_diagram to read what's on the canvas. 
Optionally pass a sessionId to load that diagram first (e.g. a link the user opened).`,
    inputSchema: {
      type: 'object',
      properties: {
        workingSessionId: { type: 'string', description: 'The workingSessionId returned by generate_diagram / apply_template. Required on the hosted server; resend it on every call about that diagram.' },
        sessionId: { type: 'string', description: 'Optional session ID to load before returning state (e.g. from a diagramUrl the user shared).' },
      },
    },
  },
  {
    name: 'update_diagram',
    title: 'Update an ArchDraw diagram',
    annotations: { title: 'Update an ArchDraw diagram', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    description: `Surgically modifies an existing diagram. Add nodes, remove nodes, 
add edges, remove edges, or update node properties — without regenerating the whole diagram.`,
    inputSchema: {
      type: 'object',
      properties: {
        workingSessionId: { type: 'string', description: 'The workingSessionId returned by generate_diagram / apply_template. Required on the hosted server; resend it on every call about that diagram.' },
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
    name: 'layout_diagram',
    title: 'Lay out an ArchDraw diagram',
    annotations: { title: 'Lay out an ArchDraw diagram', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    description: `Re-arranges the current diagram with ArchDraw's own layout engine, the same one as the editor's layout toggle. Use it when a diagram looks cramped, too wide or too tall, or the user asks to "tidy", "re-layout", "make it top-down", or fit a screen. Nothing is added or removed: only positions and sizes change, so ids, labels and connections stay the same. For exact manual placement of particular things use draw_on_canvas (move / align / distribute) instead; the two combine well: lay out, then nudge.

CONTROLS
- direction: LR (left to right, default) or TD (top down).
- arrangement: "flow" (ranks follow the data flow, default) or "zones" (clients on the left, data above, chains below).
- fold: wrap a long flow into rows so it fits a 16:9 screen (default true); false keeps one long row/column.
- mixDirections: allow groups to run the other way when that fits clearly better (default true); false keeps every group in the main direction.
- groupDirections: force particular groups, by id, e.g. {"api":"TD"} (the ids are in "canvas" from any earlier call, or get_diagram_state). Named groups are never overridden.
Works on the current diagram (workingSessionId). The reply lists every node's new position and size, and (published by default) a preview link and shareable image: SHOW THE LINKS to the user.`,
    inputSchema: {
      type: 'object',
      properties: {
        workingSessionId: { type: 'string', description: 'The workingSessionId from an earlier call about this diagram. Required on the hosted server.' },
        direction: { type: 'string', enum: ['LR', 'TD'], description: 'Main flow direction. Default LR.' },
        arrangement: { type: 'string', enum: ['flow', 'zones'], description: 'flow (default) or zones.' },
        fold: { type: 'boolean', description: 'Wrap a long flow into rows to fit a 16:9 screen. Default true.' },
        mixDirections: { type: 'boolean', description: 'Let groups run the other way when that fits better. Default true.' },
        groupDirections: { type: 'object', additionalProperties: { type: 'string', enum: ['LR', 'TD'] }, description: 'Force the direction inside particular groups, by id.' },
        label: { type: 'string' },
        publish: { type: 'boolean', description: 'Update the shareable preview link. Default true.' },
        style: { type: 'string', enum: ['sketch', 'studio', 'studio-metallic', 'neubrutalism', 'precision'], description: 'Look of the preview and shareable image. Default studio.' },
        expectedRevision: { type: 'number', description: 'Optional: refuse if the published diagram changed since this revision.' },
      },
    },
  },
  {
    name: 'draw_on_canvas',
    title: 'Draw on an ArchDraw canvas',
    annotations: { title: 'Draw on an ArchDraw canvas', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    description: `Draws on a canvas with exact control: place text, empty cards to write in, shapes, notes, components and groups at precise positions, connect them, restyle, move, align and remove. Use it when the user wants something drawn that generate_diagram's automatic layout cannot give (a whiteboard, a sketch, annotations, a precise arrangement), or to add to / edit any existing diagram.

HOW IT WORKS
- Coordinates are canvas pixels: x grows right, y grows DOWN, (x, y) is the top-left corner. A typical card is ~200x90, so leave ~60px between neighbours.
- "ops" run in order. ALL of them apply or NONE do: an error names the failing operation (Operation N) and nothing is drawn, so fix it and resend.
- Give an "id" to anything you will refer to later (connect, group, update, move...). Otherwise one is generated (text_1, card_2...) and returned in "steps".
- It works on the current diagram (workingSessionId), including one made by generate_diagram or apply_template. For a NEW canvas start with {"op":"clear"} (or omit workingSessionId on a hosted server). The reply lists every node's position and size ("canvas") and the overall "bounds": use them to place the next things.

OPERATIONS (field "op")
- text: free text. {text, x, y, size?: small|medium|large|heading, bold?, color?, parent?}. text may be "" (a blank text box).
- card: a card or shape, the "empty card to write in". {x, y, title?, subtitle?, shape?, width?, height?, color?, fill?, parent?}. Leave title empty for a blank card the user clicks to write in. shape: ${CARD_SHAPES.join(' | ')}.
- note: a sticky text block. {x, y, title?, body?, titleSize?, bodySize?, width?, height?, parent?}. For longer writing.
- component: an architecture component. {x, y, label, subtitle?, tier?, icon?, status?, width?, height?, parent?}.
- group: a labelled frame. {id?, label?, children?: [ids], color?} wraps the children (sized to fit them), or give x, y, width, height for an empty frame to fill later (put things in with parent, or update parent). Groups cannot be nested.
- connect: an arrow. {from, to, label?, style?: solid|dashed|thick, arrow?: end|both, color?, path?: smooth|step|straight|bezier, fromSide?, toSide?: top|right|bottom|left}. Joins nodes, not groups.
- update: change a node or connection. {id, text? title? subtitle? body? label? size? bold? color? fill? shape? x? y? width? height? parent? (an id, or null to leave a group) style?}. Only fields that apply to that kind of node are accepted.
- move: {ids, dx?, dy?} shift, or {ids, x?, y?} put the selection's top-left there.
- align: {ids, mode: left|center|right|top|middle|bottom}.
- distribute: {ids, axis: horizontal|vertical, gap?} even spacing (or a fixed gap).
- remove: {ids}: nodes and/or connections. Removing a group frees its children where they are.
- clear: empties the canvas and starts a new drawing.

By default the result is published and links are returned (publish:false keeps it in this session): a preview, an edit link, and a shareable IMAGE (PNG, hand-drawn like a whiteboard by default; style:"studio" for a clean look) the user can post anywhere. SHOW THE LINKS to the user, the image first when they want to share it.`,
    inputSchema: {
      type: 'object',
      properties: {
        workingSessionId: { type: 'string', description: 'The workingSessionId from an earlier call about this canvas. Required on the hosted server for edits; omit it there to start a new canvas.' },
        label: { type: 'string', description: 'Title for a new canvas.' },
        publish: { type: 'boolean', description: 'Create / update the shareable preview link. Default true.' },
        style: { type: 'string', enum: ['sketch', 'studio', 'studio-metallic', 'neubrutalism', 'precision'], description: 'Look of the shareable image and preview, matching the editor render styles: sketch (hand-drawn, like a whiteboard; the default), studio (clean), studio-metallic (satin metal), neubrutalism (bold), precision. Pick the one the user works in.' },
        expectedRevision: { type: 'number', description: 'Optional: refuse if the published canvas changed since this revision.' },
        ops: {
          type: 'array',
          description: 'Drawing operations, applied in order (1-200). All apply or none do.',
          minItems: 1,
          maxItems: 200,
          items: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: ['text', 'card', 'note', 'component', 'group', 'connect', 'update', 'move', 'align', 'distribute', 'remove', 'clear'] },
              id: { type: 'string', description: 'text/card/note/component/group/connect: optional id to create; update: the node or connection to change.' },
              ids: { type: 'array', items: { type: 'string' }, description: 'move / align / distribute / remove: the targets.' },
              x: { type: 'number', description: 'Left edge in canvas px (move: put the selection here).' },
              y: { type: 'number', description: 'Top edge in canvas px (y grows downward).' },
              dx: { type: 'number', description: 'move: shift right by this many px.' },
              dy: { type: 'number', description: 'move: shift down by this many px.' },
              width: { type: 'number' },
              height: { type: 'number' },
              text: { type: 'string', description: 'text: the text (may be empty).' },
              title: { type: 'string', description: 'card / note: the title. Empty = a blank card to write in.' },
              subtitle: { type: 'string' },
              body: { type: 'string', description: 'note: longer text.' },
              label: { type: 'string', description: 'component / group / connect label.' },
              size: { type: 'string', enum: ['small', 'medium', 'large', 'heading'], description: 'text size.' },
              titleSize: { type: 'string', enum: ['small', 'medium', 'large', 'heading'] },
              bodySize: { type: 'string', enum: ['small', 'medium', 'large', 'heading'] },
              bold: { type: 'boolean' },
              color: { type: 'string', description: '#rrggbb: ink / outline / line / group tint.' },
              fill: { type: 'string', description: '#rrggbb card background.' },
              shape: { type: 'string', enum: [...CARD_SHAPES] },
              tier: { type: 'string', enum: ['client', 'edge', 'compute', 'async', 'data', 'observe', 'external'] },
              icon: { type: 'string' },
              status: { type: 'string', enum: ['healthy', 'warning', 'error', 'unknown'] },
              parent: { type: ['string', 'null'], description: 'The group this belongs to (null in update: leave its group).' },
              children: { type: 'array', items: { type: 'string' }, description: 'group: node ids to wrap.' },
              from: { type: 'string', description: 'connect: source node id.' },
              to: { type: 'string', description: 'connect: target node id.' },
              style: { type: 'string', enum: ['solid', 'dashed', 'thick'] },
              arrow: { type: 'string', enum: ['end', 'both'] },
              path: { type: 'string', enum: ['smooth', 'step', 'straight', 'bezier'] },
              fromSide: { type: 'string', enum: ['top', 'right', 'bottom', 'left'] },
              toSide: { type: 'string', enum: ['top', 'right', 'bottom', 'left'] },
              mode: { type: 'string', enum: ['left', 'center', 'right', 'top', 'middle', 'bottom'], description: 'align.' },
              axis: { type: 'string', enum: ['horizontal', 'vertical'], description: 'distribute.' },
              gap: { type: 'number', description: 'distribute: fixed gap in px.' },
            },
            required: ['op'],
          },
        },
      },
      required: ['ops'],
    },
  },
];

export const SERVER_VERSION = '1.1.0';

/** Everything a working session holds between tool calls. */
export interface WorkingSessionSnapshot {
  diagram: DiagramState | null;
  checkpoints: Checkpoint[];
}

/**
 * External persistence for working sessions. The stdio server keeps them in
 * process memory; a serverless host (the hosted `/api/mcp` endpoint) can't, so
 * it passes a store and every stateful call hydrates from / saves back to it.
 */
export interface WorkingSessionStore {
  load(workingSessionId: string): Promise<WorkingSessionSnapshot | null>;
  save(workingSessionId: string, snapshot: WorkingSessionSnapshot): Promise<void>;
}

export interface ArchDrawServerOptions {
  /** When set, working sessions are persisted there and must be explicit UUIDs (no shared 'default'). */
  sessionStore?: WorkingSessionStore;
}

const STATEFUL_TOOLS = new Set([
  'generate_diagram',
  'apply_template',
  'get_diagram_state',
  'update_diagram',
  'draw_on_canvas',
  'layout_diagram',
]);
const SESSION_CREATING_TOOLS = new Set(['generate_diagram', 'apply_template', 'get_diagram_state', 'draw_on_canvas']);
const WORKING_SESSION_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ToolArgs = Record<string, unknown> | undefined;

// The drawn diagram goes to the inline preview in _meta, which hosts keep out
// of the model's context (it is tens of KB of SVG).
function previewMeta(previewSvg: string | undefined) {
  return previewSvg ? { _meta: { [PREVIEW_SVG_META_KEY]: previewSvg } } : {};
}

function errorResult(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

/**
 * Pick the working session for a call. Stdio keeps the historical 'default'
 * fallback (one client per process). With a session store the process is
 * shared by everyone, so ids must be explicit UUIDs — a missing id on a
 * creating tool mints a fresh one; on any other stateful tool it's an error.
 */
function resolveWorkingSession(name: string, args: ToolArgs, hosted: boolean): { id: string } | { error: string } {
  const raw = typeof args?.workingSessionId === 'string' ? args.workingSessionId.trim() : '';
  if (!hosted) {
    if (raw) return { id: raw };
    return { id: name === 'generate_diagram' || name === 'apply_template' ? randomUUID() : 'default' };
  }
  if (raw) {
    return WORKING_SESSION_RE.test(raw) ? { id: raw.toLowerCase() } : { error: 'workingSessionId must be the UUID returned by generate_diagram or apply_template.' };
  }
  if (!STATEFUL_TOOLS.has(name)) return { id: '' };
  const canCreate = SESSION_CREATING_TOOLS.has(name) && (name !== 'get_diagram_state' || typeof args?.sessionId === 'string');
  if (canCreate) return { id: randomUUID() };
  return { error: `${name} needs the workingSessionId returned by generate_diagram or apply_template. Pass it on every call about that diagram.` };
}

async function withWorkingSession<T>(store: WorkingSessionStore, id: string, run: () => Promise<T>): Promise<T> {
  const snapshot = await store.load(id);
  if (snapshot?.diagram) setDiagramState(snapshot.diagram, id);
  if (snapshot?.checkpoints?.length) importCheckpoints(snapshot.checkpoints, id);
  try {
    return await run();
  } finally {
    try {
      const checkpoints = exportCheckpoints(id);
      if (hasDiagramState(id) || checkpoints.length) {
        await store.save(id, { diagram: hasDiagramState(id) ? getDiagramState(id) : null, checkpoints });
      }
    } finally {
      clearDiagramState(id);
      clearCheckpoints(id);
    }
  }
}

async function dispatchTool(name: string, args: ToolArgs, workingSession: string) {
  switch (name) {
    case 'generate_diagram': {
      const input = GenerateDiagramInputSchema.parse(args);
      const result = await generateDiagram(input);
      if (result.success) {
        setDiagramState({ nodes: result.nodes, edges: result.edges, sessionId: result.sessionId, updateToken: result.updateToken }, workingSession);
      }
      const structuredContent = {
        success: result.success,
        nodes: result.nodes,
        edges: result.edges,
        ...(result.diagramUrl ? { diagramUrl: result.diagramUrl } : {}),
        ...(result.shareUrl ? { shareUrl: result.shareUrl } : {}),
        ...(result.sessionId ? { sessionId: result.sessionId } : {}),
        workingSessionId: workingSession,
        label: input.label || 'ArchDraw diagram',
        metadata: result.metadata,
        ...(result.errors?.length ? { errors: result.errors } : {}),
      };
      const summary = result.message || `Diagram generated with ${result.metadata.nodeCount} nodes and ${result.metadata.edgeCount} connections.`;
      const text = result.success
        ? `${formatPreviewLinks({ ...result, privateByRequest: input.publish === false })}\n\n${summary}`
        : `Diagram generation failed: ${(result.errors || ['Unknown error']).join('; ')}`;
      return {
        structuredContent: { ...structuredContent, ...(result.linkError ? { linkError: result.linkError } : {}) },
        content: [{ type: 'text' as const, text }],
        ...previewMeta(result.previewSvg),
      };
    }

    case 'apply_template': {
      const input = ApplyTemplateInputSchema.parse(args);
      const result = await applyTemplate(input);
      if (result.success) {
        setDiagramState({ nodes: result.nodes, edges: result.edges, sessionId: result.sessionId, updateToken: result.updateToken }, workingSession);
      }
      const structuredContent = {
        success: result.success,
        nodes: result.nodes,
        edges: result.edges,
        ...(result.diagramUrl ? { diagramUrl: result.diagramUrl } : {}),
        ...(result.shareUrl ? { shareUrl: result.shareUrl } : {}),
        ...(result.sessionId ? { sessionId: result.sessionId } : {}),
        workingSessionId: workingSession,
        label: input.templateId,
        metadata: {
          nodeCount: result.nodes.length,
          edgeCount: result.edges.length,
          groupCount: result.nodes.filter(node => node.data?.isGroup).length,
          layoutAlgorithm: 'template',
        },
        ...(result.errors?.length ? { errors: result.errors } : {}),
      };
      const text = result.success
        ? `${formatPreviewLinks({ ...result, privateByRequest: input.publish === false })}\n\n${result.message || `${input.templateId} template is ready.`}`
        : `Template failed: ${(result.errors || ['Unknown error']).join('; ')}`;
      return {
        structuredContent: { ...structuredContent, ...(result.linkError ? { linkError: result.linkError } : {}) },
        content: [{ type: 'text' as const, text }],
        ...previewMeta(result.previewSvg),
      };
    }

    case 'get_diagram_state': {
      const { sessionId } = (args ?? {}) as { sessionId?: string };
      if (typeof sessionId === 'string' && sessionId.trim().length > 0) {
        const { syncDiagramStateFromSession } = await import('./lib/diagram-state.js');
        const synced = await syncDiagramStateFromSession(sessionId.trim(), undefined, workingSession);
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
      const state = getDiagramState(workingSession);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              state.nodes.length === 0 && state.edges.length === 0
                ? { nodes: [], edges: [], workingSessionId: workingSession, message: 'No diagram loaded yet.' }
                : { ...state, updateToken: undefined, workingSessionId: workingSession },
              null,
              2
            ),
          },
        ],
      };
    }

    case 'update_diagram': {
      const input = UpdateDiagramInputSchema.parse(args);
      const result = await updateDiagram(input, workingSession);
      if (result.success) {
        const previous = getDiagramState(workingSession);
        setDiagramState({ nodes: result.nodes, edges: result.edges, sessionId: result.sessionId, updateToken: previous.updateToken }, workingSession);
      }
      const details = JSON.stringify({
        success: result.success,
        message: result.message,
        error: result.error,
        changes: result.changes,
        diagramUrl: result.diagramUrl,
        shareUrl: result.shareUrl,
        sessionId: result.sessionId,
        workingSessionId: workingSession,
        note: 'Raw nodes and edges omitted for brevity.',
      }, null, 2);
      // The published link is updated in place — resurface it so the
      // user can see the change without asking for the link again.
      const linkBlock = result.success && (result.shareUrl || result.diagramUrl)
        ? `${formatPreviewLinks(result)}\n\n`
        : '';
      return {
        content: [{ type: 'text' as const, text: `${linkBlock}${details}` }],
      };
    }

    case 'draw_on_canvas': {
      const input = DrawOnCanvasInputSchema.parse(args);
      const result = await drawOnCanvas(input, workingSession);
      if (!result.success) {
        return errorResult(`${result.error ?? 'Could not draw.'}${result.failedOperation !== undefined ? ` (operation index ${result.failedOperation})` : ''}`);
      }
      setDiagramState({
        nodes: result.nodes as unknown as ReactFlowNode[],
        edges: result.edges as unknown as ReactFlowEdge[],
        sessionId: result.sessionId,
        updateToken: result.updateToken,
        revision: result.revision,
      }, workingSession);
      const made = result.steps.flatMap(step => (['text', 'card', 'note', 'component', 'group', 'connect'].includes(step.op) ? step.ids.slice(0, 1).map(id => `${step.op} ${id}`) : []));
      const linkBlock = result.canvas.length > 0
        ? `${formatPreviewLinks({ shareUrl: result.shareUrl, diagramUrl: result.diagramUrl, linkError: result.linkError, privateByRequest: input.publish === false, imageStyle: input.style })}\n\n`
        : '';
      const summary = `Drew ${input.ops.length} operation(s). Canvas now has ${result.canvas.length} node(s) and ${result.edges.length} connection(s)${result.bounds ? `, spanning x ${result.bounds.x}..${result.bounds.x + result.bounds.width}, y ${result.bounds.y}..${result.bounds.y + result.bounds.height}` : ''}.${made.length ? `\nCreated: ${made.join(', ')}.` : ''}\nworkingSessionId: ${workingSession}`;
      return {
        structuredContent: {
          success: true,
          workingSessionId: workingSession,
          steps: result.steps,
          canvas: result.canvas,
          ...(result.bounds ? { bounds: result.bounds } : {}),
          revision: result.revision,
          ...(result.diagramUrl ? { diagramUrl: result.diagramUrl } : {}),
          ...(result.shareUrl ? { shareUrl: result.shareUrl } : {}),
          ...(imageUrlsFor(result.shareUrl, input.style) ? { imageUrl: imageUrlsFor(result.shareUrl, input.style)!.png, svgUrl: imageUrlsFor(result.shareUrl, input.style)!.svg } : {}),
          ...(result.sessionId ? { sessionId: result.sessionId } : {}),
          ...(result.linkError ? { linkError: result.linkError } : {}),
        },
        content: [{ type: 'text' as const, text: `${linkBlock}${summary}\n\nCanvas (id type x,y WxH):\n${result.canvas.slice(0, 120).map(e => `${e.id} ${e.type} ${e.x},${e.y} ${e.width}x${e.height}${e.parent ? ` in ${e.parent}` : ''}${e.text ? ` "${e.text}"` : ''}`).join('\n')}${result.canvas.length > 120 ? `\n…and ${result.canvas.length - 120} more` : ''}` }],
        ...previewMeta(result.previewSvg),
      };
    }

    case 'layout_diagram': {
      const input = LayoutDiagramInputSchema.parse(args);
      const result = await layoutDiagram(input, workingSession);
      if (!result.success) return errorResult(result.error ?? 'Could not lay the diagram out.');
      setDiagramState({
        nodes: result.nodes as unknown as ReactFlowNode[],
        edges: result.edges as unknown as ReactFlowEdge[],
        sessionId: result.sessionId,
        updateToken: result.updateToken,
        revision: result.revision,
      }, workingSession);
      const linkBlock = `${formatPreviewLinks({ shareUrl: result.shareUrl, diagramUrl: result.diagramUrl, linkError: result.linkError, privateByRequest: input.publish === false, imageStyle: input.style })}\n\n`;
      const summary = `Laid out ${result.canvas.length} node(s) ${input.direction === 'LR' ? 'left to right' : 'top down'} (${input.arrangement}). Only positions and sizes changed.${result.message ? `\nNote: ${result.message}` : ''}\nworkingSessionId: ${workingSession}`;
      return {
        structuredContent: {
          success: true,
          workingSessionId: workingSession,
          canvas: result.canvas,
          ...(result.bounds ? { bounds: result.bounds } : {}),
          revision: result.revision,
          ...(result.diagramUrl ? { diagramUrl: result.diagramUrl } : {}),
          ...(result.shareUrl ? { shareUrl: result.shareUrl } : {}),
          ...(imageUrlsFor(result.shareUrl, input.style) ? { imageUrl: imageUrlsFor(result.shareUrl, input.style)!.png } : {}),
          ...(result.linkError ? { linkError: result.linkError } : {}),
        },
        content: [{ type: 'text' as const, text: `${linkBlock}${summary}\n\nCanvas (id type x,y WxH):\n${result.canvas.slice(0, 120).map(e => `${e.id} ${e.type} ${e.x},${e.y} ${e.width}x${e.height}${e.parent ? ` in ${e.parent}` : ''}${e.text ? ` "${e.text}"` : ''}`).join('\n')}${result.canvas.length > 120 ? `\n…and ${result.canvas.length - 120} more` : ''}` }],
        ...previewMeta(result.previewSvg),
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
}

export function createArchDrawMCPServer(options: ArchDrawServerOptions = {}): Server {
  const server = new Server(
    {
      name: 'archdraw-mcp-server',
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [{
      uri: DIAGRAM_WIDGET_URI,
      name: 'ArchDraw diagram preview',
      description: 'Inline diagram preview and prompt form for generating another ArchDraw diagram in the chat.',
      mimeType: 'text/html;profile=mcp-app',
    }],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri !== DIAGRAM_WIDGET_URI) {
      throw new Error(`Unknown resource: ${request.params.uri}`);
    }
    return {
      contents: [{
        uri: DIAGRAM_WIDGET_URI,
        mimeType: 'text/html;profile=mcp-app',
        text: DIAGRAM_WIDGET_HTML,
        _meta: { ui: { prefersBorder: true } },
      }],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const store = options.sessionStore;
    // Hosts can multiplex calls, so agents retain and resend this opaque key
    // to isolate parallel diagrams.
    const resolved = resolveWorkingSession(name, args, Boolean(store));
    if ('error' in resolved) return errorResult(resolved.error);
    const workingSession = resolved.id;

    try {
      if (store && workingSession) {
        return await withWorkingSession(store, workingSession, () => dispatchTool(name, args, workingSession));
      }
      return await dispatchTool(name, args, workingSession);
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : String(error));
    }
  });

  return server;
}

/**
 * Serve one stateless Streamable HTTP request (POST JSON-RPC in, JSON out).
 * Used by the hosted endpoint; `context` scopes the API base / fetch the tools
 * use to this request only.
 */
export async function handleMcpHttpRequest(
  request: Request,
  options: ArchDrawServerOptions & { context?: McpRequestContext } = {},
): Promise<Response> {
  const server = createArchDrawMCPServer(options);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await runWithMcpContext(options.context ?? {}, () => transport.handleRequest(request));
  } finally {
    await server.close();
  }
}

export { runWithMcpContext, type McpRequestContext };
