/**
 * The tools ArchDraw registers with WebMCP (`document.modelContext.registerTool`), so an
 * AI agent in the browser can find templates and tutorials, open pages and start a
 * diagram without clicking through the UI. Pure: the browser parts (fetching the
 * catalog, navigating) come in as `deps`; `components/providers/WebMcpTools.tsx`
 * registers them. Lighthouse "Agentic Browsing" lists what is registered.
 */

export interface CatalogTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  url: string;
}

export interface CatalogTutorial {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  minutes: number;
  tags: string[];
  url: string;
}

export interface SiteCatalog {
  templates: CatalogTemplate[];
  tutorials: CatalogTutorial[];
}

export interface WebMcpToolDeps {
  loadCatalog: () => Promise<SiteCatalog>;
  /** Full-page navigation to a same-site path. */
  navigate: (path: string) => void;
}

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<string>;
}

/** Public pages an agent can open by name. */
export const SITE_PAGES: Record<string, string> = {
  home: '/',
  templates: '/templates',
  tutorials: '/tutorials',
  'system-design-concepts': '/system-design',
  'free-diagram-generator': '/free-diagram-generator',
  'architecture-diagram-generator': '/free-architecture-diagram-generator',
  'system-design-calculator': '/system-design-calculator',
  compare: '/alternatives',
  editor: '/editor',
  docs: '/docs',
  'connect-agents': '/docs/connect-agents',
  mcp: '/mcp',
  'repo-diagram': '/repo-diagram',
  pricing: '/pricing',
  faq: '/faq',
  blog: '/blogs',
  about: '/about',
  contact: '/contact',
};

const MAX_RESULTS = 10;
const MAX_DESCRIPTION = 2000;

/** Items matching every word of the query in any of the given fields; all items when the query is empty. */
export function searchItems<T>(items: T[], query: unknown, fields: (item: T) => string[]): T[] {
  const words = typeof query === 'string' ? query.toLowerCase().split(/\s+/).filter(Boolean) : [];
  if (!words.length) return items.slice(0, MAX_RESULTS);
  return items
    .map((item) => {
      const text = fields(item).join(' ').toLowerCase();
      return { item, hits: words.filter((w) => text.includes(w)).length };
    })
    .filter((r) => r.hits === words.length)
    .slice(0, MAX_RESULTS)
    .map((r) => r.item);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function createWebMcpTools(deps: WebMcpToolDeps): WebMcpTool[] {
  return [
    {
      name: 'search_architecture_templates',
      description:
        'Search ArchDraw\'s free architecture diagram templates (ChatGPT, Netflix, Uber, microservices, event-driven, CQRS, URL shortener and more). Returns each match\'s name, description, tags, page URL and id. Leave query empty to list them.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Words to match, e.g. "payments" or "event driven". Optional.' } },
      },
      annotations: { readOnlyHint: true },
      async execute({ query }) {
        const { templates } = await deps.loadCatalog();
        const found = searchItems(templates, query, (t) => [t.name, t.description, t.id, ...t.tags]);
        return JSON.stringify({ count: found.length, templates: found });
      },
    },
    {
      name: 'search_system_design_tutorials',
      description:
        'Search ArchDraw\'s free, interactive system design tutorials (how to design ChatGPT, WhatsApp, Netflix, Uber, a rate limiter and more). Returns title, difficulty, minutes and page URL. Leave query empty to list them.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Words to match, e.g. "chat" or "rate limiter". Optional.' } },
      },
      annotations: { readOnlyHint: true },
      async execute({ query }) {
        const { tutorials } = await deps.loadCatalog();
        const found = searchItems(tutorials, query, (t) => [t.title, t.description, t.id, ...t.tags]);
        return JSON.stringify({ count: found.length, tutorials: found });
      },
    },
    {
      name: 'open_template_in_editor',
      description: 'Open one of the architecture diagram templates in the ArchDraw editor, where it can be edited and exported. Use an id from search_architecture_templates.',
      inputSchema: {
        type: 'object',
        properties: { templateId: { type: 'string', description: 'Template id, e.g. "microservices" or "chatgpt".' } },
        required: ['templateId'],
      },
      async execute({ templateId }) {
        const id = text(templateId);
        const { templates } = await deps.loadCatalog();
        const template = templates.find((t) => t.id === id);
        if (!template) {
          return `No template with id "${id}". Ids: ${templates.map((t) => t.id).join(', ')}.`;
        }
        deps.navigate(`/editor?template=${encodeURIComponent(template.id)}`);
        return `Opening ${template.name} in the editor.`;
      },
    },
    {
      name: 'generate_architecture_diagram',
      description:
        'Draw a new architecture diagram from a description of a system, or from a public GitHub repository URL, in the ArchDraw editor. The AI generation counts toward the visitor\'s free quota.',
      inputSchema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'What to draw, e.g. "a food delivery app with ordering, courier dispatch and payments", or a GitHub repo URL.',
          },
        },
        required: ['description'],
      },
      async execute({ description }) {
        const prompt = text(description).slice(0, MAX_DESCRIPTION);
        if (!prompt) return 'Give a description of the system to draw.';
        deps.navigate(`/editor?generate=${encodeURIComponent(prompt)}`);
        return 'Opening the editor and generating the diagram.';
      },
    },
    {
      name: 'open_archdraw_page',
      description: `Open a page of the ArchDraw site: ${Object.keys(SITE_PAGES).join(', ')}.`,
      inputSchema: {
        type: 'object',
        properties: { page: { type: 'string', enum: Object.keys(SITE_PAGES), description: 'Which page to open.' } },
        required: ['page'],
      },
      async execute({ page }) {
        const path = SITE_PAGES[text(page)];
        if (!path) return `Unknown page. Pages: ${Object.keys(SITE_PAGES).join(', ')}.`;
        deps.navigate(path);
        return `Opening ${path}.`;
      },
    },
  ];
}
