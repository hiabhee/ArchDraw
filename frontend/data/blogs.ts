import type { BlogDemoId } from '@/components/landing/BlogDemo';

export interface BlogSection {
  heading: string;
  /** Paragraphs are separated by a blank line. */
  body: string;
  bullets?: string[];
  code?: string;
  /** File the code block comes from, shown above it. */
  codeTitle?: string;
  /** Interactive demo rendered after the text (see components/landing/BlogDemo). */
  demo?: BlogDemoId;
}

export interface BlogPost {
  slug: string;
  title: string;
  kicker: string;
  category: string;
  readTime: string;
  date: string;
  summary: string;
  sections: BlogSection[];
}

export const blogs: BlogPost[] = [
  {
    slug: 'live-projects-performance',
    title: 'How we made live projects fast',
    kicker: 'Performance',
    category: 'Engineering',
    readTime: '12 min',
    date: 'Oct 12, 2026',
    summary:
      'A live project shows each coding-agent session on an architecture diagram. Our first build froze the editor, signed users out and showed agents late. This post shows each cause, the code we changed and the numbers. Each section has a demo that you can change.',
    sections: [
      {
        heading: 'The system',
        body:
          'A project is a canvas. Coding agents (for example, Claude Code sessions) send the file paths that they edit. The server maps each path to a diagram component. The editor polls for activity and shows a badge on each component that a session touches.\n\nThe stack is Next.js (App Router), React Flow 11, Zustand, Prisma 7 with Postgres, and Claude Code hooks. Our test diagram had 47 nodes (9 groups) and 43 edges. The editor supports 150 nodes, so this size must be easy.\n\nOur rule for this work: measure first, then change code. We used CPU profiles from headless Chrome, store-update counters and a timer on each server step.',
        code: `Claude Code session ─ PostToolUse hook (file path) ─▶ archdraw-project.mjs
  archdraw-project.mjs ─ POST /activity (Bearer adp_ token) ─▶ Next.js API route ─▶ Postgres (AgentSession)
Editor tab ─ GET /live every 3 s ─▶ Next.js API route
Editor tab ─▶ React Flow canvas + badges ─ edge layout ─▶ Web Worker`,
      },
      {
        heading: 'Canvas rendering: a 32-second freeze',
        body:
          'The agent published the diagram. The browser then showed "Page Unresponsive". The CPU profile showed one long task of 31.7 seconds. The top functions were SimpleFloatingEdge.useMemo[route] (14.3 s), scoreAllHandlerPairs (10.0 s) and useHandleSlotLayout (4.7 s). Three causes multiplied each other.\n\nChange the inputs below to see how the main-thread work grows. The model counts full route calculations on the main thread during one load.',
        bullets: [
          'The layout worker never started. A module in its import graph used typeof window !== \'undefined\'. Next.js replaces this check with true in all client bundles. A worker is a client bundle, but it has no window, so the worker failed when it loaded and sent no reply.',
          'The fallback was the full router. Until the worker plan arrives, each edge calculated its own obstacle-aware route on the main thread, and each node handle scored all four sides for each of its edges.',
          'Each node caused a full pass. Each ShapeNode called updateNodeInternals(id) in its own microtask. Each call made a new nodeInternals map, which is a dependency of every edge. We counted 273 render passes during one load.',
          'Fixes: read the port from globalThis.location; the worker sends a ready message (5 s timeout, then one main-thread calculation); edges draw a right-angle placeholder until the plan arrives; all size updates go to React Flow in one batch.',
          'Result: the long task went from 32 s to 7 s in a development build. The remaining time is React development overhead, which production builds do not have.',
        ],
        demo: 'render-work',
        codeTitle: 'frontend/components/canvas/nodes/ShapeNode.tsx',
        code: `const pendingInternals = new Map<UpdateNodeInternals, Set<string>>();

function queueNodeInternalsUpdate(update: UpdateNodeInternals, id: string) {
  const ids = pendingInternals.get(update);
  if (ids) { ids.add(id); return; }
  pendingInternals.set(update, new Set([id]));
  queueMicrotask(() => {
    const batch = pendingInternals.get(update);
    pendingInternals.delete(update);
    if (batch?.size) update([...batch]); // React Flow 11 accepts string[]
  });
}`,
      },
      {
        heading: 'Edge geometry: 87 false failures',
        body:
          'When the worker started to work, a banner said "87 hard geometry issues". Many edges also showed an amber dash-dot line, which is the warning style for a route that fails validation. All checked violations had the same form: an edge "crossed" the group that holds its own source or target.\n\nThe router treats the ancestor groups of both endpoints as passable, because an edge must cross its own group border to leave the group. The final routeStatus() check got only the two endpoint ids, so it counted those groups as obstacles. Use the switch to compare.',
        bullets: [
          'Result: hard issues went from 87 to 7. The 7 that remain come from one real edge that crosses a stack of nodes.',
          'The banner now shows only hard issues. Edge crossings (72 on this diagram) are normal in a dense architecture diagram, so they do not show a warning.',
        ],
        demo: 'geometry-check',
        codeTitle: 'frontend/lib/diagram/edges/edgeRouteBuilder.ts',
        code: `const passableGroupIds = new Set([
  ...getAncestorGroupIds(edge.source, nodes),
  ...getAncestorGroupIds(edge.target, nodes),
])
// Validation must skip the same groups routing treats as passable, or every
// edge leaving its own group is reported as crossing it.
const validationExcludedIds = new Set([...excludedIds, ...passableGroupIds])

- let validation = routeStatus(result.waypoints, nodes, excludedIds, terminals)
+ let validation = routeStatus(result.waypoints, nodes, validationExcludedIds, terminals)`,
      },
      {
        heading: 'Auto-save: conflicts with no edits',
        body:
          'Saves use optimistic concurrency. Each save sends baseUpdatedAt. If the server copy is newer, the server returns 409 and the editor shows "changed in another tab". The user saw this warning, but the user did not edit the canvas.\n\nAfter each updateNodeInternals call, React Flow reports a dimensions change for each node, also when the size is the same. applyNodeChanges returns a new array, and the auto-save subscriber compares arrays by reference, so it saw an edit and saved 1.5 s later. If the agent published in that time, the save carried an old version.',
        bullets: [
          'The store now ignores a size report that is equal to the stored size (a real resize still saves).',
          'A selection change does not start a save.',
          'This also removes one full canvas render after each load. A conflict writes a warning to the log, not an error, because the toast already handles it.',
        ],
        codeTitle: 'frontend/store/diagram/slices/graphSlice.ts',
        code: `export function dropNoopDimensionChanges(changes: NodeChange[], nodes: Node[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return changes.filter((c) => {
    if (c.type !== 'dimensions' || !c.dimensions || c.resizing !== undefined || c.updateStyle) return true;
    const node = byId.get(c.id);
    if (!node || node.width == null || node.height == null) return true;
    return Math.abs(node.width - c.dimensions.width) >= 0.5
        || Math.abs(node.height - c.dimensions.height) >= 0.5;
  });
}`,
      },
      {
        heading: 'Sign-in: a rate limit that signed users out',
        body:
          'After some hard refreshes, users had to sign in again. The sessions in the database were valid for 7 days. The cause was the auth rate limit: 20 requests per 60 seconds, with one bucket for each IP and path. Each page load and each tab focus calls /get-session. Request 21 got a 429, and the client read a 429 the same as "no session".\n\nA session read only checks a cookie that the user already has. An attacker cannot use it to guess credentials, so the exemption is safe. The sign-in paths keep the limit.',
        demo: 'session-bucket',
        codeTitle: 'frontend/lib/server/auth.ts',
        code: `rateLimit: {
  enabled: true,
  window: 60,
  max: 20,
  // A 429 here looks like "no session" to the client, which then signs the
  // user out, so only the sign-in paths stay limited.
  customRules: { '/get-session': false },
},`,
      },
      {
        heading: 'Agent hooks: sessions that did not arrive',
        body:
          'Users paired the agent again for each new session. The pairing was not the problem: one link in ~/.archdraw/projects.json serves all sessions in a checkout for 90 days. But new sessions never showed on the canvas, so users thought the link had failed.\n\nThe hook script stopped each request after 1.5 seconds, because hooks run inside the agent loop. The local API needed 2.4 to 3.7 seconds. So the start report was lost, edit reports were lost, and the start note said "0 components". That note told the agent to map the codebase again.',
        bullets: [
          'Activity reports now go out from a detached background process with a 15 s budget. The agent does not wait for it.',
          'If the component map does not load in 4 s, the start note says "not loaded yet", never "0 components".',
          'The payload goes in argv, not through a pipe, because a parent process can exit before a pipe flushes. It holds paths only; the token stays in the 0600 link file.',
          'A test uses a server that answers in 4.5 s: the session still registers and the note says "not loaded yet".',
        ],
        demo: 'hook-timeline',
        codeTitle: 'plugins/archdraw/scripts/archdraw-project.mjs',
        code: `function sendInBackground(cwd, payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  spawn(process.execPath, [SCRIPT_PATH, 'send', cwd, encoded],
        { detached: true, stdio: 'ignore' }).unref();
}

async function runSend([cwd, encoded]) {
  const binding = loadBinding(cwd); // token read from disk, never argv
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  await api(binding, '/activity', { method: 'POST', body: JSON.stringify(payload), timeoutMs: 15_000 });
}`,
      },
      {
        heading: 'Server API: 7 seconds for one report',
        body:
          'Each activity report took 7 seconds. We timed each step in-process against the same database. One select 1 took 320 ms, because the test database is in a distant region. Then we found three problems.\n\nUse the switches to apply each fix. Use the slider to change the database round-trip time. At 5 ms (same region, as in production), round trips matter much less.',
        bullets: [
          'Rate limit, 3,004 ms on each call. The Upstash host no longer existed (DNS failure), so each call waited for the 3-second timeout. Fix: a 30-second circuit breaker. It still throws, so AI quota checks keep their fail-closed fallback.',
          'Canvas lookup, 1,733 ms. The nested select (project → workspaces) made more than one query and read the full diagram JSON. Fix: agent routes use one query with no relations; owner routes skip the JSON and run the session check and canvas lookup in parallel.',
          'Credential check, 1,359 ms: one read, then one lastUsedAt write on each request. Fix: write lastUsedAt at most once a minute.',
          'Result: POST /activity went from 7.0 s to 1.4 s, and the component map from 3.0 s to 0.7 s.',
        ],
        demo: 'api-waterfall',
        codeTitle: 'frontend/lib/server/redis.ts',
        code: `const REDIS_RETRY_AFTER_MS = 30_000;
let redisRateLimitDownUntil = 0;

// Still throws: callers keep their fail-closed fallbacks (AI quotas).
if (Date.now() < redisRateLimitDownUntil) {
  throw new RedisRateLimitError('Redis rate limit skipped: recently unreachable');
}
// ...
} catch (error) {
  redisRateLimitDownUntil = Date.now() + REDIS_RETRY_AFTER_MS;
  throw new RedisRateLimitError(/* ... */);
}`,
      },
      {
        heading: 'Results and lessons',
        body:
          'All numbers come from a local development server with a remote test database. We did not measure a production build.',
        bullets: [
          'Canvas: longest main-thread task on load went from 32 s to 7 s (development build).',
          'Geometry: hard issues on the test diagram went from 87 to 7.',
          'Auto-save: saves with no user edit went from one per load to none.',
          'Auth: session reads that succeed went from 11 of 25 to 25 of 25.',
          'Hooks: with a 3 s server, the session report went from lost to delivered.',
          'API: POST /activity went from 7.0 s to 1.4 s; the component map from 3.0 s to 0.7 s.',
          'Lesson: measure before you change code. The diagram size was not the problem; one profile showed the real cause.',
          'Lesson: look for multipliers. A small cost × each edge × each node × each pass became 32 seconds.',
          'Lesson: do not report "unknown" as "zero". A slow request told the agent that the project was empty, so it did the work again.',
          'Lesson: count round trips. At 320 ms each, the number of sequential queries matters more than all other work.',
          'Lesson: make the state visible. The pairing worked, but the panel did not say so, so users paired again.',
        ],
      },
    ],
  },
  {
    slug: 'archdraw-claude-code-opencode',
    title: 'Give your coding agent an architecture workspace with ArchDraw',
    kicker: 'Agent Integrations',
    category: 'Integrations',
    readTime: '8 min',
    date: 'Sep 8, 2026',
    summary:
      'Connect ArchDraw to Codex, Claude Code, or OpenCode so an agent can turn repository context into an editable, shared architecture view while implementation work is happening.',
    sections: [
      {
        heading: 'Why a coding agent needs more than a diagram generator',
        body:
          'A coding agent can inspect a repository, trace a request path, and suggest a safe implementation plan. But that understanding is usually trapped inside a chat session. ArchDraw gives the agent a durable visual workspace: it can turn codebase knowledge into an editable architecture view that an engineer can inspect, share, correct, and export. The valuable outcome is not a one-off image. It is a shared architecture view created at the moment the agent has the most relevant context.'
      },
      {
        heading: 'How the ArchDraw skill and MCP server work together',
        body:
          'The ArchDraw skill provides the agent with architecture-specific guidance: when to model a system, what evidence to inspect, how to distinguish current state from a proposal, and what makes a diagram useful. The MCP server provides the actions. The agent can generate a diagram from Mermaid, validate the active view, fix its layout, make targeted updates, preserve checkpoints, and export the result. Together, they turn an architecture question into an ArchDraw workspace rather than a disconnected text response.'
      },
      {
        heading: 'Set up ArchDraw in Codex',
        body:
          'Codex supports local MCP servers and discovers installed skills from its skills directory. Copy the complete archdraw-diagram skill directory to ~/.codex/skills/archdraw-diagram/, then add the ArchDraw MCP server. Restart Codex after installing the skill or changing MCP configuration.',
        code: `codex mcp add archdraw --env API_BASE_URL=https://archdraw.hiabhee.online -- npx -y @hiabhee/archdraw-mcp-server@1.0.5
codex mcp list`,
        bullets: [
          'The ArchDraw skill supplies architecture-specific guidance; the MCP server provides the diagram actions.',
          'The same setup works in Codex CLI and makes the ArchDraw tools available to the agent working in your repository.',
          'The local server requires API_BASE_URL. Without it, the tools load but diagram generation fails. For a self-hosted ArchDraw deployment, use its URL instead.',
        ],
      },
      {
        heading: 'Set up ArchDraw in Claude Code',
        body:
          'Install the ArchDraw skill first, then connect the local MCP server. Restart Claude Code after the connection is added. The skill tells Claude how to approach architecture work; the MCP server creates and manages the diagram in ArchDraw.',
        code: `npx skills add hiabhee/archdraw-skill --skill archdraw-diagram -g -a claude-code
claude mcp add --scope user --transport http archdraw https://archdraw.hiabhee.online/api/mcp
claude mcp list`,
        bullets: [
          'This connects Claude Code to the hosted ArchDraw MCP endpoint. Nothing runs on your machine.',
          'The ArchDraw plugin does the same in one step: /plugin marketplace add hiabhee/ArchDraw, then /plugin install archdraw@archdraw.',
          'For a self-hosted ArchDraw deployment, use https://<your-domain>/api/mcp as the URL.',
        ],
      },
      {
        heading: 'Set up ArchDraw in OpenCode',
        body:
          'OpenCode supports local MCP servers and discovers skills from a project or user-level skills directory. Add ArchDraw to an opencode.json configuration, then copy the complete archdraw-diagram skill directory into .opencode/skills for a project-specific installation. OpenCode automatically connects the local server unless it is disabled.',
        code: `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "archdraw": {
      "type": "remote",
      "url": "https://archdraw.hiabhee.online/api/mcp",
      "enabled": true
    }
  }
}

opencode mcp list`,
        bullets: [
          'Install the skill at .opencode/skills/archdraw-diagram/SKILL.md for one repository, or ~/.config/opencode/skills/archdraw-diagram/SKILL.md for personal use.',
          'This is the OpenCode v1 format. OpenCode v2 nests servers under mcp.servers instead; see /docs/connect-agents#opencode for both.',
          'Ask explicitly for the archdraw-diagram skill if you want to guarantee that the agent loads its architecture workflow.',
        ],
      },
      {
        heading: 'Ask an architecture question, not a drawing question',
        body:
          'The strongest prompts connect a diagram to an engineering decision. Ask the agent to inspect the relevant code and documentation before modelling, then request an editable view and a clear account of uncertainty. This prevents a generic boxes-and-arrows diagram from being mistaken for an accurate architecture record.',
        code: `Use ArchDraw to map the checkout request flow in this repository. Inspect the relevant routes,
services, data stores, and external integrations first. Create an editable diagram, identify any
uncertain relationships, and give me the ArchDraw URL.`,
      },
      {
        heading: 'Use a proposed-state view before implementation',
        body:
          'Architecture diagrams are most valuable before a risky change—not after the details have been forgotten. Ask the agent to create a proposed-state view for a migration, refactor, or new asynchronous workflow. It should identify changed components, new dependencies, affected data or event paths, and the assumptions that require a human decision. A proposal must be labelled clearly so it is never confused with the repository’s current state.',
        code: `We are splitting the payment module. Use ArchDraw to create a proposed-state architecture view,
show the affected dependencies and data flows, and clearly separate facts from assumptions.`,
      },
      {
        heading: 'A practical workflow for engineering teams',
        body:
          'Start each significant change with an architecture question. Let the agent inspect the accessible repository and create a current-state view, then review and correct it with the team in ArchDraw. Create a proposed-state view before implementation, and link the finished view in a pull request, design document, or handover note. For a GitHub repository that is not already available in an agent’s workspace, use ArchDraw’s Repo2Diagram workflow where it is available. This keeps diagrams connected to real engineering work instead of treating them as presentation artifacts.',
        bullets: [
          'Map the relevant subsystem before changing it.',
          'Review evidence and correct any uncertain relationships.',
          'Create a distinct proposed-state view before implementation.',
          'Share the final ArchDraw URL where the team reviews the change.',
        ],
      },
      {
        heading: 'The result: shared architectural memory',
        body:
          'The purpose of the integration is not to make agents draw prettier diagrams. It is to give agents and humans a shared place to understand a system, reason about change, and preserve the decisions that matter. Install the skill and MCP server, open a repository, and start with one question: before I change this code, what architecture do I need to understand?'
      },
    ],
  },
  {
    slug: 'canvas-editor-react-flow',
    title: 'How we built an interactive, state-driven diagramming canvas',
    kicker: 'Canvas System',
    category: 'Engineering',
    readTime: '12 min',
    date: 'May 22, 2026',
    summary:
      'A deep conceptual guide on how to design a fluid interactive canvas editor that coordinates nodes, edges, keyboard interactions, and grid alignment under a clean state architecture.',
    sections: [
      {
        heading: 'Why standard HTML drag-and-drop layouts break in complex editors',
        body:
          'When beginners start building a visual design tool, they often fall into a trap. They absolute-position standard HTML div elements and bind mouse drag events directly to their CSS coordinates. While this works for a couple of cards, it quickly breaks down. Once you introduce zoom controls, pan gestures, connected lines, and command palettes, updating individual DOM coordinates manually becomes a performance nightmare. Zooming requires translating screen mouse positions into canvas coordinates, and panning shift offsets must apply to all nodes simultaneously. A naive implementation results in stuttering renders, edge lines detached from boxes, and coordinate conflicts during active layouts.'
      },
      {
        heading: 'The concept of separating the visual viewport from the data store',
        body:
          'To build a scalable and responsive canvas editor, you must treat the canvas solely as a rendering surface and keep the canonical model in an independent state machine. The editor is split into two halves: the Viewport Renderer and the State Manager. The Viewport handles zoom levels, translation vectors, drag visualizers, and standard DOM events. The State Manager holds a flat list of node objects, where each node is defined by a simple JSON structure containing an ID, type, coordinate position, and visual data properties. When a user drags a node on the screen, the Viewport captures the pixel delta, updates the local rendering coordinates at 60 FPS for instant visual feedback, and notifies the State Manager only when the interaction stops to finalize the position.'
      },
      {
        heading: 'Implementing grid snapping and collision checks',
        body:
          'Ensuring that diagrams look neat requires alignment mechanics. We implement grid snapping using coordinate quantization. When a node is dragged, its raw coordinate is passed through a grid math filter. This rounds the raw coordinate to the nearest grid step. For example, on a 20px grid, the math is simple. This calculation ensures that nodes align to clean rows and columns. Following coordinate resolution, the layout engine executes bounding box checks to confirm that nodes do not overlap, automatically shifting collision areas to keep elements spaced.'
      },
      {
        heading: 'Capturing keyboard shortcuts and context menus',
        body:
          'A professional design tool must feel keyboard-first. We achieve this by listening to global document event handlers. By intercepting keydown events, we can trigger actions like spawning a search menu when hitting Cmd+K or deleting selected nodes when hitting Backspace. To manage context menus on right-clicks, we prevent the browser\'s default menu, capture the clientX and clientY mouse coordinates, convert them relative to the zoomed canvas viewport, and render a floating portal menu containing alignment, connection, and styling options.'
      }
    ]
  },
  {
    slug: 'floating-edge-routing',
    title: 'This is why our diagram connections float dynamically instead of breaking',
    kicker: 'Graph Rendering',
    category: 'Mathematics',
    readTime: '11 min',
    date: 'May 21, 2026',
    summary:
      'How to design a geometry-driven connection engine that calculates attachment points on the fly and shifts overlapping parallel paths.',
    sections: [
      {
        heading: 'The limitation of hardcoded connection ports',
        body:
          'In traditional charting applications, connecting lines are tied to hardcoded ports on a box, such as "port-right" or "port-bottom". While this makes manual wiring simple, it is highly fragile for dynamic or automated layouts. If an AI generates a diagram or a user swaps a template, the nodes are rearranged automatically. If lines remain locked to their original ports, they cross over the boxes, double back on themselves, or clip through other elements. A premium canvas needs edges that calculate their attachment points dynamically based on where the boxes are positioned relative to each other.'
      },
      {
        heading: 'Calculating attachment vectors using box geometry',
        body:
          'To make edges float, we treat each node as a bounding box defined by a center coordinate, width, and height. When drawing a line between a source box and a target box, the rendering engine first calculates the delta between their center points. By analyzing the vertical and horizontal differences, the algorithm determines the dominant axis of the path. If the horizontal distance is greater than the vertical distance, the line attaches to the Left or Right borders of the nodes. If the vertical distance is greater, it attaches to the Top or Bottom borders. This ensures that the line always takes the shortest, most natural path between the shapes.'
      },
      {
        heading: 'Uncluttering parallel paths using perpendicular shift offsets',
        body:
          'When two components have bidirectional communication (e.g., a Client calling an API, and the API returning a stream), drawing straight lines from center to center makes them overlap, rendering them as a single line. We resolve this by counting how many edges share a connection path between two nodes. We sort the connection IDs lexicographically to establish a stable order. Then, we apply a perpendicular shifting offset (such as adding or subtracting 15 pixels) to the attachment coordinates along the border. This shifts the lines outward, creating clean, parallel visual tracks that denote separate request and response flows.'
      },
      {
        heading: 'Drawing bezier curves and path markers',
        body:
          'SVG paths are drawn using cubic Bézier mathematical formulas. A Bézier curve takes a start point, an end point, and two control points that determine how the line bends. By placing the control points outward from the selected borders, the line curves gracefully around the node boundaries rather than cutting diagonally. Finally, arrowheads and indicators are drawn using SVG markers attached to the path endpoints, automatically rotating to match the tangent angle of the curve where it touches the box.'
      }
    ]
  },
  {
    slug: 'ai-generation-pipeline',
    title: 'How we engineered an 8-stage compiler to generate clean system diagrams',
    kicker: 'AI Pipeline',
    category: 'AI & Systems',
    readTime: '15 min',
    date: 'May 20, 2026',
    summary:
      'Designing an AI diagram generation pipeline that processes raw prompts, sanitizes graph relations, layouts nodes, and self-heals layouts.',
    sections: [
      {
        heading: 'Why asking LLMs for direct layout coordinates fails',
        body:
          'If you ask a standard large language model to output a diagram with exact layout positions, the results are highly chaotic. LLMs do not have native spatial awareness. They will stack database nodes directly on top of client browsers, place load balancers at random coordinates, and draw edges that cross each other. Furthermore, they frequently omit critical architecture nodes—for instance, placing a CDN without an origin object storage or connecting a database directly to a client browser. We need to treat diagram generation as a multi-stage compilation pipeline.'
      },
      {
        heading: 'The 8-stage compilation architecture',
        body:
          'To generate professional architectures, we divide the pipeline into distinct stages. In Stage 1, we identify the architectural domain. Stage 2 plans the abstract tiers (e.g., Client tier, Gateway tier, Compute tier, Database tier). Stage 3 extracts the required nodes and metadata. Stage 4 maps the edges and protocols. Stage 5 runs semantic validation filters (e.g., checking if database connections bypass the backend compute tier, or verifying that push notification gateways use websockets). Stage 6 feeds the clean structural graph to a layered layout calculator to assign coordinates. Stage 7 translates layout boundaries to the canvas coordinate system, and Stage 8 scores the diagram quality.'
      },
      {
        heading: 'Creating automated self-healing layout feedback loops',
        body:
          'If the pipeline detects validation errors (e.g. a database connecting directly to the browser client, or an auth service acting as an intermediate gateway hop for general business requests), it does not fail. Instead, it triggers an auto-repair loop. The pipeline packages the specific structural violations, compiles them into a developer-friendly error log, and feeds them back to the reasoning model as a corrective prompt. The model processes the feedback, refines the adjacency relationships, and runs the layout generator again, repeating up to three times until the quality score passes.'
      },
      {
        heading: 'Applying layered layout algorithms',
        body:
          'Once the logical connections are finalized, we pass the nodes and edges to a layered graph layout engine (such as ELK or Dagre). These engines organize nodes into horizontal or vertical ranks. Nodes in the Client tier are ranked first, followed by Gateways, Compute, and Databases. The layout engine computes positions that minimize crossing lines, keeps nodes vertically aligned, and maintains a minimum separation boundary (e.g., 120px between tiers, 60px between nodes in the same tier), resulting in neat, professional diagrams.'
      }
    ]
  },
  {
    slug: 'mcp-server-claude-antigravity',
    title: 'How our local MCP server hooks AI engines directly into the visual workspace',
    kicker: 'MCP Integration',
    category: 'Integrations',
    readTime: '13 min',
    date: 'May 19, 2026',
    summary:
      'Understanding the Model Context Protocol stdio transport layer and connecting external AI assistants to manipulate canvas files.',
    sections: [
      {
        heading: 'Bridging the gap between LLM chat interfaces and UI canvases',
        body:
          'AI assistants like Claude and Antigravity are great at writing code in a text box, but they are blind to the graphical user interface. They cannot click buttons, draw nodes, or inspect the layout coordinates of a canvas. If a user asks the AI to "insert a caching layer between my API and database," the AI needs a standardized channel to programmatically inspect the active nodes, calculate the new connections, and write back the coordinates. The Model Context Protocol (MCP) solves this by providing a unified bridge.'
      },
      {
        heading: 'How stdio and JSON-RPC power local tool execution',
        body:
          'Our local MCP server operates as a lightweight process communicating via standard input/output (stdio). When an AI client wants to call a tool, it writes a structured JSON-RPC message to the server\'s stdin. The server parses the request, performs the operation (such as adding a component or running a layout calculation), and writes a JSON-RPC response back to stdout. This architecture is fast, highly secure (as it runs locally on the user\'s machine), and requires no external network gateways.'
      },
      {
        heading: 'Exposing diagram manipulation tools to the AI',
        body:
          'The MCP server exposes specific tools to the AI client. These tools act as API endpoints for the canvas. The AI can call tools to query the current node positions, trigger layout repairs, apply templates, and insert components. When a tool is invoked, the server recalculates the graph structure, saves the new state to a local session file, and signals the web frontend to reload the workspace, allowing the AI to edit the diagram in real-time as you chat.'
      },
      {
        heading: 'Configuring desktop clients for local integration',
        body:
          'Connecting an AI assistant is straightforward. Both Claude Desktop and Antigravity read local configuration files (like `claude_desktop_config.json` or `mcp_config.json`). The config defines a list of server processes, specifying the command (e.g., "node") and the absolute path to the compiled server file. Once loaded, the AI client automatically registers the tools and makes them available within the chat interface, enabling instant system design capabilities.'
      }
    ]
  },
  {
    slug: 'setup-mcp-claude-desktop',
    title: 'How to set up the ArchDraw MCP server in Claude Desktop',
    kicker: 'MCP Setup',
    category: 'Integrations',
    readTime: '6 min',
    date: 'Aug 13, 2026',
    summary:
      'A step-by-step guide to connecting the ArchDraw MCP server to Claude Desktop so Claude can generate, edit, validate, and export architecture diagrams directly from the chat window.',
    sections: [
      {
        heading: 'What you need before you start',
        body:
          'The easiest method is a custom connector. Claude Desktop then connects to the hosted ArchDraw server at `https://archdraw.hiabhee.online/api/mcp`. You do not install software, and you do not clone the repository. If you cannot use a custom connector, use the local server. The local server needs Node.js 18 or later.',
        bullets: [
          'Claude Desktop, installed and signed in',
          'Network access to `archdraw.hiabhee.online`',
          'For the local server only: Node.js 18 or later. Type `node --version` to examine the version.',
        ],
      },
      {
        heading: 'Add ArchDraw as a custom connector (recommended)',
        body:
          'Go to Settings → Connectors and select Add custom connector. Type `ArchDraw` as the name and the URL below. Then select Add. The connector is also available on claude.ai and in Claude mobile with the same account. On Team and Enterprise plans, it is possible that an owner must add the connector first.',
        code: `https://archdraw.hiabhee.online/api/mcp`,
      },
      {
        heading: 'Use the local server (alternative)',
        body:
          'Use this method only if you cannot use a custom connector. Open the Claude Desktop configuration file. The path depends on your operating system:',
        bullets: [
          'macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`',
          'Windows: `%APPDATA%\\Claude\\claude_desktop_config.json`',
        ],
      },
      {
        heading: 'Register the local server in the config file',
        body:
          'Add an `archdraw` entry to the `mcpServers` block. `npx` downloads the pinned version of the server from npm and runs it. You must set `API_BASE_URL`. If you do not set it, the tools show, but diagram generation and layout do not operate.',
        code: `{
  "mcpServers": {
    "archdraw": {
      "command": "npx",
      "args": ["-y", "@hiabhee/archdraw-mcp-server@1.0.5"],
      "env": {
        "API_BASE_URL": "https://archdraw.hiabhee.online"
      }
    }
  }
}`,
        bullets: [
          '`command` — if Claude cannot find `npx`, use the full path from `which npx`',
          '`args` — the pinned package version; change the number to update',
          '`env.API_BASE_URL` — the ArchDraw API; use your own domain for a self-hosted deployment',
        ],
      },
      {
        heading: 'Restart Claude Desktop and verify the connection',
        body:
          'MCP servers are discovered at startup, so fully quit Claude Desktop (Cmd+Q on macOS) and reopen it. Open a chat and click the tools icon to see the connected server, or simply ask Claude what it can do. The `read_me` tool returns the full server reference — asking for it first is a good habit.',
        code: `"Draw a three-tier architecture: a React frontend, a Node API behind an API gateway, and a PostgreSQL database"`,
      },
      {
        heading: 'What Claude can do once connected',
        body:
          'Once the server is registered, Claude can drive the entire diagram workflow from the chat window. The server exposes these tools over stdio:',
        bullets: [
          '`read_me` — the full server reference; call it first to learn the rules and domain checklist',
          '`generate_diagram` — turn a prompt or Mermaid snippet into a laid-out diagram',
          '`update_diagram` — add nodes, rewire edges, and change tiers on the current canvas',
          '`validate_diagram` and `fix_layout` — run structural checks and repair the layout',
          '`apply_template` and `list_templates` — load curated architecture templates',
          '`save_checkpoint` and `load_checkpoint` — snapshot and restore diagram state',
          '`export_diagram` — export as JSON, PNG, or SVG',
          '`list_node_types` — look up available components and icons',
          '`get_diagram_state` — inspect the current canvas nodes and edges',
        ],
      },
      {
        heading: 'Troubleshooting',
        body: 'Most connection issues come from paths, PATH resolution, or forgetting to restart Claude. Walk through these in order:',
        bullets: [
          'The local server does not start — make sure that Node.js 18 or later is installed. Type `node --version` to examine the version.',
          '`npx` is not found — replace `"npx"` in the config with the full path from `which npx`.',
          'The tools show, but generation fails with "requires API_BASE_URL" — add `API_BASE_URL` to the `env` block.',
          'Tools do not appear after editing the config — quit Claude Desktop completely (Cmd+Q), not just the window, and reopen it.',
          'Config file is invalid — check Claude\'s log file (`claude_mcp_logs.txt`, stored next to the config) for JSON parse errors.',
        ],
      },
    ],
  },
  {
    slug: 'templates-authored-layouts',
    title: 'How we preserved authored coordinates and achieved high-fidelity template previews',
    kicker: 'Templates',
    category: 'Engineering',
    readTime: '10 min',
    date: 'May 18, 2026',
    summary:
      'Balancing automated layouts with custom human compositions, and scaling complex vector previews inside tiny dashboard cards.',
    sections: [
      {
        heading: 'The conflict between automatic layout engines and human composition',
        body:
          'While automatic layout algorithms are useful for organizing generated nodes, they are too rigid for professional architectures. Humans compose diagrams with semantic spatial meaning—placing primary clients in a sidebar, stacking redundant compute nodes vertically, and clustering failover databases on the right. If every template is forced through a standard Dagre or ELK layout pass, these design details are lost, flattening them into generic grids. We need a way to combine both methods.'
      },
      {
        heading: 'Preserving authored coordinates in template schemas',
        body:
          'To maintain human-designed layouts, our template loader implements a conditional check. When a user selects a template, the loader inspects the node definitions. If the template contains pre-authored non-zero X and Y coordinates, the engine skips the automatic layout pass and places the nodes exactly as defined. If coordinates are missing (like in raw AI outputs), the layout engine runs to arrange the nodes neatly, giving the best of both worlds.'
      },
      {
        heading: 'Achieving visual parity between previews and the editor',
        body:
          'A common issue in diagramming platforms is that dashboard preview thumbnails are generic static icons that do not match the actual diagram. To fix this, our dashboard cards reuse the exact same rendering logic, colors, curves, and arrow directions as the main canvas. By sharing the geometric calculation methods (like calculating edge shifts and Bézier control points), we guarantee that the thumbnail looks identical to the full-size editor canvas.'
      },
      {
        heading: 'Scaling large vector canvases to fit small card slots',
        body:
          'Rendering a heavy, interactive canvas library inside a small card is slow and causes performance lag when scrolling a dashboard grid. Instead, we render the diagram as a static, non-interactive SVG. We calculate the bounding box of all nodes in the diagram (finding the minimum and maximum X/Y coordinates) to determine the total width and height. We then apply a CSS scale transform to scale the vector graphic down, fitting the entire system architecture perfectly within the card boundaries.'
      }
    ]
  },
  {
    slug: 'state-persistence-tabs',
    title: 'How one store coordinates active canvas state, multi-canvas tabs, and persistence',
    kicker: 'State Management',
    category: 'Engineering',
    readTime: '13 min',
    date: 'May 17, 2026',
    summary:
      'Designing a centralized state store that manages tab transitions, historical undo/redo stacks, and debounces database writes.',
    sections: [
      {
        heading: 'Managing high-frequency interactions without database bottlenecks',
        body:
          'An architecture editor must feel responsive. When a user drags a node across the canvas, the coordinate updates must render smoothly at 60 FPS. However, saving these coordinates directly to a database on every frame will cause thousands of network requests, leading to rate limiting, database lockups, and UI stutter. We need a centralized, in-memory client state store to handle fast interactions and update the database only when necessary.'
      },
      {
        heading: 'The centralized store architecture',
        body:
          'We use a centralized state store (like Zustand) to act as the single source of truth. The store maintains the state of the active canvas, the list of open tabs, and user selections. When a user switches tabs, the store automatically saves the active canvas state to the tab index before loading the next canvas data, preventing data loss. This keeps the application snappy and responsive, even when working with complex multi-canvas projects.'
      },
      {
        heading: 'Implementing historical stacks for undo and redo',
        body:
          'A reliable design tool needs robust history management. We implement this using two stacks: a Past stack and a Future stack. Every time a user performs an action (e.g., adding a node, deleting an edge, or finishing a drag), we push a snapshot of the current canvas onto the Past stack. When the user hits Undo, we pop the top state from the Past stack, apply it to the canvas, and push the previous state onto the Future stack, allowing users to move backward and forward through their edit history.'
      },
      {
        heading: 'Debouncing database saves to optimize performance',
        body:
          'To keep the database sync efficient, we implement a debouncing queue. When a change occurs (like dragging a node), the editor updates the local in-memory store instantly. At the same time, it schedules a save function to run after a delay (e.g., 1000ms). If another edit occurs before the timer fires, the previous timer is cancelled and a new one starts. Once the user stops editing, the final state is flushed to the database in a single network request, reducing database load.'
      }
    ]
  },
  {
    slug: 'sharing-embed-export',
    title: 'This is why shared embeds load instantly and securely',
    kicker: 'Distribution',
    category: 'Security',
    readTime: '12 min',
    date: 'May 16, 2026',
    summary:
      'Building a lightweight read-only rendering engine for shared links and serializing canvas DOM states into clean SVG vectors.',
    sections: [
      {
        heading: 'The need for lightweight, read-only viewing modes',
        body:
          'Sharing an architecture diagram with external stakeholders shouldn\'t require them to load a heavy editing suite, log in, or risk breaking the layout. Exposing editing controls on public sharing links is a security risk. To solve this, we separate the canvas rendering logic into a lightweight viewer. This viewer reads the diagram data from the database and renders the canvas with all editing tools (dragging, sidebars, context menus, toolbars) completely disabled.'
      },
      {
        heading: 'Designing secure and fast sharing routes',
        body:
          'We use dedicated sharing and embed routes that load only the essential rendering components. When a user requests a shared link, the server fetches the diagram state from the database, checks if the document is marked as public, and renders the canvas in read-only mode. This ensures fast page loads and prevents unauthorized modifications, making shared links secure and lightweight.'
      },
      {
        heading: 'Serializing canvas DOM states into static SVG vectors',
        body:
          'For users who need to download diagrams for slide decks or documentation, we serialize the canvas into a standalone SVG file. The exporter parses the DOM structure of the active canvas, extracts the HTML and CSS styles for each node, and compiles them into a single SVG string. By bundling custom styling rules directly within the SVG, we ensure the downloaded file renders correctly in any browser or design tool.'
      },
      {
        heading: 'Generating high-resolution PNG and PDF assets',
        body:
          'Once the SVG string is compiled, we can easily convert it into high-resolution PNG or PDF assets. The SVG is loaded into an in-memory browser instance or HTML5 canvas context, scaled to the desired resolution, and exported as a binary file. This allows users to download sharp, professional vector assets that can be scaled infinitely without losing quality or pixelating.'
      }
    ]
  },
  {
    slug: 'tutorial-engine-validation',
    title: 'How we validate architectural topologies dynamically',
    kicker: 'Learning System',
    category: 'Algorithms',
    readTime: '11 min',
    date: 'May 15, 2026',
    summary:
      'Designing a flexible graph validation engine that checks semantic relationships and topological paths instead of static node IDs.',
    sections: [
      {
        heading: 'The challenge of validating dynamic architectural designs',
        body:
          'Teaching system design interactively is difficult because there are many valid ways to build the same system. If we validate a student\'s diagram by checking for specific node coordinates or exact text matches (e.g. node.label === "Auth Service"), the validation will fail if the student names the node differently or places it in a different position. We need a validation system that checks the logical relationships (topology) between nodes, rather than static strings.'
      },
      {
        heading: 'Converting visual canvases into graph adjacency lists',
        body:
          'To validate the diagram, we first convert the visual layout of nodes and edges into a graph adjacency list. An adjacency list maps each node ID to a list of its connected target nodes. This converts the visual diagram into a structured format that we can easily traverse and analyze using graph algorithms, letting us check paths and connections programmatically.'
      },
      {
        heading: 'Implementing semantic matchers for architectural rules',
        body:
          'We write validation rules using semantic matchers that check for logical patterns. For example, a "Load Balancer Rule" verifies that all incoming client traffic passes through a load balancer before reaching any compute nodes. Instead of checking for specific node IDs, the matcher looks for node categories (e.g., Client, Load Balancer, Compute), checking if the connections form the correct path, regardless of where they are placed.'
      },
      {
        heading: 'Fuzzy matching with tech stack aliases',
        body:
          'To give students more freedom, we support fuzzy matching using tech stack aliases. Each node has a category (like Cache) and an alias (like Redis or Memcached). The validation engine checks the category rather than the specific tech stack. This allows students to use either Redis or Memcached to satisfy a caching requirement, making the validator flexible and supportive of different design choices.'
      }
    ]
  },
  {
    slug: 'component-registry-command-palette',
    title: 'That\'s how our unified component registry powers search and drag-and-drop',
    kicker: 'Component System',
    category: 'Engineering',
    readTime: '10 min',
    date: 'May 14, 2026',
    summary:
      'Consolidating 150+ cloud resources into a single metadata schema that powers both visual sidebars and keyboard command palettes.',
    sections: [
      {
        heading: 'The challenge of managing a large cloud resource catalog',
        body:
          'An architecture diagramming tool needs to support a wide range of cloud resources, including databases, compute instances, messaging queues, and storage buckets. Managing this catalog across both a drag-and-drop sidebar and a keyboard-driven command palette can lead to code duplication, inconsistent styling, and outdated icons. We need a single registry to act as the source of truth for all component definitions.'
      },
      {
        heading: 'Designing a unified metadata schema',
        body:
          'We define a unified component registry where each resource type is registered with its metadata, including display name, category, icon, default dimensions, and default visual styles (like border colors and backgrounds). This schema is read by both the sidebar and the command palette, ensuring that components look and behave consistently, regardless of how they are added to the canvas.'
      },
      {
        heading: 'Passing metadata through HTML5 drag-and-drop events',
        body:
          'When a user drags a component from the sidebar, we serialize its registry metadata into the HTML5 drag event\'s data transfer object. When the component is dropped onto the canvas, the editor reads the data transfer payload, calculates the drop coordinates relative to the canvas zoom level, and initializes the new node using the registered defaults, making drag-and-drop smooth and reliable.'
      },
      {
        heading: 'Fuzzy search and instant command palette insertion',
        body:
          'For keyboard-first users, the command palette (Cmd+K) provides a fast way to insert components. The palette reads the registry, filters items dynamically using a client-side fuzzy search algorithm, and displays the matching results. When a user selects a component, it is inserted at the center of the active canvas viewport, allowing users to build diagrams without touching the mouse.'
      }
    ]
  },
  {
    slug: 'dashboard-previews',
    title: 'How we achieved pixel-perfect thumbnail parity on the dashboard',
    kicker: 'Dashboard',
    category: 'Engineering',
    readTime: '9 min',
    date: 'May 13, 2026',
    summary:
      'Designing static vector previews that share coordinate mathematics with the main canvas to ensure exact visual parity.',
    sections: [
      {
        heading: 'The performance bottleneck of dashboard previews',
        body:
          'Showing high-fidelity previews of saved diagrams on the user dashboard is important for navigation. However, rendering a full-scale interactive canvas library inside every dashboard card is slow, consuming excessive memory and causing scrolling lag. On the other hand, using static mock icons makes it hard for users to distinguish between their saved projects. We need a lightweight rendering solution that preserves visual accuracy.'
      },
      {
        heading: 'Reusing geometry calculations for preview renders',
        body:
          'To ensure the thumbnail matches the actual diagram, the preview card uses the exact same geometry calculations as the main editor. It reads the node positions, calculates the connection vectors, and applies the edge offset shifting math. This guarantees that curves bend, lines align, and arrows point in the identical directions, achieving 1:1 visual parity with the editor.'
      },
      {
        heading: 'Optimizing SVG rendering for dashboard cards',
        body:
          'Instead of mounting the heavy canvas library, the preview card renders a lightweight, static SVG version of the diagram. The SVG scales automatically to fit the card dimensions, using CSS classes for theme colors and styling. This approach is highly efficient, allowing the dashboard to render dozens of previews simultaneously without any performance lag.'
      },
      {
        heading: 'Calculating bounding boxes and scale transforms',
        body:
          'To fit the diagram inside the card, the preview component calculates the bounding box of all nodes to determine the diagram\'s total width and height. It then calculates a scale factor to scale the diagram down to fit the card dimensions. By centering the viewport on the diagram\'s center, we ensure the preview is cropped and aligned correctly, regardless of the diagram\'s size.'
      }
    ]
  }
];
