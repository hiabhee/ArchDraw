import Link from 'next/link';
import type { ComponentType } from 'react';
import { ArrowRight, Terminal, Cpu, Zap, Shield, GitBranch } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';

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
  { name: 'read_me', desc: 'Gives the reference guide for the agent. The agent calls it first.' },
  { name: 'generate_diagram', desc: 'Makes a diagram from Mermaid text or from nodes and edges.' },
  { name: 'update_diagram', desc: 'Adds, removes, or changes nodes and edges in the current diagram.' },
  { name: 'get_diagram_state', desc: 'Gives the nodes and edges of the current diagram.' },
  { name: 'validate_diagram', desc: 'Finds structural problems and gives recommendations.' },
  { name: 'fix_layout', desc: 'Calculates the layout again with the ArchDraw editor pipeline.' },
  { name: 'apply_template / list_templates', desc: 'Loads an architecture template, or gives the list of templates.' },
  { name: 'list_node_types', desc: 'Gives the list of component types in the ArchDraw library.' },
  { name: 'save_checkpoint / load_checkpoint', desc: 'Saves the current diagram with a name, and restores it.' },
  { name: 'export_diagram', desc: 'Exports the diagram as JSON, PNG, or SVG.' },
];

const FAQS = [
  {
    q: 'Which AI assistants can use the ArchDraw MCP server?',
    a: 'All MCP clients. This includes Claude Code, the Claude apps, Codex, Cursor, VS Code, Gemini CLI, and OpenCode. Clients that support remote servers connect to https://archdraw.hiabhee.online/api/mcp. Other clients run the local server with npx.',
  },
  {
    q: 'Is the MCP server secure?',
    a: 'The tools send only the diagram content that the agent gives them: component names, labels, connections, and Mermaid text. They do not read your source files. Preview links expire after 7 days. Do not put secrets in diagram labels. Read the privacy policy before you connect.',
  },
  {
    q: 'Do I need ArchDraw\u2019s cloud service to use the MCP server?',
    a: 'Yes. The remote server is the hosted ArchDraw service. The local server also uses the hosted ArchDraw API for layout and preview links. For a self-hosted deployment, use https://<your-domain>/api/mcp, or set API_BASE_URL to your domain.',
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

function FeatureCard({ icon: Icon, title, desc }: { icon: ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-card p-5">
      <Icon className="w-4 h-4 text-brand-text mb-3" />
      <h3 className="text-sm font-bold text-text-primary mb-1.5">{title}</h3>
      <p className="text-xs text-text-secondary leading-relaxed">{desc}</p>
    </div>
  );
}

export default function McpPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      <LandingNav />

      <main className="flex-1 max-w-[980px] w-full mx-auto px-6 pt-24 pb-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
        />

        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium mb-5 bg-surface-card border border-border-default text-text-secondary">
            <Terminal className="w-3 h-3" />
            MCP · Model Context Protocol
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-6 text-text-primary" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', letterSpacing: '-0.03em' }}>
            What is an MCP server for diagramming?
          </h1>

          <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-4">
            An MCP server for diagramming lets AI agents like Claude, Codex, and Cursor make, change,
            and lay out architecture diagrams. ArchDraw has one. The agent does not only describe the
            diagram. It adds nodes, connects edges, calculates the layout, and validates the graph
            through MCP tools. You can connect to the hosted server, or run it locally with npx.
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
            title="Remote or local"
            desc="Connect to the hosted server at /api/mcp with no installation. Or run the server locally over stdio with npx."
          />
          <FeatureCard
            icon={Shield}
            title="Preview links"
            desc="Each new diagram gets a preview link that you can open and share. Links expire after 7 days. Tell the agent to keep a diagram private if you do not want a link."
          />
          <FeatureCard
            icon={GitBranch}
            title="Works with your workflow"
            desc="Connect from Claude Code, the Claude apps, Codex, Cursor, VS Code, Gemini CLI, or OpenCode. The same tools make, lay out, validate, and export diagrams."
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
          <div className="rounded-xl border border-border bg-accent-bg p-5">
            <p className="text-sm leading-6 text-text-secondary">The connection guide gives the steps for each client. It also tells you how to make sure that the tools loaded.</p>
            <Link href="/agent-skill" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover">
              Open the coding agent setup guide <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/docs/connect-agents" className="mt-3 block text-sm text-text-secondary underline underline-offset-2 hover:opacity-80">
              Read the connection steps for all clients
            </Link>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mt-3">
            For background on the implementation, see the{' '}
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
            href="/agent-skill"
            className="w-full sm:w-auto inline-flex items-center justify-center text-sm font-semibold text-[hsl(var(--foreground))] px-6 py-3 rounded-lg border border-[hsl(var(--border)/0.16)] transition-colors duration-200"
          >
            Set up a coding agent
          </Link>
        </div>
      </main>
    </div>
  );
}
