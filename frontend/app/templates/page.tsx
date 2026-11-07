import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import { TemplateDiagram } from '@/components/landing/templates/TemplateDiagram';
import { TEMPLATES } from '@/data/templates/index';
import { TEMPLATE_SECTIONS, sectionFor, templateHeading, templateSlug } from '@/lib/site/templateCatalog';
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/site/seo';

export const metadata = pageMetadata({
  title: 'System Architecture Diagram Templates',
  description: `${TEMPLATES.length} free, editable system architecture diagram templates: ChatGPT, Netflix, Uber, microservices, CQRS, event-driven, URL shortener and more. Open any in ArchDraw.`,
  path: '/templates',
  keywords: ['architecture diagram templates', 'system design templates', 'microservices diagram template', 'system design interview diagrams', 'software architecture examples'],
});

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      name: 'System Architecture Diagram Templates',
      url: absoluteUrl('/templates'),
      isPartOf: { '@id': `${absoluteUrl('/')}#website` },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: TEMPLATES.length,
        itemListElement: TEMPLATES.map((t, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: templateHeading(t),
          url: absoluteUrl(`/templates/${templateSlug(t)}`),
        })),
      },
    },
    breadcrumbJsonLd([['Templates', '/templates']]),
  ],
};

export default function TemplatesGalleryPage() {
  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-28 sm:px-8">
        <header className="max-w-3xl border-b border-border-default pb-12">
          <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-brand-text">Templates</p>
          <h1
            className="tracking-[-.05em] text-text-primary"
            style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: 'clamp(2.6rem, 5.5vw, 4.6rem)', lineHeight: 0.95 }}
          >
            System architecture diagrams to start from.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-text-secondary">
            {TEMPLATES.length} editable diagrams of real products, common architecture patterns and system design interview questions.
            Open one in the editor, change it, export it, or ask the AI to adapt it to your system.
          </p>
        </header>

        <nav aria-label="Template sections" className="flex flex-wrap gap-2 py-6">
          {TEMPLATE_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-full border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">
              {s.title}
            </a>
          ))}
        </nav>

        {TEMPLATE_SECTIONS.map((section) => {
          const items = TEMPLATES.filter((t) => sectionFor(t) === section.id);
          if (items.length === 0) return null;
          return (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24 pt-10">
              <div className="mb-6 flex flex-col gap-1">
                <h2 id={`${section.id}-title`} className="text-2xl font-semibold tracking-[-.03em] text-text-primary">{section.title}</h2>
                <p className="text-sm text-text-secondary">{section.blurb}</p>
              </div>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((t) => {
                  const slug = templateSlug(t);
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/templates/${slug}`}
                        className="group flex h-full flex-col overflow-hidden rounded-xl border border-border-default bg-surface-card transition-colors hover:border-border-strong"
                      >
                        <div className="flex aspect-[16/9] items-center justify-center overflow-hidden border-b border-border-default bg-surface-panel p-3">
                          <TemplateDiagram slug={slug} alt={`${templateHeading(t)} diagram`} className="max-h-full object-contain" />
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <h3 className="text-base font-semibold tracking-tight text-text-primary">{templateHeading(t)}</h3>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-text-secondary">{t.description}</p>
                          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                            <span className="truncate font-mono text-[11px] text-text-muted">{t.tags.slice(0, 3).join(' · ')}</span>
                            <ArrowRight size={16} aria-hidden="true" className="flex-shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary" />
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <section className="mt-20 rounded-2xl border border-border-default bg-surface-panel p-7 sm:p-10">
          <h2 className="max-w-2xl text-2xl font-semibold tracking-[-.04em] text-text-primary">Need your own system instead?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-text-secondary">
            Describe it in a sentence, paste Mermaid, or point ArchDraw at a GitHub repository and get an editable diagram laid out the same way.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/editor" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover">
              Open the editor <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/repo-diagram" className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-card px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-panel">
              Diagram a GitHub repo
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
