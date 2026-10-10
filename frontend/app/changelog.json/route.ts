export const runtime = 'nodejs';

const CHANGELOG = [
  {
    version: 'v8',
    date: '2026-09-02',
    changes: [
      'Repo pipeline cache keys are level-scoped v8::url::sha::L{level} with legacy fallback',
      'Added AI Agent Discovery surface: llms-full.txt, sitemap.md, taxonomy.json, graph.json, openapi.json',
      'Docs prerequisites & graph edges now explicit for agent traversal',
      'MCP server tools stable: generate/update/validate/fix-layout/apply-template/export/list-nodes/checkpoints',
    ],
  },
  {
    version: 'v7',
    date: '2026-08-16',
    changes: ['Repo pipeline DocsReview stage after Verify, Frontend-only Dagre layout via pipeline-shared/layout'],
  },
  {
    version: 'v6',
    date: '2026-08-01',
    changes: ['Concept templates for ≤12 word prompts, detail levels L1-L3, tutorial leveled system'],
  },
];

export function GET() {
  return new Response(JSON.stringify({ generated: '2026-09-02', source: 'https://archdraw.hiabhee.online/changelog.json', changelog: CHANGELOG }, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
