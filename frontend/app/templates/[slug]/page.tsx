import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, PencilRuler } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import { TemplateDiagram } from '@/components/landing/templates/TemplateDiagram';
import {
  allTemplateSlugs,
  getTemplateBySlug,
  relatedTemplates,
  templateComponents,
  templateConnections,
  templateHeading,
  templateMetaDescription,
  templateSlug,
} from '@/lib/site/templateCatalog';
import { templatePreviewSvg, svgSize } from '@/lib/server/templatePreview';
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/site/seo';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return allTemplateSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const template = getTemplateBySlug(slug);
  if (!template) return { title: 'Template not found', robots: { index: false } };
  const heading = templateHeading(template);
  return pageMetadata({
    title: `${heading} Diagram Template`,
    description: templateMetaDescription(template),
    path: `/templates/${slug}`,
    type: 'article',
    imageAlt: `${heading} diagram`,
    keywords: [...template.tags, `${heading.toLowerCase()} diagram`, 'architecture diagram template', 'system design'],
  });
}

export default async function TemplatePage({ params }: Props) {
  const { slug } = await params;
  const template = getTemplateBySlug(slug);
  if (!template) notFound();

  const heading = templateHeading(template);
  const components = templateComponents(template);
  const connections = templateConnections(template);
  const related = relatedTemplates(template);
  const size = svgSize(await templatePreviewSvg(template, 'light'));
  const url = absoluteUrl(`/templates/${slug}`);
  const editorHref = `/editor?template=${encodeURIComponent(template.id)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CreativeWork',
        '@id': `${url}#template`,
        name: `${heading} diagram template`,
        description: template.description,
        url,
        image: absoluteUrl(`/templates/${slug}/diagram-light.svg`),
        keywords: template.tags.join(', '),
        isAccessibleForFree: true,
        inLanguage: 'en-US',
        publisher: { '@id': `${absoluteUrl('/')}#organization` },
      },
      breadcrumbJsonLd([['Templates', '/templates'], [heading, `/templates/${slug}`]]),
    ],
  };

  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-24 sm:px-8">
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-text-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="transition-colors hover:text-text-primary">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/templates" className="transition-colors hover:text-text-primary">Templates</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-text-secondary">{heading}</li>
          </ol>
        </nav>

        <header className="grid gap-8 pb-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-brand-text">Diagram template</p>
            <h1 className="text-[clamp(2rem,4.5vw,3.4rem)] font-semibold leading-[1.02] tracking-[-.045em] text-text-primary">{heading}</h1>
            <p className="mt-5 text-base leading-7 text-text-secondary">{template.description}</p>
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Tags">
              {template.tags.map((tag) => (
                <li key={tag} className="rounded-full border border-border-default px-2.5 py-1 font-mono text-[11px] text-text-secondary">{tag}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={editorHref} rel="nofollow" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover">
              <PencilRuler size={16} aria-hidden="true" /> Open in editor
            </Link>
            <Link href="/templates" className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-card px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-panel">
              <ArrowLeft size={16} aria-hidden="true" /> All templates
            </Link>
          </div>
        </header>

        <figure className="overflow-hidden rounded-2xl border border-border-default bg-surface-panel">
          <div className="overflow-x-auto p-4 sm:p-6">
            <div className="min-w-[640px]">
              <TemplateDiagram slug={slug} alt={`${heading} diagram with ${components.length} components`} width={size?.width} height={size?.height} priority />
            </div>
          </div>
          <figcaption className="border-t border-border-default px-5 py-3 text-xs text-text-muted">
            {components.length} components · {connections.length} connections · Open it in the editor to move, restyle or extend it.
          </figcaption>
        </figure>

        <div className="grid gap-10 pt-14 lg:grid-cols-2">
          <section aria-labelledby="components-title">
            <h2 id="components-title" className="text-xl font-semibold tracking-[-.03em] text-text-primary">Components</h2>
            <ul className="mt-5 divide-y divide-border-default rounded-xl border border-border-default bg-surface-card">
              {components.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
                  <span className="text-sm font-medium text-text-primary">{c.label}</span>
                  {c.detail && <span className="text-right text-xs text-text-muted">{c.detail}</span>}
                </li>
              ))}
            </ul>
          </section>

          {connections.length > 0 && (
            <section aria-labelledby="flow-title">
              <h2 id="flow-title" className="text-xl font-semibold tracking-[-.03em] text-text-primary">How the parts connect</h2>
              <ol className="mt-5 divide-y divide-border-default rounded-xl border border-border-default bg-surface-card">
                {connections.map((c, i) => (
                  <li key={`${c.from}-${c.to}-${i}`} className="px-4 py-3 text-sm text-text-secondary">
                    <span className="font-medium text-text-primary">{c.from}</span>
                    <span aria-hidden="true"> → </span>
                    <span className="sr-only"> to </span>
                    <span className="font-medium text-text-primary">{c.to}</span>
                    {c.label && <span className="text-text-muted">: {c.label}</span>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {related.length > 0 && (
          <section aria-labelledby="related-title" className="pt-16">
            <h2 id="related-title" className="text-xl font-semibold tracking-[-.03em] text-text-primary">Related templates</h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-3">
              {related.map((t) => (
                <li key={t.id}>
                  <Link href={`/templates/${templateSlug(t)}`} className="group flex h-full flex-col rounded-xl border border-border-default bg-surface-card p-5 transition-colors hover:border-border-strong">
                    <span className="text-sm font-semibold text-text-primary">{templateHeading(t)}</span>
                    <span className="mt-2 line-clamp-2 text-xs leading-5 text-text-secondary">{t.description}</span>
                    <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-medium text-brand-text">
                      View template <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
