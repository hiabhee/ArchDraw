# SEO playbook: the ArchDraw case study

How we took ArchDraw (archdraw.hiabhee.online, a Next.js App Router site) from "launched" to "built to rank", and how to repeat it on another site. Each section gives the technique, why it works, what we did here, and the details that matter.

Keep this file current. When we add or change an SEO technique, add it here, with its PR.

---

## 0. Results so far (November 2026)

| Measure | Before | After |
|---|---|---|
| Indexable URLs in the sitemap | 78 | ~130 (36 templates, 24 tutorials, 20 glossary terms, 3 free tools, 3 comparisons, hubs) |
| Tutorial page HTML (ChatGPT) | 66 words, no H1 | ~2,200 words, H1 "ChatGPT System Design" |
| Template page (ChatGPT) | 572 words | 1,230 words + FAQ rich results |
| Smallest template page (MVC) | 285 words | 706 words |
| Crawlable links from `/tutorials` to tutorials | 0 | 24 |
| Lighthouse SEO | 100 | 100 |
| Lighthouse Agentic Browsing | 2/3 | 3/3 expected (WebMCP tools registered) |

Rankings take weeks to move. Re-measure in Search Console 4–6 weeks after each deploy (section 12).

---

## 1. Start with an audit, not with content

**Technique.** Before writing anything, fetch every important page the way a crawler does and record what it really receives.

**What we checked, per URL:** HTTP status, `<title>`, meta description, `<meta name="robots">`, `X-Robots-Tag` header, `<link rel="canonical">`, H1 and H2s, word count of the server HTML (scripts and styles stripped), structured data types, and internal links.

**How:** a short script reads `sitemap.xml`, fetches each URL with `curl`, and parses the HTML. We ran it against both localhost and production.

**What it found here** (each is a common failure on other sites too):
- Pages rendered in the browser shipped almost no HTML. The tutorials were a full-screen client app: 66 words and no H1.
- A list page navigated with `onClick` handlers, so crawlers saw no links to the pages it listed.
- The root layout set a canonical URL, which every child page inherited, marking them all as duplicates of `/`.
- Titles repeated the brand, because the template already appends `| ArchDraw`.
- The home page targeted only the product's newest feature, not the category people search for.

**Rule:** the audit is the source of truth. Re-run it after every SEO change.

---

## 2. Technical foundation

### 2.1 One metadata helper for every public page
`frontend/lib/site/seo.ts` exports `pageMetadata({ title, description, path, type?, image?, keywords?, noIndex? })`. It returns the title, a **self-referencing canonical**, Open Graph and Twitter data in one call, plus `breadcrumbJsonLd(trail)` and `absoluteUrl(path)`.

- **Why:** consistency. Every page gets a canonical, an `og:url` and a social title, and nobody forgets one.
- **Detail:** the root layout sets **no** `alternates.canonical`, because a child page inherits it unless it sets its own. The title template is `%s | ArchDraw`, so page titles omit the brand.

### 2.2 Titles and descriptions
- Write the title as the search query: "ChatGPT Architecture Diagram (Free Template)", "Load Balancer in System Design: How It Works".
- Keep titles to about 60 characters including the brand, and descriptions to 160 or fewer. Tests enforce both for generated pages.

### 2.3 Crawling and indexing
- **`app/robots.ts`:** allow the public sections, disallow private ones (`/editor`, `/dashboard`, `/api/`, `/share`, `/embed/`, `/live/`, `/admin`, `/auth`). Keep `/api/og/` allowed, so social preview images can be fetched.
- **`noindex`** goes on private and user-generated surfaces through layout metadata: the editor, dashboard, live and watch links, and shared and embedded diagrams. Unknown slugs get a "not found" page that is also `noindex`.
- **`app/sitemap.ts`** generates entries from the data (templates, tutorials, glossary, blogs) with a fixed build date, so the sitemap doesn't change on every request.
- **Static generation:** `generateStaticParams` plus `dynamicParams = false` on data-driven routes, so unknown slugs return 404 instead of empty pages.

### 2.4 Structured data (JSON-LD)
| Page type | Schema |
|---|---|
| Site-wide | `Organization` (with logo), `WebSite`, `SoftwareApplication` |
| Galleries and hubs | `CollectionPage` + `ItemList` |
| Template pages | `CreativeWork` + `BreadcrumbList` + `FAQPage` |
| Tutorial pages | `TechArticle` + `LearningResource` (`timeRequired`, `educationalLevel`) + `BreadcrumbList` |
| Glossary | `DefinedTermSet` (hub) and `DefinedTerm` + `FAQPage` (term pages) |
| Free tools | `WebApplication` with an `Offer` of price 0, plus `FAQPage` |

**Rule:** only mark up content that is visible on the page. FAQ markup must match an FAQ the reader can see.

**What Google actually shows (Rich Results Test, `/templates/chatgpt`, 2026-11-07):** 3 valid items: breadcrumbs, "paywalled content" (read from `isAccessibleForFree`) and software app.
- **FAQ:** since August 2023 Google shows FAQ rich results only for well-known government and health sites, so ours don't appear there. We keep the markup because it is valid and Bing and AI answer engines read it, but don't expect FAQ dropdowns in Google.
- **`aggregateRating`:** the software app result reports it as missing; the field is optional. Never add ratings without real reviews; fabricated review markup breaks Google's policies.

### 2.5 Brand and icons
- Use one mark everywhere: `app/icon.svg` (switches with `prefers-color-scheme`), `app/apple-icon.png`, `app/favicon.ico` (16, 32 and 48px, square), `public/logo.png` (512px, used as the `Organization` logo), and the web manifest.
- **Lesson:** Google's favicon service (`google.com/s2/favicons`) and apps that use it, including Claude's connector list, cache old icons for weeks. After a brand change, request indexing of the home page and remove and re-add integrations.
- The MCP server also sends `title`, `websiteUrl` and `icons` in its connect info (server 1.2.1), so AI clients show the right mark.

### 2.6 Agent and AI discoverability
- **Machine-readable summaries:** `llms.txt` and `llms-full.txt`, an `openapi.json`, `changelog.json` and a static `catalog.json` of templates and tutorials.
- **AI crawlers** (GPTBot, ClaudeBot, PerplexityBot and others) are explicitly allowed in `robots.txt`.
- **WebMCP** (Lighthouse "Agentic Browsing"): `components/providers/WebMcpTools.tsx` registers tools with `document.modelContext.registerTool`: search templates, search tutorials, open a template, generate a diagram and open a page.
  - The tools only navigate to same-site paths they build themselves; an agent can't pass in a URL.
  - The origin-trial token goes in `NEXT_PUBLIC_WEBMCP_ORIGIN_TRIAL`. Register the origin at developer.chrome.com/origintrials (WebMCP, Chrome 149–162, ends 30 March 2027) and redeploy, since `NEXT_PUBLIC_*` values are built in. The token is public by design. It affects agent use, not Google rankings; Lighthouse only needs `chrome://flags/#enable-webmcp-testing`.

---

## 3. Map keywords to page types (search intent)

**Technique.** Give each search intent exactly one kind of page, so pages don't compete with each other (keyword cannibalisation).

| Intent | Example queries | Page type | URL |
|---|---|---|---|
| Learn to design a system | "system design", "how to design WhatsApp", "X system design" | Tutorial | `/tutorials/<id>` |
| See or download a diagram | "architecture diagram", "ChatGPT architecture diagram" | Template | `/templates/<slug>` |
| Understand a building block | "what is a load balancer", "API gateway system design" | Glossary term | `/system-design/<term>` |
| Use a tool | "free architecture diagram generator", "text to diagram", "QPS calculator" | Free tool | `/free-*`, `/system-design-calculator` |
| Compare tools | "Eraser alternative", "draw.io vs" | Comparison | `/alternatives/<slug>` |

Each page type says its phrase in the title, the H1, the description and the link text pointing to it. Tutorials say "System Design"; templates say "Architecture Diagram"; the glossary hub says "System Design Concepts", so it doesn't compete with `/tutorials`.

**Be realistic about head terms.** "System design" and "architecture diagram" belong to sites with years of backlinks. Win the long tail first (X architecture diagram, how to design X, what is X). Those pages then link to the hubs, which is how the hubs eventually rank.

---

## 4. Turn hidden content into HTML

**Technique.** Before writing new content, look for content the site already has but doesn't serve as HTML.

- **Here:** the tutorial data already held about 46,000 words of teaching text, but the interactive app rendered it only in the browser.
- **Fix:** render a written guide on the server below the app (`components/tutorial/TutorialArticle.tsx`, built by the pure `lib/tutorial/tutorialArticle.ts`). It has the H1, every stage and component with its explanation, and links.
- **Detail:** the guide is visible, normal content, not hidden text. The app's full-screen overlays were scoped to the app (`position: absolute` inside a `relative` container) so they don't cover the guide.

---

## 5. Write content that answers the query

### 5.1 Template guides
Every template page carries a guide (`data/templates/guides.ts`) with the same sections:
- how the architecture works (2–3 paragraphs);
- **request flow, step by step** (numbered, following the diagram's real connections);
- key design decisions, each with its reason and its cost;
- how it scales;
- three questions people search for, also as `FAQPage`.

**Guardrails (worth copying):**
- Write against the actual diagram. A test checks that each guide belongs to a real template, has every section and names at least 60% of that template's components, so guides can't drift from their diagrams.
- Describe real products from public information only, and say so on the page ("A typical design for a ChatGPT-style system… not OpenAI's internal architecture").
- **Don't auto-fill from shared snippets.** Generic tooltip text was written for one context ("streams video") and would have been wrong elsewhere.

### 5.2 New pages where demand has no page
- We added 10 templates for systems that had a tutorial but no diagram (WhatsApp, Twitter, Airbnb, Discord, Zoom, Spotify, LinkedIn, Figma, GitHub, rate limiter).
- **Quality bar:** generating them straight from the tutorials gave eight-node diagrams with odd links, so we drew them by hand (11–18 components, labelled connections). Every component the tutorial teaches is included, so the template and the lesson agree.
- **Deliberately skipped:** YouTube, Stripe, Shopify, DoorDash and Notion, because existing generic pages already cover them. A second near-identical page would compete with the first.

### 5.3 Glossary (programmatic, but each page is distinct)
- `/system-design` plus 20 term pages from `data/glossary/terms.ts`. Each page covers what it is, how it works, when to use it, trade-offs, common technologies and an FAQ.
- **The trick that makes them unique:** each term has a `match` pattern, and `lib/site/glossary.ts` uses it to classify every template and tutorial component. Each term page then lists the real diagrams that use it.
- **Detail:** classify by a component's name first and its subtitle second, so "API Gateway (Auth + routing)" counts as a gateway, not an auth service. Tests check that every term links to at least one template or tutorial.

---

## 6. Internal linking

Internal links tell search engines what matters and spread ranking strength across the site. What we did:
- **Real `<a href>` links everywhere.** Cards that navigate with `onClick` are invisible to crawlers. We kept the card's click and made the title a `Link` (with `stopPropagation`, so the two don't both fire).
- **Links between page types,** with link text matching the target's search phrase:
  - templates ↔ tutorials for the same system;
  - template components → glossary terms;
  - tutorial guides → "Concepts in this design";
  - glossary terms → templates and tutorials;
  - free tools → each other, the templates and the tutorials.
- **Hubs high in the structure:** Templates and Tutorials lead the nav, the home page has a "Learn" section linking both hubs plus six pages of each, and the footer lists every hub and tool.
- **When two pages cover one system,** the dedicated page wins. `templateForTutorial` prefers a template whose main tutorial is this one.

---

## 7. Free tools (link bait that also converts)

**Technique.** Free, useful, no-sign-up tools rank for "free X" queries, earn natural backlinks and turn visitors into users.

**Rule: one distinct tool per page.** Near-duplicate pages aimed at keyword variants ("free diagram generator", "AI diagram generator", "online diagram maker") are **doorway pages** under Google's spam policies and can hurt the whole site. Merge variants into one page and redirect the extras.

What we built:
| Page | What it does | Detail |
|---|---|---|
| `/free-architecture-diagram-generator` | AI generator: describe a system or paste a GitHub repo, and it opens the editor and generates | Covers both "free" and "AI" searches. `/ai-architecture-diagram-generator` redirects to it permanently (308). |
| `/free-diagram-generator` | Mermaid text in, a laid-out diagram out, download PNG or SVG, "Edit in ArchDraw" | Uses the real pipeline (`POST /api/diagram/load` with `dryRun` + `preview`, which stores nothing). The SVG is shown as an `<img>`, so nothing in it can run as script. Fair-use rate limit. |
| `/system-design-calculator` | Back-of-the-envelope estimator: queries per second, peak load, storage, bandwidth | Pure, tested maths (`lib/site/capacityEstimate.ts`), example presets, latency and powers-of-two tables, links to the glossary |

Ideas for later, each a distinct, real tool:
- an architecture diagram icon pack (download SVGs);
- a Mermaid syntax validator;
- a system design interview question bank with a practice timer;
- an SLA / uptime calculator ("99.9% = 8.76 h a year");
- a database choice helper (SQL vs NoSQL questionnaire).

---

## 8. Comparison and alternative pages

- `/alternatives` plus one page per competitor (Eraser, draw.io, Lucidchart). Each has an at-a-glance table, "What they do well", "What we do differently", **"Choose them if"** and "Choose us if", and an FAQ.
- **Honesty rules:**
  - Research current features before writing. All three competitors now have AI generation, so "they have no AI" would have been false.
  - Leave out prices and quotas, which change often; link to their pricing instead.
  - Include only table rows you're sure of; we removed one we couldn't verify.
  - Show the date the comparison was checked.
- **Why "Choose them if":** it makes the page credible, and the visitors who do choose you are a better fit.

---

## 9. Lead capture inside content

- A prompt box on the generator and comparison pages opens the editor and starts generating straight away (`/editor?generate=<text>`).
- Example prompts are one-click links, marked `rel="nofollow"` because they lead to an app URL, not content.
- Each template page has "Open in editor", plus a link to the matching tutorial.
- **Copy matches what the product really allows:**
  - guests can generate and export PNG or JSON;
  - saving, sharing and SVG export need sign-in.

  Untrue "no account needed" claims cost trust.

---

## 10. Images and previews

- Template diagrams are served as static SVGs (`/templates/<slug>/diagram-{light,dark}.svg`), using the same layout as the editor, with descriptive `alt` text ("WhatsApp Architecture Diagram").
- Social cards (`/api/og/*`) all draw the current brand mark from one component (`lib/site/ogBrandMark.tsx`).
- **Next:** a social preview image per template showing its own diagram, and PNG copies plus an image sitemap for Google Images, which shows image results for "X architecture diagram" searches.

---

## 11. Quality gates (make SEO hard to break)

Tests in the repository that fail when SEO regresses:
- `lib/site/__tests__/templateCatalog.test.ts`:
  - URL-safe, unique slugs;
  - titles shaped like "X Architecture Diagram";
  - descriptions of 160 characters or fewer;
  - template ↔ tutorial links resolve.
- `lib/tutorial/__tests__/tutorialArticle.test.ts`: "X System Design" titles of 60 characters or fewer, and every step written out.
- `data/templates/__tests__/guides.test.ts`: guides are complete and tied to their diagram.
- `lib/site/__tests__/glossary.test.ts`: complete terms, a link for every term, and classification by name before subtitle.
- `lib/tutorial/__tests__/playthrough.test.ts`: every tutorial can actually be completed. This one is about product quality, which is what keeps visitors from bouncing.
- Layout quality tests (`layoutAesthetics`, `layoutReadability`) hold every shipped diagram to the same standard, so new template pages don't look broken.

---

## 11b. Accessibility fixes that Lighthouse and agents check

Agentic Browsing includes an "agent-centric accessibility" check, so accessibility failures now also cost agent compatibility.
- **Decorative copies of real controls:** `aria-hidden="true"` hides an element from screen readers but not from the keyboard, so a hidden mock-up containing buttons fails "ARIA hidden element must not be focusable". Add `inert`, which removes it from both (the home hero's picture of the Overview / Detailed toggle).
- **Dimmed content still has to pass contrast:** scroll effects that fade inactive steps are measured in their faded state. Compute the lowest opacity that keeps the faintest text at 4.5:1 (3:1 for 24px+ or 18.66px+ bold) and never go below it. On the night page, the muted body text needed at least 0.82; the steps had been at 0.38 (1.8:1).
- **Source maps:** `productionBrowserSourceMaps: true` clears "Missing source maps for large first-party JavaScript" and makes production errors readable. Only do this when the code may be public (ArchDraw is open source).

## 11c. Performance: measure before you optimise

- **Lighthouse's mobile LCP is simulated.** With the default `throttlingMethod: simulate`, it replays the page as a slow phone on a slow network and charges LCP for every script and stylesheet requested before the first paint. Read `metrics.observedLargestContentfulPaint` in the JSON report, too. On the ArchDraw home page, the hero paragraph really painted at **224 ms**, together with the first paint, while the simulated LCP said 3.0 s (production) or 3.9 s (local build). Real-user Core Web Vitals in PageSpeed Insights' field data are what count for Google.
- **Compare like with like.** Build `main` and the branch the same way, serve both locally, run Lighthouse three times each and compare medians. A single run, or local against production, is noise.
- **Find the biggest unused chunk and trace it to its import.** Minified chunks hide library names, but fingerprints such as hundreds of `viewBox` values give them away. Here a 241 KB chunk, 96% unused, was the full `@react-icons-cloud/aws` set (about 500 icons in one pre-bundled file that can't be tree-shaken). It was pulled into every canvas, including the landing hero, which uses none of it. Loading it on demand, the first time an AWS component renders, cut unused JavaScript from **292 to 43 KiB**.
- **Lazy isn't lazy if it fires during hydration.** An `IntersectionObserver` with a 200px margin fired at once on phones, so the hero map's JavaScript competed with the first paint. Now, when the map is merely visible, it waits for the `load` event and `requestIdleCallback`; interaction still loads it immediately. That cut total blocking time by 19% (219 → 177 ms) and Speed Index by 7% (2,529 → 2,347 ms).
- **Not every Lighthouse suggestion helps.** `experimental.inlineCss` removed the render-blocking stylesheets but inlined *all* of the app's CSS. The home page HTML grew to 946 KB, and the score fell from 85 to 75. Measure each suggestion; don't apply them in bulk.

## 12. Launch and measurement checklist

After each deploy:
1. Run the audit script (section 1) against production: every sitemap URL returns 200, is indexable and has a self-referencing canonical.
2. Search Console (domain property `archdraw.hiabhee.online`; a URL-prefix property for the same site doesn't exist):
   - resubmit `sitemap.xml` (after the Nov 7 deploys Google read it the same day: 116 pages);
   - use URL Inspection → "Request indexing" for the new hubs and a few new pages (about 10 a day; on Nov 7 we requested `/system-design`, both free generators, the calculator, `/alternatives` and the WhatsApp, Twitter and rate-limiter templates);
   - check structured data with the Rich Results Test.
3. **PageSpeed Insights** (https://pagespeed.web.dev/?hl=en): test the home page and one page of each type, on both mobile and desktop.
   - It runs Lighthouse on Google's servers and also shows **real-user Core Web Vitals** (LCP, INP, CLS) from the Chrome UX Report once the site has enough traffic. Those field numbers are what Google's page experience signals use, not the lab score.
   - Treat the lab score as a to-do list. Fix accessibility and best-practice failures first: they are cheap, and agents and screen readers depend on them. Performance work comes after.
   - The Lighthouse version in PageSpeed Insights and Chrome DevTools can lag the CLI, so newer categories such as Agentic Browsing may need `npx lighthouse@latest`.
4. Lighthouse: SEO 100, Best Practices 100, Agentic Browsing 3/3. For WebMCP, use Chrome with `chrome://flags/#enable-webmcp-testing`.
5. After 4–6 weeks:
   - in Search Console's Performance report, find queries in positions 8–30 and improve those pages first;
   - check the Pages report for "Duplicate without user-selected canonical" and "Crawled – currently not indexed".
6. Off-site (needed for head terms):
   - post on Show HN and Product Hunt;
   - submit to AI-tool and MCP directories;
   - open PRs adding templates to awesome-system-design lists;
   - cross-post deep dives to dev.to with a canonical link back.

---

## 13. Lessons learned

- **Search engines only count what's in the HTML.** A rich client app can be close to empty for them.
- **One page per intent.** Cannibalisation and doorway pages do more harm than missing pages.
- **Accuracy is an SEO feature.** Honest comparisons, "representative design" notes and tested guides build the trust that earns links.
- **Product bugs are SEO bugs.** A tutorial whose steps can't be completed sends visitors back to the results page. Our playthrough test found that 22 of 24 tutorials had steps that never accepted a correct connection.
- **Caches outlive deploys.** Favicons, social cards and connector icons can stay stale for weeks after a brand change.
- **Check whose icon it really is.** The "old logo" in Claude's connector list was the parent domain's (`hiabhee.online`) favicon, not an old ArchDraw icon. Search Console's property list shows each domain's icon, which is a quick way to check.

---

## 14. Change log

| Date | Change | PR |
|---|---|---|
| 2026-11-07 | Brand mark everywhere, per-page canonicals, noindex on private pages, robots and sitemap, template gallery, legal pages, `llms.txt` | #22 |
| 2026-11-07 | Search-intent split (tutorials vs templates), server-rendered tutorial guides, crawlable tutorial links, nav, home and footer links; tutorial connection-check fix | #24 |
| 2026-11-07 | MCP server icons (1.2.1), plugin icon, social card marks | #26 |
| 2026-11-07 | WebMCP tools and `catalog.json` (Lighthouse Agentic Browsing) | #27 |
| 2026-11-07 | Written guides on all 26 template pages, with FAQ structured data | #28, #29 |
| 2026-11-07 | Ten new templates for systems that had only a tutorial | #30 |
| 2026-11-07 | System design concepts glossary (20 terms), with links in from templates and tutorials | #31 |
| 2026-11-07 | Free tools (AI generator, text-to-diagram, system design calculator) and comparison pages; this playbook | #32 |
| 2026-11-07 | Clean-ups: lint errors to zero, current MCP install commands in docs | #33 |
| 2026-11-07 | Search Console: sitemap read (116 pages), 8 indexing requests, Rich Results Test; WebMCP origin trial registered | #34 |
| 2026-11-07 | Lighthouse / PageSpeed fixes on the home page: inert hero toggle, AA contrast for dimmed steps, production source maps | #35 |
| 2026-11-07 | Home page performance: AWS icon set loaded on demand (unused JS 292 → 43 KiB), hero map loads after the page is idle | #36 |
