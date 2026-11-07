import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@/data/templates/index';
import { TEMPLATE_GUIDES } from '@/data/templates/guides';
import { templateComponents } from '@/lib/site/templateCatalog';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe('template guides', () => {
  for (const [id, guide] of Object.entries(TEMPLATE_GUIDES)) {
    it(`${id}: belongs to a template and is complete`, () => {
      const template = TEMPLATES.find((t) => t.id === id);
      expect(template, `no template "${id}"`).toBeDefined();
      expect(guide.overview.length).toBeGreaterThanOrEqual(2);
      expect(guide.flows.length).toBeGreaterThanOrEqual(1);
      expect(guide.flows.every((f) => f.steps.length >= 2)).toBe(true);
      expect(guide.decisions.length).toBeGreaterThanOrEqual(3);
      expect(guide.scaling.length).toBeGreaterThanOrEqual(3);
      expect(guide.faq.length).toBeGreaterThanOrEqual(3);
      const all = [
        ...guide.overview,
        ...guide.flows.flatMap((f) => [f.title, ...f.steps]),
        ...guide.decisions.flatMap((d) => [d.title, d.body]),
        ...guide.scaling,
        ...guide.faq.flatMap((f) => [f.question, f.answer]),
      ];
      expect(words(all.join(' '))).toBeGreaterThan(350);
      // Written against this template's diagram: most of its components are named in the guide.
      const text = all.join(' ').toLowerCase();
      const names = templateComponents(template!).map((c) => c.label.toLowerCase().replace(/\s*\(.*\)$/, ''));
      const named = names.filter((n) => text.includes(n.split(' ')[0]));
      expect(named.length / names.length).toBeGreaterThan(0.6);
    });
  }
});
