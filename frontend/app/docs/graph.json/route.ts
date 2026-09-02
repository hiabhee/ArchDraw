import { DOC_SECTIONS, SITE_URL, LAST_UPDATED } from '@/lib/discovery';
import { blogs } from '@/data/blogs';
import { TUTORIALS } from '@/data/tutorials';

export const runtime = 'nodejs';

export function GET() {
  const nodes = [
    // core pages
    { id: 'home', url: `${SITE_URL}/`, type: 'page', title: 'Home', category: 'product' },
    { id: 'docs', url: `${SITE_URL}/docs`, type: 'section', title: 'Documentation', category: 'docs' },
    ...DOC_SECTIONS.map((s) => ({
      id: s.id,
      url: s.url,
      type: 'guide',
      title: s.title,
      category: 'docs',
      prerequisites: s.prerequisites,
      keywords: s.keywords,
    })),
    { id: 'mcp', url: `${SITE_URL}/mcp`, type: 'guide', title: 'What is an MCP server for diagramming?', category: 'guide' },
    { id: 'repo-diagram', url: `${SITE_URL}/repo-diagram`, type: 'guide', title: 'How to generate a diagram from a GitHub repo', category: 'guide' },
    { id: 'tutorials', url: `${SITE_URL}/tutorials`, type: 'guide', title: 'Tutorials', category: 'learn' },
    ...TUTORIALS.map((t) => ({
      id: `tutorial-${t.id}`,
      url: `${SITE_URL}/tutorials/${t.id}`,
      type: 'tutorial',
      title: t.title,
      category: 'learn',
    })),
    { id: 'blogs', url: `${SITE_URL}/blogs`, type: 'guide', title: 'Engineering Blog', category: 'learn' },
    ...blogs.map((b) => ({
      id: `blog-${b.slug}`,
      url: `${SITE_URL}/blogs/${b.slug}`,
      type: 'article',
      title: b.title,
      category: 'learn',
    })),
    { id: 'editor', url: `${SITE_URL}/editor`, type: 'page', title: 'Editor', category: 'product' },
    // discovery files
    { id: 'llms-txt', url: `${SITE_URL}/llms.txt`, type: 'discovery', title: 'llms.txt', category: 'discovery' },
    { id: 'llms-full', url: `${SITE_URL}/llms-full.txt`, type: 'discovery', title: 'llms-full.txt', category: 'discovery' },
    { id: 'sitemap-md', url: `${SITE_URL}/docs/sitemap.md`, type: 'discovery', title: 'sitemap.md', category: 'discovery' },
    { id: 'taxonomy', url: `${SITE_URL}/docs/taxonomy.json`, type: 'discovery', title: 'taxonomy.json', category: 'discovery' },
    { id: 'graph', url: `${SITE_URL}/docs/graph.json`, type: 'discovery', title: 'graph.json', category: 'discovery' },
    { id: 'openapi', url: `${SITE_URL}/openapi.json`, type: 'discovery', title: 'openapi.json', category: 'discovery' },
  ];

  const edges: Array<{ from: string; to: string; relation: string }> = [
    // docs prerequisites → requires
    ...DOC_SECTIONS.flatMap((s) =>
      s.prerequisites.map((prereq) => ({
        from: s.id,
        to: prereq.replace(SITE_URL, '').replace('/docs#', '').replace('/docs', 'docs') || 'docs',
        relation: 'requires',
      }))
    ),
    // tutorial/blog requires getting-started
    ...TUTORIALS.map((t) => ({ from: `tutorial-${t.id}`, to: 'getting-started', relation: 'requires' as const })),
    ...blogs.map((b) => ({ from: `blog-${b.slug}`, to: 'getting-started', relation: 'related' as const })),
    // mcp relates to docs mcp-server
    { from: 'mcp', to: 'mcp-server', relation: 'expands' },
    { from: 'repo-diagram', to: 'getting-started', relation: 'requires' },
    // discovery file relations
    { from: 'llms-full', to: 'llms-txt', relation: 'expands' },
    { from: 'sitemap-md', to: 'docs', relation: 'indexes' },
    { from: 'graph', to: 'sitemap-md', relation: 'indexes' },
    { from: 'taxonomy', to: 'docs', relation: 'canonicalizes' },
    { from: 'openapi', to: 'api-ref', relation: 'specifies' },
    // docs → product
    { from: 'docs', to: 'home', relation: 'child_of' },
    { from: 'tutorials', to: 'docs', relation: 'complements' },
    { from: 'blogs', to: 'docs', relation: 'complements' },
  ];

  // normalize requires edges for doc sections where prereq strings were URL-like (/docs#x)
  // map them to node ids if possible
  const normalizedEdges = edges.map((e) => {
    let toId = e.to;
    // turn "/docs#getting-started" → "getting-started"
    if (toId.startsWith('/docs#')) toId = toId.replace('/docs#', '');
    if (toId === '/docs' || toId === 'docs') toId = 'docs';
    // if prereq was full URL + hash
    if (toId.includes('#')) toId = toId.split('#')[1] ?? toId;
    // ensure target exists, fallback to docs
    const exists = nodes.some((n) => n.id === toId);
    return { ...e, to: exists ? toId : 'docs' };
  });

  const body = {
    $schema: `${SITE_URL}/docs/graph.json`,
    generated: LAST_UPDATED,
    source: `${SITE_URL}/docs/graph.json`,
    description: 'Machine-readable cross-linking: which pages relate to which, dependency order, category clustering.',
    nodes,
    edges: normalizedEdges,
    categories: {
      product: { description: 'Core product surfaces (landing, editor)' },
      docs: { description: 'Documentation sections under /docs' },
      guide: { description: 'Top-level explainers (mcp, repo-diagram)' },
      learn: { description: 'Tutorials and engineering blogs' },
      discovery: { description: 'AI agent discovery files' },
    },
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
