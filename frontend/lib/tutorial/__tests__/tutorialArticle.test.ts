import { describe, expect, it } from 'vitest';
import { TUTORIALS } from '@/data/tutorials';
import {
  articleComponentCount,
  tutorialArticle,
  tutorialHeading,
  tutorialMetaDescription,
  tutorialMetaTitle,
  tutorialSubject,
} from '@/lib/tutorial/tutorialArticle';

describe('tutorial article', () => {
  it('names each tutorial "<system> System Design"', () => {
    expect(tutorialSubject({ title: 'How to Design ChatGPT Architecture' })).toBe('ChatGPT');
    expect(tutorialSubject({ title: 'How to Design a Rate Limiter' })).toBe('Rate Limiter');
    expect(tutorialHeading({ title: 'How to Design ChatGPT Architecture' })).toBe('ChatGPT System Design');
    expect(tutorialHeading({ title: 'How to Design AI Agent System Architecture' })).toBe('AI Agent System Design');
    for (const t of TUTORIALS) {
      expect(tutorialHeading(t)).toMatch(/^\S.* System Design$/);
      expect(tutorialHeading(t)).not.toMatch(/system system/i);
      expect(tutorialMetaTitle(t).length).toBeLessThanOrEqual(60);
      expect(tutorialMetaDescription(t).length).toBeLessThanOrEqual(160);
    }
  });

  it('writes out every step of every tutorial with its explanation', () => {
    for (const t of TUTORIALS) {
      const levels = tutorialArticle(t);
      expect(levels).toHaveLength(t.levels.length);
      const components = levels.flatMap((l) => l.components);
      expect(components).toHaveLength(t.levels.reduce((n, l) => n + l.steps.length, 0));
      expect(components.every((c) => c.name && !/^add /i.test(c.name) && c.body.length > 20)).toBe(true);
      expect(articleComponentCount(levels)).toBeGreaterThan(3);
    }
  });

  it('records where each component connects from', () => {
    const chatgpt = tutorialArticle(TUTORIALS.find((t) => t.id === 'chatgpt-architecture')!);
    const cdn = chatgpt[0].components.find((c) => c.name === 'CDN');
    expect(cdn?.connectsFrom).toEqual(['Mobile Client', 'Web Client']);
    expect(chatgpt[0].intro).toMatch(/ChatGPT/);
  });
});
