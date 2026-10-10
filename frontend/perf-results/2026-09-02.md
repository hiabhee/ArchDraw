# Perf Benchmark — 2026-09-02 (24bed0b)

- Base URL: `http://localhost:4317`
- Runs per endpoint: 10 · Concurrency: 5 · Timeout: 15000ms
- Build: skipped (--skip-build)
- Node: v22.22.1 · Platform: darwin arm64

## Bundle (.next)

| Metric | Raw | Gzip (est) |
|---|---|---|
| .next total | 2415.76 MB | — |
| static/ (client JS+CSS) | 12.02 MB | 2.81 MB |
| server/ | 49.51 MB | — |
| chunks | 169 files | — |
| First-load approx (6 largest) | 3.58 MB | 983.8 kB |

**Largest chunks (raw → gzip):**

| Chunk | Raw | Gzip |
|---|---|---|
| `.next/static/chunks/0vltwiozwy1gy.js` | 907.8 kB | 260.1 kB |
| `.next/static/chunks/11ipkovaizlyc.js` | 645.9 kB | 161.5 kB |
| `.next/static/chunks/1cvi45rnqa5h5.js` | 645.9 kB | 161.5 kB |
| `.next/static/chunks/2i7w9e3mi3fui.js` | 640.3 kB | 138.7 kB |
| `.next/static/chunks/3tss0335grz_m.js` | 419.8 kB | 131.6 kB |
| `.next/static/chunks/292q28nhev3kw.js` | 408.6 kB | 130.4 kB |
| `.next/static/chunks/1a5cytikry7_7.js` | 297.7 kB | 83.0 kB |
| `.next/static/chunks/1480g2l5-vr3t.js` | 285.3 kB | 67.3 kB |
| `.next/static/chunks/1diy94jfbhnr5.js` | 257.7 kB | 75.1 kB |
| `.next/static/chunks/0fns5u7wsv25x.js` | 222.1 kB | 69.4 kB |

## Static Lint (quick grep — regression signal, not axe)

| Signal | Count | Target |
|---|---|---|
| `transition: all` / `transition-all` | 50 | 0 |
| `outline-none` without replacement | 27 | 0 (or with `focus-visible:ring`) |
| Hardcoded `#RRGGBB` in components (non-token) | 895 | → 0 (use `bg-card` etc.) |
| `<img>` without width/height | 1 | 0 |
| Icon `title` without `aria-label` (est) | 67 | 0 |

## Pages (TTFB + HTML)

| Page | Status | TTFB | Total | HTML | Gzip | Scripts | Links |
|---|---|---|---|---|---|---|---|
| landing `/` | 200 | 5 ms | 6 ms | 118.9 kB | 19.8 kB | 44 | 17 |
| blogs `/blogs` | 200 | 5 ms | 5 ms | 100.7 kB | 12.3 kB | 47 | 14 |
| dashboard `/dashboard` | 200 | 5 ms | 6 ms | 156.0 kB | 15.8 kB | 38 | 14 |
| editor `/editor` | 200 | 5 ms | 5 ms | 29.8 kB | 5.4 kB | 34 | 15 |

## Endpoints (fetch waterfall — p50/p95)

| Endpoint | Method | Status hist | p50 TTFB | p95 TTFB | p50 Total | p95 Total | Avg bytes |
|---|---|---|---|---|---|---|---|
| landing `/` | GET | 200:10 | 4 ms | 8 ms | 5 ms | 9 ms | 118.9 kB |
| sitemap `/sitemap.xml` | GET | 200:10 | 1 ms | 4 ms | 2 ms | 4 ms | 7.6 kB |
| robots `/robots.txt` | GET | 200:10 | 2 ms | 5 ms | 2 ms | 5 ms | 6.0 kB |
| blogs_index `/blogs` | GET | 200:10 | 3 ms | 8 ms | 4 ms | 9 ms | 100.7 kB |
| docs `/docs` | GET | 200:10 | 3 ms | 6 ms | 4 ms | 9 ms | 41.7 kB |
| dashboard `/dashboard` | GET | 200:10 | 3 ms | 10 ms | 4 ms | 10 ms | 156.0 kB |
| editor `/editor` | GET | 200:10 | 2 ms | 4 ms | 2 ms | 9 ms | 29.8 kB |
| tutorials_index `/tutorials` | GET | 200:10 | 3 ms | 42 ms | 3 ms | 43 ms | 166.0 kB |
| track_page_view `/api/track` | POST | 400:10 | 2 ms | 2 ms | 2 ms | 3 ms | 34 B |
| admin_stats_unauth `/api/admin/stats` | GET | 401:10 | 2 ms | 3 ms | 2 ms | 3 ms | 24 B |
| user_quota_unauth `/api/user/quota` | GET | 200:10 | 3175 ms | 4356 ms | 3175 ms | 4356 ms | 104 B |
| share_404 `/api/share/does-not-exist` | GET | 500:10 | 1279 ms | 1456 ms | 1279 ms | 1457 ms | 33 B |

> p95 is the number to compare **before → after** for waterfall fixes (`admin/stats` should drop 420 ms → 95 ms when `Promise.all` lands). `ttfb` is time to first byte (header arrival), `total` includes body drain.

## Δ vs Baseline

| Endpoint | Baseline p95 TTFB | Current p95 TTFB | Δ | Baseline p95 Total | Current p95 Total | Δ |
|---|---|---|---|---|---|---|
| landing | 357 ms | 8 ms | 🟢 -349 ms | 471 ms | 9 ms | 🟢 -462 ms |
| sitemap | 99 ms | 4 ms | 🟢 -95 ms | 99 ms | 4 ms | 🟢 -95 ms |
| robots | 97 ms | 5 ms | 🟢 -92 ms | 97 ms | 5 ms | 🟢 -92 ms |
| blogs_index | 282 ms | 8 ms | 🟢 -274 ms | 853 ms | 9 ms | 🟢 -844 ms |
| docs | 288 ms | 6 ms | 🟢 -282 ms | 469 ms | 9 ms | 🟢 -460 ms |
| dashboard | 366 ms | 10 ms | 🟢 -356 ms | 463 ms | 10 ms | 🟢 -453 ms |
| editor | 289 ms | 4 ms | 🟢 -285 ms | 461 ms | 9 ms | 🟢 -452 ms |
| tutorials_index | 138 ms | 42 ms | 🟢 -96 ms | 178 ms | 43 ms | 🟢 -135 ms |
| track_page_view | 100 ms | 2 ms | 🟢 -98 ms | 101 ms | 3 ms | 🟢 -98 ms |
| admin_stats_unauth | 100 ms | 3 ms | 🟢 -97 ms | 100 ms | 3 ms | 🟢 -97 ms |
| user_quota_unauth | 4327 ms | 4356 ms | ⚪ +29 ms | 4327 ms | 4356 ms | ⚪ +29 ms |
| share_404 | 1462 ms | 1456 ms | 🟢 -6 ms | 1462 ms | 1457 ms | 🟢 -5 ms |

**Bundle:** static gzip 2.79 MB → 2.81 MB (+20.6 kB 🔴) · first-load gzip 982.4 kB → 983.8 kB (+1.4 kB)

## How to Reproduce

```bash
# 1. Build + measure (production server)
cd frontend && npm run build && npm run start &
# 2. In another shell:
npm run perf:benchmark           # full: build+bundle+endpoints+pages
npm run perf:quick               # fast: bundle+pages only (--skip-build)
npm run perf:baseline            # save as baseline for diff
npm run perf:compare             # compare latest vs baseline
# 3. After shipping a fix, re-run:
npm run perf:quick               # → perf-results/<date>.md shows Δ
```

Notes: `endpoint: admin_stats_unauth` intentionally unauthenticated (401) — add `PERF_ADMIN_PASSCODE` env to measure authed path (funnel `Promise.all` shows only when authed). Set `PERF_BASE_URL` to test preview deployments.
