import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@/data/templates/index';
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
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/site/seo';
import { SITE_URL } from '@/lib/site/discovery';

describe('template catalog', () => {
  it('gives every template a unique, URL-safe slug that resolves back to it', () => {
    const slugs = allTemplateSlugs();
    expect(new Set(slugs).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) {
      const slug = templateSlug(t);
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(getTemplateBySlug(slug)?.id).toBe(t.id);
    }
    expect(templateSlug({ id: 'event_driven' })).toBe('event-driven');
    expect(getTemplateBySlug('missing')).toBeUndefined();
  });

  it('does not repeat "architecture" in headings', () => {
    expect(templateHeading({ name: 'Netflix Architecture' })).toBe('Netflix Architecture');
    expect(templateHeading({ name: 'URL Shortener' })).toBe('URL Shortener Architecture');
  });

  it('lists components and named connections for every template', () => {
    for (const t of TEMPLATES) {
      const components = templateComponents(t);
      expect(components.length).toBeGreaterThan(0);
      expect(components.every((c) => c.label && !/<br/i.test(c.label))).toBe(true);
      const names = new Set(components.map((c) => c.label));
      for (const c of templateConnections(t)) {
        expect(names.has(c.from) && names.has(c.to)).toBe(true);
      }
    }
  });

  it('keeps meta descriptions within what search results show', () => {
    for (const t of TEMPLATES) expect(templateMetaDescription(t).length).toBeLessThanOrEqual(160);
  });

  it('suggests other templates, never the template itself', () => {
    for (const t of TEMPLATES) {
      const related = relatedTemplates(t);
      expect(related).toHaveLength(3);
      expect(related.some((r) => r.id === t.id)).toBe(false);
    }
  });
});

describe('page metadata', () => {
  it('sets a canonical, og:url and social title for the page itself', () => {
    const meta = pageMetadata({ title: 'Pricing', description: 'd', path: '/pricing' });
    expect(meta.title).toBe('Pricing');
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/pricing`);
    expect((meta.openGraph as { url?: string }).url).toBe(`${SITE_URL}/pricing`);
    expect((meta.openGraph as { title?: string }).title).toBe('Pricing — ArchDraw');
    expect(meta.robots).toBeUndefined();
    expect(pageMetadata({ title: 'x', description: 'd', path: '/x', noIndex: true }).robots).toEqual({ index: false, follow: false });
  });

  it('builds absolute URLs and breadcrumbs from Home', () => {
    expect(absoluteUrl('/')).toBe(`${SITE_URL}/`);
    expect(absoluteUrl('docs')).toBe(`${SITE_URL}/docs`);
    const crumbs = breadcrumbJsonLd([['Templates', '/templates']]);
    expect(crumbs.itemListElement.map((i) => i.name)).toEqual(['Home', 'Templates']);
    expect(crumbs.itemListElement[1]).toMatchObject({ position: 2, item: `${SITE_URL}/templates` });
  });
});
