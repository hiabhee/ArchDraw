import Link from 'next/link';
import type { ComponentType } from 'react';
import { ArrowRight, Terminal, Cpu, Zap, Shield, GitBranch } from 'lucide-react';

export const metadata = {
  title: 'What is an MCP server for diagramming?',
  description:
    'An MCP server for diagramming is a local bridge that lets AI assistants like Claude and Cursor read, edit, and lay out architecture diagrams programmatically. Here is how ArchDraw\u2019s MCP server works and how to connect it.',
  openGraph: {
    type: 'article',
    url: 'https://archdraw.hiabhee.online/mcp',
    title: 'What is an MCP server for diagramming?',
    description:
      'An MCP server for diagramming lets AI assistants like Claude and Cursor read, edit, and lay out architecture diagrams programmatically.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'What is an MCP server for diagramming?' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'What is an MCP server for diagramming?',
    images: ['/api/og/home'],
  },
};

const TOOLS = [
  { name: 'generate-diagram', desc: 'Create a new diagram from a prompt or Mermaid snippet.' },
  { name: 'update-diagram', desc: 'Add, remove, or rewire nodes and edges on the active canvas.' },
  { name: 'validate-diagram', desc: 'Check the current graph for structural and semantic issues.' },
  { name: 'fix-layout', desc: 'Re-run auto-layout to clean up overlapping or cramped nodes.' },
  { name: 'apply-template', desc: 'Load an architecture template onto the canvas.' },
  { name: 'export-diagram', desc: 'Export the current diagram as JSON, Mermaid, PNG, or SVG.' },
  { name: 'list-nodes', desc: 'Inspect what is currently on the canvas, node by node.' },
  { name: 'save-checkpoint / load-checkpoint', desc: 'Snapshot and restore canvas state during a session.' },
];

const FAQS = [
  {
    q: 'Which AI assistants can use the ArchDraw MCP server?',
    a: 'Any MCP-compatible client, including Claude Desktop, Claude Code, Cursor, and other agents that read mcp configuration files.',
  },
  {
    q: 'Is the MCP server secure?',
    a: 'Yes. The server runs locally on your machine and talks to the AI over standard input/output (stdio) using JSON-RPC — no data is sent to a third-party gateway.',
  },
  {
    q: 'Do I need ArchDraw\u2019s cloud service to use the MCP server?',
    a: 'No. The MCP server runs locally and operates on your diagram files directly. It is bundled in the project under the /mcp-server folder and can be run in any Node.js environment.',
  },
  {
    q: 'Why would an AI want to edit a diagram instead of just describing it?',
    a: 'Describing a diagram still leaves you to do the layout. With an MCP server the AI can inspect the actual canvas, place nodes, wire edges, and run layout — so the result is a real, editable diagram you can refine instead of starting from scratch.',
  },
];

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      '@id': 'https://archdraw.hiabhee.online/mcp#article',
      headline: 'What is an MCP server for diagramming?',
      description: metadata.description,
      url: 'https://archdraw.hiabhee.online/mcp',
      publisher: { '@id': 'https://archdraw.hiabhee.online/#organization' },
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://archdraw.hiabhee.online/mcp#faq',
      mainEntity: FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: { '@type': 'Answer', text: faq.a },
      })),
    },
  ],
};

function Header() {
  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-xl border-b border-[hsl(var(--border)/0.12)]"
      style={{ background: 'hsl(var(--background) / 0.8)' }}
    >
      <div className="max-w-[980px] mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[hsl(var(--foreground))]">
            <svg className="w-3.5 h-3.5 text-[hsl(var(--background))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" />
            </svg>
          </div>
          <span className="font-semibold text-sm text-[hsl(var(--foreground))] tracking-tight">ArchDraw</span>
        </Link>
        <nav className="flex items-center gap-4 text-xs font-semibold">
          <Link href="/docs" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            Documentation
          </Link>
          <Link href="/blogs" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            Engineering Blog
          </Link>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex items-center gap-1"
          >
            <span>Go to Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--card))] p-5">
      <Icon className="w-4 h-4 text-[hsl(var(--muted-foreground))] mb-3" />
      <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-1.5">{title}</h3>
      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{desc}</p>
    </div>
  );
}

export default function McpPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Header />

      <main className="flex-1 max-w-[980px] w-full mx-auto px-6 py-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
        />

        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium mb-5"
            style={{ background: 'hsl(var(--muted)/0.5)', border: '1px solid hsl(var(--border)/0.12)', color: 'hsl(var(--muted-foreground))' }}
          >
            <Terminal className="w-3 h-3" />
            MCP · Model Context Protocol
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-6">
            What is an MCP server for diagramming?
          </h1>

          <p className="text-sm sm:text-base text-[hsl(var(--muted-foreground))] leading-relaxed mb-4">
            An MCP server for diagramming is a local bridge that lets AI assistants like Claude and
            Cursor read, edit, and lay out architecture diagrams programmatically. ArchDraw ships one:
            instead of describing the diagram you want, the AI manipulates your actual canvas — adding
            nodes, wiring edges, running layouts, and validating the graph — through a stdio JSON-RPC interface.
          </p>
          <p className="text-sm sm:text-base text-[hsl(var(--muted-foreground))] leading-relaxed">
            The Model Context Protocol (MCP) is an open standard for giving AI models access to tools
            and data. An MCP <em>server</em> for diagramming exposes diagram operations as tools an AI
            client can call, so the model can work with a real, structured canvas instead of producing
            text you have to translate back into a drawing.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 mt-10">
          <FeatureCard
            icon={Zap}
            title="From description to real canvas"
            desc="The AI calls tools to inspect current nodes, add components, and rewire connections — the diagram is edited directly, not recreated."
          />
          <FeatureCard
            icon={Cpu}
            title="Runs locally"
            desc="The server executes on your machine over standard input/output, so canvas data never leaves your computer."
          />
          <FeatureCard
            icon={Shield}
            title="JSON-RPC transport"
            desc="Requests and responses are structured JSON-RPC messages — fast, debuggable, and standard across MCP clients."
          />
          <FeatureCard
            icon={GitBranch}
            title="Works with your workflow"
            desc="Connect from Claude Desktop, Claude Code, or Cursor; the same tools drive generation, layout, validation, and export."
          />
        </div>

        <section className="mt-12">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
            What can the ArchDraw MCP server do?
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed mb-6">
            The server exposes diagram operations as named tools. These cover the full edit loop an AI
            needs to build and refine an architecture diagram:
          </p>
          <div className="rounded-xl border border-[hsl(var(--border)/0.16)] overflow-hidden">
            {TOOLS.map((tool, i) => (
              <div
                key={tool.name}
                className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3 text-sm ${
                  i > 0 ? 'border-t border-[hsl(var(--border)/0.1)]' : ''
                }`}
              >
                <code className="text-xs font-semibold text-[hsl(var(--foreground))] shrink-0 w-48">{tool.name}</code>
                <span className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{tool.desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">How to connect it</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed mb-4">
            Add the server to your MCP client configuration (for example{' '}
            <code className="text-xs">~/Library/Application Support/Claude/claude_desktop_config.json</code>):
          </p>
          <pre className="overflow-x-auto rounded-lg border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.3)] p-4 text-xs font-mono text-[hsl(var(--foreground))] leading-relaxed">
{`{
  "mcpServers": {
    "archdraw-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/archdraw/mcp-server/dist/index.js"],
      "env": {
        "WORKSPACE_PATH": "/absolute/path/to/diagrams"
      }
    }
  }
}`}
          </pre>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mt-3">
            Full instructions live in the{' '}
            <Link href="/docs" className="text-[hsl(var(--foreground))] underline underline-offset-2 hover:opacity-80">
              MCP Server Guide
            </Link>
            , and we wrote a deep dive on the architecture in the{' '}
            <Link href="/blogs/mcp-server-claude-antigravity" className="text-[hsl(var(--foreground))] underline underline-offset-2 hover:opacity-80">
              engineering blog
            </Link>
            .
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-6">FAQ</h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="rounded-xl border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--card))] p-5">
                <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-2">{faq.q}</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold text-white px-6 py-3 rounded-lg transition-all duration-200"
            style={{ background: 'hsl(var(--primary))' }}
          >
            Generate a diagram free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/docs"
            className="w-full sm:w-auto inline-flex items-center justify-center text-sm font-semibold text-[hsl(var(--foreground))] px-6 py-3 rounded-lg border border-[hsl(var(--border)/0.16)] transition-colors duration-200"
          >
            Read the MCP Server Guide
          </Link>
        </div>
      </main>
    </div>
  );
}
