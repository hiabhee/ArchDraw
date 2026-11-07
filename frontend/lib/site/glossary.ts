import { GLOSSARY, type GlossaryTerm } from '@/data/glossary/terms';
import { TEMPLATES, type Template } from '@/data/templates/index';
import { TUTORIALS, type AnyTutorial } from '@/data/tutorials';
import { templateComponents } from '@/lib/site/templateCatalog';

/**
 * Which glossary term (`data/glossary/terms.ts`) a component is, and which templates and
 * tutorials use each term. A component's name decides first ("API Gateway (Auth +
 * routing)" is an API gateway, not an auth service); its subtitle is the fallback.
 */

/** Specific terms before general ones, since several patterns can match one name. */
const PRIORITY = [
  'vector-database', 'search-index', 'rate-limiting', 'api-gateway', 'load-balancer', 'cdn', 'dns', 'websocket',
  'crdt', 'presence', 'webhooks', 'event-streaming', 'message-queue', 'cache', 'nosql-database', 'sql-database',
  'object-storage', 'data-warehouse', 'background-jobs', 'authentication-service',
];
const ORDERED: GlossaryTerm[] = [
  ...PRIORITY.flatMap((slug) => GLOSSARY.find((t) => t.slug === slug) ?? []),
  ...GLOSSARY.filter((t) => !PRIORITY.includes(t.slug)),
];

export function termForComponent(label: string, detail?: string): GlossaryTerm | undefined {
  const name = label.toLowerCase();
  const full = `${name} ${detail ?? ''}`.toLowerCase();
  return ORDERED.find((t) => t.match.test(name)) ?? ORDERED.find((t) => t.match.test(full));
}

export function templatesUsingTerm(term: GlossaryTerm): Template[] {
  return TEMPLATES.filter((t) => templateComponents(t).some((c) => termForComponent(c.label, c.detail)?.slug === term.slug));
}

export function tutorialsUsingTerm(term: GlossaryTerm): AnyTutorial[] {
  return TUTORIALS.filter((t) =>
    t.levels.some((l) => l.steps.some((s) => termForComponent((s.component ?? s.title).replace(/^add\s+/i, ''))?.slug === term.slug)),
  );
}

/** Other terms that appear in the same templates, most shared first. */
export function relatedTerms(term: GlossaryTerm, limit = 6): GlossaryTerm[] {
  const mine = new Set(templatesUsingTerm(term).map((t) => t.id));
  return GLOSSARY.filter((t) => t.slug !== term.slug)
    .map((t, index) => ({ t, index, shared: templatesUsingTerm(t).filter((x) => mine.has(x.id)).length }))
    .sort((a, b) => b.shared - a.shared || a.index - b.index)
    .slice(0, limit)
    .map(({ t }) => t);
}
