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
- **Auth & Persistence** — Supabase Magic Link OTP
- **Share & Embed** — Public share links and embeddable viewers
- **MCP Server** — Protocol server for AI coding assistants to manipulate diagrams
- **Export** — JSON, Mermaid, PNG, SVG

## Tech Stack

Next.js 16 / React 19 / TypeScript · React Flow v11 · Zustand v5 · ELK + Dagre · Groq API · Supabase · Upstash Redis · Tailwind CSS v4 · GSAP + Framer Motion · Radix UI / shadcn/ui · Mermaid.js v11

## Getting Started

### Prerequisites

- Node.js 20+, npm 10+
- Groq API key (for AI generation)
- Supabase project (optional — auth & persistence)
- Upstash Redis (optional — caching)

### Installation

```bash
cd frontend
npm install
cd mcp-server && npm install && cd ..
cp .env.example .env.local
```

### Environment Variables

```env
GROQ_API_KEY=your_groq_api_key

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

UPSTASH_REDIS_URL=your_redis_url
UPSTASH_REDIS_TOKEN=your_redis_token
```

Only `GROQ_API_KEY` is required for AI generation. The app runs locally without Supabase or Redis (features like auth, persistence, and caching will be unavailable).

### Running

```bash
# Start everything (frontend + MCP server)
npm run dev

# Or run separately:
npm run dev:frontend   # Next.js on http://localhost:3000
npm run dev:mcp        # MCP server on stdio

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
├── lib/                  # Core logic: AI pipeline, Mermaid, canvas, Supabase
│   ├── ai/pipeline/      # 8-stage diagram generation pipeline
│   ├── ai/agents/        # LLM agents
│   ├── ai/services/      # ELK layout, caching, edge routing
│   └── mermaid/          # Mermaid parsing/validation
├── data/                 # Templates (15+), tutorials (22+), component library
├── types/                # TypeScript definitions
└── mcp-server/           # Standalone MCP server (10+ tools)
```

## AI Pipeline

8-stage pipeline in `lib/ai/pipeline/`: Intent Detection → Reasoning → Diagram Generation → Parse → Validate & Repair (up to 16 retries) → Layout (ELK/Dagre) → Convert (React Flow nodes/edges) → Score.

## MCP Server

Standalone server at `mcp-server/` exposing tools for AI coding assistants: `generate_diagram`, `fix_layout`, `apply_template`, `get_diagram_state`, `update_diagram`, `validate_diagram`, `export_diagram`, and more.

## License

MIT
