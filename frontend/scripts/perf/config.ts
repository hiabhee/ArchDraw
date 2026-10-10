/**
 * Perf benchmark config — endpoints, pages, and thresholds.
 *
 * Edit `ENDPOINTS` / `PAGES` to add routes. All timings use
 * `performance.now()` + Node `fetch` (no extra deps).
 *
 * BASE_URL: env `PERF_BASE_URL` or `http://localhost:3000` (or ephemeral if harness spawns `next start`).
 */

export interface EndpointConfig {
  name: string;
  path: string;
  method?: 'GET' | 'POST';
  /** Optional JSON body for POST */
  body?: unknown;
  /** Extra headers (e.g. admin passcode) */
  headers?: Record<string, string>;
  /** Expected status (warn if mismatch, but still record timing) */
  expectStatus?: number;
  /** Whether this endpoint hits DB (so waterfall fix shows up) */
  dbBacked?: boolean;
}

export interface PageConfig {
  name: string;
  path: string;
}

export const ENDPOINTS: EndpointConfig[] = [
  // --- Static / marketing (should benefit from cacheComponents) ---
  { name: 'landing', path: '/', dbBacked: false, expectStatus: 200 },
  { name: 'sitemap', path: '/sitemap.xml', dbBacked: false, expectStatus: 200 },
  { name: 'robots', path: '/robots.txt', dbBacked: false, expectStatus: 200 },
  { name: 'blogs_index', path: '/blogs', dbBacked: false, expectStatus: 200 },
  { name: 'docs', path: '/docs', dbBacked: false, expectStatus: 200 },
  // --- Dashboard / editor (client-heavy, layout test) ---
  { name: 'dashboard', path: '/dashboard', dbBacked: false, expectStatus: 200 },
  { name: 'editor', path: '/editor', dbBacked: false, expectStatus: 200 },
  { name: 'tutorials_index', path: '/tutorials', dbBacked: false, expectStatus: 200 },
  // --- API — track (after() path, should be instant) ---
  {
    name: 'track_page_view',
    path: '/api/track',
    method: 'POST',
    body: { event_type: 'page_view', event_name: 'perf_benchmark', page_path: '/perf', payload: {} },
    expectStatus: 200,
    dbBacked: true,
  },
  // --- API — admin funnel (waterfall fix) — will 401 without ADMIN_PASSCODE, but still measures TTFB ---
  { name: 'admin_stats_unauth', path: '/api/admin/stats', dbBacked: true, expectStatus: 401 },
  // --- API — quota (React.cache fix visible on auth'd requests) ---
  { name: 'user_quota_unauth', path: '/api/user/quota', dbBacked: true, expectStatus: 401 },
  // --- Share/embed (force-dynamic, contrast vs cached) ---
  // Use a fake id to measure 404 handling (still measures routing + DB lookup path)
  { name: 'share_404', path: '/api/share/does-not-exist', dbBacked: true, expectStatus: 404 },
];

export const PAGES: PageConfig[] = [
  { name: 'landing', path: '/' },
  { name: 'blogs', path: '/blogs' },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'editor', path: '/editor' },
];

/** Thresholds for regression detection (p95 ms). CI fails if after > max. */
export const THRESHOLDS: Record<string, number> = {
  landing: 600,
  sitemap: 800,
  blogs_index: 800,
  docs: 800,
  dashboard: 900,
  editor: 1000,
  track_page_view: 400,
  admin_stats_unauth: 1200,
};

export const DEFAULT_RUNS = 20;
export const DEFAULT_CONCURRENCY = 5;
export const DEFAULT_TIMEOUT_MS = 15_000;
