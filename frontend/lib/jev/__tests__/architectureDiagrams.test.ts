import { describe, expect, it } from 'vitest';
import { buildDiagramMermaid } from '../architectureDiagrams';

const productCore =
  'A Next.js application serves a React interface and REST API. PostgreSQL stores users and canvases. ' +
  'Redis handles rate limiting. Background jobs send email and generate diagrams.';

const eventPipeline =
  'An ingestion API accepts thousands of events per second. It publishes each event to a durable queue. ' +
  'Independent workers validate, enrich, and store records in a data warehouse.';

describe('buildDiagramMermaid', () => {
  it('draws a modular monolith as one app box wrapping modules, stores, and jobs', () => {
    const mermaid = buildDiagramMermaid(productCore, 'modular_monolith');

    expect(mermaid).toContain('modular monolith');
    expect(mermaid).toContain('UI["Web UI / Client"]');
    expect(mermaid).toContain('JOBS["Background jobs"]');
    expect(mermaid).toContain('PostgreSQL');
    expect(mermaid).toContain('Redis');
    expect(mermaid).toMatch(/JOBS --> DB/);
  });

  it('draws microservices as separate services behind a gateway', () => {
    const mermaid = buildDiagramMermaid(productCore, 'microservices');

    expect(mermaid).toContain('API Gateway');
    expect(mermaid).toContain('API Service');
    expect(mermaid).toContain('Clients');
    expect(mermaid).toContain('Worker Service');
    expect(mermaid).not.toContain('modular monolith');
  });

  it('draws an event-driven flow with a broker, consumer, and dead-letter queue', () => {
    const mermaid = buildDiagramMermaid(eventPipeline, 'event_driven');

    expect(mermaid).toContain('Ingestion / Producer API');
    expect(mermaid).toContain('Queue / Broker');
    expect(mermaid).toContain('Dead-letter queue');
    expect(mermaid).toContain('Worker / Consumer');
    expect(mermaid).toContain('Data Warehouse');
    expect(mermaid).toMatch(/Q -.-> DLQ/);
  });

  it('draws a hybrid with explicit sync and async lanes', () => {
    const mermaid = buildDiagramMermaid(productCore, 'hybrid');

    expect(mermaid).toContain('Synchronous path');
    expect(mermaid).toContain('Asynchronous path');
    expect(mermaid).toContain('Queue / Broker');
  });

  it('names Kafka when the brief mentions it', () => {
    const mermaid = buildDiagramMermaid(
      'An API publishes order events to Kafka. Consumers update a PostgreSQL database.',
      'event_driven',
    );

    expect(mermaid).toContain('Kafka');
    expect(mermaid).not.toContain('Queue / Broker');
  });

  it('wires email to the API (not an undeclared job node) when there are no workers', () => {
    const mermaid = buildDiagramMermaid(
      'A web application exposes a REST API storing data in PostgreSQL and sends email through a managed provider.',
      'modular_monolith',
    );

    expect(mermaid).toContain('Email provider');
    expect(mermaid).not.toContain('JOBS');
    expect(mermaid).toContain('API --> TP0["Email provider"]');
  });

  it('defaults unknown patterns to a modular monolith', () => {
    const mermaid = buildDiagramMermaid(productCore, 'space_odyssey');
    expect(mermaid).toContain('modular monolith');
  });
});