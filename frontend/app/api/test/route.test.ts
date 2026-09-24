import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { requireAdmin, loggerError } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({ requireAdmin }));
vi.mock('@/lib/logger', () => ({
  default: { error: loggerError, log: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/jev/architectureSpec', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/jev/architectureSpec')>();
  return { ...actual, generateArchitectureSpec: vi.fn() };
});

const fetchMock = vi.fn();

const validArchitecture =
  'A TypeScript web application has a REST API, PostgreSQL database, and background email jobs.';

const mockSpec = {
  title: 'Small SaaS',
  assumptions: ['Single region initially'],
  requirements: { scale: 'small' as const, availability: 'standard' as const, dataSensitivity: 'internal' as const },
  components: [
    { id: 'web', name: 'Web App', kind: 'client' as const, description: 'Browser UI' },
    { id: 'api', name: 'API', kind: 'service' as const, description: 'REST API' },
    { id: 'db', name: 'PostgreSQL', kind: 'database' as const, description: 'Storage' },
  ],
  connections: [
    { from: 'web', to: 'api', protocol: 'HTTPS' as const },
    { from: 'api', to: 'db', protocol: 'SQL' as const },
  ],
  decisions: [{ decision: 'modular monolith', rationale: 'MVP', alternatives: [] }],
  openQuestions: ['Tenant isolation?'],
};

const classifyAnswers = {
  appType: { type: 'choice', choice: 'web_saas', confidence: 0.9 },
  needsAsyncProcessing: { type: 'noul', noul: 0.8, confidence: 0.7 },
  dataSensitivity: { type: 'choice', choice: 'sensitive', confidence: 0.8 },
  architectureTier: { type: 'choice', choice: 'modular_monolith', confidence: 0.7 },
};

const reviewAnswers = {
  databasePubliclyExposed: { type: 'noul', noul: 0.1, confidence: 0.95 },
  hasUnjustifiedComplexity: { type: 'noul', noul: 0.3, confidence: 0.8 },
  authGap: { type: 'noul', noul: 0, confidence: 0.9 },
  architectureFit: { type: 'score', score: 4, confidence: 0.8, level: 'acceptable_fit' },
};

function request(body: unknown) {
  return new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function jevPayload(answers: Record<string, unknown> = { primary_pattern: { type: 'choice', choice: 'modular_monolith' } }) {
  return new Response(JSON.stringify({
    code: 0,
    data: {
      result: {
        answers,
        usage: { input_tokens: 24, output_tokens: 0 },
        elapsedMs: 180,
      },
      creditsUsed: 1,
    },
  }), { status: 200 });
}

describe('POST /api/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    requireAdmin.mockResolvedValue(null);
    process.env.JEV_API_KEY = 'test-key';
    delete process.env.JEV_API_BASE_URL;
    delete process.env.JEV_MODEL;
  });

  it('returns both the deterministic baseline and Jev answers with timings', async () => {
    fetchMock.mockResolvedValue(jevPayload({ primary_pattern: { type: 'choice', choice: 'microservices' } }));

    const response = await POST(request({ architecture: validArchitecture }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.jev).toMatchObject({
      answers: { primary_pattern: { choice: 'microservices' } },
      elapsedMs: 180,
    });
    expect(payload.baseline).toMatchObject({ answers: { primary_pattern: { type: 'choice' } } });
    expect(payload.jevError).toBeNull();
    expect(typeof payload.baseline.elapsedMs).toBe('number');
    expect(typeof payload.elapsedMs).toBe('number');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://thejevai.com/v1/systemone',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: 'typesafe/jev-1.13',
      questions: {
        primary_pattern: { type: 'choice' },
        async_workload_fit: { type: 'noul' },
        operational_complexity: { type: 'score' },
      },
    });
  });

  it('skips Jev when asked for the baseline only', async () => {
    const response = await POST(request({ architecture: validArchitecture, mode: 'baseline' }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.jev).toBeNull();
    expect(payload.jevError).toBeNull();
    expect(payload.baseline.answers.primary_pattern.type).toBe('choice');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still returns the baseline when Jev is not configured', async () => {
    delete process.env.JEV_API_KEY;

    const response = await POST(request({ architecture: validArchitecture }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.baseline.answers.primary_pattern.choice).toBe('modular_monolith');
    expect(payload.jev).toBeNull();
    expect(payload.jevError).toContain('JEV_API_KEY');
    expect(payload.jevCode).toBe('SERVICE_UNAVAILABLE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports an upstream Jev failure without hiding the baseline', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 401, message: 'bad key' }), { status: 401 }));

    const response = await POST(request({ architecture: validArchitecture }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.jev).toBeNull();
    expect(payload.jevError).toBe('Jev rejected the configured API key. Check JEV_API_KEY in frontend/.env.local.');
    expect(payload.jevCode).toBe('JEV_REQUEST_FAILED');
    expect(payload.baseline.answers.primary_pattern.choice).toBe('modular_monolith');
  });

  it('rejects an invalid architecture before computing anything', async () => {
    const response = await POST(request({ architecture: 'too short' }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not expose upstream credentials', async () => {
    fetchMock.mockResolvedValue(jevPayload());

    const response = await POST(request({ architecture: validArchitecture }));

    expect(response.status).toBe(200);
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain('test-key');
  });

  it('runs the two-stage pipeline: classify → LLM spec → validate', async () => {
    const { generateArchitectureSpec } = await import('@/lib/jev/architectureSpec');
    vi.mocked(generateArchitectureSpec).mockResolvedValue({ spec: mockSpec, repairs: 0, elapsedMs: 500 });
    fetchMock.mockResolvedValueOnce(jevPayload(classifyAnswers));
    fetchMock.mockResolvedValueOnce(jevPayload(reviewAnswers));

    const response = await POST(request({ architecture: validArchitecture, mode: 'twoStage' }));

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.mode).toBe('twoStage');
    expect(payload.classification.ok).toBe(true);
    expect(payload.classification.decisions).toEqual({
      appType: 'web_saas',
      needsAsyncProcessing: true,
      dataSensitivity: 'sensitive',
      architectureTier: 'modular_monolith',
    });

    expect(payload.durations).toMatchObject({
      classificationMs: expect.any(Number),
      specMs: expect.any(Number),
      validationMs: expect.any(Number),
      totalMs: expect.any(Number),
    });
    expect(payload.durations.totalMs).toBeGreaterThanOrEqual(payload.durations.classificationMs);
    expect(payload.specAttempted).toBe(true);

    expect(payload.spec).toMatchObject({ title: 'Small SaaS' });
    expect(payload.specError).toBeNull();

    expect(payload.validation.ok).toBe(true);
    expect(payload.validation.verdicts.some((v: { check: string }) => v.check === 'databasePubliclyExposed')).toBe(true);
    expect(payload.validation.fitJudgement).toBe('accepted');

    expect(payload.render).toContain('graph LR');
    expect(payload.render).toContain('db[("PostgreSQL")]');

    // call 1 = intent classification, call 2 = atomic validation
    const call1 = JSON.parse(fetchMock.mock.calls[0][1].body);
    const call2 = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(Object.keys(call1.questions)).toEqual([
      'appType',
      'needsAsyncProcessing',
      'dataSensitivity',
      'architectureTier',
    ]);
    expect(Object.keys(call2.questions)).toEqual([
      'databasePubliclyExposed',
      'hasUnjustifiedComplexity',
      'authGap',
      'architectureFit',
    ]);
    // Jev contract: choice uses a criteria OBJECT, noul/score use instructions.
    expect(call1.questions.appType.criteria.web_saas).toBeTruthy();
    expect(call1.questions.dataSensitivity.criteria.sensitive).toBeTruthy();
    expect(call1.questions.architectureTier.criteria.modular_monolith).toBeTruthy();
    expect(Array.isArray(call2.questions.architectureFit.criteria)).toBe(true);
    expect(typeof call2.questions.databasePubliclyExposed.instructions).toBe('string');
    expect(typeof payload.elapsedMs).toBe('number');
  });

  it('two-stage: Jev unavailable still produces an LLM spec with skipped validation', async () => {
    const { generateArchitectureSpec } = await import('@/lib/jev/architectureSpec');
    vi.mocked(generateArchitectureSpec).mockResolvedValue({ spec: mockSpec, repairs: 0, elapsedMs: 500 });
    delete process.env.JEV_API_KEY;

    const response = await POST(request({ architecture: validArchitecture, mode: 'twoStage' }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.classification.ok).toBe(false);
    expect(payload.classification.code).toBe('SERVICE_UNAVAILABLE');
    expect(payload.classification.decisions).toEqual({});
    expect(payload.spec).toMatchObject({ title: 'Small SaaS' });
    expect(payload.specError).toBeNull();
    expect(payload.validation).toBeNull();
    expect(payload.durations.specMs).toEqual(expect.any(Number));
    expect(payload.durations.validationMs).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('two-stage: a Jev HTTP failure during classification does not block the design or review', async () => {
    const { generateArchitectureSpec } = await import('@/lib/jev/architectureSpec');
    vi.mocked(generateArchitectureSpec).mockResolvedValue({ spec: mockSpec, repairs: 0, elapsedMs: 500 });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: -1, message: 'upstream error' }), { status: 502 }));
    fetchMock.mockResolvedValueOnce(jevPayload(reviewAnswers));

    const response = await POST(request({ architecture: validArchitecture, mode: 'twoStage' }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.classification.ok).toBe(false);
    expect(payload.classification.code).toBe('JEV_REQUEST_FAILED');
    expect(payload.spec).toMatchObject({ title: 'Small SaaS' });
    expect(payload.specError).toBeNull();
    expect(payload.validation.ok).toBe(true);
    expect(payload.render).toContain('graph LR');
  });

  it('two-stage: reports LLM_NOT_CONFIGURED when the design model has no keys', async () => {
    const { generateArchitectureSpec } = await import('@/lib/jev/architectureSpec');
    fetchMock.mockResolvedValueOnce(jevPayload(classifyAnswers));
    vi.mocked(generateArchitectureSpec).mockRejectedValue(new Error('No Groq API keys configured'));

    const response = await POST(request({ architecture: validArchitecture, mode: 'twoStage' }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.classification.ok).toBe(true);
    expect(payload.spec).toBeNull();
    expect(payload.specCode).toBe('LLM_NOT_CONFIGURED');
    expect(payload.specError).toContain('GROQ_API_KEY');
    expect(payload.validation).toBeNull();
  });
});