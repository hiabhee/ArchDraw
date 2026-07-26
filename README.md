# ArchDraw

AI-assisted system architecture diagramming tool. Describe a system in plain English and get a professional React Flow diagram with auto-layout, subgraph grouping, and export.

## Features

- **AI Generation** — Natural language → multi-stage pipeline → styled diagram
- **Interactive Canvas** — Drag, pan, zoom, group, connect with collision resolution
- **Multi-Canvas Tabs** — Zustand-backed tab management with undo/redo
- **Mermaid** — Input/export raw Mermaid syntax with auto-validation
- **Auto-Layout** — ELK + Dagre for hierarchical layouts
- **Templates** — Pre-built architectures (Netflix, Uber, Instagram, etc.)
- **Tutorials** — 22+ guided tutorials teaching system architecture
- **Auth** — better-auth (credentials / Google / GitHub OAuth)
- **Persistence** — Prisma + Neon (PostgreSQL) with better-auth
- **Share & Embed** — Public share links and embeddable viewers
- **MCP Server** — Protocol server for AI coding assistants to manipulate diagrams
- **Export** — JSON, Mermaid, PNG, SVG

## Tech Stack

Next.js 16 / React 19 / TypeScript · React Flow v11 · Zustand v5 · ELK + Dagre · Groq API · Prisma + Neon (PostgreSQL) · Upstash Redis · Tailwind CSS v4 · Framer Motion · Radix UI / shadcn/ui · Mermaid.js v11 · better-auth

## Getting Started

### Prerequisites

- Node.js 18+, npm 10+
- Groq API key (for AI generation)
- PostgreSQL database (optional — auth & persistence, e.g. Neon)
- Upstash Redis (optional — caching)

### Installation

```bash
cd frontend
npm install
cd ../mcp-server && npm install && cd ../frontend
cp .env.example .env.local
```

### Environment Variables

```env
GROQ_API_KEY=your_groq_api_key

DATABASE_URL=postgresql://...

UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

BETTER_AUTH_SECRET=your_secret
BETTER_AUTH_URL=http://localhost:3000
```

Only `GROQ_API_KEY` is required for AI generation. The app runs locally without Redis (rate limiting degrades gracefully).

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
├── lib/                  # Core logic: AI pipeline, Mermaid, canvas
│   ├── ai/pipeline/      # 8-stage diagram generation pipeline
│   ├── ai/agents/        # LLM agents
│   ├── ai/services/      # ELK layout, caching, edge routing
│   ├── mermaid/          # Mermaid parsing/validation
│   └── types/            # TypeScript definitions
├── data/                 # Templates (15+), tutorials (22+), component library
└── src/                  # Generated Prisma types & utilities

mcp-server/               # Standalone MCP server (10+ tools)
```

## AI Pipeline

8-stage pipeline in `lib/ai/pipeline/`: Intent Detection → Reasoning → Diagram Generation → Parse → Validate & Repair (up to 16 retries) → Layout (ELK/Dagre) → Convert (React Flow nodes/edges) → Score.

## MCP Server

Standalone server at `mcp-server/` exposing tools for AI coding assistants: `generate_diagram`, `fix_layout`, `apply_template`, `get_diagram_state`, `update_diagram`, `validate_diagram`, `export_diagram`, and more.

## License

MIT
