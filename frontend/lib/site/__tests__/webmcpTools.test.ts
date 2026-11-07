import { describe, expect, it, vi } from 'vitest';
import { createWebMcpTools, searchItems, SITE_PAGES, type SiteCatalog } from '@/lib/site/webmcpTools';
import { GET } from '@/app/catalog.json/route';
import { TEMPLATES } from '@/data/templates/index';
import { TUTORIALS } from '@/data/tutorials';

async function setup() {
  const catalog = (await GET().json()) as SiteCatalog;
  const navigate = vi.fn();
  const tools = createWebMcpTools({ loadCatalog: async () => catalog, navigate });
  const tool = (name: string) => tools.find((t) => t.name === name)!;
  return { catalog, navigate, tools, tool };
}

describe('WebMCP tools', () => {
  it('serves every template and tutorial in the catalog', async () => {
    const { catalog } = await setup();
    expect(catalog.templates).toHaveLength(TEMPLATES.length);
    expect(catalog.tutorials).toHaveLength(TUTORIALS.length);
    expect(catalog.templates.every((t) => /^https?:\/\/[^/]+\/templates\/[a-z0-9-]+$/.test(t.url) && t.id)).toBe(true);
    expect(catalog.tutorials.every((t) => /\/tutorials\/[a-z0-9-]+$/.test(t.url))).toBe(true);
  });

  it('registers distinct, described tools with object input schemas', async () => {
    const { tools } = await setup();
    expect(new Set(tools.map((t) => t.name)).size).toBe(tools.length);
    for (const t of tools) {
      expect(t.name).toMatch(/^[a-z_]+$/);
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.inputSchema.type).toBe('object');
    }
  });

  it('searches templates and tutorials by every word of the query', async () => {
    const { tool } = await setup();
    const templates = JSON.parse(await tool('search_architecture_templates').execute({ query: 'event driven' }));
    expect(templates.templates.map((t: { id: string }) => t.id)).toContain('event_driven');
    const tutorials = JSON.parse(await tool('search_system_design_tutorials').execute({ query: 'chatgpt' }));
    expect(tutorials.tutorials[0].id).toBe('chatgpt-architecture');
    expect(JSON.parse(await tool('search_architecture_templates').execute({})).count).toBeGreaterThan(0);
    expect(searchItems([{ a: 'x' }], 'nomatch', (i) => [i.a])).toEqual([]);
  });

  it('only navigates to same-site paths it builds itself', async () => {
    const { tool, navigate } = await setup();
    await tool('open_template_in_editor').execute({ templateId: 'microservices' });
    expect(navigate).toHaveBeenLastCalledWith('/editor?template=microservices');
    expect(await tool('open_template_in_editor').execute({ templateId: 'nope' })).toMatch(/No template/);

    await tool('generate_architecture_diagram').execute({ description: 'a chat app & push' });
    expect(navigate).toHaveBeenLastCalledWith('/editor?generate=a%20chat%20app%20%26%20push');
    expect(await tool('generate_architecture_diagram').execute({ description: '  ' })).toMatch(/description/);

    await tool('open_archdraw_page').execute({ page: 'pricing' });
    expect(navigate).toHaveBeenLastCalledWith('/pricing');
    expect(await tool('open_archdraw_page').execute({ page: 'https://evil.example' })).toMatch(/Unknown page/);
    expect(Object.values(SITE_PAGES).every((p) => p.startsWith('/'))).toBe(true);
    expect(navigate.mock.calls.every(([p]) => typeof p === 'string' && p.startsWith('/'))).toBe(true);
  });
});
