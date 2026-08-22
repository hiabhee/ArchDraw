# Postmortem: Nonce-Based CSP Blocked All Client JavaScript

**Date:** Aug 23, 2026 · **Impact:** Production fully broken client-side (landing
frozen below hero, dashboard stuck on spinner, editor unusable) · **Status:** Reverted
in `fix(csp): revert nonce-based script CSP`

---

## TL;DR

A commit added a nonce-based Content-Security-Policy via `middleware.ts` with
`'strict-dynamic'`. Next.js only stamps its own bootstrap `<script>` tags with the
nonce when the **root layout reads it via `headers()`**, which also forces every route
to render dynamically. Neither happened: statically-prerendered pages (`/`, `/blogs`,
`/docs`) served build-time HTML whose scripts carried no `nonce="…"` attribute. Under
`'strict-dynamic'` a script without a matching nonce is blocked — so *every* script on
*every* page was refused by the browser.

Server responses were still HTTP 200 with complete-looking HTML, which is why basic
smoke tests passed while the product was effectively dead in the browser.

---

## Symptoms

1. **Landing page rendered only the hero section.** Everything below the fold
   (`SocialProof`, `InteractiveDemo`, `Pricing`, …) is animated with framer-motion
   `initial={{ opacity: 0 }}` + `whileInView`. Without JS those elements stay at
   `opacity: 0` — invisible, though present in the DOM.
2. **Dashboard button → infinite loading screen.** `/dashboard` renders a Suspense
   skeleton that only resolves after React hydration.
3. No visible errors to the user — CSP violations log to the browser console only.

## Root cause chain

```
middleware.ts
  ├─ generates per-request nonce
  ├─ sets response CSP:  script-src 'nonce-xxx' 'strict-dynamic'
  └─ sets request headers: x-nonce, Content-Security-Policy   ← forwarded to renderer

Next.js renderer
  └─ stamps <script nonce="…"> ONLY IF the render is dynamic AND something
     calls headers() during the render tree (root layout reading x-nonce)

app/page.tsx (landing), /blogs, /docs …
  └─ statically prerendered at BUILD time (○ in build output).
     Middleware runs at request time, but the HTML — including its script tags —
     already exists. Nothing re-stamps nonces into cached HTML.
     → scripts ship without nonce attributes.
     → 'strict-dynamic' ignores 'self' when a nonce is present in the policy,
       so even same-origin /_next/static chunks are blocked.
```

### Why `'strict-dynamic'` made it worse, not better

`'strict-dynamic'` tells the browser: *trust only scripts loaded by an already-trusted
(nonce-carrying) script; ignore host allowlists like `'self'`*. It's the correct choice
for a working nonce setup (it lets bootstrap scripts dynamically import more chunks).
But when **no** script carries the nonce:

| Policy | Untagged same-origin script |
|---|---|
| `script-src 'self'` | ✅ loads |
| `script-src 'self' 'strict-dynamic'` | ❌ blocked |

So adding `'strict-dynamic'` converted "weaker CSP" into "block everything".

### The Next.js contract we missed

From the Next.js docs (*Content Security Policy → Adding a nonce with Middleware*):

1. Middleware generates the nonce and sets it on **request headers**
   (`x-nonce` and/or `Content-Security-Policy`) so the server render can see it.
2. **The root layout must read it**: `const nonce = (await headers()).get('x-nonce')`.
3. Reading `headers()` opts the whole tree out of static rendering — every route
   becomes server-rendered-per-request. This is what lets Next inject the nonce into
   its runtime/bootstrap script tags.

Step 2 is not optional decoration — it is the mechanism. Skipping it means step 3
never happens and static pages ship untagged scripts.

---

## Detection gap: why our smoke tests missed it

All our production checks were `curl`-based:

- Status codes: 200 ✅
- Latency: sub-second ✅
- HTML body: contained full markup including sections below the hero ✅

None of these execute JavaScript. A CSP-blocked page returns perfect HTML with zero
client behavior. **An HTTP-level smoke test cannot catch a broken hydration pipeline.**

What would have caught it immediately:

```js
// headless Chrome against prod — fails loudly when scripts are blocked
const page = await browser.newPage();
const blocked = [];
page.on('console', m => m.type() === 'error' && blocked.push(m.text()));
await page.goto(url);
await page.waitForFunction(() => document.querySelectorAll('section').length > 5);
// or simply: assert some hydration side-effect occurred
```

Or manually: open DevTools console — CSP violations appear as
`Refused to execute inline script … (CSP)` / `Refused to load the script …`.

## The fix (revert)

- Deleted `frontend/middleware.ts` (the nonce CSP).
- Restored the global CSP in `next.config.ts` with
  `script-src 'self' blob: 'unsafe-inline' …` — no `'strict-dynamic'`, no nonce —
  which matches the last known-good production behavior.
- Kept the other hardening from the same commit (DOMPurify sanitizer, embed-domain
  validation, admin login rate limiting).

A code comment in `next.config.ts` now documents why the nonce CSP was removed, so the
next person doesn't "re-harden" it back into the same wall.

## If we want nonce CSP back, do it end-to-end

Required changes, in order:

1. **Root layout reads the nonce** (`app/layout.tsx`):
   ```tsx
   import { headers } from 'next/headers';
   export default async function RootLayout({ children }: { children: React.ReactNode }) {
     const nonce = (await headers()).get('x-nonce') ?? undefined;
     return (
       <html>
         <body>{children}</body> {/* Next consumes the request CSP automatically */}
       </html>
     );
   }
   ```
2. **Accept the cost:** calling `headers()` makes *every* route dynamic.
   - Landing, blogs, docs lose static/ISR prerender → TTFB rises, build-time
     generation disappears.
   - Decide explicitly whether that trade is worth it before starting.
3. Keep the middleware matcher excluding `_next/static`, `_next/image`, `api`,
   static assets (the reverted file already did).
4. Verify with a browser (not curl): zero CSP console errors, hydration completes,
   `document.querySelector('script[nonce]')` is non-null on `/`, `/blogs`, `/editor`.
5. Consider `Content-Security-Policy-Report-Only` rollout first: deploy the nonce
   policy as report-only, watch violation reports for a week, then enforce.

## Lessons learned

1. **Client-side breakage is invisible to HTTP smoke tests.** Any deploy that touches
   CSP, script loading, or module boundaries needs at least one headless-browser check
   against production (or the preview URL) asserting hydration happened.
2. **Security hardening on the rendering path needs framework-contract verification.**
   CSP interacts with the framework's render pipeline; "set the header" is not the
   whole feature.
3. **Static vs dynamic rendering is a real dependency.** Nonce propagation silently
   requires dynamic rendering; nothing warns you at build time — pages just ship
   untagged scripts.
4. **Symptom pattern to memorize:** *server HTML fine + JS-driven UI dead = script
   execution problem.* Check the console before checking the server.
