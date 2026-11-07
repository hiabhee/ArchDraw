import Link from 'next/link';
import { ArrowRight, ArrowUp, Network } from 'lucide-react';
import { TUTORIALS, type AnyTutorial } from '@/data/tutorials';
import { templateForTutorial, templateHeading, templateSlug } from '@/lib/site/templateCatalog';
import { absoluteUrl, breadcrumbJsonLd } from '@/lib/site/seo';
import { termForComponent } from '@/lib/site/glossary';
import {
  articleComponentCount,
  tutorialArticle,
  tutorialHeading,
  tutorialSubject,
} from '@/lib/tutorial/tutorialArticle';

const DIFFICULTY_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;

/** Other tutorials, most shared tags first, then curated order. */
function relatedTutorials(tutorial: AnyTutorial, limit = 3): AnyTutorial[] {
  const tags = new Set((tutorial.tags ?? []).map((t) => t.toLowerCase()));
  return TUTORIALS.filter((t) => t.id !== tutorial.id)
    .map((t, index) => ({ t, index, score: (t.tags ?? []).filter((tag) => tags.has(tag.toLowerCase())).length }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ t }) => t);
}

/**
 * The tutorial as a written guide, rendered on the server below the interactive canvas:
 * every level and component with its explanation, so the page carries the lesson itself
 * (the canvas is client-only). Links to the matching architecture diagram template.
 */
export function TutorialArticle({ tutorial }: { tutorial: AnyTutorial }) {
  const levels = tutorialArticle(tutorial);
  const heading = tutorialHeading(tutorial);
  const subject = tutorialSubject(tutorial);
  const template = templateForTutorial(tutorial.id);
  const related = relatedTutorials(tutorial);
  const path = `/tutorials/${tutorial.id}`;
  const url = absoluteUrl(path);
  const concepts = [...new Map(levels.flatMap((l) => l.components).flatMap((c) => {
    const term = termForComponent(c.name);
    return term ? [[term.slug, term] as const] : [];
  })).values()];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['TechArticle', 'LearningResource'],
        '@id': `${url}#guide`,
        headline: heading,
        name: tutorial.title,
        description: tutorial.description,
        url,
        image: absoluteUrl(`/api/og/tutorial/${tutorial.id}`),
        about: ['System design', `${subject} architecture`, ...(tutorial.tags ?? [])],
        keywords: [`${subject} system design`, `how to design ${subject}`, 'system design tutorial', ...(tutorial.tags ?? [])].join(', '),
        learningResourceType: 'Tutorial',
        educationalLevel: DIFFICULTY_LABEL[tutorial.difficulty],
        timeRequired: `PT${tutorial.estimatedMinutes}M`,
        isAccessibleForFree: true,
        inLanguage: 'en-US',
        author: { '@id': `${absoluteUrl('/')}#organization` },
        publisher: { '@id': `${absoluteUrl('/')}#organization` },
      },
      breadcrumbJsonLd([['System design tutorials', '/tutorials'], [heading, path]]),
    ],
  };

  return (
    <article aria-labelledby="guide-title" className="border-t border-border-default bg-surface-page text-text-primary">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-16 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-text-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="transition-colors hover:text-text-primary">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/tutorials" className="transition-colors hover:text-text-primary">System design tutorials</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-text-secondary">{heading}</li>
          </ol>
        </nav>

        <header>
          <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-brand-text">
            System design tutorial · {DIFFICULTY_LABEL[tutorial.difficulty]} · {tutorial.estimatedMinutes} min
          </p>
          <h1 id="guide-title" className="text-[clamp(2rem,4.5vw,3rem)] font-semibold leading-[1.05] tracking-[-.04em]">{heading}</h1>
          <p className="mt-4 text-lg leading-8 text-text-secondary">
            How to design {subject} architecture, step by step. {tutorial.description}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#tutorial-app" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover">
              <ArrowUp size={16} aria-hidden="true" /> Build it in the interactive tutorial
            </a>
            {template && (
              <Link href={`/templates/${templateSlug(template)}`} className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-card px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-panel">
                <Network size={16} aria-hidden="true" /> See the {templateHeading(template)}
              </Link>
            )}
          </div>
        </header>

        <section aria-labelledby="outline-title" className="mt-12 rounded-xl border border-border-default bg-surface-card p-5">
          <h2 id="outline-title" className="text-base font-semibold">What you will design</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {articleComponentCount(levels)} components in {levels.length} {levels.length === 1 ? 'stage' : 'stages'}, from a working system to production scale.
          </p>
          <ol className="mt-4 space-y-1.5 text-sm">
            {levels.map((level, i) => (
              <li key={level.id}>
                <a href={`#${level.id}`} className="text-text-primary transition-colors hover:text-brand-text">
                  {i + 1}. {level.title}
                </a>
                <span className="text-text-muted"> · {level.components.map((c) => c.name).join(', ')}</span>
              </li>
            ))}
          </ol>
        </section>

        {concepts.length > 0 && (
          <nav aria-label="Concepts in this design" className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-text-muted">Concepts in this design</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {concepts.map((t) => (
                <li key={t.slug}>
                  <Link href={`/system-design/${t.slug}`} className="inline-block rounded-full border border-border-default px-3 py-1 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">{t.name}</Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {levels.map((level, i) => (
          <section key={level.id} id={level.id} aria-labelledby={`${level.id}-title`} className="mt-14 scroll-mt-20">
            <h2 id={`${level.id}-title`} className="text-2xl font-semibold tracking-[-.03em]">
              Step {i + 1}: {level.title}
            </h2>
            {level.intro && <p className="mt-3 leading-7 text-text-secondary">{level.intro}</p>}
            <div className="mt-6 space-y-8">
              {level.components.map((c) => (
                <div key={c.name}>
                  <h3 className="text-lg font-semibold">{c.name}</h3>
                  <p className="mt-2 leading-7 text-text-secondary">{c.body}</p>
                  {c.whyItMatters && (
                    <p className="mt-2 leading-7 text-text-secondary"><strong className="font-semibold text-text-primary">Why it matters:</strong> {c.whyItMatters}</p>
                  )}
                  {c.tradeoff && (
                    <p className="mt-2 leading-7 text-text-secondary"><strong className="font-semibold text-text-primary">Trade-off:</strong> {c.tradeoff}</p>
                  )}
                  {c.connectsFrom.length > 0 && (
                    <p className="mt-2 text-sm text-text-muted">Receives traffic from {c.connectsFrom.join(', ')}.</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        <section aria-labelledby="next-title" className="mt-16 border-t border-border-default pt-10">
          <h2 id="next-title" className="text-xl font-semibold tracking-[-.03em]">Keep learning system design</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {related.map((t) => (
              <li key={t.id}>
                <Link href={`/tutorials/${t.id}`} className="group flex h-full flex-col rounded-xl border border-border-default bg-surface-card p-4 transition-colors hover:border-border-strong">
                  <span className="text-sm font-semibold text-text-primary">{tutorialHeading(t)}</span>
                  <span className="mt-2 line-clamp-2 text-xs leading-5 text-text-secondary">{t.description}</span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-medium text-brand-text">
                    Start tutorial <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-text-secondary">
            Browse all <Link href="/tutorials" className="font-medium text-brand-text hover:underline">system design tutorials</Link>, or start from one of the{' '}
            <Link href="/templates" className="font-medium text-brand-text hover:underline">architecture diagram templates</Link>.
          </p>
        </section>
      </div>
    </article>
  );
}
