# ArchDraw

AI-assisted system architecture diagramming tool. Describe a system in plain English and get a professional React Flow diagram with auto-layout, subgraph grouping, and export.

## Features

- **AI Generation** — Natural language → 6-stage pipeline → styled diagram (concept detection, LLM planning, Mermaid materialize, layout, score, validate)
- **Repo → Diagram** — GitHub URL / tarball → 10-stage pipeline → architecture from code (ingest, analyze, classify, extract, relationships, verify)
- **Interactive Canvas** — Drag, pan, zoom, group, connect with floating-edge + collision-aware routing
- **Multi-Canvas Tabs** — Zustand-backed tab management with undo/redo + debounced persistence
- **Mermaid** — Input / export raw Mermaid with auto-validation and round-trip via `layoutDiagramViaMermaid`
- **Auto-Layout** — Dagre-only via Mermaid pipeline (`pipeline-shared/layout`); LR / TB toggle in toolbar
- **Templates** — Pre-built architectures (Netflix, Uber, Instagram, etc.)
- **Tutorials** — 22+ guided tutorials teaching system architecture
- **Auth** — better-auth (Google / GitHub OAuth — email+password disabled) with 7-day sessions
- **Persistence** — Prisma + Supabase / Neon (PostgreSQL) + guest localStorage fallback
- **Share & Embed** — Public share links and embeddable viewers (domain allowlist via `ALLOWED_EMBED_DOMAINS`)
- **MCP Server** — Standalone protocol server for AI assistants (generate, update, validate, layout, template, export)
- **Export** — JSON, Mermaid, PNG, SVG (SVG/PDF gated for authenticated users)

## Tech Stack

Next.js 16 / React 19 / TypeScript · React Flow v11 · Zustand v5 · Dagre (frontend) / ELK (mcp-server only) · Groq · Prisma + Supabase · Upstash Redis · Tailwind CSS v4 · Framer Motion · Radix UI / shadcn/ui · Mermaid.js v11 · better-auth

## Getting Started

### Prerequisites

- Node.js 18+, npm 10+
- Groq API key (for AI generation)
- PostgreSQL database (optional — auth & persistence, e.g. Supabase)
- Upstash Redis (optional — caching)

### Installation

```bash
cd frontend
npm install
cd ../mcp-server && npm install && cd ../frontend
cp .env.example .env.local
# Edit frontend/.env.local with your actual values
```

### Environment Variables

```env
GROQ_API_KEY=your_groq_api_key

DATABASE_URL=postgresql://...

UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

BETTER_AUTH_SECRET=your_secret
BETTER_AUTH_URL=http://localhost:3000

# Admin Configuration (Optional)
ADMIN_PASSCODE=your_admin_passcode
ADMIN_SESSION_SECRET=your_admin_session_secret
ALLOWED_ADMIN_EMAIL=admin@yourdomain.com

# Public Configuration
NEXT_PUBLIC_ADMIN_EMAIL=admin@yourdomain.com
NEXT_PUBLIC_CONTACT_EMAIL=contact@yourdomain.com

# Embed Security (Optional)
ALLOWED_EMBED_DOMAINS=example.com,another.com
```

Only `GROQ_API_KEY` is required for AI generation. The app runs locally without Redis (rate limiting degrades gracefully).

See `frontend/.env.example` for a complete list of available environment variables.

For security configuration and best practices, see [SECURITY.md](SECURITY.md).

### Running

All commands should be run from the `frontend/` directory.

```bash
# Start Next.js dev server
npm run dev

# MCP server (in a separate terminal)
npm run dev:mcp

# Tests
npm test

# Lint & type check
npm run lint
npx tsc --noEmit

# Production build
npm run build
npm run start
```

## Project Layout

```
frontend/
├── app/                  # Next.js App Router pages & API routes
├── components/           # React components (Canvas, nodes, edges, panels)
├── store/                # Zustand stores (diagram, auth, tutorial, etc.)
├── lib/
│   ├── ai/pipeline/mermaid-pipeline/  # 6-stage AI → Mermaid pipeline
│   ├── repo-diagram/      # 10-stage Repo → Diagram pipeline
│   ├── mermaid/           # Mermaid parse / validate / relayout (canonical)
│   ├── pipeline-shared/layout/  # Dagre layout engine (single owner)
│   ├── pipeline-core/     # Typed Pipeline / Stage primitives
│   └── types/             # TypeScript definitions
├── data/                 # Templates, tutorials, component registry
└── prisma/               # Schema & migrations (client → src/generated/prisma)

mcp-server/               # Standalone MCP server (10 tools, ELK layout only here)
```

## AI Pipeline

6-stage pipeline in `lib/ai/pipeline/mermaid-pipeline/createAiMermaidStages.ts`: Concept Detection → Architecture Planning (LLM or canned `conceptTemplates.ts` for ≤12-word prompts) → Layout Override → Mermaid Materialize (parse → build → Dagre layout → size) → Score → Validate. Canonical relayout is `layoutDiagramViaMermaid` in `lib/mermaid/relayout.ts` (React Flow → Mermaid → Dagre → React Flow).

Repo pipeline in `lib/repo-diagram/pipeline-v2.ts`: Ingest → Cache Check → Analysis → Baseline → Classify → Extract → Relationships → Verify → Finalization → Cache Write.

## MCP Server

Standalone server at `mcp-server/` (self-contained `node_modules`, SDK 1.29). Dev: `npm run dev:mcp` from `frontend/`. Tools: `generate_diagram` (Mermaid-first), `update_diagram`, `validate_diagram`, `fix_layout`, `apply_template`, `export_diagram`, `list_nodes`, `save_checkpoint`, `load_checkpoint`, `read_me`. ELK lives only here — frontend layout is Dagre-only.

## License

MIT
