import { SITE_URL, LAST_UPDATED } from '@/lib/discovery';

export const runtime = 'nodejs';

// Canonical naming — source of truth to prevent agents hallucinating product names
// or using deprecated ones. Keep in sync with lib/shapeRegistry.ts, componentRegistry, etc.

const TAXONOMY = {
  $schema: 'https://archdraw.hiabhee.online/docs/taxonomy.json',
  generated: LAST_UPDATED,
  source: `${SITE_URL}/docs/taxonomy.json`,
  products: [
    {
      canonical_name: 'ArchDraw',
      aliases: ['Arch Draw', 'archdraw'],
      deprecated_names: [],
      status: 'active',
      description: 'AI-assisted system architecture diagramming tool (React Flow, Dagre layout, Groq AI pipeline, local MCP server).',
      url: SITE_URL,
    },
  ],
  features: [
    {
      canonical_name: 'MCP Server',
      aliases: ['Model Context Protocol Server', 'archdraw-mcp'],
      deprecated_names: [],
      status: 'active',
      description: 'Local stdio JSON-RPC server exposing diagram tools to Claude/Cursor.',
    },
    {
      canonical_name: 'Repo → Diagram',
      aliases: ['Repo Diagram', 'GitHub to Diagram', 'repo-diagram'],
      deprecated_names: [],
      status: 'active',
      description: 'Pipeline that analyzes a GitHub repo and produces an auto-laid-out architecture diagram.',
    },
    {
      canonical_name: 'AI Generation Pipeline',
      aliases: ['Generate Diagram', 'prompt to diagram'],
      deprecated_names: [],
      status: 'active',
      description: 'Prompt → ConceptDetection → ArchitecturePlanning → MermaidMaterialize (Dagre) → Score → Validation.',
    },
  ],
  components: [
    // shapeRegistry canonical shapes — keep aligned with lib/shapeRegistry.ts
    { canonical_name: 'hexagon', aliases: ['load balancer', 'ingress', 'gateway'], deprecated_names: [], status: 'active', mermaid_token: 'id{{"Label"}}' },
    { canonical_name: 'cloud', aliases: ['external', 'SaaS', 'third-party'], deprecated_names: [], status: 'active', mermaid_directive: '%% archdraw-shape: {"shape":"cloud"}' },
    { canonical_name: 'shield', aliases: ['auth', 'WAF', 'Vault'], deprecated_names: [], status: 'active', mermaid_directive: '%% archdraw-shape: {"shape":"shield"}' },
    { canonical_name: 'monitor', aliases: ['web client', 'browser', 'frontend', 'desktop'], deprecated_names: [], status: 'active', mermaid_directive: '%% archdraw-shape: {"shape":"monitor"}' },
    { canonical_name: 'mobile', aliases: ['iOS', 'Android', 'mobile client'], deprecated_names: [], status: 'active', mermaid_directive: '%% archdraw-shape: {"shape":"mobile"}' },
    { canonical_name: 'actor', aliases: ['user', 'person', 'customer', 'admin'], deprecated_names: [], status: 'active', mermaid_directive: '%% archdraw-shape: {"shape":"actor"}' },
    { canonical_name: 'dashed-rectangle', aliases: ['out-of-system', 'optional', 'future'], deprecated_names: [], status: 'active', mermaid_directive: '%% archdraw-shape: {"shape":"dashed-rectangle"}' },
    { canonical_name: 'rectangle', aliases: [], deprecated_names: [], status: 'active', mermaid_token: 'id["Label"]' },
    { canonical_name: 'rounded-rectangle', aliases: ['rounded'], deprecated_names: [], status: 'active', mermaid_token: 'id("Label")' },
    { canonical_name: 'diamond', aliases: ['decision', 'gateway'], deprecated_names: [], status: 'active', mermaid_token: 'id{"Label"}' },
    { canonical_name: 'cylinder', aliases: ['database', 'storage'], deprecated_names: [], status: 'active', mermaid_token: 'id[("Label")]' },
    { canonical_name: 'circle', aliases: ['start', 'end'], deprecated_names: [], status: 'active', mermaid_token: 'id(("Label"))' },
    { canonical_name: 'parallelogram', aliases: ['input-output'], deprecated_names: [], status: 'active', mermaid_token: 'id[/"Label"/]' },
  ],
  tiers: [
    { canonical_name: 'client', aliases: ['frontend', 'browser'], color: '#64748b' },
    { canonical_name: 'compute', aliases: ['service', 'api', 'worker'], color: '#0f766e' },
    { canonical_name: 'data', aliases: ['database', 'cache', 'storage'], color: '#475569' },
    { canonical_name: 'async', aliases: ['queue', 'broker', 'stream'], color: '#b45309' },
    { canonical_name: 'external', aliases: ['third-party', 'SaaS', 'CDN'], color: '#6b7280' },
  ],
  tiers_deprecated_aliases: {
    // Avoid confusion: "edge" tier was renamed to split client/compute in docs, but legacy template files may still contain it
    edge: 'use_gateway_or_CDN',
  },
  deprecated_names_global: [
    { name: 'YourProduct Premium', replacement: 'ArchDraw' },
  ],
};

export function GET() {
  return new Response(JSON.stringify(TAXONOMY, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
