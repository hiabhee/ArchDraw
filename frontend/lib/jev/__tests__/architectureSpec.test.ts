import { describe, expect, it } from 'vitest';
import {
  ArchitectureSpecSchema,
  computeReviewVerdicts,
  extractJsonObject,
  specToMermaid,
  type ArchitectureSpec,
} from '../architectureSpec';

function makeSpec(overrides: Partial<ArchitectureSpec> = {}): ArchitectureSpec {
  return {
    title: 'Invoice SaaS',
    assumptions: ['Single region initially'],
    requirements: { scale: 'small', availability: 'standard', dataSensitivity: 'internal' },
    components: [
      { id: 'web', name: 'Web App', kind: 'client', description: 'Browser UI' },
      { id: 'api', name: 'API', kind: 'service', description: 'REST API' },
      { id: 'auth', name: 'Auth', kind: 'auth', description: 'Sign-in' },
      { id: 'db', name: 'PostgreSQL', kind: 'database', description: 'Users and invoices' },
      { id: 'queue', name: 'Invoice Queue', kind: 'queue', description: 'Async job queue' },
      { id: 'worker', name: 'Worker', kind: 'service', description: 'Processes invoices' },
    ],
    connections: [
      { from: 'web', to: 'api', protocol: 'HTTPS' },
      { from: 'api', to: 'auth', protocol: 'HTTPS' },
      { from: 'api', to: 'db', protocol: 'SQL' },
      { from: 'api', to: 'queue', protocol: 'async', label: 'enqueue invoice' },
      { from: 'queue', to: 'worker', protocol: 'async' },
    ],
    decisions: [{ decision: 'modular monolith', rationale: 'MVP', alternatives: [] }],
    openQuestions: ['Do we need tenant isolation yet?'],
    ...overrides,
  };
}

describe('ArchitectureSpecSchema', () => {
  it('accepts a well-formed spec', () => {
    const parsed = ArchitectureSpecSchema.safeParse(makeSpec());
    expect(parsed.success).toBe(true);
  });

  it('rejects a connection referencing an unknown component id', () => {
    const bad = makeSpec({ connections: [{ from: 'api', to: 'missing', protocol: 'HTTPS' }] });
    const parsed = ArchitectureSpecSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join('.') === 'connections.0.to')).toBe(true);
    }
  });

  it('rejects stray component kinds', () => {
    const bad = makeSpec();
    (bad.components[0] as { kind: string }).kind = 'kubernetes';
    expect(ArchitectureSpecSchema.safeParse(bad).success).toBe(false);
  });
});

describe('specToMermaid', () => {
  it('renders components, groups, and edges deterministically', () => {
    const code = specToMermaid(makeSpec());
    expect(code.startsWith('graph LR')).toBe(true);
    expect(code).toContain('subgraph');
    expect(code).toContain('"Public"');
    expect(code).toContain('db[("PostgreSQL")]');
    expect(code).toContain('auth{{"Auth"}}');
    expect(code).toContain('queue[/"Invoice Queue"/]');
    expect(code).toContain('web -->|"HTTPS"| api');
    expect(code).toContain('api -.->|"enqueue invoice - async"| queue');
    expect(code).toContain('queue -.->|"async"| worker');
  });

  it('escapes unsafe ids and dedupes collisions', () => {
    const spec = makeSpec({ components: [{ id: 'api x', name: 'A', kind: 'service', description: '' }] });
    const code = specToMermaid(spec);
    expect(code).not.toContain('api x');
    expect(code).toContain('api_x');
  });

  it('produces mermaid the engine can parse', async () => {
    const { default: mermaid } = await import('mermaid');
    const code = specToMermaid(makeSpec());
    const result = await mermaid.parse(code);
    expect(result).toBeDefined();
  });
});

describe('extractJsonObject', () => {
  it('strips markdown fences', () => {
    expect(JSON.parse(extractJsonObject('Sure:\n```json\n{"a":1}\n```\nDone')).a).toBe(1);
  });

  it('finds an object in trailing prose', () => {
    expect(JSON.parse(extractJsonObject('here {"x": 2} okay')).x).toBe(2);
  });

  it('throws when no object exists', () => {
    expect(() => extractJsonObject('no json here')).toThrow();
  });
});

describe('computeReviewVerdicts', () => {
  it('flags a publicly exposed database', () => {
    const verdicts = computeReviewVerdicts({
      databasePubliclyExposed: { noul: 0.3, confidence: 0.9 },
      hasUnjustifiedComplexity: { noul: 0.1, confidence: 0.9 },
      authGap: { noul: 0, confidence: 0.9 },
      architectureFit: { score: 5, confidence: 0.9 },
    });
    expect(verdicts.find((v) => v.check === 'databasePubliclyExposed')?.status).toBe('flagged');
  });

  it('flags unjustified complexity only above its threshold', () => {
    const pass = computeReviewVerdicts({ hasUnjustifiedComplexity: { noul: 0.6, confidence: 0.8 } });
    const fail = computeReviewVerdicts({ hasUnjustifiedComplexity: { noul: 0.8, confidence: 0.8 } });
    expect(pass.find((v) => v.check === 'hasUnjustifiedComplexity')?.status).toBe('accepted');
    expect(fail.find((v) => v.check === 'hasUnjustifiedComplexity')?.status).toBe('flagged');
  });

  it('flags a low-fit score or low fit confidence for review', () => {
    const lowScore = computeReviewVerdicts({ architectureFit: { score: 3, confidence: 0.9 } });
    const lowConfidence = computeReviewVerdicts({ architectureFit: { score: 4, confidence: 0.6 } });
    const strong = computeReviewVerdicts({ architectureFit: { score: 5, confidence: 0.9 } });
    expect(lowScore.find((v) => v.check === 'architectureFit')?.status).toBe('flagged');
    expect(lowConfidence.find((v) => v.check === 'architectureFit')?.status).toBe('flagged');
    expect(strong.find((v) => v.check === 'architectureFit')?.status).toBe('accepted');
  });

  it('marks missing checks as no_data', () => {
    const verdicts = computeReviewVerdicts({});
    expect(verdicts.every((v) => v.status === 'no_data')).toBe(true);
  });
});