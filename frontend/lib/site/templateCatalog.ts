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
const INTERVIEW_IDS = new Set(['ecommerce', 'url_shortener', 'chat_system', 'notification', 'search', 'request_response']);

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

/** The page heading: names already ending in "Architecture" keep it, others get "Architecture". */
export function templateHeading(template: Pick<Template, 'name'>): string {
  return /architecture$/i.test(template.name.trim()) ? template.name.trim() : `${template.name.trim()} Architecture`;
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
  const base = `${templateHeading(template)} diagram template: ${template.description}`;
  const full = `${base} Open it in ArchDraw and edit it free.`;
  if (full.length <= 160) return full;
  return base.length <= 160 ? base : `${base.slice(0, 157).replace(/\s+\S*$/, '')}…`;
}
