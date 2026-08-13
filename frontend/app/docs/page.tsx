'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Play, Layers, Cpu, Terminal, Shield, Database, Keyboard, HelpCircle, Info, AlertTriangle
} from 'lucide-react';

type SectionID = 'getting-started' | 'node-types' | 'diagram-types' | 'mcp-server' | 'prompt-guide' | 'api-ref' | 'shortcuts' | 'faq';

interface SidebarItem {
  id: SectionID;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function BlogDocsHeader({ activeTab }: { activeTab: 'docs' | 'blogs' }) {
  return (
    <header 
      className="sticky top-0 z-30 backdrop-blur-xl border-b border-[hsl(var(--border)/0.12)]"
      style={{ background: 'hsl(var(--background) / 0.8)' }}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Logo & Brand */}
          <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-[hsl(var(--foreground))]"
            >
              <svg className="w-3.5 h-3.5 text-[hsl(var(--background))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-[hsl(var(--foreground))] tracking-tight">ArchDraw</span>
          </Link>

          <div className="w-px h-4 bg-[hsl(var(--border)/0.2)] hidden sm:block" />

          {/* Navigation Links */}
          <nav className="flex items-center gap-4 text-xs font-semibold">
            <Link
              href="/docs"
              className={`transition-colors ${
                activeTab === 'docs' 
                  ? 'text-[hsl(var(--foreground))] underline underline-offset-4 decoration-2 decoration-[hsl(var(--foreground))]' 
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              Documentation
            </Link>
            <Link
              href="/blogs"
              className={`transition-colors ${
                activeTab === 'blogs' 
                  ? 'text-[hsl(var(--foreground))] underline underline-offset-4 decoration-2 decoration-[hsl(var(--foreground))]' 
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              Engineering Blog
            </Link>
          </nav>
        </div>

        {/* Right Action */}
        <Link
          href="/dashboard"
          className="text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex items-center gap-1"
        >
          <span>Go to Dashboard</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </header>
  );
}

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
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <BlogDocsHeader activeTab="docs" />
      
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-12">
        {/* Content Layout */}
        <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
          
          {/* Sticky Left Sidebar */}
          <aside className="hidden lg:block space-y-4 self-start lg:sticky lg:top-24 max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
            {/* Quick Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[hsl(var(--card))] border border-[hsl(var(--border)/0.16)] focus:border-[hsl(var(--border))] rounded-lg px-3 py-1.5 text-xs text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] outline-none transition-colors"
              />
            </div>

            <div className="space-y-1">
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))] px-3 mb-2">
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
                          ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/0.4)] hover:text-[hsl(var(--foreground))]'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                {filteredItems.length === 0 && (
                  <div className="text-xs text-[hsl(var(--muted-foreground))] p-3 italic">No results found</div>
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
              className="w-full bg-[hsl(var(--card))] border border-[hsl(var(--border)/0.16)] rounded-lg px-3 py-2 text-xs text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--border))]"
            >
              {sidebarItems.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>

          {/* Content Viewport */}
          <div className="min-w-0">
            <div className="rounded-xl border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--card))] p-6 md:p-8 backdrop-blur-sm" style={{ boxShadow: '0 8px 24px hsl(var(--foreground) / 0.03)' }}>
              
              {activeSection === 'getting-started' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] font-mono mb-2">
                      Documentation
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">
                      Getting Started
                    </h1>
                    <p className="mt-3 text-xs sm:text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                      Welcome to ArchDraw. ArchDraw is a system architecture design tool tailored for engineers. It combines a drag-and-drop workspace canvas with dynamic routing, allowing you to quickly visualize scalable microservices, backend data pipelines, and security zones.
                    </p>
                  </div>

                  {/* Guide Card */}
                  <div className="grid gap-4 sm:grid-cols-2 mt-6">
                    <div className="border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.1)] p-4 rounded-xl space-y-1.5" style={{ boxShadow: '0 4px 12px hsl(var(--foreground)/0.01)' }}>
                      <h3 className="font-bold text-[hsl(var(--foreground))] text-sm">1. Drag & Drop</h3>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                        Choose from our unified catalog of 150+ components, including compute resources, database storage, and external providers.
                      </p>
                    </div>
                    <div className="border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.1)] p-4 rounded-xl space-y-1.5" style={{ boxShadow: '0 4px 12px hsl(var(--foreground)/0.01)' }}>
                      <h3 className="font-bold text-[hsl(var(--foreground))] text-sm">2. Connect Edges</h3>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                        Draw lines from node borders. Edges shift dynamically to avoid overlap and indicate communication protocols.
                      </p>
                    </div>
                    <div className="border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.1)] p-4 rounded-xl space-y-1.5" style={{ boxShadow: '0 4px 12px hsl(var(--foreground)/0.01)' }}>
                      <h3 className="font-bold text-[hsl(var(--foreground))] text-sm">3. AI Compilation</h3>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                        Use simple prompts to compile complete layouts instantly, leveraging horizontal node tiers and self-healing routing.
                      </p>
                    </div>
                    <div className="border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.1)] p-4 rounded-xl space-y-1.5" style={{ boxShadow: '0 4px 12px hsl(var(--foreground)/0.01)' }}>
                      <h3 className="font-bold text-[hsl(var(--foreground))] text-sm">4. Share & Export</h3>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                        Export your diagrams as high-resolution SVGs or share read-only dashboard embed links secure for presentations.
                      </p>
                    </div>
                  </div>

                  {/* Callout Alert */}
                  <div className="flex gap-2.5 bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border)/0.12)] p-4 rounded-xl mt-6">
                    <Info className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0 mt-0.5" />
                    <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                      <strong>Note:</strong> ArchDraw automatically saves canvas state to local cache profiles, preventing data loss during network interruptions.
                    </p>
                  </div>

                  <div className="pt-4">
                    <h2 className="text-base font-bold text-[hsl(var(--foreground))] mb-2">Workspace Structure</h2>
                    <p className="text-[hsl(var(--muted-foreground))] text-xs leading-relaxed mb-3">
                      Architectures are serialized as flat JSON models containing node definitions, edge arrays, and layout settings:
                    </p>
                    <pre className="overflow-x-auto rounded-lg border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.3)] p-4 text-xs font-mono text-[hsl(var(--foreground))] leading-relaxed">
{`{
  "id": "diagram-uuid-001",
  "name": "E-Commerce Pipeline",
  "nodes": [
    { "id": "node-1", "type": "compute", "position": { "x": 300, "y": 150 }, "data": { "label": "API Service" } }
  ],
  "edges": [
    { "id": "edge-1", "source": "node-1", "target": "node-2", "label": "gRPC" }
  ]
}`}
                    </pre>
                  </div>
                </div>
              )}

              {activeSection === 'node-types' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] font-mono mb-2">
                      Reference
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">
                      Node Types
                    </h1>
                    <p className="mt-3 text-xs sm:text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                      Components are categorized into semantic tiers, ensuring that visual diagrams clearly represent actual software environments.
                    </p>
                  </div>

                  {/* Table of Nodes */}
                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[hsl(var(--border)/0.16)] text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
                          <th className="py-2.5 font-semibold">Tier Category</th>
                          <th className="py-2.5 font-semibold">Color Scheme</th>
                          <th className="py-2.5 font-semibold">Example Components</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[hsl(var(--border)/0.1)] text-xs">
                        <tr>
                          <td className="py-3 font-semibold text-[hsl(var(--foreground))]">Client / Frontend</td>
                          <td className="py-3 text-[hsl(var(--muted-foreground))] font-mono text-[10px]">Gray border / 10% opacity fill</td>
                          <td className="py-3 text-[hsl(var(--muted-foreground))]">Mobile, Web Browser, Desktop Client</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold text-[hsl(var(--foreground))]">Security / Auth</td>
                          <td className="py-3 text-[hsl(var(--muted-foreground))] font-mono text-[10px]">Purple (#7C3AED) border</td>
                          <td className="py-3 text-[hsl(var(--muted-foreground))]">OAuth Provider, WAF, Identity Manager</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold text-[hsl(var(--foreground))]">Compute / Services</td>
                          <td className="py-3 text-[hsl(var(--muted-foreground))] font-mono text-[10px]">Blue (#2563EB) border</td>
                          <td className="py-3 text-[hsl(var(--muted-foreground))]">Order Service, Transcoder Worker, Billing API</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold text-[hsl(var(--foreground))]">Async / Queue</td>
                          <td className="py-3 text-[hsl(var(--muted-foreground))] font-mono text-[10px]">Orange (#D97706) border</td>
                          <td className="py-3 text-[hsl(var(--muted-foreground))]">Kafka Broker, RabbitMQ, SQS Queue</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold text-[hsl(var(--foreground))]">Database / Cache</td>
                          <td className="py-3 text-[hsl(var(--muted-foreground))] font-mono text-[10px]">Green (#059669) / Teal</td>
                          <td className="py-3 text-[hsl(var(--muted-foreground))]">PostgreSQL, Redis Cache, MongoDB</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Callout */}
                  <div className="flex gap-2.5 bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border)/0.12)] p-4 rounded-xl mt-6">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                      <strong>Rule:</strong> Nodes automatically adjust their width based on their label text. We enforce a minimum node width of 180px and do not truncate headings to avoid clipping in visual exports.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'diagram-types' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] font-mono mb-2">
                      Guides
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">
                      Diagram Types
                    </h1>
                    <p className="mt-3 text-xs sm:text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                      ArchDraw organizes system architectures according to industry standards, guaranteeing that design models represent production workflows.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 mt-4">
                    <div className="border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.1)] p-4 rounded-xl space-y-2" style={{ boxShadow: '0 4px 12px hsl(var(--foreground)/0.01)' }}>
                      <div className="font-bold text-[hsl(var(--foreground))] text-sm">Video Streaming Pipelines</div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                        Requires raw object storage (e.g. S3), transcoding workers, CDN origin distributions, and analytics engines tracking play/pause events.
                      </p>
                    </div>
                    <div className="border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.1)] p-4 rounded-xl space-y-2" style={{ boxShadow: '0 4px 12px hsl(var(--foreground)/0.01)' }}>
                      <div className="font-bold text-[hsl(var(--foreground))] text-sm">E-Commerce Architectures</div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                        Features cart caching layers, secure API payment gateways, order workers, dynamic inventories, and email notification queues.
                      </p>
                    </div>
                    <div className="border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.1)] p-4 rounded-xl space-y-2" style={{ boxShadow: '0 4px 12px hsl(var(--foreground)/0.01)' }}>
                      <div className="font-bold text-[hsl(var(--foreground))] text-sm">Real-time WebSockets</div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                        Uses WebSocket gateway tiers, connection handlers, pub/sub event channels, and persistent chat state storage.
                      </p>
                    </div>
                    <div className="border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.1)] p-4 rounded-xl space-y-2" style={{ boxShadow: '0 4px 12px hsl(var(--foreground)/0.01)' }}>
                      <div className="font-bold text-[hsl(var(--foreground))] text-sm">Social Media Platforms</div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                        Includes engagement loops, user media object stores, CDN caches, activity feeds, and notification brokers.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'mcp-server' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] font-mono mb-2">
                      Integration
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">
                      Model Context Protocol Guide
                    </h1>
                    <p className="mt-3 text-xs sm:text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                      Connect AI reasoning engines (like Claude Desktop or Antigravity) directly to your local ArchDraw canvas files.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-[hsl(var(--foreground))]">How it works</h3>
                    <p className="text-[hsl(var(--muted-foreground))] text-xs leading-relaxed">
                      The MCP server establishes a stdio-based transport layer using JSON-RPC. When you prompt the AI, it reads, modifies, and validates coordinates in your active canvas via local command tools.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-[hsl(var(--foreground))]">Configuration</h3>
                    <p className="text-[hsl(var(--muted-foreground))] text-xs leading-relaxed">
                      Insert the following snippet inside your local configuration file (e.g. <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>):
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
                  </div>
                </div>
              )}

              {activeSection === 'prompt-guide' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] font-mono mb-2">
                      Aesthetics
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">
                      Prompt Guide
                    </h1>
                    <p className="mt-3 text-xs sm:text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                      Guide the AI layout generator to design clean, horizontally tiered diagram structures.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-[hsl(var(--foreground))]">Flow Order Mandate</h3>
                    <p className="text-[hsl(var(--muted-foreground))] text-xs leading-relaxed">
                      Edges must flow sequentially from left to right. Client devices are sources, not sinks.
                    </p>
                    <div className="border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.1)] p-4 rounded-xl text-xs font-mono space-y-1">
                      <div className="text-[hsl(var(--muted-foreground))]">Tier Order Structure:</div>
                      <div className="text-[hsl(var(--foreground))] font-semibold">Client (0) → Gateway / CDN (1) → Compute Services (2) → Async Brokers (3) → Data Tiers (4)</div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <h3 className="text-base font-bold text-[hsl(var(--foreground))]">Example Prompt Styles</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="border border-red-500/10 bg-red-500/5 p-4 rounded-xl">
                        <div className="text-red-500 font-bold text-[10px] font-mono uppercase mb-1">Avoid (Unstructured)</div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] italic">
                          &quot;Create a chat app with websocket servers and database and message brokers.&quot;
                        </p>
                      </div>
                      <div className="border border-green-500/10 bg-green-500/5 p-4 rounded-xl">
                        <div className="text-green-500 dark:text-green-400 font-bold text-[10px] font-mono uppercase mb-1">Preferred (Structured)</div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] italic">
                          &quot;Generate a messaging architecture. Order nodes in LR flow. Web clients connect to a WebSocket Gateway, pushing messages to RabbitMQ, consumed by a Chat Service, saved to PostgreSQL.&quot;
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'api-ref' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] font-mono mb-2">
                      Developers
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">
                      API Reference
                    </h1>
                    <p className="mt-3 text-xs sm:text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                      Query, edit, and export visual diagram files programmatically via standard REST endpoints.
                    </p>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="bg-green-500/10 text-green-500 dark:text-green-400 border border-green-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold">GET</span>
                        <code className="text-xs font-semibold text-[hsl(var(--foreground))]">/api/diagrams</code>
                      </div>
                      <p className="text-[hsl(var(--muted-foreground))] text-xs">
                        Fetch a list of all active workspaces.
                      </p>
                    </div>

                    <div className="space-y-1.5 border-t border-[hsl(var(--border)/0.1)] pt-4">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold">POST</span>
                        <code className="text-xs font-semibold text-[hsl(var(--foreground))]">/api/diagrams/generate</code>
                      </div>
                      <p className="text-[hsl(var(--muted-foreground))] text-xs">
                        Trigger the AI compiler to generate a layout from a text prompt.
                      </p>
                    </div>

                    <div className="space-y-1.5 border-t border-[hsl(var(--border)/0.1)] pt-4">
                      <div className="flex items-center gap-2">
                        <span className="bg-orange-500/10 text-orange-500 dark:text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold">GET</span>
                        <code className="text-xs font-semibold text-[hsl(var(--foreground))]">/api/diagrams/:id/export</code>
                      </div>
                      <p className="text-[hsl(var(--muted-foreground))] text-xs">
                        Export the serialized diagram canvas as a high-resolution static SVG.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'shortcuts' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] font-mono mb-2">
                      UX Controls
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">
                      Keyboard Shortcuts
                    </h1>
                    <p className="mt-3 text-xs sm:text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                      Build layouts efficiently using global hotkey handlers.
                    </p>
                  </div>

                  {/* Shortcuts Grid */}
                  <div className="grid gap-3 sm:grid-cols-2 pt-2">
                    <div className="flex justify-between items-center p-3 border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.1)] rounded-xl">
                      <span className="text-[hsl(var(--foreground))] text-xs">Command Palette</span>
                      <kbd className="bg-[hsl(var(--muted))] border border-[hsl(var(--border)/0.16)] text-[hsl(var(--muted-foreground))] px-2 py-0.5 rounded text-[10px] font-mono">Cmd + K</kbd>
                    </div>
                    <div className="flex justify-between items-center p-3 border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.1)] rounded-xl">
                      <span className="text-[hsl(var(--foreground))] text-xs">Delete Element</span>
                      <kbd className="bg-[hsl(var(--muted))] border border-[hsl(var(--border)/0.16)] text-[hsl(var(--muted-foreground))] px-2 py-0.5 rounded text-[10px] font-mono">Delete / Backspace</kbd>
                    </div>
                    <div className="flex justify-between items-center p-3 border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.1)] rounded-xl">
                      <span className="text-[hsl(var(--foreground))] text-xs">Multiple Select</span>
                      <kbd className="bg-[hsl(var(--muted))] border border-[hsl(var(--border)/0.16)] text-[hsl(var(--muted-foreground))] px-2 py-0.5 rounded text-[10px] font-mono">Shift + Click</kbd>
                    </div>
                    <div className="flex justify-between items-center p-3 border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--muted)/0.1)] rounded-xl">
                      <span className="text-[hsl(var(--foreground))] text-xs">Grid Alignment Snapping</span>
                      <kbd className="bg-[hsl(var(--muted))] border border-[hsl(var(--border)/0.16)] text-[hsl(var(--muted-foreground))] px-2 py-0.5 rounded text-[10px] font-mono">Hold Command</kbd>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'faq' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] font-mono mb-2">
                      Help Desk
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">
                      Frequently Asked Questions
                    </h1>
                    <p className="mt-3 text-xs sm:text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                      Answers to common questions about using ArchDraw.
                    </p>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <h3 className="font-bold text-[hsl(var(--foreground))] text-sm">Is ArchDraw free to use?</h3>
                      <p className="text-[hsl(var(--muted-foreground))] text-xs leading-relaxed">
                        Yes! ArchDraw includes a fully-featured free workspace tier that lets you create, save, and export system diagrams.
                      </p>
                    </div>

                    <div className="space-y-1 border-t border-[hsl(var(--border)/0.1)] pt-3">
                      <h3 className="font-bold text-[hsl(var(--foreground))] text-sm">Why are my parallel edge paths overlapping?</h3>
                      <p className="text-[hsl(var(--muted-foreground))] text-xs leading-relaxed">
                        By default, straight lines between nodes will overlap. Enable &quot;Dynamic Shift&quot; in the connection options menu to apply parallel perpendicular shifting offsets.
                      </p>
                    </div>

                    <div className="space-y-1 border-t border-[hsl(var(--border)/0.1)] pt-3">
                      <h3 className="font-bold text-[hsl(var(--foreground))] text-sm">Can I self-host my own MCP server?</h3>
                      <p className="text-[hsl(var(--muted-foreground))] text-xs leading-relaxed">
                        Yes. The MCP repository files are bundled in the package under the <code>/mcp-server</code> folder and can be executed locally in any node environment.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
