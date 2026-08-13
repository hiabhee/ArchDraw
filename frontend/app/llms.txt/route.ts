import { blogs } from '@/data/blogs';

export const runtime = 'nodejs';

const BASE_URL = 'https://archdraw.app';

const CORE_PAGES: Array<[string, string, string]> = [
  ['Home', `${BASE_URL}/`, 'Product landing page — build accurate architecture diagrams in seconds, not hours.'],
  ['Docs', `${BASE_URL}/docs`, 'User documentation — getting started, node types, diagram types, MCP server guide, prompt guide, API reference, keyboard shortcuts, FAQ.'],
  ['What is an MCP server for diagramming?', `${BASE_URL}/mcp`, 'How ArchDraw\u2019s local MCP server lets AI assistants like Claude and Cursor read, edit, and lay out diagrams — plus connection instructions.'],
  ['How to generate an architecture diagram from a GitHub repo with AI', `${BASE_URL}/repo-diagram`, 'Paste a GitHub repo URL and get an auto-laid-out architecture diagram with components, workflows, and dependency intelligence.'],
  ['MCP Server Guide', `${BASE_URL}/docs#mcp-server`, 'Connect ArchDraw\u2019s local MCP server to Claude, Antigravity, and other AI assistants to inspect and manipulate diagrams over JSON-RPC.'],
  ['Templates', `${BASE_URL}/dashboard/templates`, 'Example architecture diagrams and reusable templates.'],
  ['Tutorials', `${BASE_URL}/tutorials`, 'Guided architecture lessons for common system design patterns.'],
  ['Engineering Blog', `${BASE_URL}/blogs`, 'Deep technical write-ups on the ArchDraw canvas, AI pipeline, edge routing, and MCP integration.'],
  ['Privacy Policy', `${BASE_URL}/privacy`, 'How ArchDraw handles prompts, diagrams, and personal data.'],
  ['Terms of Service', `${BASE_URL}/terms`, 'Terms of service for using ArchDraw.'],
];

export function GET() {
  const blogLines = blogs
    .map((post) => `- [${post.title}](${BASE_URL}/blogs/${post.slug}): ${post.summary}`)
    .join('\n');

  const body = `# ArchDraw

> ArchDraw is an AI-assisted system architecture diagramming tool. Describe a system in plain English, Mermaid, or paste a GitHub repo URL, and ArchDraw generates a styled, auto-laid-out architecture diagram with subgraphs, floating edges, templates, live sharing, and export to JSON, Mermaid, PNG, and SVG. An MCP server lets AI assistants such as Claude and Cursor drive the diagram directly.

## Core pages

${CORE_PAGES.map(([title, url, desc]) => `- [${title}](${url}): ${desc}`).join('\n')}

## Engineering blog

${blogLines}

## Source

- [GitHub repository](https://github.com/hiabhee/ArchDraw): Source code for the web app and the MCP server.
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
