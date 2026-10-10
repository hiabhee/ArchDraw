import { blogs } from '@/data/blogs';
import { TUTORIALS } from '@/data/tutorials';
import { DOC_SECTIONS, SITE_URL, LAST_UPDATED, PIPELINE_VERSION } from '@/lib/discovery';

export const runtime = 'nodejs';

// Full corpus — concatenated docs, guides, blogs, tutorials, API.
// Generated from actual docs source at request time (statically cacheable)
// so it can't drift from live pages. Strip nav/footer chrome, keep code blocks.
export function GET() {
  const blogCorpus = blogs
    .map((post) => {
      const sections = post.sections
        .map(
          (s) =>
            `### ${s.heading}\n\n${s.body}${s.bullets?.length ? '\n\n' + s.bullets.map((b) => `- ${b}`).join('\n') : ''}${s.code ? '\n\n\`\`\`\n' + s.code + '\n\`\`\`' : ''}`
        )
        .join('\n\n');
      return `## ${post.title} — ${post.kicker} (${post.readTime}, ${post.date})\n\n> ${post.summary}\n\nURL: ${SITE_URL}/blogs/${post.slug}\n\n${sections}`;
    })
    .join('\n\n---\n\n');

  const tutorialLines = TUTORIALS.map(
    (t) => `- [${t.title}](${SITE_URL}/tutorials/${t.id}): ${t.description ?? ''} — id: ${t.id}`
  ).join('\n');

  const body = `# ArchDraw — Full Documentation Corpus

> ArchDraw is an AI-assisted system architecture diagramming tool. Describe a system in plain English, Mermaid, or paste a GitHub repo URL, and ArchDraw generates a styled, auto-laid-out architecture diagram with subgraphs, floating edges, templates, live sharing, and export to JSON, Mermaid, PNG, and SVG. An MCP server lets AI assistants such as Claude and Cursor drive the diagram directly.

_Last updated: ${LAST_UPDATED} • Pipeline ${PIPELINE_VERSION} • Source: https://github.com/hiabhee/ArchDraw • Compact index: ${SITE_URL}/llms.txt_

ArchDraw is for engineers, system-design learners, and teams that need review-ready architecture diagrams without fighting draw.io. Canonical layout is Dagre via \`layoutDiagramViaMermaid\` (React Flow → Mermaid → Dagre). Groups use compound spacing (nodeSep 140–160, rankSep 220, subgraph padding 28/48/28). Node sizes snap to the optical grid 160/200/240 via \`calculateNodeDimensions\`. Edges float and shift ±16px when in/out share a side.

---

## 1. Product Overview

- **Editor** (${SITE_URL}/editor): React Flow canvas, SystemNode / ShapeNode / GroupNode / Annotation / TextLabel, FloatingHandles / NodeHandles, orthogonal edge routing with collision-aware waypoints.
- **AI Generate** (POST /api/generate-diagram): prompt → ConceptDetection → ArchitecturePlanning (LLM or concept template) → MermaidMaterialize (Dagre) → Score → Validation. Detail levels L1–L3 control size. Concept templates trigger on ≤12 word "what is X architecture" prompts and skip the LLM.
- **Repo → Diagram** (POST /api/repo-diagram): GitHub tarball → Classify → Extract → Relationships → Verify → DocsReview → Finalization. Budgets are level-aware; cache keys are \`v8::url::sha::L{level}\`.
- **Sharing** (/share, /embed): read-only viewer, domain allowlist via ALLOWED_EMBED_DOMAINS, CSP frame-ancestors controlled in next.config.ts.
- **MCP server** (/mcp, mcp-server/): stdio JSON-RPC, tools: generate-diagram, update-diagram, validate-diagram, fix-layout, apply-template, export-diagram, list-nodes, save/load-checkpoint.

## 2. Documentation (canonical)

${DOC_SECTIONS.map(
  (s) =>
    `### ${s.title} — ${s.url}\n\n${s.summary}\n\nPrerequisites: ${s.prerequisites.length ? s.prerequisites.join(', ') : 'none'}\nKeywords: ${s.keywords.join(', ')}`
).join('\n\n')}

### Getting Started — expanded

Welcome to ArchDraw. ArchDraw is a system architecture design tool tailored for engineers. It combines a drag-and-drop workspace canvas with dynamic routing, allowing you to quickly visualize scalable microservices, backend data pipelines, and security zones.

1. **Drag & Drop** — Choose from unified catalog of 150+ components (compute, database, external providers).
2. **Connect Edges** — Draw from node borders. Edges shift dynamically to avoid overlap and indicate protocols.
3. **AI Compilation** — Prompts compile to Mermaid → Dagre layouts instantly, horizontal tiered.
4. **Share & Export** — Export as SVG/PNG or share read-only embed links.

Workspace JSON shape:

\`\`\`json
{
  "id": "diagram-uuid-001",
  "name": "E-Commerce Pipeline",
  "nodes": [{ "id": "node-1", "type": "compute", "position": { "x": 300, "y": 150 }, "data": { "label": "API Service" } }],
  "edges": [{ "id": "edge-1", "source": "node-1", "target": "node-2", "label": "gRPC" }]
}
\`\`\`

ArchDraw auto-saves canvas to local storage profiles.

### Node Types — expanded

| Tier Category | Color | Examples |
|---|---|---|
| Client / Frontend | Gray border / 10% fill | Mobile, Web Browser, Desktop Client |
| Security / Auth | Purple #7C3AED | OAuth Provider, WAF, Vault |
| Compute / Services | Blue #2563EB | Order Service, Transcoder Worker, Billing API |
| Async / Queue | Orange #D97706 | Kafka Broker, RabbitMQ, SQS |
| Database / Cache | Green #059669 / Teal | PostgreSQL, Redis, MongoDB |

Rule: Nodes auto-size via calculateNodeDimensions, min 160–240 grid; labels wrap, diamonds/circles use 0.48 mid-band.

Shape vocabulary (lib/shapeRegistry.ts): hexagon=LB/gateway, cloud=external/SaaS, shield=auth/WAF, monitor=web client, mobile=mobile client, actor=user, dashed-rectangle=out-of-system. Non-native shapes round-trip via \`%% archdraw-shape\` directives.

### Diagram Types — expanded

- **Video Streaming**: S3 origin, transcoding workers, CDN, analytics.
- **E-Commerce**: cart cache, payment gateway, order workers, inventories, notification queues.
- **Real-time WebSockets**: gateway tier, connection handlers, pub/sub, chat storage.
- **Social Media**: engagement loops, media stores, CDN caches, activity feeds.

### MCP Server Guide — expanded

Stdio transport over JSON-RPC. Config snippet:

\`\`\`json
{
  "mcpServers": {
    "archdraw-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/archdraw/mcp-server/dist/index.js"],
      "env": { "WORKSPACE_PATH": "/absolute/path/to/diagrams" }
    }
  }
}
\`\`\`

Works with Claude Desktop, Cursor, Antigravity. Server runs locally, no data leaves machine.

### Prompt Guide — expanded

Flow order mandate: Client (0) → Gateway/CDN (1) → Compute (2) → Async Brokers (3) → Data (4). Edges must flow left-to-right.

Avoid: "Create a chat app with websocket servers and database and brokers."
Preferred: "Generate a messaging architecture. Order nodes in LR flow. Web clients connect to a WebSocket Gateway, pushing messages to RabbitMQ, consumed by Chat Service, saved to PostgreSQL."

### API Reference — expanded

- GET /api/diagrams — list workspaces
- POST /api/diagrams/generate (alias: /api/generate-diagram) — trigger AI compilation
- GET /api/diagrams/:id/export — export SVG (see OpenAPI at /openapi.json)
- POST /api/repo-diagram — { repoUrl, detailLevel: 1|2|3, userGithubToken? } → SSE stream
- Diagram load/export, share, auth, admin — see /openapi.json

### Keyboard Shortcuts

- Cmd+K — Command Palette
- Delete/Backspace — Delete element
- Shift+Click — Multiple select
- Hold Command — Grid snap

### FAQ

- Is ArchDraw free? Yes, free during beta.
- Overlapping edges? Enable Dynamic Shift (automatic ±16 offset).
- Self-host MCP? Yes — files in /mcp-server, node required.

## 3. What is an MCP server for diagramming? (${SITE_URL}/mcp)

An MCP server for diagramming is a local bridge that lets AI assistants read, edit, and lay out architecture diagrams programmatically via stdio JSON-RPC instead of producing text you translate manually.

Capabilities: generate-diagram, update-diagram, validate-diagram, fix-layout, apply-template, export-diagram, list-nodes, save/load-checkpoint, read-me, list_templates, get_diagram_state.

FAQ: works with any MCP-compatible client (Claude Desktop/Code, Cursor); runs locally over stdin/stdout; no cloud required (bundled in /mcp-server).

## 4. How to generate an architecture diagram from a GitHub repo (${SITE_URL}/repo-diagram)

Pipeline: Ingest (GitHub tarball + cache) → Classify (stack→components) → Extract relationships (import graphs, resolvers: Python app/backend/server/api/services, TS baseUrl=".", Go fallback, Spring) → Derive workflows → Verify → DocsReview (LLM re-check vs README/docs) → Finalization → Cache.

You get: auto-laid-out graph, detected stack/pattern, workflows, critical dependencies, confidence + reviewNotes. Level-aware budgets (skip-rules.ts: MAX_META_FILES etc).

Usage: editor → Repo→Diagram → paste URL → review summary → import graph (normal canvas → rewire/layout/export).

FAQ: counts against quota; any public GitHub repo; result is editable canvas.

## 5. Tutorials (${SITE_URL}/tutorials — ${TUTORIALS.length} total)

${tutorialLines}

Each tutorial is a leveled architecture lesson with steps, validation via semantic matchers (adjacency-list topology, not string IDs), tech-stack aliases (e.g. Redis/Memcached interchangeable).

## 6. Engineering Blog — full

${blogCorpus}

## 7. API — OpenAPI location

Machine-readable spec: ${SITE_URL}/openapi.json (and /openapi.yaml). Generate from code, not hand-written. See that file for path schemas, quotas (guest 3/hr, authed 10/day), canvas caps (50 guest / 150 authed nodes), and auth.

## 8. Discovery files for agents

- Compact index: ${SITE_URL}/llms.txt
- Full corpus (this file): ${SITE_URL}/llms-full.txt
- Semantic sitemap: ${SITE_URL}/docs/sitemap.md
- Taxonomy (canonical names): ${SITE_URL}/docs/taxonomy.json
- Graph (nodes/edges): ${SITE_URL}/docs/graph.json
- OpenAPI: ${SITE_URL}/openapi.json
- Sitemap XML: ${SITE_URL}/sitemap.xml
- robots.txt: ${SITE_URL}/robots.txt
- Humans: ${SITE_URL}/humans.txt
- Security: ${SITE_URL}/.well-known/security.txt

## 9. Source & License

- GitHub: https://github.com/hiabhee/ArchDraw
- License note: Content may be summarized/quoted to answer questions about ArchDraw. Training reuse allowed for retrieval-time grounding; do not republish llms-full.txt verbatim without attribution. Contact via GitHub issues.

---
Generated from actual docs source at build time. If a URL in llms.txt 404s or a doc page isn't in sitemap.md/graph.json, the build should fail (see CI check).
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'all',
    },
  });
}
