// Shared source of truth for AI Agent Discovery files.
// Generate, don't hand-maintain divergence — llms.txt, llms-full.txt, sitemap.md,
// taxonomy.json, graph.json, openapi.json all import from here so URLs/titles
// can't drift from live docs.

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://archdraw.hiabhee.online';
export const SITE_NAME = 'ArchDraw';
export const LAST_UPDATED = '2026-09-02';
export const PIPELINE_VERSION = 'v8';

export interface DocSection {
  id: string;
  title: string;
  url: string;
  summary: string;
  prerequisites: string[];
  keywords: string[];
}

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    url: `${SITE_URL}/docs#getting-started`,
    summary: 'Create your first architecture diagram — drag-and-drop workspace, tiers, AI prompt compilation, and workspace JSON shape.',
    prerequisites: [],
    keywords: ['getting started', 'editor', 'workspace'],
  },
  {
    id: 'node-types',
    title: 'Node Types',
    url: `${SITE_URL}/docs#node-types`,
    summary: 'Semantic tier system and visual vocabulary: client / security / compute / async / data tiers, colors, and allowed components.',
    prerequisites: ['/docs#getting-started'],
    keywords: ['nodes', 'tiers', 'shapes', 'SystemNode', 'ShapeNode'],
  },
  {
    id: 'diagram-types',
    title: 'Diagram Types',
    url: `${SITE_URL}/docs#diagram-types`,
    summary: 'Canonical architecture patterns — video streaming, e-commerce, WebSockets / real-time, social platforms and when to use each.',
    prerequisites: ['/docs#getting-started'],
    keywords: ['diagram types', 'patterns', 'templates'],
  },
  {
    id: 'mcp-server',
    title: 'MCP Server Guide',
    url: `${SITE_URL}/docs#mcp-server`,
    summary: 'Run the local MCP server over stdio JSON-RPC so Claude / Cursor can read, edit, validate, and lay out your canvas programmatically.',
    prerequisites: ['/docs#getting-started'],
    keywords: ['MCP', 'Model Context Protocol', 'Claude', 'Cursor'],
  },
  {
    id: 'prompt-guide',
    title: 'Prompt Guide',
    url: `${SITE_URL}/docs#prompt-guide`,
    summary: 'How to write left-to-right tiered prompts (Client → Gateway/CDN → Compute → Async → Data) for deterministic layout.',
    prerequisites: ['/docs#getting-started', '/docs#node-types'],
    keywords: ['prompt', 'AI generation', 'layout', 'tiers'],
  },
  {
    id: 'api-ref',
    title: 'API Reference',
    url: `${SITE_URL}/docs#api-ref`,
    summary: 'REST endpoints for diagram generation, repo-to-diagram, persistence, share/embed, and OpenAPI spec location.',
    prerequisites: ['/docs#getting-started'],
    keywords: ['API', 'generate-diagram', 'repo-diagram', 'OpenAPI'],
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    url: `${SITE_URL}/docs#shortcuts`,
    summary: 'Command palette, delete, multi-select, and grid snap hotkeys for keyboard-first editing.',
    prerequisites: ['/docs#getting-started'],
    keywords: ['shortcuts', 'hotkeys', 'command palette'],
  },
  {
    id: 'faq',
    title: 'FAQ',
    url: `${SITE_URL}/docs#faq`,
    summary: 'Pricing / free tier, overlapping edge routing, and self-hosting the MCP server.',
    prerequisites: [],
    keywords: ['FAQ', 'pricing', 'edges', 'self-host'],
  },
];

export interface SitePage {
  title: string;
  url: string;
  summary: string;
  category: 'docs' | 'guide' | 'api' | 'product' | 'learn';
}

export const CORE_PAGES: SitePage[] = [
  {
    title: 'Home',
    url: SITE_URL + '/',
    summary: 'Product landing — build accurate architecture diagrams in seconds, not hours.',
    category: 'product',
  },
  {
    title: 'Docs',
    url: SITE_URL + '/docs',
    summary: 'User documentation — getting started, node types, diagram types, MCP server guide, prompt guide, API reference, keyboard shortcuts, FAQ.',
    category: 'docs',
  },
  {
    title: 'MCP — What is an MCP server for diagramming?',
    url: SITE_URL + '/mcp',
    summary: 'How the local MCP server lets AI assistants like Claude and Cursor read, edit, and lay out diagrams plus connection instructions.',
    category: 'guide',
  },
  {
    title: 'Repo → Diagram',
    url: SITE_URL + '/repo-diagram',
    summary: 'Paste a GitHub repo URL and get an auto-laid-out architecture diagram with components, workflows, and dependency intelligence.',
    category: 'guide',
  },
  {
    title: 'Tutorials',
    url: SITE_URL + '/tutorials',
    summary: 'Guided system-design lessons — ChatGPT, Netflix, Uber, Shopify, RAG, AI agents and more (25 tutorials).',
    category: 'learn',
  },
  {
    title: 'Engineering Blog',
    url: SITE_URL + '/blogs',
    summary: 'Technical deep-dives on canvas, edge routing, AI pipeline, MCP, and state persistence.',
    category: 'learn',
  },
  {
    title: 'Editor',
    url: SITE_URL + '/editor',
    summary: 'Interactive diagram canvas — requires auth or local storage; not crawled.',
    category: 'product',
  },
  {
    title: 'OpenAPI Spec',
    url: SITE_URL + '/openapi.json',
    summary: 'Machine-readable API spec for agents that need to act on ArchDraw programmatically.',
    category: 'api',
  },
];

export const DISCOVERY_FILES = [
  { path: '/llms.txt', summary: 'Compact index of ArchDraw docs and guides — start here.', type: 'index' },
  { path: '/llms-full.txt', summary: 'Full corpus — entire docs + blog + API reference concatenated in one fetch.', type: 'corpus' },
  { path: '/docs/sitemap.md', summary: 'Semantic index with summaries and prerequisites per page.', type: 'sitemap' },
  { path: '/docs/taxonomy.json', summary: 'Canonical product/component naming — solves alias/deprecated hallucinations.', type: 'taxonomy' },
  { path: '/docs/graph.json', summary: 'Machine-readable graph of nodes/edges between docs pages.', type: 'graph' },
  { path: '/openapi.json', summary: 'OpenAPI 3.0 spec for the public REST API.', type: 'openapi' },
  { path: '/sitemap.xml', summary: 'Standard XML sitemap for search crawlers.', type: 'sitemap-xml' },
  { path: '/robots.txt', summary: 'Crawler allowlist — explicitly allows GPTBot, ClaudeBot, PerplexityBot on discovery paths.', type: 'robots' },
] as const;
