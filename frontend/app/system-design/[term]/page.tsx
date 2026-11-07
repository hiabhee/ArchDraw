import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import { GLOSSARY, getGlossaryTerm } from '@/data/glossary/terms';
import { relatedTerms, templatesUsingTerm, tutorialsUsingTerm } from '@/lib/site/glossary';
import { templateHeading, templateSlug } from '@/lib/site/templateCatalog';
import { tutorialHeading } from '@/lib/tutorial/tutorialArticle';
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/site/seo';

interface Props {
  params: Promise<{ term: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return GLOSSARY.map((t) => ({ term: t.slug }));
}

/** "CDN (Content Delivery Network)" → "CDN", for titles. */
const shortName = (name: string) => name.replace(/\s*\(.*\)$/, '');

/** Practices and plurals read without an article: "What is event streaming?", not "an Event Streaming". */
const NO_ARTICLE = new Set(['event-streaming', 'websocket', 'rate-limiting', 'presence', 'background-jobs', 'webhooks']);
function whatIs(slug: string, short: string): string {
  if (NO_ARTICLE.has(slug)) return `What ${/s$/.test(short) ? 'are' : 'is'} ${short.toLowerCase().replace(/^websockets$/, 'WebSockets')}?`;
  return `What is ${/^[aeiou]/i.test(short) ? 'an' : 'a'} ${short}?`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { term: slug } = await params;
  const term = getGlossaryTerm(slug);
  if (!term) return { title: 'Concept not found', robots: { index: false } };
  return pageMetadata({
    title: `${shortName(term.name)} in System Design: How It Works`,
    description: term.summary,
    path: `/system-design/${term.slug}`,
    type: 'article',
    keywords: [`${shortName(term.name).toLowerCase()} system design`, `what is ${shortName(term.name).toLowerCase()}`, 'system design concepts', ...term.examples],
  });
}

const h2 = 'text-xl font-semibold tracking-[-.03em] text-text-primary';
const p = 'leading-7 text-text-secondary';

export default async function GlossaryTermPage({ params }: Props) {
  const { term: slug } = await params;
  const term = getGlossaryTerm(slug);
  if (!term) notFound();

  const templates = templatesUsingTerm(term);
  const tutorials = tutorialsUsingTerm(term).slice(0, 6);
  const related = relatedTerms(term);
  const path = `/system-design/${term.slug}`;
  const short = shortName(term.name);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'DefinedTerm',
        '@id': `${absoluteUrl(path)}#term`,
        name: term.name,
        description: term.summary,
        url: absoluteUrl(path),
        inDefinedTermSet: `${absoluteUrl('/system-design')}#glossary`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: term.faq.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
      },
      breadcrumbJsonLd([['System design concepts', '/system-design'], [term.name, path]]),
    ],
  };

  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-24 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-text-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="transition-colors hover:text-text-primary">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/system-design" className="transition-colors hover:text-text-primary">System design concepts</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-text-secondary">{term.name}</li>
          </ol>
        </nav>

        <header>
          <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-brand-text">System design concept</p>
          <h1 className="text-[clamp(2rem,4.5vw,3rem)] font-semibold leading-[1.05] tracking-[-.04em]">{term.name}</h1>
          <p className="mt-4 text-lg leading-8 text-text-secondary">{term.summary}</p>
        </header>

        <div className="mt-12 space-y-12">
          <section aria-labelledby="what-title">
            <h2 id="what-title" className={h2}>{whatIs(term.slug, short)}</h2>
            <div className="mt-4 space-y-4">{term.intro.map((para) => <p key={para.slice(0, 40)} className={p}>{para}</p>)}</div>
          </section>

          <section aria-labelledby="how-title">
            <h2 id="how-title" className={h2}>How it works</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 marker:text-text-muted">
              {term.howItWorks.map((s) => <li key={s.slice(0, 40)} className={`pl-1 ${p}`}>{s}</li>)}
            </ol>
          </section>

          <div className="grid gap-10 sm:grid-cols-2">
            <section aria-labelledby="when-title">
              <h2 id="when-title" className={h2}>When to use it</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 marker:text-text-muted">
                {term.whenToUse.map((s) => <li key={s.slice(0, 40)} className={`pl-1 ${p}`}>{s}</li>)}
              </ul>
            </section>
            <section aria-labelledby="tradeoffs-title">
              <h2 id="tradeoffs-title" className={h2}>Trade-offs</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 marker:text-text-muted">
                {term.tradeoffs.map((s) => <li key={s.slice(0, 40)} className={`pl-1 ${p}`}>{s}</li>)}
              </ul>
            </section>
          </div>

          <section aria-labelledby="examples-title">
            <h2 id="examples-title" className={h2}>Common technologies</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {term.examples.map((x) => <li key={x} className="rounded-full border border-border-default px-3 py-1 text-sm text-text-secondary">{x}</li>)}
            </ul>
          </section>

          {templates.length > 0 && (
            <section aria-labelledby="templates-title">
              <h2 id="templates-title" className={h2}>Architecture diagrams that use {NO_ARTICLE.has(term.slug) ? short.toLowerCase().replace(/^websockets$/, 'WebSockets') : short}</h2>
              <p className="mt-2 text-sm text-text-secondary">See where it fits in real systems. Each diagram is free to open and edit.</p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {templates.slice(0, 12).map((t) => (
                  <li key={t.id}>
                    <Link href={`/templates/${templateSlug(t)}`} className="group flex items-center justify-between rounded-lg border border-border-default bg-surface-card px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:border-border-strong">
                      {templateHeading(t)}
                      <ArrowRight size={14} aria-hidden="true" className="text-text-muted transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tutorials.length > 0 && (
            <section aria-labelledby="tutorials-title">
              <h2 id="tutorials-title" className={h2}>Learn it in a system design tutorial</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {tutorials.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tutorials/${t.id}`} className="group flex items-center justify-between rounded-lg border border-border-default bg-surface-card px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:border-border-strong">
                      {tutorialHeading(t)}
                      <ArrowRight size={14} aria-hidden="true" className="text-text-muted transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="faq-title">
            <h2 id="faq-title" className={h2}>Frequently asked questions</h2>
            <div className="mt-5 divide-y divide-border-default rounded-xl border border-border-default bg-surface-card">
              {term.faq.map((f) => (
                <div key={f.question} className="px-5 py-4">
                  <h3 className="text-sm font-semibold text-text-primary">{f.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="related-title" className="border-t border-border-default pt-10">
            <h2 id="related-title" className={h2}>Related concepts</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/system-design/${r.slug}`} className="inline-block rounded-full border border-border-default px-3 py-1.5 text-sm text-text-primary transition-colors hover:border-border-strong">{r.name}</Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-text-secondary">
              <Link href="/system-design" className="font-medium text-brand-text hover:underline">All system design concepts</Link>
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
