import { blogs } from '@/data/blogs';
import { TUTORIALS } from '@/data/tutorials';
import { DOC_SECTIONS, SITE_URL, LAST_UPDATED, PIPELINE_VERSION } from '@/lib/discovery';

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

  const body = `# ArchDraw

> ArchDraw is an AI-assisted system architecture diagramming tool. Describe a system in plain English, Mermaid, or paste a GitHub repo URL, and ArchDraw generates a styled, auto-laid-out architecture diagram with subgraphs, floating edges, templates, live sharing, and export to JSON, Mermaid, PNG, and SVG. An MCP server lets AI assistants such as Claude and Cursor drive the diagram directly.

ArchDraw is for engineers, system-design learners, and teams that need review-ready architecture diagrams without fighting draw.io. You describe the system or point at a repo; we compile it through a validated, tiered layout pipeline (Client → Gateway/CDN → Compute → Async → Data) so edges never flow backwards and groups stay legible. The canvas is React Flow + Dagre, the AI path is Groq-backed, and the local MCP server gives external agents JSON-RPC tools to mutate the real canvas.

_Last updated: ${LAST_UPDATED} • Pipeline ${PIPELINE_VERSION} • Source: https://github.com/hiabhee/ArchDraw_

## Docs

${docSectionLines}

## Guides

- [What is an MCP server for diagramming?](${BASE_URL}/mcp): How ArchDraw's local MCP server lets AI assistants like Claude and Cursor read, edit, and lay out diagrams — plus connection instructions.
- [How to generate an architecture diagram from a GitHub repo with AI](${BASE_URL}/repo-diagram): Paste a GitHub repo URL and get an auto-laid-out architecture diagram with components, workflows, and dependency intelligence.
- [Tutorials](${BASE_URL}/tutorials): Guided system-design lessons (ChatGPT, Netflix, Uber, Shopify, RAG, AI agents — ${TUTORIALS.length} total).
${tutorialSample}
- [More tutorials](${BASE_URL}/tutorials): Full catalog of ${TUTORIALS.length} architecture tutorials.

## Engineering blog

${blogLines}

## API

- [API Reference](${BASE_URL}/docs#api-ref): REST endpoints for diagram generation and repo-to-diagram.
- [OpenAPI Spec](${BASE_URL}/openapi.json): Machine-readable OpenAPI 3.0 spec — use this to *act* on ArchDraw, not just describe it.
- [Generate diagram](${BASE_URL}/docs#api-ref): POST /api/generate-diagram — prompt → Mermaid pipeline → React Flow graph.
- [Repo diagram](${BASE_URL}/docs#api-ref): POST /api/repo-diagram — GitHub URL → component graph (SSE stream).

## Discovery files

- [llms-full.txt](${BASE_URL}/llms-full.txt): Full corpus — every doc, guide, and blog section concatenated in one fetch. Prefer this when you need full context.
- [Semantic sitemap](${BASE_URL}/docs/sitemap.md): Human/agent-readable index with summaries and prerequisites per page.
- [Taxonomy](${BASE_URL}/docs/taxonomy.json): Canonical product and component names — solves alias/hallucination.
- [Graph](${BASE_URL}/docs/graph.json): Machine-readable nodes/edges for programmatic traversal.
- [Sitemap XML](${BASE_URL}/sitemap.xml): Standard XML sitemap.
- [robots.txt](${BASE_URL}/robots.txt): Explicit Allow for GPTBot, ClaudeBot, PerplexityBot on discovery paths.

## Optional

- [Changelog](${BASE_URL}/blogs): Release history via Engineering Blog.
- [Privacy Policy](${BASE_URL}/privacy): How ArchDraw handles prompts, diagrams, and personal data.
- [Terms of Service](${BASE_URL}/terms): Terms of service for using ArchDraw.
- [Humans](${BASE_URL}/humans.txt): Who builds ArchDraw.
- [Security](${BASE_URL}/.well-known/security.txt): Contact and policy for security reports.

## Source

- [GitHub repository](https://github.com/hiabhee/ArchDraw): Source for the web app and the MCP server (see /mcp-server).

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
