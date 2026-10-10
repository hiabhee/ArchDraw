import { describe, expect, it } from 'vitest';
import { assessArchitectureBaseline } from '../architectureBaseline';

const productCore =
  'A Next.js application serves a React interface and REST API. PostgreSQL stores users and canvases. ' +
  'Redis handles rate limiting. Background jobs send email and generate diagrams. ' +
  'The product expects traffic spikes when teams publish diagrams.';

const eventPipeline =
  'An ingestion API accepts thousands of events per second. It publishes each event to a durable queue. ' +
  'Independent workers validate, enrich, and store records in a data warehouse. ' +
  'Failed events go to a dead-letter queue and can be replayed.';

const smallSaaS =
  'A small team runs one TypeScript application with a web UI, REST endpoints, PostgreSQL, and a managed email provider. ' +
  'Deployments happen a few times per week. There are no background workers or cross-service calls today.';

describe('assessArchitectureBaseline', () => {
  it('classifies the product core as a modular monolith with background work', () => {
    const result = assessArchitectureBaseline(productCore);

    expect(result.answers.primary_pattern.choice).toBe('modular_monolith');
    expect(result.answers.operational_complexity.score).toBe(3);
    expect(result.answers.async_workload_fit.noul).toBeGreaterThan(0.5);
    expect(result.answers.async_workload_fit.noul).toBeLessThanOrEqual(0.95);
    expect(result.answers.primary_pattern.rationale).toBeTruthy();
  });

  it('classifies a high-volume event pipeline as event-driven with high operational load', () => {
    const result = assessArchitectureBaseline(eventPipeline);

    expect(result.answers.primary_pattern.choice).toBe('event_driven');
    expect(result.answers.operational_complexity.score).toBeGreaterThanOrEqual(4);
    expect(result.answers.async_workload_fit.noul).toBeGreaterThan(0.7);
  });

  it('classifies a small SaaS as a quiet modular monolith', () => {
    const result = assessArchitectureBaseline(smallSaaS);

    expect(result.answers.primary_pattern.choice).toBe('modular_monolith');
    expect(result.answers.operational_complexity.score).toBe(1);
    expect(result.answers.async_workload_fit.noul).toBeLessThanOrEqual(0.2);
  });

  it('reports a real elapsed time', () => {
    const result = assessArchitectureBaseline(productCore);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('shapes every answer with type, confidence, and rationale', () => {
    const { answers } = assessArchitectureBaseline(eventPipeline);
    for (const decision of Object.values(answers)) {
      expect(typeof decision?.type).toBe('string');
      expect(typeof decision?.confidence).toBe('number');
      expect(typeof decision?.rationale).toBe('string');
    }
  });
});