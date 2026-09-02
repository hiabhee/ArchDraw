import { blogs } from '@/data/blogs';
import { TUTORIALS } from '@/data/tutorials';
import { DOC_SECTIONS, SITE_URL, LAST_UPDATED } from '@/lib/discovery';

export const runtime = 'nodejs';

export function GET() {
  const docSectionBlocks = DOC_SECTIONS.map(
    (s) =>
      `## ${s.url.replace(SITE_URL, '')}\nSummary: ${s.summary}\nPrerequisites: ${s.prerequisites.length ? s.prerequisites.join(', ') : 'none'}\nKeywords: ${s.keywords.join(', ')}\nURL: ${s.url}`
  ).join('\n\n');

  const blogBlocks = blogs
    .map(
      (b) =>
        `## /blogs/${b.slug}\nSummary: ${b.summary}\nPrerequisites: /docs#getting-started\nCategory: ${b.category} / ${b.kicker}\nURL: ${SITE_URL}/blogs/${b.slug}`
    )
    .join('\n\n');

  const tutorialBlocks = TUTORIALS.map(
    (t) =>
      `## /tutorials/${t.id}\nSummary: ${t.description ?? `Guided architecture lesson for ${t.title}`}\nPrerequisites: /docs#getting-started\nURL: ${SITE_URL}/tutorials/${t.id}`
  ).join('\n\n');

  const body = `# Documentation Sitemap

> Last updated: ${LAST_UPDATED} • Generated from actual docs source (DOC_SECTIONS / blogs / tutorials) — not hand-maintained.

# Core

## /
Summary: Marketing landing — build accurate architecture diagrams in seconds, not hours.
Prerequisites: none
URL: ${SITE_URL}/

## /docs
Summary: Documentation hub — Getting Started, Node Types, Diagram Types, MCP Server Guide, Prompt Guide, API Reference, Keyboard Shortcuts, FAQ.
Prerequisites: none
URL: ${SITE_URL}/docs

${docSectionBlocks}

## /mcp
Summary: What is an MCP server for diagramming — local stdio JSON-RPC bridge so Claude/Cursor can read, edit, and lay out your canvas.
Prerequisites: /docs#mcp-server
URL: ${SITE_URL}/mcp

## /repo-diagram
Summary: How to generate an architecture diagram from a GitHub repo URL via the multi-stage repo pipeline.
Prerequisites: /docs#getting-started
URL: ${SITE_URL}/repo-diagram

## /blogs
Summary: Engineering Blog index — ${blogs.length} deep-dives on canvas, edge routing, AI pipeline, MCP.
Prerequisites: none
URL: ${SITE_URL}/blogs

${blogBlocks}

## /tutorials
Summary: Tutorials catalog — ${TUTORIALS.length} guided system-design lessons.
Prerequisites: none
URL: ${SITE_URL}/tutorials

${tutorialBlocks}

## /editor
Summary: Interactive diagram canvas — requires auth or local storage. Not indexed for crawlers.
Prerequisites: /docs#getting-started
URL: ${SITE_URL}/editor

## Discovery files (for agents)

## /llms.txt
Summary: Compact index of ArchDraw docs and guides — start here.
Prerequisites: none
URL: ${SITE_URL}/llms.txt

## /llms-full.txt
Summary: Full corpus — every doc, guide, and blog section concatenated in one fetch.
Prerequisites: /llms.txt
URL: ${SITE_URL}/llms-full.txt

## /openapi.json
Summary: OpenAPI 3.0 spec for ArchDraw's public REST API.
Prerequisites: /docs#api-ref
URL: ${SITE_URL}/openapi.json

## /docs/taxonomy.json
Summary: Canonical product/component naming to prevent hallucinated names.
Prerequisites: none
URL: ${SITE_URL}/docs/taxonomy.json

## /docs/graph.json
Summary: Machine-readable nodes/edges between docs pages.
Prerequisites: /docs/sitemap.md
URL: ${SITE_URL}/docs/graph.json
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
