import type { Metadata } from 'next';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import { Mail, Github, Twitter } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact — ArchDraw',
  description: 'Contact ArchDraw — hello@archdraw.app, GitHub, and Twitter. We reply within a day.',
  alternates: { canonical: 'https://archdraw.hiabhee.online/contact' },
  openGraph: {
    type: 'website',
    url: 'https://archdraw.hiabhee.online/contact',
    title: 'Contact — ArchDraw',
    description: 'Get in touch with the ArchDraw team.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'Contact ArchDraw' }],
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      <LandingNav />
      <main className="flex-1 max-w-[1160px] w-full mx-auto px-6 pt-24 pb-16">
        <p className="text-[11px] font-bold tracking-[2px] uppercase text-text-secondary mb-3">Contact</p>
        <h1 className="font-bold tracking-tight leading-[0.95]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '-0.05em' }}>
          Talk to <em className="text-brand-text font-normal">humans</em>
        </h1>
        <p className="mt-4 text-sm text-text-secondary max-w-2xl leading-relaxed">Questions, feedback, or a repo that won’t diagram? We answer quickly.</p>

        <div className="mt-10 grid gap-5 md:grid-cols-3 max-w-3xl">
          <a href="mailto:hello@archdraw.app" className="bg-surface-card border border-border-default rounded-xl p-6 hover:shadow-[0_8px_24px_rgba(28,28,26,0.06)] transition-shadow">
            <Mail className="w-4 h-4 text-brand-text mb-3" />
            <h3 className="text-sm font-bold">Email</h3>
            <p className="text-xs text-text-secondary mt-1">hello@archdraw.app</p>
            <p className="text-xs text-brand-text mt-3 font-medium">Send an email →</p>
          </a>
          <a href="https://github.com/hiabhee/ArchDraw" target="_blank" rel="noopener noreferrer" className="bg-surface-card border border-border-default rounded-xl p-6 hover:shadow-[0_8px_24px_rgba(28,28,26,0.06)] transition-shadow">
            <Github className="w-4 h-4 text-text-primary mb-3" />
            <h3 className="text-sm font-bold">GitHub</h3>
            <p className="text-xs text-text-secondary mt-1">Open an issue or PR</p>
            <p className="text-xs text-brand-text mt-3 font-medium">View repo →</p>
          </a>
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="bg-surface-card border border-border-default rounded-xl p-6 hover:shadow-[0_8px_24px_rgba(28,28,26,0.06)] transition-shadow">
            <Twitter className="w-4 h-4 text-brand-text mb-3" />
            <h3 className="text-sm font-bold">Twitter</h3>
            <p className="text-xs text-text-secondary mt-1">DMs open</p>
            <p className="text-xs text-brand-text mt-3 font-medium">Say hi →</p>
          </a>
        </div>

        <div className="mt-10 max-w-3xl bg-surface-card border border-border-default rounded-xl p-6">
          <h3 className="text-sm font-bold mb-2">Response time</h3>
          <p className="text-xs text-text-secondary leading-relaxed">We reply within 24h on weekdays. For security reports see <a href="/.well-known/security.txt" className="text-brand-text underline">security.txt</a>.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
