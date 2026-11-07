import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import { GLOSSARY, getGlossaryTerm } from '@/data/glossary/terms';
import { templatesUsingTerm } from '@/lib/site/glossary';
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/site/seo';

export const metadata = pageMetadata({
  title: 'System Design Concepts: Components Explained',
  description: `${GLOSSARY.length} system design building blocks explained: load balancers, API gateways, caches, queues, Kafka, CDNs, databases and more, with real architecture diagrams.`,
  path: '/system-design',
  keywords: ['system design concepts', 'system design components', 'system design glossary', 'system design basics', 'distributed systems concepts'],
});

const GROUPS: Array<{ title: string; slugs: string[] }> = [
  { title: 'Traffic and the edge', slugs: ['dns', 'cdn', 'load-balancer', 'api-gateway', 'rate-limiting'] },
  { title: 'Data and storage', slugs: ['sql-database', 'nosql-database', 'cache', 'object-storage', 'search-index', 'vector-database', 'data-warehouse'] },
  { title: 'Messaging and background work', slugs: ['message-queue', 'event-streaming', 'background-jobs', 'webhooks'] },
  { title: 'Real time and collaboration', slugs: ['websocket', 'presence', 'crdt'] },
  { title: 'Identity', slugs: ['authentication-service'] },
];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'DefinedTermSet',
      '@id': `${absoluteUrl('/system-design')}#glossary`,
      name: 'System design concepts',
      url: absoluteUrl('/system-design'),
      hasDefinedTerm: GLOSSARY.map((t) => ({ '@type': 'DefinedTerm', name: t.name, description: t.summary, url: absoluteUrl(`/system-design/${t.slug}`) })),
    },
    breadcrumbJsonLd([['System design concepts', '/system-design']]),
  ],
};

export default function SystemDesignConceptsPage() {
  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-28 sm:px-8">
        <header className="max-w-3xl border-b border-border-default pb-12">
          <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-brand-text">Glossary</p>
          <h1 className="text-[clamp(2.4rem,5vw,4rem)] font-semibold leading-[1] tracking-[-.045em]">System design concepts</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-text-secondary">
            The building blocks every large system is made of, each explained with how it works, when to use it and what it costs, and linked to the{' '}
            <Link href="/templates" className="font-medium text-brand-text hover:underline">architecture diagrams</Link> and{' '}
            <Link href="/tutorials" className="font-medium text-brand-text hover:underline">system design tutorials</Link> that use it.
          </p>
        </header>

        {GROUPS.map((group) => (
          <section key={group.title} aria-labelledby={`${group.slugs[0]}-group`} className="pt-12">
            <h2 id={`${group.slugs[0]}-group`} className="text-xl font-semibold tracking-[-.03em]">{group.title}</h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.slugs.flatMap((slug) => getGlossaryTerm(slug) ?? []).map((term) => (
                <li key={term.slug}>
                  <Link href={`/system-design/${term.slug}`} className="group flex h-full flex-col rounded-xl border border-border-default bg-surface-card p-5 transition-colors hover:border-border-strong">
                    <span className="text-base font-semibold text-text-primary">{term.name}</span>
                    <span className="mt-2 line-clamp-3 text-sm leading-6 text-text-secondary">{term.summary}</span>
                    <span className="mt-auto flex items-center justify-between pt-4 text-xs text-text-muted">
                      <span>Used in {templatesUsingTerm(term).length} architecture diagrams</span>
                      <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
