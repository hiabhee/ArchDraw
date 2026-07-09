'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import { 
  ArrowRight, Menu, X, Check, ArrowRightLeft, RefreshCw, Clock, 
  Paintbrush, Layers, MousePointer, ShieldCheck, Mail, Database, 
  Server, Zap, Globe, MessageSquare, BookOpen, User, Sparkles, 
  ChevronDown, CheckCircle2, Send, Lock, Share2, Activity
} from 'lucide-react';

const outfit = Outfit({ 
  subsets: ['latin'], 
  display: 'swap',
  variable: '--font-outfit'
});

const plusJakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'], 
  display: 'swap',
  variable: '--font-plus-jakarta'
});

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Docs', href: '/docs' },
];

const TECH_LOGOS = [
  'AWS', 'GCP', 'Kubernetes', 'Node.js', 'PostgreSQL',
  'Redis', 'RabbitMQ', 'React', 'Docker', 'TypeScript',
];

const FEATURES_GRID = [
  {
    title: 'AI-generated diagrams',
    desc: 'Describe your architecture in plain English; the pipeline generates structured, validated Mermaid and renders it instantly.',
    icon: <Sparkles className="w-5 h-5 text-accent" />
  },
  {
    title: 'Mermaid-first pipeline',
    desc: 'Write Mermaid directly or let AI generate it. Same pipeline either way: validated, enriched, and laid out correctly.',
    icon: <CodeIcon className="w-5 h-5 text-accent" />
  },
  {
    title: 'Smart auto-layout',
    desc: 'Dagre-powered layout with automatic handle selection. Nodes position themselves; you focus on the architecture.',
    icon: <Layers className="w-5 h-5 text-accent" />
  },
  {
    title: 'Subgraph support',
    desc: 'Group nodes into containers with Mermaid subgraphs. Nested layouts render with correct parent-child positioning.',
    icon: <FolderIcon className="w-5 h-5 text-accent" />
  },
  {
    title: 'Interactive React Flow canvas',
    desc: 'Every diagram is a live, zoomable, pannable canvas — not a static image until you choose to export one.',
    icon: <MousePointer className="w-5 h-5 text-accent" />
  },
  {
    title: 'Multiple diagram types',
    desc: 'Flowcharts, sequence diagrams, system architecture, ERDs. Handles the full range of Mermaid specs.',
    icon: <Database className="w-5 h-5 text-accent" />
  },
  {
    title: 'Export & share',
    desc: 'PNG, SVG, or a live shareable link. Dark theme, clean layout, presentation-ready by default.',
    icon: <Globe className="w-5 h-5 text-accent" />
  },
  {
    title: 'Collaborative Syncing',
    desc: 'Instantly generate and share live, read/write links with teammates. Sync canvas changes in real-time across tabs.',
    icon: <Share2 className="w-5 h-5 text-accent" />
  },
  {
    title: 'Keyboard Shortcuts',
    desc: 'Navigate the canvas, connect nodes, delete items, and trigger layouts entirely via keyboard shortcuts.',
    icon: <Activity className="w-5 h-5 text-accent" />
  }
];

function CodeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function FolderIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

const InteractiveLandingDemo = dynamic(
  () => import('@/components/landing/InteractiveLandingDemo'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[820px] rounded-2xl bg-[#0f1011] border border-[#23252a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
          <span className="text-xs text-[#8a8f98] font-medium">Loading interactive canvas...</span>
        </div>
      </div>
    )
  }
);

function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 h-14 transition-all duration-200 ${
        scrolled ? 'bg-[#f7f7f5]/90 backdrop-blur-xl border-b border-[#e4e4df]/50' : 'bg-[#f7f7f5]'
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(94,106,210,0.4)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f7f8f8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className={`text-sm font-bold text-[#1c1c1a] tracking-tight ${outfit.className}`}>ArchDraw</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-sm text-[#575752] hover:text-accent rounded-md transition-colors duration-150 font-medium"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/dashboard"
            className="text-sm text-[#575752] hover:text-[#1c1c1a] px-4 py-1.5 rounded-lg border border-[#e4e4df] bg-white hover:bg-slate-50 transition-all duration-150 font-medium"
          >
            Sign in
          </a>
          <a
            href="/dashboard"
            className="text-sm font-semibold text-white bg-accent hover:bg-accent-hover px-4 py-1.5 rounded-lg transition-all duration-150 shadow-[0_4px_12px_rgba(94,106,210,0.2)] hover:shadow-[0_4px_16px_rgba(94,106,210,0.35)] hover:-translate-y-0.5 active:translate-y-0"
          >
            Get started free
          </a>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-[#575752] hover:text-[#1c1c1a] transition-colors"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size="20" /> : <Menu size="20" />}
        </button>
      </div>
      {menuOpen && (
        <div className="md:hidden bg-white border-b border-[#e4e4df] animate-in fade-in slide-in-from-top-4 duration-150">
          <div className="px-6 py-4 flex flex-col gap-2">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm text-[#575752] hover:text-[#1c1c1a] py-2 transition-colors font-medium"
              >
                {link.label}
              </a>
            ))}
            <hr className="border-[#e4e4df] my-2" />
            <a 
              href="/dashboard" 
              onClick={() => setMenuOpen(false)}
              className="text-sm text-[#575752] hover:text-[#1c1c1a] py-2 transition-colors font-medium"
            >
              Sign in
            </a>
            <a
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-semibold text-center text-white bg-accent hover:bg-accent-hover px-4 py-2.5 rounded-lg transition-colors"
            >
              Get started free
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

interface FloatingHeroNodeProps {
  title: string;
  subtitle: string;
  layer: string;
  accent?: string;
  isDatabase?: boolean;
  className: string;
  delay: string;
}

function getTierColorNormalized(layer?: string): string {
  const tier = (layer || 'compute').toLowerCase();
  const colorMap: Record<string, string> = {
    client:   '#64748b',
    edge:     '#6366f1',
    compute:  '#0d9488',
    async:    '#d97706',
    data:     '#3b82f6',
    observe:  '#8b5cf6',
    external: '#ec4899',
  };
  return colorMap[tier] || colorMap.compute;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getDarkCategoryStyle(layer?: string): { border: string; glow: string } {
  const tier = (layer || 'compute').toLowerCase();
  const map: Record<string, { border: string; glow: string }> = {
    client:      { border: '#60A5FA', glow: 'rgba(96,165,250,0.15)' },
    edge:        { border: '#60A5FA', glow: 'rgba(96,165,250,0.15)' },
    compute:     { border: '#34D399', glow: 'rgba(52,211,153,0.15)' },
    async:       { border: '#FBBF24', glow: 'rgba(251,191,36,0.15)' },
    data:        { border: '#F87171', glow: 'rgba(248,113,113,0.15)' },
    observe:     { border: '#A78BFA', glow: 'rgba(167,139,250,0.15)' },
    external:    { border: '#22D3EE', glow: 'rgba(34,211,238,0.15)' },
  };
  return map[tier] || map.compute;
}

function FloatingHeroNode({ title, subtitle, layer, accent, isDatabase, className, delay }: FloatingHeroNodeProps) {
  const tierColor = getTierColorNormalized(layer);
  const accentColor = accent || tierColor;
  const catStyle = getDarkCategoryStyle(layer);

  const backplateLayers = [
    { offset: 10, color: '#ffffff' },
    { offset: 5, color: '#f5f5f5' },
  ];

  return (
    <div className={`hidden lg:block absolute pointer-events-none select-none z-10 w-[220px] h-[72px] ${className}`}>
      <div 
        className="w-full h-full relative"
        style={{
          animation: 'float 6s ease-in-out infinite',
          animationDelay: delay,
        }}
      >
        <div
          className={`node-wrapper${isDatabase ? ' node-cylinder' : ''}`}
          style={{
            ['--node-accent' as string]: accentColor,
            ['--node-accent-soft' as string]: hexToRgba(accentColor, 0.04),
            ['--node-accent-bg' as string]: `${accentColor}12`,
            ['--node-glow' as string]: catStyle.glow,
            ['--node-glow-border' as string]: catStyle.border,
            ['--node-status-color' as string]: '#10B981',
          }}
        >
          {/* Backplates to render the 3D stack shadow */}
          {backplateLayers.map((backplate, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: isDatabase ? 12 : 16,
                transform: `translate(${backplate.offset}px, ${backplate.offset}px)`,
                background: backplate.color,
                zIndex: i + 1,
                pointerEvents: 'none',
                border: '1px solid rgba(0, 0, 0, 0.04)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            />
          ))}

          {/* Node Card */}
          <div
            className={`group node-card${isDatabase ? ' node-card-db' : ''}`}
            style={{
              width: 220,
              minWidth: 220,
              minHeight: 72,
              background: '#ffffff',
            }}
          >
            <div className="node-shine" />
            <div className="node-header">
              <span className="node-title">{title}</span>
            </div>
            <div className="node-footer">
              <span className="node-subtitle">{subtitle}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="pt-[110px] pb-16 px-6 relative overflow-hidden bg-surface-page">
      {/* Background glow */}
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Floating half-submerged nodes matching main canvas aesthetics */}
      <FloatingHeroNode 
        title="API Gateway" 
        subtitle="Reverse Proxy" 
        layer="edge" 
        className="left-0 top-[20%] -translate-x-1/3 rotate-6" 
        delay="0s" 
      />
      <FloatingHeroNode 
        title="Auth Service" 
        subtitle="JWT Validator" 
        layer="compute" 
        className="right-0 top-[15%] translate-x-1/3 -rotate-12" 
        delay="1.5s" 
      />
      <FloatingHeroNode 
        title="User DB" 
        subtitle="PostgreSQL Replica" 
        layer="data" 
        isDatabase={true} 
        className="left-0 bottom-[20%] -translate-x-1/4 -rotate-6" 
        delay="3s" 
      />
      <FloatingHeroNode 
        title="Redis Cache" 
        subtitle="In-Memory DB" 
        layer="data" 
        accent="#1E90FF" 
        className="right-0 bottom-[25%] translate-x-1/4 rotate-12" 
        delay="4.5s" 
      />

      <div className="max-w-[1280px] mx-auto flex flex-col items-center text-center relative z-10">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary bg-[#f1f1eb] border border-border rounded-full px-4 py-1.5 mb-8 shadow-inner animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-[#27a644]" />
          AI-powered diagramming <span className="text-text-secondary">· Now in beta</span>
        </div>
        <h1
          className={`text-text-primary font-bold leading-[1.05] tracking-tight max-w-[950px] ${outfit.className}`}
          style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)' }}
        >
          From idea to architecture diagram in one prompt — not one hour.
        </h1>
        <p className="mt-6 max-w-[650px] text-base md:text-lg text-text-secondary leading-relaxed font-medium">
          Describe your system in plain English or Mermaid. ArchDraw's AI pipeline handles structure, layout, and styling — so you get a clean, presentation-ready diagram in seconds, not after an hour of dragging boxes in draw.io.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
          <a
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover px-6 py-3 rounded-lg transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 shadow-[0_4px_20px_rgba(94,106,210,0.3)] hover:shadow-[0_4px_25px_rgba(94,106,210,0.45)]"
          >
            Generate my diagram free <ArrowRight size="15" />
          </a>
          <a
            href="/dashboard/templates"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold text-text-primary bg-surface-panel border border-border hover:bg-surface-page px-6 py-3 rounded-lg transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
          >
            See example diagrams
          </a>
        </div>
        
        <span className="mt-4 text-xs text-text-muted font-medium tracking-wide">
          Free during beta. No credit card, no account needed to try.
        </span>
      </div>
    </section>
  );
}

function ProblemSection() {
  const painPoints = [
    {
      title: 'Untangling crossing lines',
      desc: 'Dragging boxes and untangling messy layout routing manually in draw.io or Lucidchart.',
      icon: <ArrowRightLeft className="w-5 h-5 text-[#eb534b]" />
    },
    {
      title: 'Redoing diagrams on code change',
      desc: 'Losing diagram state and having to redo the layout completely every time your service contracts shift.',
      icon: <RefreshCw className="w-5 h-5 text-[#d4a04a]" />
    },
    {
      title: 'Losing 30 minutes in formatting',
      desc: 'Wasting precious minutes tweaking alignments, colors, and line nodes to make it look decent enough to share.',
      icon: <Clock className="w-5 h-5 text-accent" />
    },
    {
      title: 'Design is not your day job',
      desc: 'You are an engineer, not a professional designer — and it shows in the generic, unaligned results.',
      icon: <Paintbrush className="w-5 h-5 text-[#1c1c1a]" />
    }
  ];

  return (
    <section className="py-24 px-6 border-t border-[#e4e4df] bg-[#f1f1eb]/30 relative">
      <div className="max-w-[1280px] mx-auto">
        <div className="max-w-[800px] mb-16">
          <span className={`text-[13px] font-bold tracking-[1.5px] uppercase text-[#8a8f98] block mb-3 ${outfit.className}`}>The Friction</span>
          <h2
            className={`text-[#1c1c1a] font-bold leading-[1.10] tracking-tight ${outfit.className}`}
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            Diagramming takes longer than building the thing it diagrams.
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {painPoints.map((item, i) => (
            <div 
              key={i} 
              className="bg-white border border-[#e4e4df] hover:border-slate-300 p-6 rounded-xl transition-all duration-150 hover:-translate-y-1 shadow-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-[#f1f1eb] border border-[#e4e4df] flex items-center justify-center mb-5">
                {item.icon}
              </div>
              <h3 className={`text-base font-bold text-[#1c1c1a] mb-2 tracking-tight ${outfit.className}`}>{item.title}</h3>
              <p className="text-sm text-[#575752] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center text-center p-8 border border-[#e4e4df] bg-white rounded-xl max-w-4xl mx-auto shadow-sm">
          <p className="text-base md:text-lg text-[#1c1c1a] font-medium italic">
            "ArchDraw skips all of that. Describe the system once. The AI handles the rest."
          </p>
          <a
            href="/dashboard"
            className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-accent hover:text-accent-hover transition-colors"
          >
            Get started now <ArrowRight size="14" className="ml-1" />
          </a>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const cards = [
    {
      number: '01',
      title: 'Describe',
      desc: 'Type your architecture in plain English, upload code structures, or paste standard Mermaid code directly into the workspace.',
    },
    {
      number: '02',
      title: 'Generate',
      desc: 'ArchDraw builds & layouts nodes',
    },
    {
      number: '03',
      title: 'Export',
      desc: 'Download PNG, SVG or share live link',
    },
  ];

  return (
    <section id="how-it-works" className="py-24 px-6 border-t border-[#e4e4df] dark:border-[#202327] bg-[#f7f7f5] dark:bg-[#090b0d] relative">
      <div className="max-w-[1280px] mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className={`text-[13px] font-bold tracking-[1.5px] uppercase text-[#8a8f98] block mb-3 ${outfit.className}`}>Workflow</span>
          <h2
            className={`text-[#1c1c1a] dark:text-[#f7f8f8] font-bold leading-[1.10] tracking-tight ${outfit.className}`}
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            From description to diagram in 3 steps
          </h2>
        </div>

        <div className="flex flex-col md:flex-row items-stretch justify-center gap-6 md:gap-0">
          {cards.map((card, i) => {
            const rotations = ['md:rotate-[-3deg]', 'md:rotate-0', 'md:rotate-[3deg]'];
            const isCenter = i === 1;

            return (
              <div
                key={i}
                className={`
                  group relative w-full md:w-[380px]
                  bg-white dark:bg-[#1e2235]
                  border border-[#e4e4df] dark:border-[#202327]
                  rounded-xl p-6
                  flex flex-col
                  transition-all duration-300 ease-out
                  ${rotations[i]}
                  ${isCenter ? 'md:relative md:z-10 md:shadow-xl' : 'shadow-sm'}
                  ${i < 2 ? 'md:-mr-16' : ''}
                  hover:!rotate-0 hover:-translate-y-2
                  ${isCenter ? 'hover:z-20' : 'hover:z-10'}
                `}
              >
                {/* Step number badge with spark icon */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold font-mono text-[#575752] dark:text-[#d0d6e0] tracking-wide">
                    {card.number}
                  </span>
                  <Sparkles size={12} className="text-accent" />
                </div>

                {/* Step title */}
                <h3 className={`text-xl font-bold text-[#1c1c1a] dark:text-[#f7f8f8] mb-2 ${outfit.className}`}>
                  {card.title}
                </h3>

                {/* Step description */}
                <p className="text-sm text-[#575752] dark:text-[#d0d6e0] leading-relaxed mb-4">
                  {card.desc}
                </p>

                {/* --- Visual preview areas --- */}

                {/* Card 1: Describe — mock text input snippet */}
                {i === 0 && (
                  <div className="mt-auto bg-[#f1f1eb] dark:bg-[#141516] rounded-lg p-3">
                    <div className="font-mono text-xs text-[#575752] dark:text-[#d0d6e0]">
                      Client <span className="text-[#8a8f98] dark:text-[#62666d]">→</span> Gateway <span className="text-[#8a8f98] dark:text-[#62666d]">→</span> Postgres DB
                    </div>
                  </div>
                )}

                {/* Card 2: Generate — miniature mock diagram */}
                {i === 1 && (
                  <div className="mt-auto bg-[#f1f1eb] dark:bg-[#141516] rounded-lg p-3 flex items-center justify-center">
                    <svg width="120" height="28" viewBox="0 0 120 28" fill="none" className="text-[#8a8f98] dark:text-[#62666d]">
                      <rect x="0" y="6" width="24" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
                      <line x1="24" y1="14" x2="34" y2="14" stroke="currentColor" strokeWidth="1" />
                      <polygon points="44,0 56,14 44,28 32,14" stroke="#1E90FF" strokeWidth="1.5" fill="rgba(30,144,255,0.1)" />
                      <line x1="56" y1="14" x2="66" y2="14" stroke="currentColor" strokeWidth="1" />
                      <rect x="66" y="2" width="38" height="24" rx="12" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </div>
                )}

                {/* Card 3: Export — mock export chips */}
                {i === 2 && (
                  <div className="mt-auto bg-[#f1f1eb] dark:bg-[#141516] rounded-lg p-3 flex items-center justify-center gap-2 flex-wrap">
                    <span className="px-3 py-1 text-[10px] font-bold rounded-full bg-accent text-white">PNG</span>
                    <span className="px-3 py-1 text-[10px] font-bold rounded-full bg-[#e4e4df] dark:bg-[#23252a] text-[#575752] dark:text-[#d0d6e0]">SVG</span>
                    <span className="px-3 py-1 text-[10px] font-bold rounded-full bg-[#e4e4df] dark:bg-[#23252a] text-[#575752] dark:text-[#d0d6e0]">Share Link</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FeatureCardGrid() {
  return (
    <section id="features" className="py-24 px-6 bg-[#f7f7f5]">
      <div className="max-w-[1280px] mx-auto">
        <div className="text-center mb-16">
          <span className={`text-[13px] font-bold tracking-[1.5px] uppercase text-[#8a8f98] block mb-3 ${outfit.className}`}>Features</span>
          <h2
            className={`text-[#1c1c1a] font-bold leading-[1.15] tracking-tight text-center max-w-[680px] mx-auto ${outfit.className}`}
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            Everything you need to map complex architecture
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#e4e4df] rounded-xl overflow-hidden border border-[#e4e4df] shadow-md">
          {FEATURES_GRID.map((f, i) => (
            <div key={i} className="bg-white hover:bg-slate-50/50 transition-all duration-150 p-8 flex flex-col gap-4">
              <div className="w-9 h-9 rounded bg-[#f1f1eb] border border-[#e4e4df] flex items-center justify-center shrink-0 shadow-sm">
                {f.icon}
              </div>
              <div>
                <h3 className={`text-lg font-bold text-[#1c1c1a] tracking-tight mb-2 ${outfit.className}`}>{f.title}</h3>
                <p className="text-sm text-[#575752] leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InteractiveDemoSection() {
  return (
    <section className="py-20 px-6 bg-[#f7f7f5] relative border-t border-[#e4e4df]">
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent/2 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-[1600px] mx-auto px-8 flex flex-col items-center relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className={`text-[13px] font-bold tracking-[1.5px] uppercase text-[#8a8f98] block mb-3 ${outfit.className}`}>Try it out</span>
          <h2
            className={`text-[#1c1c1a] font-bold leading-[1.10] tracking-tight ${outfit.className}`}
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            Try it right here — no sign-up needed
          </h2>
          <p className="mt-4 text-sm md:text-base text-[#575752] max-w-[550px] mx-auto leading-relaxed">
            This is a real ArchDraw canvas. Drag the nodes, zoom in, or type a prompt below.
          </p>
        </div>
        
        <div className="w-full">
          <InteractiveLandingDemo />
        </div>
      </div>
    </section>
  );
}

function BuiltForStack() {
  return (
    <section className="py-16 px-6 border-t border-b border-[#e4e4df] bg-[#f1f1eb]/30 overflow-hidden">
      <div className="max-w-[1280px] mx-auto text-center">
        <h2 className={`text-base font-bold uppercase tracking-[1.5px] text-[#8a8f98] mb-2 ${outfit.className}`}>
          Speaks the language of your stack
        </h2>
        <p className="text-sm text-[#575752] mb-8 font-medium">
          ArchDraw understands the services and tools you already design around.
        </p>
        <div className="relative overflow-hidden mask-fade-x">
          <div className="flex gap-16 animate-marquee" style={{ width: 'max-content' }}>
            {[...TECH_LOGOS, ...TECH_LOGOS, ...TECH_LOGOS].map((name, i) => (
              <span key={i} className="text-sm text-[#575752] hover:text-[#1c1c1a] whitespace-nowrap font-mono font-semibold transition-colors duration-150 select-none">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WhoUsesSection() {
  const personas = [
    {
      title: 'Students',
      desc: 'Practice system design interview diagrams, or finish project docs fast without getting stuck dragging margins.',
      icon: <BookOpen className="w-5 h-5 text-accent" />
    },
    {
      title: 'Engineers & Teams',
      desc: 'Document real production architecture in seconds for onboarding, architecture reviews, and markdown READMEs.',
      icon: <Layers className="w-5 h-5 text-[#27a644]" />
    },
    {
      title: 'Technical Writers',
      desc: 'Embed accurate, crisp diagrams for user documentation, without spending hours learning complex design tools.',
      icon: <MessageSquare className="w-5 h-5 text-[#d4a04a]" />
    },
    {
      title: 'Researchers & Founders',
      desc: 'Explain highly complex technical systems clearly to stakeholders or cross-functional collaborators in one view.',
      icon: <User className="w-5 h-5 text-[#1c1c1a]" />
    }
  ];

  return (
    <section className="py-24 px-6 bg-[#f7f7f5]">
      <div className="max-w-[1280px] mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className={`text-[13px] font-bold tracking-[1.5px] uppercase text-[#8a8f98] block mb-3 ${outfit.className}`}>Audiences</span>
          <h2
            className={`text-[#1c1c1a] font-bold leading-[1.10] tracking-tight ${outfit.className}`}
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            Built for anyone who needs to explain systems visually
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {personas.map((persona, i) => (
            <div 
              key={i} 
              className="bg-white border border-[#e4e4df] hover:border-slate-300 p-6 rounded-xl transition-all duration-150 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 rounded bg-[#f1f1eb] border border-[#e4e4df] flex items-center justify-center mb-5">
                  {persona.icon}
                </div>
                <h3 className={`text-base font-bold text-[#1c1c1a] mb-2 tracking-tight ${outfit.className}`}>{persona.title}</h3>
                <p className="text-sm text-[#575752] leading-relaxed">{persona.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FounderNote() {
  return (
    <section className="py-24 px-6 border-t border-[#e4e4df] bg-[#f1f1eb]/30 relative">
      <div className="max-w-[760px] mx-auto bg-white border border-[#e4e4df] rounded-xl p-8 md:p-12 relative shadow-md">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
          <div className="flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-[#f1f1eb] border-2 border-accent flex items-center justify-center overflow-hidden shadow-lg select-none">
              <span className={`text-lg font-bold text-[#1c1c1a] ${outfit.className}`}>AS</span>
            </div>
          </div>
          <div>
            <span className={`text-xs font-bold uppercase tracking-wider text-accent block mb-2`}>Developer Note</span>
            <h3 className={`text-xl font-bold text-[#1c1c1a] mb-4 ${outfit.className}`}>Hey, I'm Abhishek 👋</h3>
            <div className="space-y-4 text-sm text-[#575752] leading-relaxed font-normal">
              <p>
                I'm a final-year engineering student, and I built ArchDraw because I kept losing more time formatting a diagram than thinking about the architecture itself.
              </p>
              <p>
                Every system design interview, every project doc, every README needed a diagram — and every time, I'd open draw.io, drag the same boxes around, and burn 30 minutes I didn't have.
              </p>
              <p>
                So I built an AI pipeline to handle the part that doesn't need a human: layout, styling, alignment. You focus on the system. ArchDraw handles the diagram.
              </p>
              <p>
                I'm building this in public as a solo developer. If you try it and something's rough, I'd genuinely want to hear about it.
              </p>
            </div>
            
            <div className="mt-6 pt-6 border-t border-[#e4e4df] flex items-center gap-3">
              <div>
                <div className={`text-sm font-semibold text-[#1c1c1a] ${outfit.className}`}>Abhishek Suresh Jamdade</div>
                <div className="text-[11px] text-[#8a8f98]">Founder, ArchDraw</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    try {
      if (localStorage.getItem('archdraw-waitlist-joined') === 'true') {
        setSubmitted(true);
      }
    } catch {}
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      try {
        localStorage.setItem('archdraw-waitlist-joined', 'true');
        localStorage.setItem('archdraw-waitlist-email', email);
      } catch {}
    }, 1000);
  };

  return (
    <section id="pricing" className="py-24 px-6 border-t border-[#e4e4df] bg-[#f7f7f5]">
      <div className="max-w-[1280px] mx-auto">
        <div className="text-center max-w-xl mx-auto mb-16">
          <span className={`text-[13px] font-bold tracking-[1.5px] uppercase text-[#8a8f98] block mb-3 ${outfit.className}`}>Pricing</span>
          <h2
            className={`text-[#1c1c1a] font-bold leading-[1.10] tracking-tight ${outfit.className}`}
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            Free during beta
          </h2>
          <p className="mt-4 text-sm text-[#575752] max-w-[480px] mx-auto leading-relaxed">
            ArchDraw is free to use while in beta. Paid plans are coming — early users will get a locked-in discount when they launch.
          </p>
        </div>

        <div className="max-w-md mx-auto bg-white border border-[#e4e4df] rounded-xl p-8 shadow-md relative">
          <div className="absolute -top-3 right-6 bg-accent text-white text-[9px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full shadow-sm">
            Beta Pass
          </div>
          
          <div className="mb-6">
            <h3 className={`text-lg font-bold text-[#1c1c1a] mb-1 ${outfit.className}`}>Beta access</h3>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-extrabold text-[#1c1c1a]">$0</span>
              <span className="text-xs text-[#575752]">/ free forever in beta</span>
            </div>
          </div>

          <ul className="space-y-3 mb-8 text-sm text-[#575752]">
            <li className="flex items-center gap-2">
              <Check size="16" className="text-[#27a644] shrink-0" />
              <span>Unlimited diagram generation</span>
            </li>
            <li className="flex items-center gap-2">
              <Check size="16" className="text-[#27a644] shrink-0" />
              <span>Mermaid workspace editor</span>
            </li>
            <li className="flex items-center gap-2">
              <Check size="16" className="text-[#27a644] shrink-0" />
              <span>SVG, PNG, and Live share link export</span>
            </li>
            <li className="flex items-center gap-2">
              <Check size="16" className="text-[#27a644] shrink-0" />
              <span>No credit card required</span>
            </li>
          </ul>

          <div className="border-t border-[#e4e4df] pt-6">
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="text-xs text-[#575752] font-medium block mb-1">
                  Want updates and locked-in launch discount? Join waitlist:
                </div>
                <div className="flex gap-2 bg-[#f9f9f7] border border-[#e4e4df] focus-within:border-accent rounded-lg p-1.5 transition-colors relative">
                  <div className="flex items-center pl-2 text-[#8a8f98]">
                    <Mail size="14" />
                  </div>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="bg-transparent border-none outline-none text-xs text-[#1c1c1a] placeholder-[#8a8f98] flex-1 py-1.5 px-1 min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-accent hover:bg-accent-hover text-white text-xs font-semibold px-4 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Join <Send size="10" />
                      </>
                    )}
                  </button>
                </div>
                {errorMsg && (
                  <p className="text-xs text-[#eb534b] font-medium pl-1 animate-fade-in">{errorMsg}</p>
                )}
              </form>
            ) : (
              <div className="bg-[#27a644]/10 border border-[#27a644]/30 rounded-lg p-4 text-center animate-in fade-in zoom-in-95 duration-150">
                <CheckCircle2 size="24" className="text-[#27a644] mx-auto mb-2" />
                <h4 className={`text-sm font-bold text-[#1c1c1a] ${outfit.className}`}>Waitlist joined!</h4>
                <p className="text-xs text-[#575752] mt-1">We've locked in your early adopter discount. We'll notify you on launch!</p>
              </div>
            )}
          </div>
          
          <a
            href="/dashboard"
            className="mt-6 w-full inline-flex items-center justify-center gap-2 text-xs font-bold text-[#1c1c1a] bg-[#f1f1eb] border border-[#e4e4df] hover:bg-slate-100 p-3 rounded-lg transition-colors cursor-pointer"
          >
            Get started free immediately
          </a>
        </div>
      </div>
    </section>
  );
}

interface FAQItem {
  q: string;
  a: string;
}

function FAQSection() {
  const faqs: FAQItem[] = [
    {
      q: 'Is ArchDraw free?',
      a: 'Yes, ArchDraw is completely free to use while we are in pre-launch beta. Paid subscriptions will be introduced down the line, but early users signing up for the waitlist will get a permanently locked-in launch discount.'
    },
    {
      q: 'Do I need an account to try it?',
      a: 'No. You can try the generator, inspect canvas structures, and design live diagrams in the workspace without signing up or creating an account.'
    },
    {
      q: 'How is this different from draw.io or Lucidchart?',
      a: 'Manual editing systems like draw.io require you to manually drag, connect, align, and restyle every single box. ArchDraw uses automated layouts. You simply type your system architecture in plain text, and the AI lays out the components perfectly, avoiding overlapping lines.'
    },
    {
      q: 'How is this different from Eraser/DiagramGPT or similar AI tools?',
      a: 'ArchDraw is built on a Mermaid-first pipeline that combines full custom Mermaid editing with AI generation. Instead of locked-in proprietary formats or static images, you get fully interactive, zoomable React Flow canvas diagrams. Plus, it exposes a direct Model Context Protocol (MCP) server so you can use it directly inside AI assistants like Claude Desktop.'
    },
    {
      q: 'Can I write my own Mermaid code?',
      a: 'Yes! The workspace features a fully-functional Mermaid syntax code editor with live syntax checking, highlighting, and auto-rendering.'
    },
    {
      q: 'What can I export to?',
      a: 'You can export diagrams in high-definition PNG format, vector SVG for scalable web layouts, or generate a permanent live shareable link to email or Slack teammates.'
    },
    {
      q: 'Is ArchDraw good for system design interview prep?',
      a: 'Yes, absolutely. Students use it to quickly construct clear system schemas during whiteboard interview prep sessions, saving hours of drawing.'
    },
    {
      q: 'Is my data stored or used to train anything?',
      a: 'No. Your prompts, code segments, and schema inputs are processed temporarily to output standard layout coordinates, but they are not stored on our databases or shared with external model trainers. Everything is sandboxed locally in your browser session.'
    }
  ];

  return (
    <section id="faq" className="py-24 px-6 border-t border-[#e4e4df] bg-[#f1f1eb]/20">
      <div className="max-w-[800px] mx-auto">
        <div className="text-center max-w-xl mx-auto mb-16">
          <span className={`text-[13px] font-bold tracking-[1.5px] uppercase text-[#8a8f98] block mb-3 ${outfit.className}`}>FAQ</span>
          <h2
            className={`text-[#1c1c1a] font-bold leading-[1.10] tracking-tight ${outfit.className}`}
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <FAQAccordion key={i} faq={faq} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQAccordion({ faq }: { faq: FAQItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-[#e4e4df] bg-white rounded-xl overflow-hidden transition-colors duration-150 shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left text-sm font-semibold text-[#1c1c1a] hover:text-accent transition-colors cursor-pointer select-none"
      >
        <span className={`${outfit.className} text-sm md:text-base pr-4`}>{faq.q}</span>
        <ChevronDown 
          size="16" 
          className={`text-[#8a8f98] shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180 text-accent' : ''
          }`} 
        />
      </button>
      
      <div 
        className={`transition-all duration-300 ease-in-out ${
          open ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        } overflow-hidden`}
      >
        <div className="p-5 pt-0 border-t border-[#e4e4df]/50 text-xs md:text-sm text-[#575752] leading-relaxed font-normal bg-[#f9f9f7]">
          {faq.a}
        </div>
      </div>
    </div>
  );
}

function CTABanner() {
  return (
    <section className="py-24 px-6 bg-[#f7f7f5] border-t border-[#e4e4df] relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-accent/2 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="max-w-[960px] mx-auto bg-white border border-border rounded-xl p-12 text-center relative z-10 shadow-md">
        <h2
          className={`text-text-primary font-bold leading-[1.15] tracking-tight ${outfit.className}`}
          style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}
        >
          Stop dragging boxes. Start describing systems.
        </h2>
        <p className="mt-4 text-base text-text-secondary max-w-[500px] mx-auto leading-relaxed font-normal">
          Get clean, structured, presentation-ready diagrams in seconds. Free to use, no credit card required.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <a
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover px-6 py-3 rounded-lg transition-colors shadow-md cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
          >
            Generate my diagram free <ArrowRight size="15" />
          </a>
          <a
            href="/dashboard/templates"
            className="w-full sm:w-auto text-sm font-semibold text-[#1c1c1a] bg-[#f1f1eb] border border-[#e4e4df] hover:bg-slate-100 px-6 py-3 rounded-lg transition-colors cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
          >
            See example diagrams
          </a>
        </div>
        <div className="mt-4 text-xs text-[#8a8f98] font-semibold flex items-center justify-center gap-1.5">
          <Lock size="10" /> Free during beta. No account required to try.
        </div>
      </div>
    </section>
  );
}

function FooterSection() {
  const columns = [
    { 
      title: 'Product', 
      links: [
        { label: 'Features', href: '#features' },
        { label: 'Mermaid Editor', href: '/dashboard' },
        { label: 'AI Pipeline', href: '#how-it-works' },
        { label: 'Export', href: '/dashboard' }
      ] 
    },
    { 
      title: 'Resources', 
      links: [
        { label: 'Docs', href: '/docs' },
        { label: 'Examples', href: '/dashboard/templates' },
        { label: 'Changelog', href: '#how-it-works' },
        { label: 'GitHub', href: 'https://github.com' }
      ] 
    },
    { 
      title: 'Company', 
      links: [
        { label: 'About', href: '#founder-note' },
        { label: 'Twitter/X', href: 'https://twitter.com' },
        { label: 'Contact', href: 'mailto:contact@archdraw.app' }
      ] 
    },
  ];

  return (
    <footer className="py-16 px-6 bg-[#f1f1eb] border-t border-[#e4e4df] relative z-10">
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shadow-md">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f7f8f8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className={`text-sm font-bold text-text-primary tracking-tight ${outfit.className}`}>ArchDraw</span>
            </Link>
            <p className="text-xs text-[#575752] max-w-[240px] leading-relaxed font-semibold">
              A diagramming tool for engineers who think in systems.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className={`text-xs font-bold uppercase tracking-wider text-[#1c1c1a] mb-3 ${outfit.className}`}>{col.title}</h4>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a 
                      href={link.href} 
                      className="text-xs text-[#575752] hover:text-[#1c1c1a] transition-colors duration-150 font-medium"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-[#e4e4df] text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs text-[#8a8f98] font-semibold">&copy; 2026 ArchDraw. Built for engineers.</span>
          <span className="text-xs text-[#8a8f98] font-semibold">Crafted in public by Abhishek.</span>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    try { localStorage.setItem('archdraw-theme', 'light'); } catch {}
  }, []);

  return (
    <div className={`min-h-screen bg-[#f7f7f5] text-[#1c1c1a] antialiased ${plusJakarta.className} ${outfit.variable} ${plusJakarta.variable}`}>
      <TopNav />
      <main>
        <HeroSection />
        <InteractiveDemoSection />
        <BuiltForStack />
        <ProblemSection />
        <HowItWorksSection />
        <FeatureCardGrid />
        <WhoUsesSection />
        <div id="founder-note">
          <FounderNote />
        </div>
        <PricingSection />
        <FAQSection />
        <CTABanner />
      </main>
      <FooterSection />
    </div>
  );
}
