import type { MetadataRoute } from 'next';

// Private / gated paths — never crawl / training, but discovery files must stay public.
const DISALLOWED = ['/editor', '/api/', '/share', '/auth', '/admin'];

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://archdraw.hiabhee.online';

// Stable public paths — must be reachable unauthenticated, no JS required.
// Explicit allowlist per AI Agent Discovery checklist §2–3.
const DISCOVERY_ALLOW = [
  '/llms.txt',
  '/llms-full.txt',
  '/openapi.json',
  '/openapi.yaml',
  '/docs',
  '/docs/',
  '/docs/sitemap.md',
  '/docs/taxonomy.json',
  '/docs/graph.json',
  '/humans.txt',
  '/.well-known/security.txt',
  '/sitemap.xml',
  '/robots.txt',
];

const ALLOWED = ['/', '/docs', '/blogs', '/tutorials', '/mcp', '/repo-diagram', ...DISCOVERY_ALLOW];

// AI crawler user-agents — explicitly allowlisted per checklist §2 WAF note + §3 robots.txt.
const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'Claude-Web',
  'PerplexityBot',
  'Bytespider',
  'Google-Extended',
  'Applebot-Extended',
  'Applebot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // AI bots: full allow on public docs + discovery files (never 403/429 these).
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: [...ALLOWED],
        disallow: DISALLOWED,
      })),
      {
        userAgent: '*',
        // Wildcard: explicitly list discovery files so even if middleware
        // or a global Disallow slips, llms.txt etc stay crawlable.
        allow: [...ALLOWED],
        disallow: DISALLOWED,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
