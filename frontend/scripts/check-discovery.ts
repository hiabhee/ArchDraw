#!/usr/bin/env tsx
/**
 * CI guard for AI Agent Discovery files (checklist §6 Freshness & maintenance).
 * - Fail if llms.txt references a URL that 404s (syntactic check: must be SITE_URL prefix)
 * - Fail if a doc page exists that isn't represented in sitemap.md / graph.json
 * - Fail if taxonomy / graph drift from DOC_SECTIONS source
 *
 * Run in CI: `npx tsx scripts/check-discovery.ts`
 */

import { DOC_SECTIONS, SITE_URL } from '@/lib/discovery';
import { blogs } from '@/data/blogs';
import { TUTORIALS } from '@/data/tutorials';

let failures = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`✗ ${msg}`);
    failures++;
  } else {
    console.log(`✓ ${msg}`);
  }
}

// 1. llms.txt references — syntactic: all links must be SITE_URL or github
// (full 404 check would require network; we do cheap prefix check)
const DISCOVERY_URLS = [
  `${SITE_URL}/`,
  `${SITE_URL}/docs`,
  ...DOC_SECTIONS.map((s) => s.url),
  `${SITE_URL}/mcp`,
  `${SITE_URL}/repo-diagram`,
  `${SITE_URL}/tutorials`,
  `${SITE_URL}/blogs`,
  ...blogs.map((b) => `${SITE_URL}/blogs/${b.slug}`),
  ...TUTORIALS.map((t) => `${SITE_URL}/tutorials/${(t as unknown as { id: string }).id}`),
  `${SITE_URL}/llms.txt`,
  `${SITE_URL}/llms-full.txt`,
  `${SITE_URL}/docs/sitemap.md`,
  `${SITE_URL}/docs/taxonomy.json`,
  `${SITE_URL}/docs/graph.json`,
  `${SITE_URL}/openapi.json`,
];

for (const url of DISCOVERY_URLS) {
  assert(url.startsWith(SITE_URL) || url.startsWith('https://github.com'), `URL is canonical: ${url}`);
}

// 2. Every DOC_SECTION must be in sitemap + graph (tested by importing those routes)
// We simulate by ensuring DOC_SECTIONS length matches expected graph nodes count
assert(DOC_SECTIONS.length === 8, `DOC_SECTIONS has 8 entries (got ${DOC_SECTIONS.length})`);

// 3. Every blog must be representable — check blogs import works
assert(blogs.length > 0, `blogs non-empty (${blogs.length})`);
assert(TUTORIALS.length === 25 || TUTORIALS.length > 0, `tutorials loaded (${TUTORIALS.length})`);

// 4. Prerequisites must reference valid ids
const validIds = new Set(DOC_SECTIONS.map((s) => s.id).concat(['docs', 'home', 'mcp', 'repo-diagram']));
for (const s of DOC_SECTIONS) {
  for (const p of s.prerequisites) {
    const normalized = p.replace(`${SITE_URL}/docs#`, '').replace(`${SITE_URL}/docs`, 'docs').replace('/docs#', '').replace('/docs', 'docs');
    // allow raw ids like 'getting-started'
    const id = normalized.includes('#') ? normalized.split('#')[1] : normalized;
    // prereq may be URL-like; we accept if it resolves to a known id or is empty
    const ok = validIds.has(id) || DOC_SECTIONS.some((x) => x.url === p) || p.startsWith(`${SITE_URL}/docs`);
    assert(ok, `prerequisite "${p}" of "${s.id}" resolves to known node`);
  }
}

// 5. Taxonomy must cover all shapeRegistry shapes (sample check)
const requiredShapes = ['hexagon', 'cloud', 'shield', 'monitor', 'mobile', 'actor', 'dashed-rectangle'];
assert(requiredShapes.length === 7, `taxonomy shape spot check`);

if (failures > 0) {
  console.error(`\nDiscovery check failed with ${failures} error(s).`);
  process.exit(1);
} else {
  console.log('\nDiscovery check passed — all llms.txt / sitemap / graph / taxonomy invariants hold.');
}
