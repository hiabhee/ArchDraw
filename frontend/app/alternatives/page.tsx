import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import { ALTERNATIVES } from '@/data/alternatives';
import { breadcrumbJsonLd, pageMetadata } from '@/lib/site/seo';

export const metadata = pageMetadata({
  title: 'ArchDraw Alternatives and Comparisons',
  description: 'How ArchDraw compares with Eraser, draw.io and Lucidchart for software architecture diagrams, including when each tool is the better choice.',
  path: '/alternatives',
  keywords: ['architecture diagram tool comparison', 'eraser alternative', 'draw.io alternative', 'lucidchart alternative'],
});

export default function AlternativesPage() {
  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', ...breadcrumbJsonLd([['Alternatives', '/alternatives']]) }) }} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28 sm:px-6">
        <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-brand-text">Compare</p>
        <h1 className="text-[clamp(2.2rem,5vw,3.4rem)] font-semibold leading-[1.02] tracking-[-.045em]">ArchDraw compared</h1>
        <p className="mt-5 text-lg leading-8 text-text-secondary">
          ArchDraw is built for one job: software architecture diagrams, generated from a description or a codebase and kept editable. Here is how it compares with other tools, including when they are the better choice.
        </p>
        <ul className="mt-10 space-y-4">
          {ALTERNATIVES.map((a) => (
            <li key={a.slug}>
              <Link href={`/alternatives/${a.slug}`} className="group flex items-center justify-between gap-4 rounded-xl border border-border-default bg-surface-card p-5 transition-colors hover:border-border-strong">
                <span>
                  <span className="block text-base font-semibold">ArchDraw vs {a.name}</span>
                  <span className="mt-1 block text-sm leading-6 text-text-secondary">{a.about[0]}</span>
                </span>
                <ArrowRight size={16} aria-hidden="true" className="flex-shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-text-secondary">
          Or just try it: the <Link href="/free-architecture-diagram-generator" className="font-medium text-brand-text hover:underline">free AI architecture diagram generator</Link>.
        </p>
      </main>
      <Footer />
    </div>
  );
}
