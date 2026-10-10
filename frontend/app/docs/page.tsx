import Link from 'next/link';
import type { ReactNode } from 'react';
import { BookOpen, GitBranch, LayoutPanelTop, Sparkles, Terminal } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';

const DOC_GROUPS = [
  {
    label: 'Get started',
    links: [
      { href: '#overview', label: 'Overview', current: true },
      { href: '#generate', label: 'Generate a diagram' },
      { href: '#repository', label: 'Map a repository' },
    ],
  },
  {
    label: 'Build on the canvas',
    links: [
      { href: '#canvas', label: 'Nodes, edges & groups' },
      { href: '#layout', label: 'Layout & direction' },
      { href: '#mermaid', label: 'Mermaid round-trip' },
    ],
  },
  {
    label: 'Integrate',
    links: [
      { href: '#mcp', label: 'MCP server' },
      { href: '#export', label: 'Share & export' },
      { href: '#faq', label: 'FAQ' },
    ],
  },
] as const;

const DOC_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'ArchDraw Documentation',
  description: 'Guides for generating, editing, laying out, exporting, and automating architecture diagrams with ArchDraw.',
  url: 'https://archdraw.hiabhee.online/docs',
  inLanguage: 'en-US',
  articleSection: 'Documentation',
};

function DocIcon({ children }: { children: ReactNode }) {
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#dfe4df] bg-white text-[#1686f5]">{children}</span>;
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#fbfcfa] text-[#16211f]">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(DOC_JSON_LD) }} />

      <main className="mx-auto w-full max-w-[1400px] px-5 pb-20 pt-20 sm:px-8">
        <div className="grid gap-10 py-10 lg:grid-cols-[220px_minmax(0,720px)_180px] lg:gap-14">
          <aside className="hidden lg:block">
            <nav className="sticky top-20 space-y-7" aria-label="Documentation navigation">
              <Link href="/docs" className="mb-6 flex items-center gap-2 text-sm font-bold tracking-tight text-[#16211f]"><BookOpen size={16} className="text-[#1686f5]" /> Docs home</Link>
              {DOC_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 px-3 font-mono text-[10px] font-bold uppercase tracking-[.13em] text-[#8b9691]">{group.label}</p>
                  <div className="space-y-0.5">
                    {group.links.map((link) => <a key={link.href} href={link.href} className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${'current' in link && link.current ? 'bg-[#eaf4ff] font-semibold text-[#075aaf]' : 'text-[#65706c] hover:bg-white hover:text-[#16211f]'}`}>{link.label}</a>)}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <article className="min-w-0">
            <section id="overview" className="scroll-mt-24">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[.12em] text-[#4786bf]">Overview</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Start with what you know.</h2>
              <p className="mt-4 text-[15px] leading-7 text-[#51605a]">ArchDraw is an AI-assisted architecture canvas. Start from a description, a GitHub repository, or Mermaid; then edit the generated system as a diagram rather than a static image.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#dfe4df] bg-white p-4"><DocIcon><Sparkles size={17} /></DocIcon><h3 className="mt-4 text-sm font-bold">Describe</h3><p className="mt-1 text-xs leading-5 text-[#65706c]">Turn a system idea into an editable starting point.</p></div>
                <div className="rounded-xl border border-[#dfe4df] bg-white p-4"><DocIcon><GitBranch size={17} /></DocIcon><h3 className="mt-4 text-sm font-bold">Inspect</h3><p className="mt-1 text-xs leading-5 text-[#65706c]">Map the services and relationships in a repository.</p></div>
                <div className="rounded-xl border border-[#dfe4df] bg-white p-4"><DocIcon><LayoutPanelTop size={17} /></DocIcon><h3 className="mt-4 text-sm font-bold">Shape</h3><p className="mt-1 text-xs leading-5 text-[#65706c]">Edit, rearrange, export, or share the live canvas.</p></div>
              </div>
            </section>

            <section id="generate" className="mt-16 scroll-mt-24 border-t border-[#dfe4df] pt-12">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[.12em] text-[#4786bf]">Generate a diagram</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">From prompt to editable architecture.</h2>
              <ol className="mt-6 space-y-4 border-l border-[#dfe4df] pl-5 text-sm leading-6 text-[#51605a]">
                <li><strong className="text-[#16211f]">Give the system context.</strong> Describe the clients, services, integrations, and data stores that matter.</li>
                <li><strong className="text-[#16211f]">Review the first draft.</strong> ArchDraw produces nodes, edges, and layout you can inspect on the canvas.</li>
                <li><strong className="text-[#16211f]">Refine the diagram.</strong> Change labels, nodes, connections, groups, and direction as the discussion evolves.</li>
              </ol>
              <pre className="mt-7 overflow-x-auto rounded-xl border border-[#dfe4df] bg-[#16211f] p-5 font-mono text-xs leading-6 text-[#d9e8e1]"><code>{'Web client → API gateway → order service → Postgres\nSend completed orders to a notification worker.'}</code></pre>
            </section>

            <section id="repository" className="mt-16 scroll-mt-24 border-t border-[#dfe4df] pt-12">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[.12em] text-[#4786bf]">Repository diagrams</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Map the codebase you inherited.</h2>
              <p className="mt-4 text-[15px] leading-7 text-[#51605a]">Paste a GitHub repository URL. ArchDraw examines architecture-signalling files such as README files, manifests, routes, infrastructure definitions, and service boundaries to form an editable system map.</p>
              <div className="mt-6 rounded-xl border border-[#cfe5f7] bg-[#f1f8ff] p-4 text-sm leading-6 text-[#38617d]"><strong className="text-[#075aaf]">Tip:</strong> Treat the result as a reviewable first draft. Keep the parts that reflect your system and edit the rest on the canvas.</div>
            </section>

            <section id="canvas" className="mt-16 scroll-mt-24 border-t border-[#dfe4df] pt-12">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[.12em] text-[#4786bf]">Canvas</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Use a visual vocabulary that stays readable.</h2>
              <p className="mt-4 text-[15px] leading-7 text-[#51605a]">System nodes, shape nodes, groups, annotations, and labeled connections give architecture discussions a common language. Nodes are sized on a compact optical grid so labels wrap before diagrams become oversized.</p>
              <div className="mt-7 overflow-hidden rounded-xl border border-[#dfe4df] bg-white">
                <div className="grid grid-cols-[1fr_1.4fr] border-b border-[#dfe4df] px-4 py-3 text-xs"><span className="font-semibold">System node</span><span className="text-[#65706c]">A service or deployable component with an optional subtitle.</span></div>
                <div className="grid grid-cols-[1fr_1.4fr] border-b border-[#dfe4df] px-4 py-3 text-xs"><span className="font-semibold">Shape node</span><span className="text-[#65706c]">A semantic silhouette for clients, gateways, databases, auth, and external systems.</span></div>
                <div className="grid grid-cols-[1fr_1.4fr] px-4 py-3 text-xs"><span className="font-semibold">Group</span><span className="text-[#65706c]">A boundary that collects related components into a subsystem.</span></div>
              </div>
            </section>

            <section id="layout" className="mt-16 scroll-mt-24 border-t border-[#dfe4df] pt-12">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[.12em] text-[#4786bf]">Layout</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Keep the flow legible.</h2>
              <p className="mt-4 text-[15px] leading-7 text-[#51605a]">Use the layout control to arrange a diagram left-to-right or top-to-bottom. ArchDraw keeps the graph and its groups on the same Mermaid-to-Dagre layout path, so generated diagrams and manual reflows use consistent spacing.</p>
            </section>

            <section id="mermaid" className="mt-16 scroll-mt-24 border-t border-[#dfe4df] pt-12">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[.12em] text-[#4786bf]">Mermaid</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Keep diagrams portable.</h2>
              <p className="mt-4 text-[15px] leading-7 text-[#51605a]">Import Mermaid when you already have a text representation, or export the canvas when the diagram needs to travel with code, documentation, or a pull request.</p>
              <pre className="mt-7 overflow-x-auto rounded-xl border border-[#dfe4df] bg-[#f6f7f3] p-5 font-mono text-xs leading-6 text-[#283731]"><code>{'graph LR\n  Client[Web client] --> Gateway{{API gateway}}\n  Gateway --> Service[Order service]\n  Service --> Database[(Postgres)]'}</code></pre>
            </section>

            <section id="mcp" className="mt-16 scroll-mt-24 border-t border-[#dfe4df] pt-12">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[.12em] text-[#4786bf]">MCP server</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Bring ArchDraw into your AI workflow.</h2>
              <p className="mt-4 text-[15px] leading-7 text-[#51605a]">The local MCP server exposes diagram tools for compatible assistants. Use it to generate, update, validate, lay out, and export the same canvas you use in the browser.</p>
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#dfe4df] bg-white p-4"><DocIcon><Terminal size={17} /></DocIcon><p className="text-sm leading-6 text-[#51605a]">Read the MCP guide for the current tool list and connection instructions before adding it to an assistant configuration.</p></div>
            </section>

            <section id="export" className="mt-16 scroll-mt-24 border-t border-[#dfe4df] pt-12">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[.12em] text-[#4786bf]">Share & export</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Take the architecture with you.</h2>
              <p className="mt-4 text-[15px] leading-7 text-[#51605a]">Export a canvas as JSON, Mermaid, PNG, or SVG where available. Share links and embeds give teammates a view without turning the diagram into a stale screenshot.</p>
            </section>

            <section id="faq" className="mt-16 scroll-mt-24 border-t border-[#dfe4df] pt-12">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[.12em] text-[#4786bf]">FAQ</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Common questions.</h2>
              <div className="mt-6 divide-y divide-[#dfe4df] rounded-xl border border-[#dfe4df] bg-white">
                <details className="group p-5" open><summary className="cursor-pointer list-none text-sm font-semibold">Can I edit what ArchDraw generates?</summary><p className="mt-3 text-sm leading-6 text-[#65706c]">Yes. Generated diagrams open as editable canvases, so you can move, rename, connect, group, and remove components.</p></details>
                <details className="group p-5"><summary className="cursor-pointer list-none text-sm font-semibold">Can I start from an existing diagram?</summary><p className="mt-3 text-sm leading-6 text-[#65706c]">Yes. Mermaid is supported as an import and export format, alongside the canvas&apos;s JSON representation.</p></details>
                <details className="group p-5"><summary className="cursor-pointer list-none text-sm font-semibold">What should I do if a generated layout needs work?</summary><p className="mt-3 text-sm leading-6 text-[#65706c]">Adjust the canvas directly or use the layout controls to reflow the graph in your preferred direction.</p></details>
              </div>
            </section>
          </article>

          <aside className="hidden xl:block">
            <div className="sticky top-20 border-l border-[#dfe4df] pl-5">
              <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[.13em] text-[#8b9691]">On this page</p>
              <div className="space-y-2 text-xs"><a className="block text-[#65706c] hover:text-[#075aaf]" href="#overview">Overview</a><a className="block text-[#65706c] hover:text-[#075aaf]" href="#generate">Generate a diagram</a><a className="block text-[#65706c] hover:text-[#075aaf]" href="#repository">Map a repository</a><a className="block text-[#65706c] hover:text-[#075aaf]" href="#canvas">Canvas concepts</a><a className="block text-[#65706c] hover:text-[#075aaf]" href="#mcp">MCP server</a><a className="block text-[#65706c] hover:text-[#075aaf]" href="#faq">FAQ</a></div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
