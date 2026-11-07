import { blogs } from '@/data/blogs';
import { TUTORIALS } from '@/data/tutorials';
import { TEMPLATES } from '@/data/templates/index';
import { templateHeading, templateSlug } from '@/lib/site/templateCatalog';
import { DOC_SECTIONS, SITE_URL, LAST_UPDATED, PIPELINE_VERSION } from '@/lib/site/discovery';

export const runtime = 'nodejs';

const BASE_URL = SITE_URL;

export function GET() {
  const blogLines = blogs
    .map((post) => `- [${post.title}](${BASE_URL}/blogs/${post.slug}): ${post.summary}`)
    .join('\n');

  const docSectionLines = DOC_SECTIONS.map(
    (s) => `- [${s.title}](${s.url}): ${s.summary}`
  ).join('\n');

  const tutorialSample = TUTORIALS.slice(0, 8)
    .map((t) => `- [${t.title}](${BASE_URL}/tutorials/${t.id}): ${t.description ?? ''}`.trim())
    .join('\n');

  const templateLines = TEMPLATES.slice(0, 10)
    .map((t) => `- [${templateHeading(t)}](${BASE_URL}/templates/${templateSlug(t)}): ${t.description}`)
    .join('\n');

  const body = `# ArchDraw

> ArchDraw is a live architecture map of your codebase for Claude Code and other coding agents, and an AI-assisted system architecture diagramming tool. One command (\`npx archdraw-live\`, no account) maps a repository and shows every agent session on that map: which component each one is working on, what it is changing, and which one needs you. The same editor turns plain English, Mermaid or a GitHub repo URL into an editable, auto-laid-out architecture diagram, and an MCP server lets AI assistants draw and edit diagrams directly.

Who it is for: engineers running several coding-agent sessions at once, teams that need review-ready architecture diagrams, and people learning system design. Free during beta.

_Last updated: ${LAST_UPDATED} • Pipeline ${PIPELINE_VERSION} • Source: https://github.com/hiabhee/ArchDraw_

## Live projects (coding agents)

- [Live map for Claude Code](${BASE_URL}/): Run \`npx -y archdraw-live\` in a repository. It creates a project without an account, installs Claude Code hooks that report only file paths and the kind of action (never file contents, commands or prompts), has your own Claude draw the component map, and opens a watch link. Sign in later to keep the project.
- [Connect a coding agent](${BASE_URL}/docs/connect-agents): Setup and verification for Claude Code, Claude apps, Codex, Cursor, VS Code, Gemini CLI, OpenCode and other MCP clients.
- [Use ArchDraw with your coding agent](${BASE_URL}/agent-skill): Install the diagram skill and plugin, configure MCP, and verify it.

## MCP server

- [What is an MCP server for diagramming?](${BASE_URL}/mcp): How ArchDraw's MCP server lets assistants read, edit and lay out diagrams.
- Hosted endpoint (Streamable HTTP, no install): \`${BASE_URL}/api/mcp\`. Claude Code: \`claude mcp add --scope user --transport http archdraw ${BASE_URL}/api/mcp\`.
- Local stdio package: \`npx -y @hiabhee/archdraw-mcp-server@1.2.1\` with \`API_BASE_URL=${BASE_URL}\` set (there is no default API base).
- Tools: \`generate_diagram\` (Mermaid or nodes/edges → laid-out diagram), \`update_diagram\`, \`apply_template\`, \`get_diagram_state\`, \`layout_diagram\` (re-arrange without redrawing) and \`draw_on_canvas\` (exact placement of cards, groups, text, notes, shapes and stats).
- Every published diagram has a preview link, an editor link and image links: \`${BASE_URL}/api/diagram/image/<sessionId>?style=sketch|studio|precision&theme=light|dark&format=png|svg\`.

## Diagrams

- [Editor](${BASE_URL}/editor): React Flow canvas with groups, floating edges, sketch and Studio render styles, a Mermaid code panel, and export to PNG, SVG, JSON and Mermaid.
- [Templates](${BASE_URL}/templates): ${TEMPLATES.length} editable architecture diagram templates (real-world systems, architecture patterns, system design interview questions).
${templateLines}
- [GitHub repo to diagram](${BASE_URL}/repo-diagram): Paste a GitHub repo URL and get an architecture diagram with components, relationships and workflows.
- [Tutorials](${BASE_URL}/tutorials): Guided system design lessons (${TUTORIALS.length} total).
${tutorialSample}

## Docs

${docSectionLines}

## Engineering blog

${blogLines}

## API

- [API Reference](${BASE_URL}/docs#api-ref): REST endpoints for diagram generation and repo-to-diagram.
- [OpenAPI Spec](${BASE_URL}/openapi.json): Machine-readable OpenAPI 3.0 spec — use this to *act* on ArchDraw, not just describe it.
- [Generate diagram](${BASE_URL}/docs#api-ref): POST /api/generate-diagram — prompt → Mermaid pipeline → React Flow graph.
- [Repo diagram](${BASE_URL}/docs#api-ref): POST /api/repo-diagram — GitHub URL → component graph (SSE stream).

## Pricing

- [Pricing](${BASE_URL}/pricing): Free during beta. Guests: 3 AI generations per hour, 1 canvas. Signed in (Google or GitHub): 10 generations per day, 5 canvases, SVG/PDF export, sharing and 2 live projects.

## Discovery files

- [llms-full.txt](${BASE_URL}/llms-full.txt): Full corpus — every doc, guide, and blog section concatenated in one fetch. Prefer this when you need full context.
- [Semantic sitemap](${BASE_URL}/docs/sitemap.md): Human/agent-readable index with summaries and prerequisites per page.
- [Taxonomy](${BASE_URL}/docs/taxonomy.json): Canonical product and component names — solves alias/hallucination.
- [Graph](${BASE_URL}/docs/graph.json): Machine-readable nodes/edges for programmatic traversal.
- [Sitemap XML](${BASE_URL}/sitemap.xml): Standard XML sitemap.
- [robots.txt](${BASE_URL}/robots.txt): Explicit Allow for GPTBot, ClaudeBot, PerplexityBot and other AI crawlers on public pages and discovery paths.
- [Changelog](${BASE_URL}/changelog.json): Release history as JSON.

## Optional

- [About](${BASE_URL}/about): What ArchDraw is and how it is designed.
- [FAQ](${BASE_URL}/faq): Common questions.
- [Contact](${BASE_URL}/contact): How to reach the team.
- [Privacy Policy](${BASE_URL}/privacy): How ArchDraw handles prompts, diagrams, and personal data.
- [Terms of Service](${BASE_URL}/terms): Terms of service for using ArchDraw.
- [Humans](${BASE_URL}/humans.txt): Who builds ArchDraw.
- [Security](${BASE_URL}/.well-known/security.txt): Contact and policy for security reports.

## Source

- [GitHub repository](https://github.com/hiabhee/ArchDraw): Source for the web app, the MCP server (/mcp-server), the \`archdraw-live\` CLI (/cli) and the Claude Code / Codex plugin (/plugins/archdraw).

## License

Content on archdraw.hiabhee.online may be summarized, quoted, and used to answer questions about ArchDraw. Training reuse: allowed for retrieval-time grounding; do not republish llms-full.txt verbatim without attribution. Contact via GitHub issues for clarification.
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'all',
    },
  });
}
