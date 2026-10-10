# Deployment Guide — Next.js on Vercel

A pre-flight and post-flight checklist to avoid production crashes and bad deploys.

---

## 1. Before You Even Open a PR

- [ ] `npm run build` passes locally with **zero errors and zero warnings you don't understand**. Never rely on "it worked in dev" — dev mode hides a lot (missing env vars, `use client` boundary issues, etc.)
- [ ] `npm run lint` and `tsc --noEmit` (if using TypeScript) pass clean.
- [ ] No `console.log` / debug statements left in critical paths (auth, payments, API routes).
- [ ] Remove any hardcoded secrets, API keys, or `localhost` URLs from the codebase.

---

## 2. Environment Variables

This is the #1 cause of "works locally, crashes on Vercel."

- [ ] Every env var used in code exists in **Vercel → Project → Settings → Environment Variables**, for the correct environment (Production / Preview / Development).
- [ ] Client-exposed vars are prefixed `NEXT_PUBLIC_` — anything without this prefix is `undefined` in the browser bundle.
- [ ] Double-check for **trailing spaces or quotes** pasted into Vercel's env var UI — a very common silent bug.
- [ ] Preview deployments often need their own copies of secrets (e.g. a separate DB branch) — don't assume Production env vars apply everywhere.
- [ ] If you use `.env.local` for dev, confirm `.env*` is in `.gitignore` so nothing leaks into git history.
- [ ] After adding/changing an env var in Vercel, **redeploy** — existing deployments don't pick up new values automatically.

---

## 3. Database & Migrations

- [ ] Run migrations **before** deploying the code that depends on the new schema (not after) — or your live app will error on missing columns/tables mid-deploy.
- [ ] Never run destructive migrations (drop column/table) in the same deploy as the code that stops using them. Do it in two phases: (1) deploy code that no longer needs the column, (2) drop the column later.
- [ ] Confirm your DB connection pooler (e.g. Supabase pooler, Neon pooled connection, PgBouncer) is used — Vercel serverless functions spin up many short-lived connections and can exhaust a direct Postgres connection limit fast.
- [ ] Set sane connection timeouts so a slow/hanging DB doesn't hang the whole function (and burn execution time / cost).
- [ ] Test against a staging/preview database, never against production data.

---

## 4. API Routes & Server Actions

- [ ] Every API route/Server Action has **try/catch** — an uncaught throw returns a raw 500 with a stack trace exposed to the client in some configs.
- [ ] Validate request bodies (zod/yup) before using them — don't trust client input.
- [ ] Set explicit `runtime = 'nodejs'` or `'edge'` per route where it matters — Edge runtime doesn't support all Node APIs (e.g. some crypto, `fs`, certain SDKs like the Node Postgres driver).
- [ ] Watch function timeout limits: Hobby plan = 10s, Pro = 60s (configurable up to higher with `maxDuration`). Long AI calls, file processing, or scraping can hit this — offload to background jobs/queues if needed.
- [ ] Rate-limit public-facing routes (especially anything hitting an LLM API or your DB) to avoid cost blowups or abuse.

---

## 5. Auth

- [ ] Confirm callback/redirect URLs are registered for **both** the production domain and preview URLs (or preview auth will break, which is fine to accept — but know it in advance).
- [ ] Cookies: check `secure`, `sameSite`, and `domain` settings — a cookie scoped wrong will silently log users out or break auth in production while working fine locally on `localhost`.
- [ ] If using a custom domain, make sure auth provider allowlists match exactly (including `www` vs non-`www`).

---

## 6. Build & Runtime Safety

- [ ] Check for **client/server boundary mistakes**: using browser-only APIs (`window`, `localStorage`) in a Server Component or during SSR will crash the build/render. Guard with `typeof window !== 'undefined'` or move to `useEffect`.
- [ ] Any dynamic import of a heavy library (charting, canvas, etc.) that needs the browser should use `next/dynamic` with `{ ssr: false }`.
- [ ] Add an `error.tsx` (App Router) at root and key route segments so a thrown error shows a graceful fallback instead of a blank white screen / full crash.
- [ ] Add a `not-found.tsx` for expected 404s.
- [ ] Add a `loading.tsx` where slow data fetches happen, so users don't see a frozen page.
- [ ] Wrap risky client components (canvas/diagram rendering, third-party widgets) in a React Error Boundary so one broken component doesn't take down the whole page.

---

## 7. Images, Fonts & Static Assets

- [ ] External image domains are whitelisted in `next.config.js` under `images.remotePatterns` — unlisted domains will throw at request time in production, not at build time.
- [ ] Large uploads/assets aren't bundled into the serverless function — use a CDN/object storage (S3, Supabase Storage, Vercel Blob) instead.
- [ ] Self-hosted fonts use `next/font` to avoid render-blocking and layout shift.

---

## 8. Caching & Data Freshness

- [ ] Understand which pages are static, ISR, or fully dynamic — check for accidental `force-static` on pages that need live data (users see stale content) or accidental `force-dynamic` on pages that don't (unnecessary cost/latency).
- [ ] If using `revalidate`, confirm the value is intentional, not the Next.js default.
- [ ] Server Actions / route handlers that mutate data call `revalidatePath` / `revalidateTag` where needed, or users will see stale UI after writes.

---

## 9. Third-Party Services & External APIs

- [ ] Wrap every external API call (LLM, payment, email, etc.) in a timeout + try/catch — a hanging third-party call should not hang your whole route.
- [ ] Have a fallback/error state in the UI for when an external service is down or rate-limited, especially for AI pipeline stages.
- [ ] Confirm you're not exceeding free-tier rate limits on any dependency (DB, AI API, image API) before a launch/traffic spike.

---

## 10. Vercel-Specific Gotchas

- [ ] Check the **function region** — if your DB is in one region and your Vercel function is in another (default is often `iad1`/US East), you'll pay a latency tax on every DB call. Pin the region to match your DB if it matters.
- [ ] Watch **bundle size** per serverless function — huge dependencies (some AI SDKs, headless browser libs like Puppeteer) can exceed the size limit or slow cold starts.
- [ ] Confirm `vercel.json` (if present) isn't overriding something unintentionally (redirects, headers, function config).
- [ ] If using cron jobs (`vercel.json` crons), confirm they're enabled for your plan and pointed at the right route.
- [ ] Preview deployments are public URLs by default — don't put anything sensitive only behind "security by obscurity."

---

## 11. Before Clicking "Promote to Production"

- [ ] Test the **Preview Deployment URL** first, not just localhost — this catches env var and build differences that only show up on Vercel's infra.
- [ ] Click through the critical user paths manually: sign up/login, core feature (e.g. create a diagram), payment flow if any.
- [ ] Check browser console for errors on the preview URL.
- [ ] Check Vercel's build logs for warnings you might've ignored.
- [ ] Confirm mobile responsiveness on at least one real device or devtools emulation.

---

## 12. After Deploying

- [ ] Watch the **Vercel Runtime Logs / Observability tab** for the first 10–15 minutes after a production deploy for spikes in errors or function duration.
- [ ] Set up error monitoring (Sentry, or Vercel's built-in observability) so you find out about crashes from logs, not from users messaging you.
- [ ] Have a rollback plan: Vercel keeps previous deployments — know that you can instantly "Promote" an older deployment back to production if something breaks.
- [ ] Monitor function invocation count/cost if you're on a usage-based plan, especially after adding new AI or DB-heavy routes.

---

## Quick Pre-Deploy Checklist (TL;DR)

1. `npm run build` clean locally
2. All env vars present in Vercel for the right environment
3. Migrations run before code deploy
4. try/catch on every API route/Server Action
5. `error.tsx` + `loading.tsx` in place
6. Tested on the Preview URL, not just localhost
7. Rollback plan known (Promote previous deployment)
