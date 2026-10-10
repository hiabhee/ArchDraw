import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDown, ArrowRight, Check, CircleHelp, Code2, ExternalLink, Terminal } from 'lucide-react';
import { CopyButton } from '@/components/agent-skill/CopyButton';
import { Footer } from '@/components/landing/Footer';
import { LandingNav } from '@/components/landing/LandingNav';

const SKILL_COMMAND = 'npx skills add hiabhee/archdraw-skill --skill archdraw-diagram';
const CODEX_COMMAND = 'codex mcp add archdraw --scope user --env API_BASE_URL=https://archdraw.hiabhee.online -- npx -y @hiabhee/archdraw-mcp-server';
const CLAUDE_COMMAND = 'claude mcp add --scope local --transport stdio --env API_BASE_URL=https://archdraw.hiabhee.online archdraw -- npx -y @hiabhee/archdraw-mcp-server';
const CURSOR_CONFIG = `{
  "mcpServers": {
    "archdraw": {
      "command": "npx",
      "args": ["-y", "@hiabhee/archdraw-mcp-server"],
      "env": {
        "API_BASE_URL": "https://archdraw.hiabhee.online"
      }
    }
  }
}`;

export const metadata: Metadata = {
  title: 'Use ArchDraw with your coding agent',
  description: 'Install the ArchDraw diagram skill and connect the MCP server to Codex, Claude Code, Cursor, or another coding agent.',
  alternates: { canonical: 'https://archdraw.hiabhee.online/agent-skill' },
  openGraph: {
    type: 'article',
    url: 'https://archdraw.hiabhee.online/agent-skill',
    title: 'Use ArchDraw with your coding agent',
    description: 'Install the ArchDraw diagram skill, connect MCP, and give your coding agent architecture diagram tools.',
  },
};

function CodePanel({ title, value, language = 'Terminal' }: { title: string; value: string; language?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-card text-text-primary shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-text-primary">{title}</p>
          <p className="mt-0.5 font-mono text-[10px] text-text-muted">{language}</p>
        </div>
        <CopyButton value={value} />
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all p-4 font-mono text-[11px] leading-6 text-text-secondary sm:text-xs"><code>{value}</code></pre>
    </div>
  );
}

function StepNumber({ children }: { children: string }) {
  return <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border-strong bg-accent-bg font-mono text-xs font-bold text-accent-text">{children}</span>;
}

export default function AgentSkillPage() {
  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <LandingNav />

      <main className="mx-auto w-full max-w-[1120px] px-5 pb-20 pt-24 sm:px-8">
        <div className="mb-8 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/docs" className="transition hover:text-text-primary">Docs</Link>
          <span aria-hidden="true">/</span>
          <span className="text-text-secondary">Coding agents</span>
        </div>

        <section className="grid gap-10 border-b border-border pb-12 lg:grid-cols-[minmax(0,1fr)_370px] lg:items-end lg:gap-16">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-card px-3 py-1.5 text-xs font-medium text-text-secondary">
              <Terminal size={13} className="text-accent" aria-hidden="true" />
              ArchDraw · Coding agent setup
            </div>
            <h1 className="max-w-[760px] text-4xl font-semibold leading-[1.05] tracking-[-.045em] sm:text-5xl">
              Give your coding agent an architecture canvas.
            </h1>
            <p className="mt-5 max-w-[650px] text-base leading-7 text-text-secondary">
              Install the ArchDraw skill so your agent knows how to shape diagrams, then connect the MCP server so it can create and refine them with real tools.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#setup" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover">
                Set up your agent <ArrowDown size={15} aria-hidden="true" />
              </a>
              <Link href="/mcp" className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-card px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-surface-panel">
                How the MCP server works <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface-card p-5 sm:p-6">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[.15em] text-text-muted">The setup, in three steps</p>
            <ol className="mt-5 space-y-4">
              <li className="flex items-center gap-3"><StepNumber>01</StepNumber><span className="text-sm font-medium">Install the diagram skill</span><Check size={15} className="ml-auto text-emerald-600" aria-hidden="true" /></li>
              <li className="flex items-center gap-3"><StepNumber>02</StepNumber><span className="text-sm font-medium">Add the ArchDraw MCP server</span><Check size={15} className="ml-auto text-emerald-600" aria-hidden="true" /></li>
              <li className="flex items-center gap-3"><StepNumber>03</StepNumber><span className="text-sm font-medium">Restart and ask for a diagram</span><Check size={15} className="ml-auto text-emerald-600" aria-hidden="true" /></li>
            </ol>
          </div>
        </section>

        <div className="grid gap-12 pt-12 lg:grid-cols-[190px_minmax(0,740px)] lg:gap-16">
          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="sticky top-20 space-y-2 border-l border-border pl-4 text-xs">
              <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[.13em] text-text-muted">On this page</p>
              <a className="block py-1 text-text-secondary hover:text-text-primary" href="#setup">Install</a>
              <a className="block py-1 text-text-secondary hover:text-text-primary" href="#verify">Verify</a>
              <a className="block py-1 text-text-secondary hover:text-text-primary" href="#try-it">Try these prompts</a>
              <a className="block py-1 text-text-secondary hover:text-text-primary" href="#updates">Updates</a>
              <a className="block py-1 text-text-secondary hover:text-text-primary" href="#troubleshooting">Troubleshooting</a>
            </nav>
          </aside>

          <article className="min-w-0">
            <section id="setup" className="scroll-mt-24">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-accent-text">01 · Install</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em] sm:text-3xl">Add the skill and the MCP server.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
                The skill provides reusable instructions for architecture diagrams. The MCP server adds diagram tools to your agent. Install the skill from your project root; then use the command for your coding agent below.
              </p>

              <div className="mt-7 flex gap-4">
                <StepNumber>1</StepNumber>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">Install the ArchDraw skill</h3>
                  <p className="mb-4 mt-1 text-xs leading-5 text-text-secondary">The Skills CLI will ask which supported agent to install it for. From the project root, the default install is local to this project.</p>
                  <CodePanel title="Install skill" value={SKILL_COMMAND} />
                  <p className="mt-2 text-xs text-text-muted">To install globally, add <code className="rounded bg-surface-panel px-1 py-0.5 font-mono">-g</code> to the command.</p>
                </div>
              </div>

              <div className="mt-9 flex gap-4">
                <StepNumber>2</StepNumber>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">Connect MCP</h3>
                  <p className="mb-4 mt-1 text-xs leading-5 text-text-secondary">Set <code className="rounded bg-surface-panel px-1 py-0.5 font-mono">API_BASE_URL</code> so the server can use ArchDraw’s diagram generation and layout API.</p>

                  <div className="space-y-4">
                    <CodePanel title="Codex CLI" value={CODEX_COMMAND} />
                    <CodePanel title="Claude Code" value={CLAUDE_COMMAND} />
                    <CodePanel title="Cursor · .cursor/mcp.json" value={CURSOR_CONFIG} language="JSON" />
                  </div>

                  <p className="mt-3 text-xs leading-5 text-text-muted">Codex above installs for your user account. To limit it to the current project, change <code className="font-mono">--scope user</code> to <code className="font-mono">--scope project</code>. Claude Code above saves a local entry for this project.</p>

                  <div className="mt-4 rounded-lg border border-border bg-accent-bg p-4 text-xs leading-5 text-text-secondary">
                    <strong className="text-accent-text">Using a different MCP client?</strong> Add a local stdio server named <code className="font-mono">archdraw</code>, with command <code className="font-mono">npx</code>, arguments <code className="font-mono">-y @hiabhee/archdraw-mcp-server</code>, and environment variable <code className="font-mono">API_BASE_URL=https://archdraw.hiabhee.online</code>.
                  </div>
                  <p className="mt-3 text-xs leading-5 text-text-muted">The MCP process runs on your machine and sends diagram requests to the API URL you configure. For a self-hosted ArchDraw instance, set that variable to your instance URL.</p>
                </div>
              </div>
            </section>

            <section id="verify" className="mt-14 scroll-mt-24 border-t border-border pt-10">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-accent-text">02 · Verify</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em]">Check that the tools loaded.</h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary">Restart your coding agent after adding the server. Then check its MCP list or ask it to list the ArchDraw tools. You should see tools such as <code className="rounded bg-surface-panel px-1 py-0.5 font-mono text-xs">generate_diagram</code>, <code className="rounded bg-surface-panel px-1 py-0.5 font-mono text-xs">update_diagram</code>, and <code className="rounded bg-surface-panel px-1 py-0.5 font-mono text-xs">list_node_types</code>.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface-card p-4"><p className="text-xs font-semibold">Codex</p><code className="mt-2 block font-mono text-xs text-text-secondary">codex mcp list</code><p className="mt-2 text-xs text-text-muted">In the Codex TUI, open <code className="font-mono">/mcp</code>.</p></div>
                <div className="rounded-xl border border-border bg-surface-card p-4"><p className="text-xs font-semibold">Claude Code</p><code className="mt-2 block font-mono text-xs text-text-secondary">claude mcp list</code><p className="mt-2 text-xs text-text-muted">Inside Claude Code, use <code className="font-mono">/mcp</code>.</p></div>
                <div className="rounded-xl border border-border bg-surface-card p-4 sm:col-span-2"><p className="text-xs font-semibold">Cursor</p><p className="mt-2 text-xs leading-5 text-text-secondary">Open <strong>Settings → Tools & MCP</strong> and check that ArchDraw is connected. From Cursor Agent CLI, you can also run <code className="font-mono">cursor-agent mcp list</code>.</p></div>
              </div>
            </section>

            <section id="try-it" className="mt-14 scroll-mt-24 border-t border-border pt-10">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-accent-text">03 · Try it</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em]">Ask for a diagram grounded in your code.</h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary">Start with one of these prompts, then refine the generated architecture in conversation.</p>
              <div className="mt-5 divide-y divide-border rounded-xl border border-border bg-surface-card px-4">
                <p className="py-4 text-sm leading-6">“Inspect this repository and map its architecture. Use evidence from the code and mark anything uncertain.”</p>
                <p className="py-4 text-sm leading-6">“Trace a request from the web client through the backend to persistent storage. Include the main services and external calls.”</p>
                <p className="py-4 text-sm leading-6">“Add Redis between the API and Postgres, show which requests use the cache, and update the diagram.”</p>
              </div>
            </section>

            <section id="updates" className="mt-14 scroll-mt-24 border-t border-border pt-10">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-accent-text">Updates</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em]">Keep the skill current.</h2>
              <p className="mt-3 mb-4 text-sm leading-6 text-text-secondary">Run the Skills CLI from the project where you installed the skill. For a global install, add <code className="rounded bg-surface-panel px-1 py-0.5 font-mono text-xs">-g</code>.</p>
              <CodePanel title="Update the ArchDraw skill" value="npx skills update archdraw-diagram" />
            </section>

            <section id="troubleshooting" className="mt-14 scroll-mt-24 border-t border-border pt-10">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-accent-text">Troubleshooting</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em]">When setup doesn’t show up.</h2>
              <div className="mt-5 space-y-3">
                <details className="group rounded-xl border border-border bg-surface-card p-4">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold"><CircleHelp size={15} className="text-accent" aria-hidden="true" /> I ran <code className="font-mono text-xs">npx archdraw-agent setup</code> and nothing happened.</summary>
                  <p className="mt-3 pl-6 text-xs leading-5 text-text-secondary">That setup command can exit without registering the MCP server. Use the manual skill and MCP steps above; the Codex and Claude commands will write the server entry into the respective agent configuration.</p>
                </details>
                <details className="group rounded-xl border border-border bg-surface-card p-4">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold"><CircleHelp size={15} className="text-accent" aria-hidden="true" /> The MCP server is missing from the agent.</summary>
                  <p className="mt-3 pl-6 text-xs leading-5 text-text-secondary">Confirm the <code className="font-mono">archdraw</code> entry exists in the right configuration, then fully restart the agent. For Codex or Claude Code, rerun that client’s list command above and check for an error next to the server.</p>
                </details>
                <details className="group rounded-xl border border-border bg-surface-card p-4">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold"><CircleHelp size={15} className="text-accent" aria-hidden="true" /> The tools load, but generation fails.</summary>
                  <p className="mt-3 pl-6 text-xs leading-5 text-text-secondary">Check that the MCP entry includes <code className="font-mono">API_BASE_URL</code>, that the URL is reachable, and that Node.js 18 or newer is installed. Then restart the agent and try again.</p>
                </details>
                <details className="group rounded-xl border border-border bg-surface-card p-4">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold"><CircleHelp size={15} className="text-accent" aria-hidden="true" /> My agent has MCP but doesn’t use the skill.</summary>
                  <p className="mt-3 pl-6 text-xs leading-5 text-text-secondary">Confirm the <code className="font-mono">archdraw-diagram</code> skill is installed for the same agent and project. You can also prompt: “Use the ArchDraw diagram skill to map this system.”</p>
                </details>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                <Link href="/mcp" className="inline-flex items-center gap-1.5 font-semibold text-accent-text hover:underline">Read about the MCP tools <ExternalLink size={13} aria-hidden="true" /></Link>
                <Link href="https://github.com/hiabhee/archdraw-skill" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-accent-text hover:underline">View the skill source <Code2 size={13} aria-hidden="true" /></Link>
              </div>
            </section>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
