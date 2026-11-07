import { describe, expect, it } from 'vitest';
import { GLOSSARY, getGlossaryTerm } from '@/data/glossary/terms';
import { relatedTerms, templatesUsingTerm, termForComponent, tutorialsUsingTerm } from '@/lib/site/glossary';

describe('system design glossary', () => {
  it('has unique, URL-safe slugs and complete entries', () => {
    expect(new Set(GLOSSARY.map((t) => t.slug)).size).toBe(GLOSSARY.length);
    for (const t of GLOSSARY) {
      expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(t.summary.length).toBeLessThanOrEqual(160);
      expect(t.intro.length).toBeGreaterThanOrEqual(2);
      expect(t.howItWorks.length).toBeGreaterThanOrEqual(3);
      expect(t.whenToUse.length).toBeGreaterThanOrEqual(2);
      expect(t.tradeoffs.length).toBeGreaterThanOrEqual(2);
      expect(t.examples.length).toBeGreaterThanOrEqual(3);
      expect(t.faq.length).toBeGreaterThanOrEqual(2);
      expect(getGlossaryTerm(t.slug)).toBe(t);
    }
  });

  it('links every term to at least one template or tutorial', () => {
    for (const t of GLOSSARY) {
      expect(templatesUsingTerm(t).length + tutorialsUsingTerm(t).length, t.slug).toBeGreaterThan(0);
    }
  });

  it('classifies components by their name before their subtitle', () => {
    expect(termForComponent('API Gateway', 'Auth + routing')?.slug).toBe('api-gateway');
    expect(termForComponent('Auth Service', 'JWT')?.slug).toBe('authentication-service');
    expect(termForComponent('Message Queue', 'Activity events')?.slug).toBe('message-queue');
    expect(termForComponent('Event Bus', 'Kafka')?.slug).toBe('event-streaming');
    expect(termForComponent('NoSQL Database')?.slug).toBe('nosql-database');
    expect(termForComponent('SQL Database')?.slug).toBe('sql-database');
    expect(termForComponent('Database', 'Cassandra')?.slug).toBe('nosql-database');
    expect(termForComponent('In-Memory Cache', 'Sessions + presence')?.slug).toBe('cache');
    expect(termForComponent('Vector Database')?.slug).toBe('vector-database');
    expect(termForComponent('Search Service')).toBeUndefined();
  });

  it('suggests other terms, never the term itself', () => {
    for (const t of GLOSSARY) expect(relatedTerms(t).some((r) => r.slug === t.slug)).toBe(false);
  });
});
