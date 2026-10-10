import { describe, expect, it } from 'vitest';
import { buildDiagramMermaid } from '../architectureDiagrams';

describe('buildDiagramMermaid parse validity', () => {
  it('produces graph syntax the mermaid engine accepts for every pattern', async () => {
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

    const briefs: Array<[string, string]> = [
      ['modular_monolith', 'A Next.js application serves a React interface and REST API. PostgreSQL stores users and canvases. Redis handles rate limiting. Background jobs send email and generate diagrams.'],
      ['microservices', 'Two independent services expose REST APIs and call each other across service boundaries. PostgreSQL stores data.'],
      ['event_driven', 'An ingestion API accepts thousands of events per second. It publishes each event to a durable queue. Independent workers validate, enrich, and store records in a data warehouse. Failed events go to a dead-letter queue and can be replayed.'],
      ['hybrid', 'A web app with a REST API calls a cache and a queue. Workers consume jobs from the queue and write to PostgreSQL.'],
    ];

    for (const [pattern, brief] of briefs) {
      const code = buildDiagramMermaid(brief, pattern);
      await expect(mermaid.parse(code)).resolves.toMatchObject({ diagramType: 'flowchart-v2' });
    }
  });
});