'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import { motion } from 'framer-motion';
import {
  ArrowRight, Menu, X, Sparkles,
} from 'lucide-react';
import { SocialProof } from '@/components/landing/SocialProof';
import { InteractiveDemo } from '@/components/landing/InteractiveDemo';
import { ValueProps } from '@/components/landing/ValueProps';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { UseCases } from '@/components/landing/UseCases';
import { Comparison } from '@/components/landing/Comparison';
import { FounderNote } from '@/components/landing/FounderNote';
import { Pricing } from '@/components/landing/Pricing';
import { FAQ } from '@/components/landing/FAQ';
import { CTABanner } from '@/components/landing/CTABanner';
import { Footer } from '@/components/landing/Footer';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta',
});

const NAV_LINKS = [
  { label: 'Why', href: '#why', track: 'nav_why' },
  { label: 'How it works', href: '#how-it-works', track: 'nav_how_it_works' },
  { label: 'Pricing', href: '#pricing', track: 'nav_pricing' },
  { label: 'Docs', href: '/docs', track: 'nav_docs' },
];

function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 h-14 transition-all duration-200 ${
        scrolled
          ? 'bg-[#f7f7f5]/85 backdrop-blur-xl border-b border-[#e4e4df]/60'
          : 'bg-[#f7f7f5]'
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(30,144,255,0.35)] transition-transform duration-200 group-hover:scale-105">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className={`text-sm font-bold text-[#1c1c1a] tracking-tight ${outfit.className}`}>
              ArchDraw
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                data-track={link.track}
                className="px-3 py-1.5 text-sm text-[#575752] hover:text-[#1c1c1a] rounded-md transition-colors duration-150 font-medium"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/dashboard"
            data-track="nav_sign_in"
            className="text-sm text-[#575752] hover:text-[#1c1c1a] px-4 py-1.5 rounded-lg border border-[#e4e4df] bg-white hover:bg-slate-50 transition-all duration-150 font-medium"
          >
            Sign in
          </a>
          <a
            href="/dashboard"
            data-track="nav_get_started"
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover px-4 py-1.5 rounded-lg transition-all duration-200 shadow-[0_4px_12px_rgba(30,144,255,0.2)] hover:shadow-[0_4px_18px_rgba(30,144,255,0.35)] hover:-translate-y-0.5"
          >
            Get started free
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
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
          <div className="px-6 py-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm text-[#575752] hover:text-[#1c1c1a] py-2.5 transition-colors font-medium"
              >
                {link.label}
              </a>
            ))}
            <hr className="border-[#e4e4df] my-2" />
            <a
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="text-sm text-[#575752] hover:text-[#1c1c1a] py-2.5 transition-colors font-medium"
            >
              Sign in
            </a>
            <a
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-semibold text-center text-white bg-brand hover:bg-brand-hover px-4 py-2.5 rounded-lg transition-colors"
            >
              Get started free
            </a>
          </div>
        </div>
      )}
    </motion.header>
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
    edge:     '#0f766e',
    compute:  '#0f766e',
    async:    '#b45309',
    data:     '#475569',
    observe:  '#0f766e',
    external: '#6b7280',
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
  const color = getTierColorNormalized(layer);
  return { border: color, glow: hexToRgba(color, 0.12) };
}

function FloatingHeroNode({ title, subtitle, layer, accent, isDatabase, className, delay }: FloatingHeroNodeProps) {
  const tierColor = getTierColorNormalized(layer);
  const accentColor = accent || tierColor;
  const catStyle = getDarkCategoryStyle(layer);

  return (
    <div className={`hidden lg:block absolute pointer-events-none select-none z-10 w-[200px] h-[72px] ${className}`}>
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
          <div
            className={`group node-card${isDatabase ? ' node-card-db' : ''}`}
            style={{
              width: 200,
              minWidth: 200,
              minHeight: 72,
              background: '#ffffff',
            }}
          >
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
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand/5 blur-[120px] rounded-full pointer-events-none" />

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
          ChatGPT for architecture diagrams <span className="text-text-secondary">· Now in beta</span>
        </div>
        <h1
          className={`text-text-primary font-bold leading-[1.05] tracking-tight max-w-[950px] ${outfit.className}`}
          style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)' }}
        >
          Build accurate architecture diagrams in seconds — not hours.
        </h1>
        <p className="mt-6 max-w-[650px] text-base md:text-lg text-text-secondary leading-relaxed font-medium">
          Describe your system in plain English or Mermaid. ArchDraw lays it out for design reviews, docs, and onboarding — so you stop fighting draw.io.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
          <a
            href="/dashboard"
            data-track="hero_generate_diagram"
            className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand-hover px-6 py-3 rounded-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-[0_4px_20px_rgba(30,144,255,0.3)] hover:shadow-[0_4px_28px_rgba(30,144,255,0.45)]"
          >
            Generate my diagram free
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
          <a
            href="/dashboard/templates"
            data-track="hero_see_examples"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold text-text-primary bg-surface-panel border border-border hover:bg-surface-page px-6 py-3 rounded-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            See example diagrams
          </a>
        </div>

        <span className="mt-4 text-xs text-text-muted font-medium tracking-wide flex items-center gap-2">
          <Sparkles className="w-3 h-3" />
          Free during beta. No credit card, no account needed to try.
        </span>
      </div>
    </section>
  );
}

export default function LandingPage() {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    try { localStorage.setItem('archdraw-theme', 'light'); } catch { /* localStorage may throw in private browsing */ }

    try {
      const hasVisited = localStorage.getItem('archdraw-visited');
      const fromSameOrigin = document.referrer.startsWith(window.location.origin);

      if (hasVisited && !fromSameOrigin) {
        window.location.replace('/editor');
        return;
      }

      localStorage.setItem('archdraw-visited', 'true');
    } catch { /* localStorage may throw in private browsing */ }
  }, []);

  return (
    <div className={`min-h-screen bg-[#f7f7f5] text-[#1c1c1a] antialiased ${plusJakarta.className} ${outfit.variable} ${plusJakarta.variable}`}>
      <TopNav />
      <main>
        <HeroSection />
        <SocialProof />
        <InteractiveDemo />
        <div id="why">
          <ValueProps />
        </div>
        <HowItWorks />
        <UseCases />
        <Comparison />
        <div id="founder">
          <FounderNote />
        </div>
        <Pricing />
        <FAQ />
        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
