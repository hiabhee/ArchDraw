import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { getClientIP } from '@/lib/server/ip';
import { getSessionFromRequest } from '@/lib/middleware/quotaCheck';
import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import {
  AUTH_EXPLAIN_LIMIT_PER_STEP,
  type ExplainPhase,
} from '@/lib/tutorial/explainQuota';
import { buildExplainCacheHash } from '@/lib/tutorial/explainHash';
import { getTutorialCachedResponse, upsertTutorialCachedResponse } from '@/lib/db';

export const runtime = 'nodejs';

const explainRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const EXPLAIN_RATE_WINDOW_MS = 60_000;
const MAX_EXPLAIN_REQUESTS_PER_MIN = 8;

const explainSchema = z.object({
  tutorialId: z.string().min(1),
  stepId: z.string().min(1),
  phase: z.enum(['intro', 'teaching']),
  component: z.string().min(1),
  heading: z.string().min(1),
  body: z.string().min(1),
  variantIndex: z.number().int().min(0).max(2),
  stepExplainCount: z.number().int().min(0),
});

function checkExplainRateLimit(key: string): boolean {
  const now = Date.now();
  const record = explainRateLimitMap.get(key);
  if (!record || now > record.resetTime) {
    explainRateLimitMap.set(key, { count: 1, resetTime: now + EXPLAIN_RATE_WINDOW_MS });
    return true;
  }
  if (record.count >= MAX_EXPLAIN_REQUESTS_PER_MIN) return false;
  record.count += 1;
  return true;
}

function systemPrompt(phase: ExplainPhase): string {
  return `You are a system design tutor rewriting a tutorial ${phase} section for a student who asked for a different explanation.
Rules:
- Max 150 words for the body
- Simpler language, one concrete analogy when helpful
- Stay factually accurate for the component and architecture
- Return valid JSON only: {"heading":"...","body":"..."}
- Do not use markdown bullets`;
}

function userPrompt(data: z.infer<typeof explainSchema>): string {
  return `Component: ${data.component}
Phase: ${data.phase}
Variant: ${data.variantIndex} (use a fresh angle from prior variants)

Original heading: ${data.heading}
Original body: ${data.body}

Rewrite with different wording and emphasis. JSON only.`;
}

export async function POST(req: NextRequest) {
  const rateKey = `explain:${getClientIP(req)}`;
  if (!checkExplainRateLimit(rateKey)) {
    return NextResponse.json(
      { error: 'Too many explain requests. Please wait a moment.', code: 'RATE_LIMITED' },
      { status: 429 }
    );
  }

  try {
    const parsed = explainSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', '), code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const session = await getSessionFromRequest(req);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Sign in to use “Explain differently”.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (data.stepExplainCount >= AUTH_EXPLAIN_LIMIT_PER_STEP) {
      return NextResponse.json(
        {
          error: `Limit of ${AUTH_EXPLAIN_LIMIT_PER_STEP} explains per step reached.`,
          code: 'QUOTA_EXCEEDED',
        },
        { status: 429 }
      );
    }

    const questionHash = buildExplainCacheHash(
      data.tutorialId,
      data.stepId,
      data.phase,
      data.variantIndex
    );

    const cached = await getTutorialCachedResponse(questionHash);
    if (cached?.response) {
      try {
        const payload = JSON.parse(cached.response) as { heading: string; body: string };
        return NextResponse.json({ ...payload, cached: true });
      } catch {
        // fall through to regenerate if cache corrupt
      }
    }

    if (!apiKeyManager.hasGroq()) {
      return NextResponse.json(
        { error: 'AI explain is not configured on this server.', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 }
      );
    }

    const completion = await apiKeyManager.executeWithGroq((groq) =>
      groq.chat.completions.create({
        model: 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: systemPrompt(data.phase) },
          { role: 'user', content: userPrompt(data) },
        ],
        max_tokens: 280,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      })
    );

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return NextResponse.json({ error: 'Empty model response', code: 'AI_ERROR' }, { status: 502 });
    }

    const payload = JSON.parse(raw) as { heading?: string; body?: string };
    if (!payload.body?.trim()) {
      return NextResponse.json({ error: 'Invalid model response', code: 'AI_ERROR' }, { status: 502 });
    }

    const result = {
      heading: payload.heading?.trim() || data.heading,
      body: payload.body.trim(),
      cached: false,
    };

    await upsertTutorialCachedResponse(questionHash, JSON.stringify(result));

    return NextResponse.json(result);
  } catch (err) {
    logger.error('[tutorials/explain]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
