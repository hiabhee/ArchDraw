# ArchDraw — Overview

## 1. What is ArchDraw?

ArchDraw is an **AI-assisted system architecture diagramming tool**. Instead of manually dragging and aligning boxes, users **describe a system in plain English (or paste Mermaid / a GitHub repo URL)** and ArchDraw turns that description into a **professional, auto-laid-out React Flow diagram** with styled nodes, subgraph grouping, edges, and export.

The primary app lives in `frontend/` (a Next.js App Router application); a companion MCP server (`mcp-server/`) exposes diagram tools to external AI coding assistants.

It is positioned as "**ChatGPT for architecture diagrams**" — an AI-native tool for the task where general-purpose diagram editors (draw.io, Lucidchart) make users spend more time formatting the diagram than thinking about the architecture.

### Positioning in one line

> Build accurate architecture diagrams in seconds — not hours.

---

## 2. Features

### AI generation
- **Prompt → diagram**: describe a system in plain English and a multi-stage AI pipeline (intent detection → planning → Mermaid materialization → validation → layout → score) produces a styled diagram.
- **Repo → diagram**: paste a GitHub repo URL and the pipeline ingests, analyzes, classifies, and extracts components/relationships to generate a diagram of the codebase.
- **Mermaid input**: paste raw Mermaid syntax with auto-validation and round-tripping.
- **Concept templates**: short "what is X / describe X architecture" prompts hit canned, curated Mermaid templates (no LLM) for consistent results.

### Diagramming & canvas
- **Interactive canvas**: drag, pan, zoom, select, connect nodes with collision resolution.
- **Rich visual vocabulary**: silhouette shapes (rectangle, diamond, cylinder, circle, hexagon, cloud, shield, actor, monitor, mobile, etc.), system cards, groups/subgraphs, annotations, and text labels.
- **Semantic styling**: five visual concerns (client, compute, data, async, external) with a consistent, muted design system.
- **Dynamic handles**: per-side in/out handle slots (±16px) so edges stay clean on every shape type.
- **Auto-layout**: canonical Mermaid → Dagre layout with LR/TB toggling.
- **Smart node sizing**: optical grid (160/200/240) with per-shape bands and label wrapping.

### Product features
- **Multi-canvas tabs** with undo/redo and debounced persistence.
- **Templates**: 15+ pre-built architectures (Netflix, Uber, Instagram, etc.).
- **Tutorials**: 22+ guided tutorials teaching system architecture.
- **Command palette (⌘K)**: quick-add components.
- **Mermaid panel**: view/edit the underlying Mermaid code.

### Sharing, export & integration
- **Export**: JSON, Mermaid, PNG, SVG (PDF/HTML-embed for authenticated users).
- **Share & embed**: public share links and embeddable viewers with domain allowlist.
- **MCP server**: 10+ tools (`generate-diagram`, `update-diagram`, `validate-diagram`, `fix-layout`, `apply-template`, `export-diagram`, etc.) so AI coding assistants can manipulate diagrams.

### Platform
- **Auth**: better-auth with Google/GitHub OAuth.
- **Persistence**: Prisma + Supabase (PostgreSQL); guests work via localStorage.
- **Quotas/tiers**: guest vs. authenticated limits (AI generations, canvases, node counts, export formats) with upsell modal.
- **Stack**: Next.js · React · TypeScript · React Flow v11 · Zustand · Dagre · Groq · Mermaid.js · Tailwind.

---

## 3. What the landing page says

### Hero (badge + headline + subtext)
- Badge: "**ChatGPT for architecture diagrams** · Now in beta".
- H1: "**Build accurate architecture diagrams in seconds — not hours.**"
- Subtext: "Describe your system in plain English or Mermaid. ArchDraw lays it out for design reviews, docs, and onboarding — so you stop fighting draw.io."
- CTAs: "Generate my diagram free" and "See example diagrams"; free during beta, no credit card, no account needed to try.

### Why ArchDraw (value props)
- "The fastest way from idea to architecture" — "Stop fighting your diagramming tool. ArchDraw turns your thinking into a clean, structured diagram — so you can focus on the system, not the layout."
  1. **Describe, don't draw** — type in plain English or paste Mermaid; AI handles structure, layout, styling.
  2. **Edit visually** — drag, connect, refine; auto-layout keeps diagrams clean.
  3. **Share anywhere** — PNG/SVG/live link; presentation-ready in every context.
- Trust strip: "**10× faster than draw.io** · Mermaid-compatible · AI that understands your stack".
- Social proof: "Built for the systems you already design around" (AWS, GCP, Kubernetes, Node.js, PostgreSQL, Redis, RabbitMQ, React, Docker, TypeScript).

### How it works
"From description to diagram in 3 steps" — no learning curve, no manual alignment:
1. **Describe** — type in plain English, paste Mermaid, or import a file.
2. **Generate** — ArchDraw validates, enriches, and auto-lays out the diagram. "No more dragging boxes or untangling lines."
3. **Share** — export to PNG/SVG or a live shareable link.

### Who it's for
- **Students** — practice system-design interview diagrams without burning time on alignment.
- **Engineers & teams** — document real production architecture for onboarding, reviews, READMEs.
- **Technical writers** — embed crisp diagrams in user docs without learning a design tool.
- **Founders & researchers** — explain complex systems to stakeholders in one clear view.

### Founder note
"I built ArchDraw because I kept losing more time formatting a diagram than thinking about the architecture itself. Now the AI handles layout — and I focus on the system." — Abhishek Suresh Jamdade, Founder · Building in public.

### Pricing
- "**Free during beta**" — $0, free forever in beta. Includes unlimited generation, Mermaid workspace editor, PNG/SVG/live-link export, real-time collaboration, no credit card.
- "Paid plans are coming. Early users will get a permanently locked-in launch discount." (Beta Pass)

### FAQ highlights
- **vs. draw.io/Lucidchart**: "Those tools make you manually drag, connect, and align every box. ArchDraw uses AI to handle layout automatically — you describe the system, the diagram takes shape."
- No account needed to try; account only to save or share.
- Export to PNG/SVG or permanent live links.
- Data privacy: prompts/diagrams processed in-session, not stored or used to train models.

### Final CTA
"**Stop dragging boxes. Start describing systems.**" — clean, structured, presentation-ready diagrams in seconds, free during beta.

### Footer
"A diagramming tool for engineers who think in systems." · "Crafted in public by Abhishek."

---

## 4. Positioning of ArchDraw so far

**Category**: AI-native architecture diagramming — an "AI diagram generator" rather than a manual diagram editor.

**Core wedge / differentiator**: automation of layout and structure. The recurring enemy is **draw.io / Lucidchart** — tools that force manual dragging, connecting, and aligning. ArchDraw's answer: *describe, don't draw*; the AI owns structure, layout, and styling so users focus on the system, not the diagram mechanics.

**Speed & accuracy framing**: "accurate diagrams in seconds — not hours", "10× faster than draw.io", "ready in 30 seconds".

**Audience / personas**: engineers & teams (docs, onboarding, design reviews), students (system-design interview prep), technical writers, founders & researchers. Broadly: "anyone who explains systems visually."

**Monetization / lifecycle stage**: **Beta**. Free during beta (no credit card, no account to try); paid plans coming with a locked-in early-adopter discount ("Beta Pass"). Data is processed in-session and never stored for training — a privacy-first stance.

**Differentiation axes emphasized on the landing page**:
1. AI-native generation from natural language (incl. concept templates for consistent results).
2. Mermaid compatibility (input, export, round-trip).
3. Auto-layout that stays clean during manual editing.
4. Presentation-ready export (PNG/SVG/live links).

**Differentiation in the codebase beyond the landing page**:
- Repo-to-diagram pipeline (GitHub URL → architecture diagram).
- MCP server for AI coding assistants.
- Architecture tutorials (22+) as a learning/onboarding asset.
- Multi-canvas tabs, command palette, component registry/ports.
