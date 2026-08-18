export interface BlogSection {
  heading: string;
  body: string;
  bullets?: string[];
  code?: string;
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
          'You need three things before connecting the server: a recent Node.js runtime (18 or newer) so the server can run, a local clone of the ArchDraw repository, and Claude Desktop itself. The MCP server lives inside the repository in the `mcp-server/` directory — it is a self-contained Node process, so nothing needs to be hosted or deployed. If you want the server to persist diagram session files, create a folder for them too (for example `~/ArchDraw/diagrams`); you will point `WORKSPACE_PATH` at it in a later step.',
        bullets: [
          'Node.js 18+ — check with `node --version`',
          'A local clone of the ArchDraw repository (the server builds from `mcp-server/`)',
          'Claude Desktop, installed and signed in',
        ],
        code: `node --version`,
      },
      {
        heading: 'Install dependencies and build the server',
        body:
          'The server talks to MCP clients over standard input/output (stdio), so it must be compiled before Claude can launch it. Open a terminal, move into the `mcp-server` directory, install its dependencies, and build. TypeScript compiles the source into `dist/index.js`, which is the file you will point Claude at. During development you can also run `npm run dev` to launch the server straight from source with tsx.',
        code: `cd mcp-server
npm install
npm run build`,
      },
      {
        heading: 'Open your Claude Desktop configuration file',
        body:
          'Claude Desktop reads its MCP configuration from a local JSON file. The exact path depends on your operating system:',
        bullets: [
          'macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`',
          'Windows: `%APPDATA%\\Claude\\claude_desktop_config.json`',
          'Linux: `~/.config/Claude/claude_desktop_config.json`',
        ],
      },
      {
        heading: 'Register the server in the config file',
        body:
          'Add an `mcpServers` block to the JSON. Each entry names a server and describes how Claude should launch it: the command to run (`node`), the absolute path to the compiled server (`dist/index.js`), and an optional `WORKSPACE_PATH` environment variable pointing at the folder where diagram session files are written. Replace the two paths below with real ones.',
        code: `{
  "mcpServers": {
    "archdraw-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/archdraw/mcp-server/dist/index.js"],
      "env": {
        "WORKSPACE_PATH": "/absolute/path/to/diagrams"
      }
    }
  }
}`,
        bullets: [
          '`command` — how to start the process; if `node` is not on Claude\'s PATH, use the full binary path from `which node`',
          '`args` — the absolute path to `mcp-server/dist/index.js`',
          '`env.WORKSPACE_PATH` — where diagram session files are saved; create the folder before launching Claude',
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
          '`export_diagram` — export as JSON, Mermaid, PNG, or SVG',
          '`list_node_types` — look up available components and icons',
          '`get_diagram_state` — inspect the current canvas nodes and edges',
        ],
      },
      {
        heading: 'Troubleshooting',
        body: 'Most connection issues come from paths, PATH resolution, or forgetting to restart Claude. Walk through these in order:',
        bullets: [
          'The server shows as failed to start — make sure `args` points at `mcp-server/dist/index.js` and that you ran `npm run build` after the latest changes.',
          '`node` is not found — replace `"node"` in the config with the full binary path from `which node`.',
          'Tools do not appear after editing the config — quit Claude Desktop completely (Cmd+Q), not just the window, and reopen it.',
          'Config file is invalid — check Claude\'s log file (`claude_mcp_logs.txt`, stored next to the config) for JSON parse errors.',
          'No session files are written — create the `WORKSPACE_PATH` directory before starting Claude.',
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
