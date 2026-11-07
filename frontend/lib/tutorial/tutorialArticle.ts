import type { TutorialDefinition, TutorialStep } from './schema';

/**
 * The written version of a tutorial, rendered on the server under the interactive
 * canvas (`components/tutorial/TutorialArticle.tsx`) so search engines and readers get
 * the full lesson, not just the app shell. Pure: built from the tutorial definition.
 *
 * Tutorials own the "<system> system design" / "how to design <system>" searches;
 * template pages own "<system> architecture diagram" (`lib/site/templateCatalog.ts`).
 */

export interface ArticleComponent {
  name: string;
  body: string;
  whyItMatters?: string;
  tradeoff?: string;
  connectsFrom: string[];
}

export interface ArticleLevel {
  id: string;
  title: string;
  intro?: string;
  components: ArticleComponent[];
}

/** "How to Design ChatGPT Architecture" → "ChatGPT"; "How to Design a Rate Limiter" → "Rate Limiter". */
export function tutorialSubject(tutorial: Pick<TutorialDefinition, 'title'>): string {
  return tutorial.title
    .trim()
    .replace(/^how to (design|build)\s+/i, '')
    .replace(/^(a|an|the)\s+/i, '')
    .replace(/\s+architecture$/i, '')
    .trim();
}

/** "ChatGPT System Design"; a subject already ending in "System" is not doubled ("AI Agent System Design"). */
export function tutorialHeading(tutorial: Pick<TutorialDefinition, 'title'>): string {
  const subject = tutorialSubject(tutorial);
  return /\bsystem$/i.test(subject) ? `${subject} Design` : `${subject} System Design`;
}

export function tutorialMetaTitle(tutorial: Pick<TutorialDefinition, 'title'>): string {
  return `${tutorialHeading(tutorial)}: Step-by-Step Tutorial`;
}

/** Meta description that leads with the search phrase, trimmed to what results show. */
export function tutorialMetaDescription(tutorial: Pick<TutorialDefinition, 'title' | 'description'>): string {
  const full = `Learn ${tutorialHeading(tutorial)} step by step. ${tutorial.description}`;
  return full.length <= 160 ? full : `${full.slice(0, 157).replace(/\s+\S*$/, '')}…`;
}

/** Display name; a few authored names carry the step verb ("Add Guild Service"). */
function displayName(name: string): string {
  return name.replace(/^add\s+/i, '');
}

function componentName(step: TutorialStep): string {
  return displayName(step.component ?? step.title);
}

/** A level's opening line, when its first step sets the scene (not "Level 2: Step 1"). */
function levelIntro(levelDescription: string | undefined, first: TutorialStep | undefined): string | undefined {
  if (levelDescription) return levelDescription;
  const context = first?.phases.context;
  if (!context || /step\s*\d/i.test(context.heading)) return undefined;
  return context.body;
}

export function tutorialArticle(tutorial: TutorialDefinition): ArticleLevel[] {
  return tutorial.levels.map((level) => ({
    id: level.id,
    title: level.title,
    intro: levelIntro(level.description, level.steps[0]),
    components: level.steps.map((step) => ({
      name: componentName(step),
      body: step.phases.teaching.body,
      whyItMatters: step.phases.teaching.whyItMatters,
      tradeoff: step.phases.teaching.tradeoff,
      connectsFrom: (step.connectsFrom ?? []).map(displayName),
    })),
  }));
}

export function articleComponentCount(levels: ArticleLevel[]): number {
  return new Set(levels.flatMap((l) => l.components.map((c) => c.name))).size;
}
