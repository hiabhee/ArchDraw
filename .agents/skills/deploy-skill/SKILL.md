---
name: deploy-skill
description: Next.js on Vercel deployment checklist — pre-flight, env vars, DB migrations, API/auth safety, build boundaries, caching, and post-deploy verification. Use when deploying, reviewing a deploy, or debugging "works locally, crashes on Vercel".
---

# Deploy Skill — Next.js on Vercel

Source of truth: `deployment.md` at repo root. This skill makes that checklist actionable for agents and humans.

## When to use this skill

- Preparing a Vercel production or preview deploy
- Reviewing a PR that touches env vars, DB schema, API routes, auth, or `next.config`
- Debugging a deploy that builds locally but fails on Vercel
- Auditing runtime safety (RSC boundaries, timeouts, bundle size)

## Pre-flight (must pass locally)

- [ ] `npm run build` — zero errors, zero unexplained warnings (dev hides `use client` / missing env issues). Run from `frontend/` per AGENTS.md.
- [ ] `npm run lint` and `npx tsc --noEmit` clean — CI runs `prisma generate` → `tsc --noEmit` → `npm test` (see `AGENTS.md` §22).
- [ ] No `console.log` / debug probes in auth, payments, API routes.
- [ ] No hardcoded secrets, API keys, or `localhost` URLs.

## 1. Environment Variables

#1 cause of "works locally, crashes on Vercel."

- [ ] Every var used in code exists in **Vercel → Project → Settings → Environment Variables** for correct env (Production / Preview / Development).
- [ ] Client vars prefixed `NEXT_PUBLIC_` — unprefixed is `undefined` in browser bundle.
- [ ] No trailing spaces/quotes pasted into Vercel UI.
- [ ] Preview needs its own secrets (e.g. separate DB branch) — Production vars don't auto-apply.
- [ ] `.env*` in `.gitignore`; never commit `.env.local`.
- [ ] After adding/changing a var → **redeploy** (existing deploys don't pick it up).
- Validate via `frontend/lib/env-validation.ts`; required vars listed in `AGENTS.md` §17.

## 2. Database & Migrations

- [ ] Migrations run **before** code that depends on new schema.
- [ ] Destructive migrations (drop column/table) in two phases: (1) ship code that no longer needs column, (2) drop later.
- [ ] Use pooler (Supabase pooler / Neon pooled / PgBouncer) — Vercel serverless fans out connections.
- [ ] Sane connection timeouts so hanging DB doesn't hang function / burn cost.
- [ ] Test against staging/preview DB, never prod data. Schema: `frontend/prisma/schema.prisma`.

## 3. API Routes & Server Actions

- [ ] Every `app/api/**/route.ts` and Server Action has `try/catch` — uncaught throw can expose stack as 500.
- [ ] Validate bodies with `zod`/`yup`.
- [ ] Set explicit `export const runtime = 'nodejs'` or `'edge'` — Edge lacks `fs`, some `crypto`, Node Postgres driver.
- [ ] Respect timeouts: Hobby 10s, Pro 60s (up to `maxDuration`). Offload long AI/file/scrape work to queues. Check `maxDuration` in route files.
- [ ] Rate-limit public routes (LLM/DB) — see `frontend/lib/redis.ts` / `quotaCheck.ts`.

## 4. Auth

- [ ] Callback/redirect URLs registered for **both** prod and preview (or accept preview auth broken).
- [ ] Cookies: `secure`, `sameSite`, `domain` correct — wrong scope silently logs out on prod while `localhost` works.
- [ ] Custom domain allowlist matches exactly (`www` vs bare). Config in `frontend/lib/auth.ts`, `next.config.ts` CSP / `trustedOrigins`.

## 5. Build & Runtime Safety

- [ ] No browser-only APIs (`window`, `localStorage`) in Server Components / SSR — guard `typeof window !== 'undefined'` or move to `useEffect` / `next/dynamic` `{ ssr: false }` for heavy browser libs (charting, canvas).
- [ ] `error.tsx` at root + key segments, plus `not-found.tsx` and `loading.tsx` where data is slow.
- [ ] Risky client components (React Flow canvas, third-party widgets) wrapped in Error Boundary.

## 6. Images, Fonts & Static Assets

- [ ] External image domains in `next.config.js` `images.remotePatterns` — unlisted throws at request time, not build time.
- [ ] Large uploads not bundled into function — use S3 / Supabase Storage / Vercel Blob.
- [ ] Fonts via `next/font` to avoid FOIT/layout shift.

## 7. Caching & Data Freshness

- [ ] Verify static vs ISR vs `force-dynamic` — accidental `force-static` = stale data; accidental `force-dynamic` = extra cost/latency.
- [ ] `revalidate` values intentional.
- [ ] Mutating Server Actions / Route Handlers call `revalidatePath` / `revalidateTag`.

## 8. Third-Party Services

- [ ] Every external call (Groq/OpenRouter, email, payments) wrapped in timeout + `try/catch`.
- [ ] UI has fallback/error state when external service down or rate-limited (AI pipeline graceful fallback in `FallbackPlan.ts`).
- [ ] Check free-tier limits before traffic spike.

## 9. Vercel-Specific

- [ ] Function region matches DB region (default `iad1`); pin if latency-sensitive.
- [ ] Watch bundle size per function — large AI SDKs / Puppeteer bloat cold starts or exceed limit.
- [ ] `vercel.json` not overriding redirects/headers/function config unintentionally.
- [ ] Cron jobs (`vercel.json` crons) enabled for plan and routed correctly.
- [ ] Preview URLs are public — no security by obscurity.

## 10. Before Promote to Production

- [ ] Test the **Preview Deployment URL**, not just `localhost`.
- [ ] Manual critical paths: sign up/login, create diagram, share/export, payments if any.
- [ ] Browser console clean on preview.
- [ ] Vercel build logs checked for warnings.
- [ ] Mobile responsiveness spot-checked.

## 11. After Deploy

- [ ] Watch **Vercel Runtime Logs / Observability** 10–15 min for error / duration spikes.
- [ ] Error monitoring active (Sentry or Vercel observability).
- [ ] Rollback plan known: Vercel → Deployments → Promote previous deployment.
- [ ] Monitor invocation count/cost, especially AI/DB-heavy routes.

## Quick Pre-Deploy TL;DR

1. `npm run build` clean locally (from `frontend/`)
2. All env vars in Vercel for right env
3. Migrations before code deploy
4. `try/catch` on every API route / Server Action
5. `error.tsx` + `loading.tsx` in place
6. Tested on Preview URL, not just localhost
7. Rollback plan known

## ArchDraw specifics to double-check

- Groq keys (`GROQ_API_KEY` / multi-key) and OpenRouter fallback present — AI generation fails without them.
- Supabase `DATABASE_URL` + `BETTER_AUTH_SECRET/URL` for auth/persistence.
- Upstash Redis optional but guest quota falls back to DB fail-closed — don't "fix" by allowing unlimited.
- Canvas layout canonical is `layoutDiagramViaMermaid` (Dagre) — don't assume ELK on frontend.
- Prisma client generated (`prisma generate`) before `tsc`/`build`.
