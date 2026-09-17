'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import { 
  Play, Layers, Cpu, Terminal, Shield, Database, Keyboard, HelpCircle, Info, AlertTriangle
} from 'lucide-react';

type SectionID = 'getting-started' | 'node-types' | 'diagram-types' | 'mcp-server' | 'prompt-guide' | 'api-ref' | 'shortcuts' | 'faq';

interface SidebarItem {
  id: SectionID;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DOC_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'TechArticle',
      '@id': 'https://archdraw.hiabhee.online/docs#article',
      headline: 'ArchDraw Documentation',
      description: 'Getting started, node types, diagram types, MCP server setup, prompt guide, API reference, keyboard shortcuts, FAQ.',
      url: 'https://archdraw.hiabhee.online/docs',
      publisher: { '@id': 'https://archdraw.hiabhee.online/#organization' },
      inLanguage: 'en-US',
      articleSection: 'Documentation',
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://archdraw.hiabhee.online/' },
        { '@type': 'ListItem', position: 2, name: 'Documentation', item: 'https://archdraw.hiabhee.online/docs' },
      ],
    },
  ],
};

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<SectionID>('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const sidebarItems: SidebarItem[] = [
    { id: 'getting-started', label: 'Getting Started', icon: Play },
    { id: 'node-types', label: 'Node Types', icon: Layers },
    { id: 'diagram-types', label: 'Diagram Types', icon: Cpu },
    { id: 'mcp-server', label: 'MCP Server Guide', icon: Terminal },
    { id: 'prompt-guide', label: 'Prompt Guide', icon: Shield },
    { id: 'api-ref', label: 'API Reference', icon: Database },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
    { id: 'faq', label: 'FAQ', icon: HelpCircle },
  ];

  const filteredItems = sidebarItems.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f7f5] text-[#1c1c1a]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(DOC_JSON_LD) }} />
      <LandingNav />
      
      <main className="flex-1 max-w-[1160px] w-full mx-auto px-6 pt-24 pb-16">
        <div className="mb-8">
          <p className="text-[11px] font-bold tracking-[2px] uppercase text-[#5a6066] mb-3">Documentation</p>
          <h1 className="font-bold tracking-tight leading-[0.95]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: 'clamp(2rem, 4vw, 2.75rem)', letterSpacing: '-0.04em' }}>
            How ArchDraw <em className="text-[#155e9c] font-normal">works</em>
          </h1>
          <p className="mt-3 text-sm text-[#5a6066] leading-relaxed max-w-2xl">Everything from first diagram to MCP automation — in the same paper, same type, same canvas you already use.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          
          {/* Sticky Left Sidebar — paper theme */}
          <aside className="hidden lg:block space-y-4 self-start lg:sticky lg:top-[72px] max-h-[calc(100vh-96px)] overflow-y-auto pr-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search docs…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-[#e4e4df] focus:border-[#1E90FF] rounded-lg px-3 py-2 text-xs text-[#1c1c1a] placeholder-[#8a8f98] outline-none transition-colors"
              />
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#5a6066] px-3 mb-2">
                Navigation
              </div>
              <nav className="space-y-1">
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#1c1c1a] text-white'
                          : 'text-[#5a6066] hover:bg-white hover:text-[#1c1c1a] border border-transparent hover:border-[#e4e4df]'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[#8a8f98]'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                {filteredItems.length === 0 && (
                  <div className="text-xs text-[#8a8f98] p-3 italic">No results found</div>
                )}
              </nav>
            </div>
          </aside>

          {/* Mobile Navigation Dropdown */}
          <div className="block lg:hidden w-full mb-4">
            <label htmlFor="docs-section-select" className="sr-only">Select a section</label>
            <select
              id="docs-section-select"
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value as SectionID)}
              className="w-full bg-white border border-[#e4e4df] rounded-lg px-3 py-2.5 text-xs text-[#1c1c1a] outline-none focus:border-[#1E90FF]"
            >
              {sidebarItems.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>

          {/* Content Viewport — white card on paper */}
          <div className="min-w-0">
            <div className="rounded-xl border border-[#e4e4df] bg-white p-6 md:p-8" style={{ boxShadow: '0 8px 24px rgba(28,28,26,0.04)' }}>
              
              {activeSection === 'getting-started' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#5a6066] mb-2">
                      Getting Started
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1c1c1a]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', letterSpacing: '-0.03em' }}>
                      Getting Started
                    </h2>
                    <p className="mt-3 text-sm text-[#5a6066] leading-relaxed">
                      Welcome to ArchDraw. A system architecture tool for people who think in systems — drag, connect, and let the layout do the rest.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 mt-6">
                    <div className="border border-[#e4e4df] bg-[#fbfbfa] p-4 rounded-xl space-y-1.5">
                      <h3 className="font-bold text-[#1c1c1a] text-sm">1. Drag & Drop</h3>
                      <p className="text-xs text-[#5a6066] leading-relaxed">
                        Pick from 150+ components — compute, data, external — all sized on a 160/200/240 grid.
                      </p>
                    </div>
                    <div className="border border-[#e4e4df] bg-[#fbfbfa] p-4 rounded-xl space-y-1.5">
                      <h3 className="font-bold text-[#1c1c1a] text-sm">2. Connect Edges</h3>
                      <p className="text-xs text-[#5a6066] leading-relaxed">
                        Edges float (±16px slots) and route orthogonally — no overlap, no manual cleanup.
                      </p>
                    </div>
                    <div className="border border-[#e4e4df] bg-[#fbfbfa] p-4 rounded-xl space-y-1.5">
                      <h3 className="font-bold text-[#1c1c1a] text-sm">3. AI Compilation</h3>
                      <p className="text-xs text-[#5a6066] leading-relaxed">
                        Prompt → Mermaid → Dagre. Validated, tier-ordered, auto-laid-out.
                      </p>
                    </div>
                    <div className="border border-[#e4e4df] bg-[#fbfbfa] p-4 rounded-xl space-y-1.5">
                      <h3 className="font-bold text-[#1c1c1a] text-sm">4. Share & Export</h3>
                      <p className="text-xs text-[#5a6066] leading-relaxed">
                        PNG/SVG/JSON/Mermaid + live share link. The same canvas, everywhere.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2.5 bg-[#eef6ff] border border-[#d8e9fb] p-4 rounded-xl mt-6">
                    <Info className="w-4 h-4 text-[#1E90FF] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#5a6066] leading-relaxed">
                      <strong className="text-[#1c1c1a]">Note:</strong> Canvases autosave locally + to Supabase when signed in. No work lost on refresh.
                    </p>
                  </div>

                  <div className="pt-4">
                    <h3 className="text-base font-bold text-[#1c1c1a] mb-2">Workspace Structure</h3>
                    <p className="text-[#5a6066] text-xs leading-relaxed mb-3">
                      A diagram is JSON — nodes, edges, groups — round-trippable to Mermaid:
                    </p>
                    <pre className="overflow-x-auto rounded-lg border border-[#e4e4df] bg-[#fbfbfa] p-4 text-xs font-mono text-[#1c1c1a] leading-relaxed">
{`{
  "nodes": [{ "id": "api", "label": "API Service", "type": "systemNode" }],
  "edges": [{ "source": "client", "target": "api", "label": "HTTPS" }]
}`}
                    </pre>
                  </div>
                </div>
              )}

              {activeSection === 'node-types' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#5a6066] mb-2">
                      Reference
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1c1c1a]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', letterSpacing: '-0.03em' }}>
                      Node Types
                    </h2>
                    <p className="mt-3 text-sm text-[#5a6066] leading-relaxed">
                      Five concerns, one palette — color is structure, not decoration.
                    </p>
                  </div>

                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#e4e4df] text-[10px] font-mono text-[#5a6066]">
                          <th className="py-2.5 font-semibold">Tier</th>
                          <th className="py-2.5 font-semibold">Color</th>
                          <th className="py-2.5 font-semibold">Examples</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e4e4df]/70 text-xs">
                        <tr>
                          <td className="py-3 font-semibold text-[#1c1c1a]">Client</td>
                          <td className="py-3 text-[#5a6066] font-mono text-[10px]">slate #64748b</td>
                          <td className="py-3 text-[#5a6066]">Web, Mobile</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold text-[#1c1c1a]">Compute</td>
                          <td className="py-3 text-[#5a6066] font-mono text-[10px]">teal #0d9488</td>
                          <td className="py-3 text-[#5a6066]">API, Worker</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold text-[#1c1c1a]">Data</td>
                          <td className="py-3 text-[#5a6066] font-mono text-[10px]">blue #3b82f6</td>
                          <td className="py-3 text-[#5a6066]">Postgres, Redis</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold text-[#1c1c1a]">Async</td>
                          <td className="py-3 text-[#5a6066] font-mono text-[10px]">amber #d97706</td>
                          <td className="py-3 text-[#5a6066]">Kafka, SQS</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold text-[#1c1c1a]">External</td>
                          <td className="py-3 text-[#5a6066] font-mono text-[10px]">violet #8b5cf6</td>
                          <td className="py-3 text-[#5a6066]">Stripe, CDN</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-2.5 bg-[#fef3c7] border border-[#fde68a] p-4 rounded-xl mt-6">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-[#5a6066] leading-relaxed">
                      <strong>Rule:</strong> Nodes snap to 160/200/240. Labels wrap — they never truncate in export.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'diagram-types' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#5a6066] mb-2">
                      Guides
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1c1c1a]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', letterSpacing: '-0.03em' }}>
                      Diagram Types
                    </h2>
                    <p className="mt-3 text-sm text-[#5a6066] leading-relaxed">
                      Four shapes that cover most reviews.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 mt-4">
                    <div className="border border-[#e4e4df] bg-[#fbfbfa] p-4 rounded-xl space-y-2">
                      <div className="font-bold text-[#1c1c1a] text-sm">Video / CDN</div>
                      <p className="text-xs text-[#5a6066] leading-relaxed">
                        S3 → transcode → S3 → CDN → client, plus Event Stream → Recommendation.
                      </p>
                    </div>
                    <div className="border border-[#e4e4df] bg-[#fbfbfa] p-4 rounded-xl space-y-2">
                      <div className="font-bold text-[#1c1c1a] text-sm">E-Commerce</div>
                      <p className="text-xs text-[#5a6066] leading-relaxed">
                        Cart, payments, orders, plus analytics stream feeding search.
                      </p>
                    </div>
                    <div className="border border-[#e4e4df] bg-[#fbfbfa] p-4 rounded-xl space-y-2">
                      <div className="font-bold text-[#1c1c1a] text-sm">Realtime</div>
                      <p className="text-xs text-[#5a6066] leading-relaxed">
                        WebSocket Gateway → service → pub/sub → storage. Edges flow LR.
                      </p>
                    </div>
                    <div className="border border-[#e4e4df] bg-[#fbfbfa] p-4 rounded-xl space-y-2">
                      <div className="font-bold text-[#1c1c1a] text-sm">Social</div>
                      <p className="text-xs text-[#5a6066] leading-relaxed">
                        Feed, media store, CDN, notification broker — with event stream.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'mcp-server' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#5a6066] mb-2">
                      Integration
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1c1c1a]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', letterSpacing: '-0.03em' }}>
                      MCP Server
                    </h2>
                    <p className="mt-3 text-sm text-[#5a6066] leading-relaxed">
                      Let Claude/Cursor drive the canvas via stdio JSON-RPC.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-[#1c1c1a]">How it works</h3>
                    <p className="text-[#5a6066] text-xs leading-relaxed">
                      Tools: generate-diagram, update-diagram, validate-diagram, fix-layout, export. Guard 14a: JWT validated at gateway, never client→DRM.
                    </p>
                  </div>

                  <pre className="overflow-x-auto rounded-lg border border-[#e4e4df] bg-[#fbfbfa] p-4 text-xs font-mono text-[#1c1c1a] leading-relaxed">
{`{
  "mcpServers": {
    "archdraw": { "command": "npx", "args": ["-y", "@hiabhee/archdraw-mcp-server"] }
  }
}`}
                  </pre>
                </div>
              )}

              {activeSection === 'prompt-guide' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#5a6066] mb-2">
                      Aesthetics
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1c1c1a]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', letterSpacing: '-0.03em' }}>
                      Prompt Guide
                    </h2>
                    <p className="mt-3 text-sm text-[#5a6066] leading-relaxed">
                      Left→right only. Client is source, data is sink.
                    </p>
                  </div>

                  <div className="border border-[#e4e4df] bg-[#fbfbfa] p-4 rounded-xl text-xs font-mono space-y-1">
                    <div className="text-[#5a6066]">Tier order</div>
                    <div className="text-[#1c1c1a] font-semibold">client → edge → compute → async → data → external</div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 pt-2">
                    <div className="border border-red-200 bg-red-50 p-4 rounded-xl">
                      <div className="text-red-600 font-bold text-[10px] font-mono uppercase mb-1">Avoid</div>
                      <p className="text-xs text-[#5a6066] italic">“chat app with db and brokers”</p>
                    </div>
                    <div className="border border-emerald-200 bg-emerald-50 p-4 rounded-xl">
                      <div className="text-emerald-700 font-bold text-[10px] font-mono uppercase mb-1">Prefer</div>
                      <p className="text-xs text-[#5a6066] italic">“Web → API → RabbitMQ → Chat → Postgres, LR”</p>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'api-ref' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#5a6066] mb-2">
                      Developers
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1c1c1a]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', letterSpacing: '-0.03em' }}>
                      API Reference
                    </h2>
                    <p className="mt-3 text-sm text-[#5a6066] leading-relaxed">
                      REST + MCP. Same pipeline, two surfaces.
                    </p>
                  </div>

                  <div className="space-y-4 pt-2 text-xs">
                    <div className="flex items-center gap-2"><span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">POST</span><code className="font-semibold text-[#1c1c1a]">/api/generate-diagram</code></div>
                    <div className="flex items-center gap-2"><span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">POST</span><code className="font-semibold text-[#1c1c1a]">/api/repo-diagram</code></div>
                    <div className="flex items-center gap-2"><span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">GET</span><code className="font-semibold text-[#1c1c1a]">/api/diagram/session/:id</code></div>
                  </div>
                </div>
              )}

              {activeSection === 'shortcuts' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#5a6066] mb-2">
                      UX Controls
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1c1c1a]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', letterSpacing: '-0.03em' }}>
                      Keyboard Shortcuts
                    </h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 pt-2">
                    <div className="flex justify-between items-center p-3 border border-[#e4e4df] bg-[#fbfbfa] rounded-xl text-xs"><span>Command Palette</span><kbd className="bg-white border border-[#e4e4df] px-2 py-0.5 rounded text-[10px] font-mono">⌘ K</kbd></div>
                    <div className="flex justify-between items-center p-3 border border-[#e4e4df] bg-[#fbfbfa] rounded-xl text-xs"><span>Delete</span><kbd className="bg-white border border-[#e4e4df] px-2 py-0.5 rounded text-[10px] font-mono">Del</kbd></div>
                    <div className="flex justify-between items-center p-3 border border-[#e4e4df] bg-[#fbfbfa] rounded-xl text-xs"><span>Multi-select</span><kbd className="bg-white border border-[#e4e4df] px-2 py-0.5 rounded text-[10px] font-mono">Shift + Click</kbd></div>
                    <div className="flex justify-between items-center p-3 border border-[#e4e4df] bg-[#fbfbfa] rounded-xl text-xs"><span>Snap</span><kbd className="bg-white border border-[#e4e4df] px-2 py-0.5 rounded text-[10px] font-mono">⌘ drag</kbd></div>
                  </div>
                </div>
              )}

              {activeSection === 'faq' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#5a6066] mb-2">
                      Help Desk
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1c1c1a]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', letterSpacing: '-0.03em' }}>
                      FAQ
                    </h2>
                  </div>
                  <div className="space-y-3 pt-2 text-sm">
                    <div><h3 className="font-bold text-[#1c1c1a]">Is it free?</h3><p className="text-[#5a6066] text-xs leading-relaxed">Yes — free during beta, 3/hour guests, 10/day signed-in.</p></div>
                    <div className="border-t border-[#e4e4df]/70 pt-3"><h3 className="font-bold text-[#1c1c1a]">Why do parallel edges overlap?</h3><p className="text-[#5a6066] text-xs leading-relaxed">We auto-offset ±16px on shared sides. If you see merging, run fix-layout.</p></div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
