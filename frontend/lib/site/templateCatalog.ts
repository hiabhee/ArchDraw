import type { Edge, Node } from 'reactflow';
import { TEMPLATES, type Template } from '@/data/templates/index';

/**
 * The public template gallery (`/templates`, `/templates/<slug>`): readable URLs for the
 * editor's built-in templates and the text each page shows about its diagram. Pure: no
 * layout or rendering here (that is `lib/server/templatePreview.ts`).
 */

export type TemplateSection = 'systems' | 'patterns' | 'interview';

export const TEMPLATE_SECTIONS: Array<{ id: TemplateSection; title: string; blurb: string }> = [
  { id: 'systems', title: 'Real-world systems', blurb: 'How well-known products are put together, from AI chat to video streaming and payments.' },
  { id: 'patterns', title: 'Architecture patterns', blurb: 'The structural patterns behind most backends: layers, ports and adapters, events and CQRS.' },
  { id: 'interview', title: 'System design interview classics', blurb: 'The questions that come up in system design interviews, drawn as a starting point.' },
];

const PATTERN_IDS = new Set(['mvc', 'clean_architecture', 'hexagonal', 'layered', 'microservices', 'event_driven', 'cqrs', 'event_sourcing', 'serverless']);
const INTERVIEW_IDS = new Set(['ecommerce', 'url_shortener', 'chat_system', 'notification', 'search', 'request_response', 'rate_limiter']);

export function sectionFor(template: Template): TemplateSection {
  if (PATTERN_IDS.has(template.id)) return 'patterns';
  if (INTERVIEW_IDS.has(template.id)) return 'interview';
  return 'systems';
}

/** `event_driven` → `event-driven`: hyphenated, lowercase, stable (derived from the template id). */
export function templateSlug(template: Pick<Template, 'id'>): string {
  return template.id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function allTemplateSlugs(): string[] {
  return TEMPLATES.map(templateSlug);
}

export function getTemplateBySlug(slug: string): Template | undefined {
  return TEMPLATES.find((t) => templateSlug(t) === slug);
}

/**
 * Search-facing names where the template's own name is not what people search for
 * (the editor keeps the original names).
 */
const SUBJECT_OVERRIDES: Record<string, string> = {
  netflix: 'Netflix',
  rideshare: 'Uber Ride-Sharing',
  fintech_payments: 'Payment System',
  collaborative_docs: 'Google Docs-Style Editor',
  food_delivery: 'Food Delivery App',
  repo_to_diagram: 'Repo-to-Diagram Pipeline',
};

/** The system a template shows, as people search for it: "ChatGPT-like Architecture" → "ChatGPT". */
export function templateSubject(template: Pick<Template, 'id' | 'name'>): string {
  return (
    SUBJECT_OVERRIDES[template.id] ??
    template.name.trim().replace(/-like\b/i, '').replace(/\s+architecture$/i, '').trim()
  );
}

/**
 * The page heading and title. Template pages own the "<system> architecture diagram"
 * searches; tutorials own "<system> system design" (`lib/tutorial/tutorialArticle.ts`).
 */
export function templateHeading(template: Pick<Template, 'id' | 'name'>): string {
  return `${templateSubject(template)} Architecture Diagram`;
}

/** Templates that show a typical design for a named product, and that product. */
const REPRESENTED_PRODUCTS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude_code: 'Claude Code',
  instagram: 'Instagram',
  netflix: 'Netflix',
  rideshare: 'Uber',
  collaborative_docs: 'Google Docs',
  whatsapp: 'WhatsApp',
  twitter: 'Twitter',
  airbnb: 'Airbnb',
  discord: 'Discord',
  zoom: 'Zoom',
  spotify: 'Spotify',
  linkedin: 'LinkedIn',
  figma: 'Figma',
  github: 'GitHub',
};

/**
 * The named product a template sketches, if any. Its page says the design is drawn from
 * public information, so a "ChatGPT architecture diagram" is not read as OpenAI's own.
 */
export function representedProduct(template: Pick<Template, 'id'>): string | undefined {
  return REPRESENTED_PRODUCTS[template.id];
}

/**
 * The system design tutorials that teach each template's system, best match first.
 * Templates point readers here for "how to design X"; tutorials point back for the diagram.
 */
export const TEMPLATE_TUTORIALS: Record<string, string[]> = {
  chatgpt: ['chatgpt-architecture', 'rag-application-architecture'],
  claude_code: ['ai-agent-system-architecture', 'openclaw-architecture'],
  instagram: ['instagram-architecture'],
  video_streaming: ['youtube-architecture'],
  netflix: ['netflix-architecture'],
  rideshare: ['uber-architecture'],
  fintech_payments: ['stripe-architecture'],
  collaborative_docs: ['notion-architecture', 'figma-architecture'],
  food_delivery: ['doordash-architecture'],
  ecommerce: ['shopify-architecture'],
  url_shortener: ['url-shortener-architecture'],
  whatsapp: ['whatsapp-architecture'],
  twitter: ['twitter-architecture'],
  airbnb: ['airbnb-architecture'],
  discord: ['discord-architecture'],
  zoom: ['zoom-architecture'],
  spotify: ['spotify-architecture'],
  linkedin: ['linkedin-architecture'],
  figma: ['figma-architecture'],
  github: ['github-architecture'],
  rate_limiter: ['rate-limiter-architecture'],
  // After the dedicated WhatsApp / Discord templates, which those tutorials link back to.
  chat_system: ['whatsapp-architecture', 'discord-architecture'],
};

export function tutorialIdsForTemplate(template: Pick<Template, 'id'>): string[] {
  return TEMPLATE_TUTORIALS[template.id] ?? [];
}

/** The template whose diagram a tutorial builds (its best match), if any. */
export function templateForTutorial(tutorialId: string): Template | undefined {
  // A template built for this tutorial's system (listed first) wins over one that also covers it.
  const entries = Object.entries(TEMPLATE_TUTORIALS);
  const entry = entries.find(([, ids]) => ids[0] === tutorialId) ?? entries.find(([, ids]) => ids.includes(tutorialId));
  return entry ? TEMPLATES.find((t) => t.id === entry[0]) : undefined;
}

export interface TemplateComponent {
  id: string;
  label: string;
  detail?: string;
}

export interface TemplateConnection {
  from: string;
  to: string;
  label?: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim() : '';
}

/** The diagram's components (groups and decoration left out), in template order. */
export function templateComponents(template: { nodes: Node[] }): TemplateComponent[] {
  return template.nodes
    .filter((n) => n.type !== 'groupNode' && text(n.data?.label))
    .map((n) => ({ id: n.id, label: text(n.data?.label), detail: text(n.data?.subtitle) || undefined }));
}

/** Its connections, by component name. */
export function templateConnections(template: { nodes: Node[]; edges: Edge[] }): TemplateConnection[] {
  const names = new Map(template.nodes.map((n) => [n.id, text(n.data?.label)]));
  return template.edges
    .map((e) => ({ from: names.get(e.source) ?? '', to: names.get(e.target) ?? '', label: text(e.data?.label ?? e.label) || undefined }))
    .filter((c) => c.from && c.to);
}

/** Up to `limit` other templates, most shared tags first, then the same section. */
export function relatedTemplates(template: Template, limit = 3): Template[] {
  const tags = new Set(template.tags.map((t) => t.toLowerCase()));
  const section = sectionFor(template);
  return TEMPLATES.filter((t) => t.id !== template.id)
    .map((t, index) => ({
      t,
      index,
      score: t.tags.filter((tag) => tags.has(tag.toLowerCase())).length * 2 + (sectionFor(t) === section ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ t }) => t);
}

/** Meta description: the template's own text, trimmed to what search results show. */
export function templateMetaDescription(template: Template): string {
  const base = `${templateHeading(template)}: ${template.description}`;
  const full = `${base} Free, editable template.`;
  if (full.length <= 160) return full;
  return base.length <= 160 ? base : `${base.slice(0, 157).replace(/\s+\S*$/, '')}…`;
}
