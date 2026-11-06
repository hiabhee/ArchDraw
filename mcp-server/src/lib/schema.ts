import { z } from 'zod';

export const NodeInputSchema = z.object({
  id: z.string().describe('Unique node identifier. REQUIRED — use snake_case, e.g. "api_gateway", "postgres_db"'),
  label: z.string().describe('Display name shown on the node (e.g., "API Gateway", "PostgreSQL"). Keep it short — 1-3 words.'),
  tier: z.string().describe('Tier placement (REQUIRED): client | edge | compute | async | data | observe | external'),
  layer: z.string().optional().describe('Alternative to tier — same values accepted'),
  subtitle: z.string().describe(
    'Short description shown under the label (REQUIRED for all nodes). ' +
    'CRITICAL: If the user specified a tech stack, the subtitle MUST reflect it. ' +
    'Examples: "AWS Lambda, Node.js 20, handles video uploads" NOT "handles uploads". ' +
    '"PostgreSQL 15 on RDS, stores user data" NOT "database". ' +
    '"CloudFront CDN, serves transcoded HLS segments" NOT "CDN". ' +
    'Always encode the actual technology name + version + role in the subtitle.'
  ),
  icon: z.string().optional().describe('Icon name from lucide-react. Examples: "server", "database", "zap", "globe", "shield", "layers", "cpu", "activity", "box", "cloud"'),
  tierColor: z.string().optional().describe('Override hex color for the node accent. Use tier defaults unless you need visual differentiation.'),
  accentColor: z.string().optional().describe('Additional accent/highlight color for the node. 15 options: #3b82f6 #0ea5e9 #06b6d4 #14b8a6 #22c55e #f59e0b #f97316 #ef4444 #ec4899 #6b7280 #f43f5e #a855f7 #84cc16 #fb923c #0ea5e9'),
  width: z.number().optional().default(200).describe('Node width in pixels. Default 200. Groups should be wider (400-800).'),
  height: z.number().optional().default(70).describe('Node height in pixels. Default 70 for regular nodes. Groups should be taller (200-400).'),
  serviceType: z.string().optional().describe('Service type or category for metadata'),
  isGroup: z.boolean().optional().describe('Set true to render this node as a group container/swimlane that visually wraps child nodes'),
  parentId: z.string().optional().describe('ID of the parent group node. Set this on child nodes to place them inside a group.'),
  groupColor: z.string().optional().describe('Background tint color for group containers (hex). E.g. "#1e293b", "#0f172a"'),
  status: z.enum(['healthy', 'warning', 'error', 'unknown']).optional().describe('Status indicator shown as a colored dot on the node. Use "warning"/"error" to highlight problem areas.'),
  shape: z.enum(['rectangle', 'diamond', 'ellipse', 'hexagon']).optional().describe('Node shape. Default rectangle. Use diamond for decision nodes, ellipse for queues/events.'),
});

export const EdgeInputSchema = z.object({
  id: z.string().optional().describe('Unique edge identifier (auto-generated if omitted)'),
  source: z.string().describe('Source node ID — the node where data/control flows FROM'),
  target: z.string().describe('Target node ID — the node where data/control flows TO'),
  communicationType: z.enum(['sync', 'async', 'stream', 'event', 'dep']).default('sync').describe(
    'Communication pattern:\n' +
    '  sync  = REST/gRPC/HTTP request-response (solid line)\n' +
    '  async = Message queue, background job (dashed amber, animated)\n' +
    '  stream = WebSocket, SSE, real-time (dashed green, animated)\n' +
    '  event = Pub/sub, event-driven (dashed pink, animated)\n' +
    '  dep   = Build-time dependency (dotted gray)'
  ),
  pathType: z.enum(['smooth', 'Smoothstep', 'bezier', 'step', 'straight']).default('Smoothstep').describe('Edge path style. Smoothstep for most cases, bezier for curved, step for right-angle bends.'),
  label: z.string().min(1).describe('Label shown on the edge. REQUIRED for EVERY edge. Describe the protocol, action, or event. E.g. "HTTPS", "REST", "SQL Query", "user.created", "gRPC"'),
  animated: z.boolean().optional().describe('Override animation. Async/stream/event are animated by default.'),
});

export const GenerateDiagramInputSchema = z.object({
  mermaid: z.string().optional().describe(
    'Mermaid code representing the diagram. If provided, the system will use the robust Web UI parser, ' +
    'layout engine, and style pipeline to build the diagram. This is the RECOMMENDED way to generate diagrams.'
  ),
  nodes: z.array(NodeInputSchema).optional().describe(
    'Array of nodes. Legacy parameter (not needed if mermaid code is provided).'
  ),
  edges: z.array(EdgeInputSchema).optional().describe(
    'Array of edges. Legacy parameter (not needed if mermaid code is provided).'
  ),
  direction: z.enum(['RIGHT', 'DOWN', 'LEFT', 'UP']).default('RIGHT').describe('Layout direction. Default RIGHT (left-to-right).'),
  label: z.string().optional().describe('Diagram title shown in the header'),
  diagramDescription: z.string().optional().describe('One-sentence description of what this architecture does. Helps with diagram metadata.'),
  userPrompt: z.string().optional().describe(
    'The original user request/prompt verbatim. CRITICAL: When provided, every node subtitle MUST reflect ' +
    'any tech stack, services, or features the user mentioned.'
  ),
  techStack: z.array(z.string()).optional().describe(
    'Explicit list of technologies/services extracted from the user prompt.'
  ),
  customFeatures: z.array(z.string()).optional().describe(
    'Custom features or components the user explicitly requested.'
  ),
  publish: z.boolean().optional().default(true).describe('Create a preview link (default). Links are unguessable, view-by-link and expire after 7 days. Set false only when the user asks to keep the diagram private.'),
});

export const ApplyTemplateInputSchema = z.object({
  templateId: z.string().min(1).describe('Template identifier'),
  publish: z.boolean().optional().default(true).describe('Create a preview link (default). Set false only when the user asks to keep the diagram private.'),
  customizations: z.object({
    renameNodes: z.record(z.string(), z.string()).optional().describe('Map of node ID to new label'),
    addNodes: z.array(z.object({
      id: z.string(),
      label: z.string(),
      category: z.string(),
      color: z.string(),
      icon: z.string(),
    })).optional().describe('Additional nodes to add'),
  }).optional().describe('Optional customizations to apply'),
});

export type GenerateDiagramInput = z.infer<typeof GenerateDiagramInputSchema>;
export type ApplyTemplateInput = z.infer<typeof ApplyTemplateInputSchema>;

export const UpdateDiagramInputSchema = z.object({
  expectedRevision: z.number().int().nonnegative().optional().describe('Revision returned by get_diagram_state. Required when updating a published diagram to prevent overwriting a newer edit.'),
  addNodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    tier: z.string(),
    subtitle: z.string().optional(),
    icon: z.string().optional(),
    tierColor: z.string().optional(),
    accentColor: z.string().optional(),
    status: z.enum(['healthy', 'warning', 'error', 'unknown']).optional(),
    isGroup: z.boolean().optional(),
    parentId: z.string().optional(),
    groupColor: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  })).optional(),
  removeNodeIds: z.array(z.string()).optional(),
  addEdges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    communicationType: z.enum(['sync', 'async', 'stream', 'event', 'dep']).optional(),
    label: z.string().optional(),
    pathType: z.enum(['smooth', 'Smoothstep', 'bezier', 'step', 'straight']).optional(),
  })).optional(),
  removeEdgeIds: z.array(z.string()).optional(),
  updateNodes: z.array(z.object({
    id: z.string(),
    label: z.string().optional(),
    subtitle: z.string().optional(),
    tier: z.string().optional(),
    tierColor: z.string().optional(),
    accentColor: z.string().optional(),
    icon: z.string().optional(),
    status: z.enum(['healthy', 'warning', 'error', 'unknown']).optional(),
  })).optional(),
});

export type UpdateDiagramInput = z.infer<typeof UpdateDiagramInputSchema>;


export const GenerateDiagramOutputSchema = z.object({
  success: z.boolean(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.object({
      label: z.string(),
      icon: z.string(),
      layer: z.string(),
      tier: z.string().optional(),
      tierColor: z.string().optional(),
      accentColor: z.string().optional(),
      subtitle: z.string().optional(),
      status: z.string().optional(),
      isGroup: z.boolean().optional(),
    }),
    width: z.number().optional(),
    height: z.number().optional(),
    parentNode: z.string().optional(),
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string(),
    targetHandle: z.string(),
    type: z.string(),
    animated: z.boolean(),
    label: z.string(),
    data: z.object({
      communicationType: z.string(),
      pathType: z.string(),
    }),
  })),
  elkPositions: z.array(z.object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  })),
  metadata: z.object({
    nodeCount: z.number(),
    edgeCount: z.number(),
    layoutAlgorithm: z.string(),
    direction: z.string(),
  }),
  diagramUrl: z.string().optional(),
  sessionId: z.string().optional(),
  embeddedDiagram: z.object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
  }).optional(),
  message: z.string().optional(),
  errors: z.array(z.string()).optional(),
});

export const ApplyTemplateOutputSchema = z.object({
  success: z.boolean(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.object({
      label: z.string(),
      icon: z.string(),
      layer: z.string(),
      tier: z.string().optional(),
      tierColor: z.string().optional(),
      category: z.string().optional(),
    }),
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string(),
    targetHandle: z.string(),
    type: z.string(),
    data: z.object({
      communicationType: z.string(),
      pathType: z.string(),
    }),
  })),
  metadata: z.object({
    templateName: z.string(),
    nodeCount: z.number(),
    edgeCount: z.number(),
  }),
  diagramUrl: z.string().optional(),
  sessionId: z.string().optional(),
  message: z.string().optional(),
  errors: z.array(z.string()).optional(),
});

// ─── draw_on_canvas ──────────────────────────────────────────────────────────

const CanvasId = z.string().regex(/^[A-Za-z0-9_.:-]{1,64}$/, 'ids use letters, digits and _ . : - (max 64)');
const Coord = z.number().finite().min(-100_000).max(100_000);
const Length = z.number().finite().min(8).max(5000);
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'colors are #rrggbb');
const TextSizeEnum = z.enum(['small', 'medium', 'large', 'heading']);
const SideEnum = z.enum(['top', 'right', 'bottom', 'left']);
const FreeText = z.string().max(4000);

export const CARD_SHAPES = [
  'rounded-rectangle', 'rectangle', 'diamond', 'circle', 'cylinder', 'hexagon', 'cloud',
  'parallelogram', 'shield', 'actor', 'monitor', 'mobile', 'dashed-rectangle',
] as const;

const At = { x: Coord.describe('Left edge on the canvas, in px (canvas coordinates, y grows downward).'), y: Coord.describe('Top edge on the canvas, in px.') };

export const DrawOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('text'),
    id: CanvasId.optional().describe('Optional id so later operations can refer to it; generated when omitted.'),
    text: FreeText.describe('The text. May be empty (a blank text box to fill in) and may contain line breaks.'),
    ...At,
    size: TextSizeEnum.optional().describe('small | medium (default) | large | heading.'),
    bold: z.boolean().optional(),
    color: Hex.optional().describe('Ink color. Omit to follow the light/dark theme.'),
    parent: CanvasId.optional().describe('Group to place it in; x / y are then still canvas coordinates.'),
  }),
  z.object({
    op: z.literal('card'),
    id: CanvasId.optional(),
    ...At,
    title: FreeText.optional().describe('Text on the card. Leave empty for a blank card the user can click and write in.'),
    subtitle: FreeText.optional().describe('Smaller second line under the title.'),
    shape: z.enum(CARD_SHAPES).optional().describe('Silhouette; default rounded-rectangle. diamond = decision, cylinder = database, cloud = external service, actor = person.'),
    width: Length.optional(),
    height: Length.optional(),
    color: Hex.optional().describe('Outline and accent color.'),
    fill: Hex.optional().describe('Background color.'),
    parent: CanvasId.optional(),
  }),
  z.object({
    op: z.literal('note'),
    id: CanvasId.optional(),
    ...At,
    title: FreeText.optional(),
    body: FreeText.optional().describe('Longer text under the title; wraps inside the note.'),
    titleSize: TextSizeEnum.optional(),
    bodySize: TextSizeEnum.optional(),
    width: Length.optional(),
    height: Length.optional(),
    parent: CanvasId.optional(),
  }),
  z.object({
    op: z.literal('component'),
    id: CanvasId.optional(),
    ...At,
    label: z.string().min(1).max(200),
    subtitle: FreeText.optional(),
    tier: z.enum(['client', 'edge', 'compute', 'async', 'data', 'observe', 'external']).optional().describe('Colors the component; default compute.'),
    icon: z.string().max(64).optional().describe('lucide-react icon name.'),
    status: z.enum(['healthy', 'warning', 'error', 'unknown']).optional(),
    width: Length.optional(),
    height: Length.optional(),
    parent: CanvasId.optional(),
  }),
  z.object({
    op: z.literal('group'),
    id: CanvasId.optional(),
    label: z.string().max(200).optional(),
    children: z.array(CanvasId).max(200).optional().describe('Nodes to put inside; the group is sized to wrap them (with padding) unless x/y/width/height are given.'),
    x: Coord.optional(),
    y: Coord.optional(),
    width: Length.optional(),
    height: Length.optional(),
    color: Hex.optional().describe('Background tint.'),
  }),
  z.object({
    op: z.literal('connect'),
    id: CanvasId.optional(),
    from: CanvasId,
    to: CanvasId,
    label: z.string().max(200).optional(),
    style: z.enum(['solid', 'dashed', 'thick']).optional().describe('solid (default), dashed (async / optional), thick (main flow).'),
    arrow: z.enum(['end', 'both']).optional().describe('end (default) points at `to`; both points both ways.'),
    color: Hex.optional(),
    path: z.enum(['smooth', 'step', 'straight', 'bezier']).optional().describe('How the line bends; default smooth.'),
    fromSide: SideEnum.optional().describe('Leave from this side of `from` (a preference; the router still avoids nodes).'),
    toSide: SideEnum.optional().describe('Arrive at this side of `to`.'),
  }),
  z.object({
    op: z.literal('update'),
    id: CanvasId.describe('The node or edge to change.'),
    text: FreeText.optional().describe('text nodes: the text.'),
    title: FreeText.optional().describe('card / note: the title (card: the text on it).'),
    subtitle: FreeText.optional(),
    body: FreeText.optional().describe('note: the body.'),
    label: FreeText.optional().describe('component / group / edge: the label.'),
    size: TextSizeEnum.optional().describe('text nodes: the size.'),
    bold: z.boolean().optional(),
    color: Hex.optional(),
    fill: Hex.optional(),
    shape: z.enum(CARD_SHAPES).optional(),
    x: Coord.optional(),
    y: Coord.optional(),
    width: Length.optional(),
    height: Length.optional(),
    parent: CanvasId.nullable().optional().describe('Move into a group (an id) or out of one (null); the node stays where it is on the canvas.'),
    style: z.enum(['solid', 'dashed', 'thick']).optional().describe('edges only.'),
  }),
  z.object({
    op: z.literal('move'),
    ids: z.array(CanvasId).min(1).max(200),
    dx: Coord.optional().describe('Shift right by this many px (negative: left).'),
    dy: Coord.optional().describe('Shift down by this many px (negative: up).'),
    x: Coord.optional().describe('Or put the left edge of the whole selection here.'),
    y: Coord.optional().describe('Or put the top edge of the whole selection here.'),
  }),
  z.object({
    op: z.literal('align'),
    ids: z.array(CanvasId).min(2).max(200),
    mode: z.enum(['left', 'center', 'right', 'top', 'middle', 'bottom']).describe('left / center / right line up the vertical edges or middle; top / middle / bottom the horizontal ones.'),
  }),
  z.object({
    op: z.literal('distribute'),
    ids: z.array(CanvasId).min(2).max(200),
    axis: z.enum(['horizontal', 'vertical']),
    gap: z.number().finite().min(0).max(2000).optional().describe('Fixed gap in px between neighbours; omit to spread evenly between the two outermost.'),
  }),
  z.object({
    op: z.literal('remove'),
    ids: z.array(CanvasId).min(1).max(200).describe('Nodes and / or edges. Removing a node removes its edges; removing a group frees its children.'),
  }),
  z.object({
    op: z.literal('clear'),
  }),
]);

export const DrawOnCanvasInputSchema = z.object({
  ops: z.array(DrawOpSchema).min(1).max(200).describe('Drawing operations, applied in order. All of them apply or none do.'),
  label: z.string().max(200).optional().describe('Title of a new canvas (used when the canvas is first published).'),
  publish: z.boolean().default(true).describe('Create / update the shareable preview link (default true). false keeps the drawing in this session only.'),
  style: z.enum(['sketch', 'studio', 'studio-metallic', 'neubrutalism', 'precision']).default('sketch').describe('Look of the shareable image and preview, matching the editor render styles: sketch (hand-drawn, like a whiteboard; default), studio (clean), studio-metallic (satin metal), neubrutalism (bold), precision. Pick the one the user works in.'),
  expectedRevision: z.number().int().positive().optional(),
});

export const LayoutDiagramInputSchema = z.object({
  direction: z.enum(['LR', 'TD']).default('LR').describe('Main flow direction: LR (left to right) or TD (top down).'),
  arrangement: z.enum(['flow', 'zones']).default('flow').describe('flow: ranks follow the data flow (default). zones: hub-and-zones, with clients on the left, data above and chains below.'),
  fold: z.boolean().optional().describe('Wrap a long flow into rows so it fits a 16:9 screen (default true). false keeps one long row or column.'),
  mixDirections: z.boolean().optional().describe('Let groups run the other way (top-down inside a left-to-right diagram) when that fits the screen clearly better (default true). false keeps every group in the main direction.'),
  groupDirections: z.record(z.string(), z.enum(['LR', 'TD'])).optional().describe('Force the direction inside particular groups, by group id, e.g. {"api":"TD"}. Groups you name are never overridden by mixDirections.'),
  label: z.string().max(200).optional(),
  publish: z.boolean().default(true).describe('Update the shareable preview link (default true). false keeps the change in this session only.'),
  style: z.enum(['sketch', 'studio', 'studio-metallic', 'neubrutalism', 'precision']).default('studio').describe('Look of the preview and shareable image. Defaults to studio (clean); pick the one the user works in.'),
  expectedRevision: z.number().int().positive().optional(),
});

export type LayoutDiagramInput = z.infer<typeof LayoutDiagramInputSchema>;
export type DrawOp = z.infer<typeof DrawOpSchema>;
export type DrawOnCanvasInput = z.infer<typeof DrawOnCanvasInputSchema>;
