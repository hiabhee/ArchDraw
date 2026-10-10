import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import logger from '@/lib/logger';
import { assessArchitectureBaseline } from '@/lib/jev/architectureBaseline';
import { callJev, classificationQuestions, reviewQuestions, type JevConfig } from '@/lib/jev/jevApi';
import {
  computeReviewVerdicts,
  generateArchitectureSpec,
  isLlmNotConfigured,
  normalizeDecisions,
  specToMermaid,
  specToText,
  type ArchitectureSpec,
} from '@/lib/jev/architectureSpec';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * JEV_API_KEY may only be consumed here — the shared Jev client
 * (lib/jev/jevApi.ts) receives its credentials from this endpoint.
 */
function jevConfig(): JevConfig {
  return {
    apiKey: process.env.JEV_API_KEY,
    baseUrl: process.env.JEV_API_BASE_URL,
    model: process.env.JEV_MODEL,
  };
}

const architectureSchema = z.object({
  architecture: z.string().trim().min(20, 'Describe the architecture in at least 20 characters.').max(12_000),
  mode: z.enum(['both', 'baseline', 'jev', 'twoStage']).optional().default('both'),
});

const decisionQuestions = {
  primary_pattern: {
    type: 'choice',
    instructions: 'Which primary architectural pattern best fits the described system today?',
    criteria: {
      modular_monolith: 'A single deployable application with well-separated modules.',
      microservices: 'Independently deployable services with clear domain boundaries.',
      event_driven: 'Asynchronous events and consumers are the dominant integration style.',
      hybrid: 'A deliberate combination of synchronous services and asynchronous workflows.',
    },
  },
  async_workload_fit: {
    type: 'noul',
    instructions: 'Would introducing or retaining a queue materially improve reliability or throughput for this system?',
  },
  operational_complexity: {
    type: 'score',
    instructions: 'Rate the operational complexity required to run this architecture reliably.',
    criteria: [
      '1: A single service with minimal operational dependencies.',
      '2: A small number of managed dependencies and straightforward deployments.',
      '3: Multiple services or workflows requiring monitoring, retries, and runbooks.',
      '4: Distributed coordination, scaling, and failure recovery need dedicated operations.',
      '5: High operational burden with complex multi-service or multi-region reliability concerns.',
    ],
  },
} as const;

async function runTwoStage(architecture: string): Promise<NextResponse> {
  const startedAt = performance.now();

  const classificationStartedAt = performance.now();
  const classificationCall = await callJev(architecture, classificationQuestions, jevConfig());
  const classificationMs = Math.max(0, performance.now() - classificationStartedAt);
  const decisions = normalizeDecisions(classificationCall.answers);

  let spec: ArchitectureSpec | null = null;
  let specError: string | null = null;
  let specCode: string | null = null;
  let specMs: number | null = null;
  let specAttempted = false;
  // Jev is a constraint provider, not a gate. A classification failure must not
  // block the design stage — the spec generator works with default constraints.
  const specStartedAt = performance.now();
  specAttempted = true;
  try {
    const generated = await generateArchitectureSpec(architecture, decisions);
    spec = generated.spec;
    specMs = Math.max(0, performance.now() - specStartedAt);
  } catch (error) {
    logger.error('[TwoStage] ArchitectureSpec generation failed', error);
    specError = isLlmNotConfigured(error)
      ? 'No LLM keys configured. Set a Groq API key (GROQ_API_KEY) in frontend/.env.local.'
      : 'The design model could not produce a valid ArchitectureSpec.';
    specCode = isLlmNotConfigured(error) ? 'LLM_NOT_CONFIGURED' : 'SPEC_GENERATION_FAILED';
    specMs = Math.max(0, performance.now() - specStartedAt);
  }

  let validation = null;
  let validationMs: number | null = null;
  if (spec && jevConfig().apiKey) {
    const validationStartedAt = performance.now();
    const validationCall = await callJev(specToText(spec), reviewQuestions, jevConfig());
    validationMs = Math.max(0, performance.now() - validationStartedAt);
    validation = {
      ok: validationCall.ok,
      answers: validationCall.answers ?? {},
      verdicts: validationCall.ok ? computeReviewVerdicts(validationCall.answers) : [],
      fitJudgement: validationCall.ok
        ? computeReviewVerdicts(validationCall.answers).some((v) => v.status === 'flagged') ? 'flagged' : 'accepted'
        : null,
      elapsedMs: validationCall.elapsedMs ?? null,
      creditsUsed: validationCall.creditsUsed ?? null,
      error: validationCall.ok ? null : validationCall.message,
      code: validationCall.ok ? null : (validationCall.code ?? 'JEV_REQUEST_FAILED'),
    };
  }

  return NextResponse.json({
    mode: 'twoStage',
    durations: {
      classificationMs,
      specMs,
      validationMs,
      totalMs: Math.max(0, performance.now() - startedAt),
    },
    classification: {
      ok: classificationCall.ok,
      answers: classificationCall.answers ?? {},
      decisions,
      elapsedMs: classificationCall.elapsedMs ?? null,
      creditsUsed: classificationCall.creditsUsed ?? null,
      error: classificationCall.ok ? null : classificationCall.message,
      code: classificationCall.ok ? null : (classificationCall.code ?? 'JEV_REQUEST_FAILED'),
    },
    spec,
    specError,
    specCode,
    specMs,
    specAttempted,
    validation,
    render: spec ? specToMermaid(spec) : null,
    elapsedMs: Math.max(0, performance.now() - startedAt),
  });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const input = architectureSchema.safeParse(await request.json());
    if (!input.success) {
      return NextResponse.json(
        { error: input.error.issues[0]?.message ?? 'Invalid request body.', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    if (input.data.mode === 'twoStage') {
      return runTwoStage(input.data.architecture);
    }

    const startedAt = performance.now();
    const baseline = assessArchitectureBaseline(input.data.architecture);

    let jev = null;
    let jevError: string | null = null;
    let jevCode: string | null = null;

    if (input.data.mode !== 'baseline') {
      const jevCall = await callJev(input.data.architecture, decisionQuestions, jevConfig());
      if (!jevCall.ok) {
        jevError = jevCall.message ?? null;
        jevCode = jevCall.code ?? 'JEV_REQUEST_FAILED';
      } else {
        jev = {
          answers: jevCall.answers,
          usage: jevCall.usage,
          elapsedMs: jevCall.elapsedMs,
          creditsUsed: jevCall.creditsUsed,
        };
      }
    }

    return NextResponse.json({
      baseline,
      jev,
      jevError,
      jevCode,
      elapsedMs: Math.max(0, performance.now() - startedAt),
    });
  } catch (error) {
    logger.error('Jev architecture test error', error);
    return NextResponse.json(
      { error: 'Jev request timed out or could not be completed.', code: 'JEV_UNAVAILABLE' },
      { status: 504 },
    );
  }
}