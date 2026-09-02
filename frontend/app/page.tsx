import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import { ArrowRight, Sparkles } from 'lucide-react';
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
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingBootstrap } from '@/components/landing/LandingBootstrap';

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
    <div className={`hidden md:block absolute pointer-events-none select-none z-10 w-[200px] h-[72px] ${className}`}>
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
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-brand/8 blur-[90px] rounded-full" />
        <div className="absolute top-[18%] left-[28%] w-[500px] h-[320px] bg-brand/5 blur-[100px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
      </div>

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
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary bg-surface-panel border border-border-default rounded-full px-4 py-1.5 mb-8 shadow-inner animate-fade-in">
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
            className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand-hover px-6 py-3 rounded-lg transition-[background,transform,box-shadow] duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-[0_4px_20px_rgba(30,144,255,0.3)] hover:shadow-[0_4px_28px_rgba(30,144,255,0.45)]"
          >
            Generate my diagram free
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
          <a
            href="/dashboard/templates"
            data-track="hero_see_examples"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold text-text-primary bg-surface-panel border border-border hover:bg-surface-page px-6 py-3 rounded-lg transition-[background,transform,box-shadow] duration-200 hover:-translate-y-0.5 active:translate-y-0"
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
  return (
    <div className={`min-h-screen bg-surface-page text-text-primary antialiased ${plusJakarta.className} ${outfit.variable} ${plusJakarta.variable}`}>
      <LandingNav outfitClassName={outfit.className} />
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
      <LandingBootstrap />
    </div>
  );
}
