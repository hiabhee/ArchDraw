import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { generateDiagram } from '@/lib/ai/services/orchestrator';
import { MODELS, isKnownModel } from '@/lib/ai/models';
import { inferSystemType, inferComplexity } from '@/lib/ai/utils/promptInference';
import type { UserIntent, GenerationProgress } from '@/lib/ai/types';
import { get as getCachedDiagram, set as setCachedDiagram } from '@/lib/ai/services/diagramCache';
import logger from '@/lib/logger';
import { isTokenExhaustedError, SERVER_BUSY_USER_MESSAGE } from '@/lib/ai/utils/apiKeyManager';
import { z } from 'zod';
import { checkAIGenerationQuota, getSessionFromRequest, incrementAIGeneration, logUsage, getGuestId, releaseAIGeneration } from '@/lib/server/quotaCheck';
import { CREDIT_POLICY, reserveCredits, refundCredits, getCreditSnapshot, type DetailLevel } from '@/lib/server/credits';
import { acquireAiCapacity, CapacityBusyError, getGenerationBudget } from '@/lib/ai/services/aiCapacity';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Known model IDs the pipeline can route — derived from the single source of
// truth in lib/ai/models.ts (shared by client and server so the offered
// dropdown and the accepted wire values can never diverge).
const SUPPORTED_MODEL_IDS = new Set(MODELS.map((m) => m.id));

const MAX_CONTEXT_NODES = 150;
const MAX_CONTEXT_EDGES = 400;
const MAX_CONTEXT_BYTES = 200_000;

// Zod validation schema
const generateDiagramSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  systemType: z.string().optional(),
  complexity: z.enum(['low', 'medium', 'high']).optional(),
  model: z.string().refine(
    val => !val || isKnownModel(val),
    { message: `Unsupported model. Supported: ${Array.from(SUPPORTED_MODEL_IDS).join(', ')}` }
  ).optional(),
  diagramSize: z.enum(['small', 'medium', 'large']).optional(),
  detailLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  stream: z.boolean().optional().default(false),
  // Edit mode: the current canvas, sent to the planner. Bounded so it can't be
  // used to push arbitrarily large payloads into the LLM prompt.
  existingContext: z.object({
    nodes: z.array(z.record(z.string(), z.unknown())).max(MAX_CONTEXT_NODES),
    edges: z.array(z.record(z.string(), z.unknown())).max(MAX_CONTEXT_EDGES),
  }).refine(
    ctx => JSON.stringify(ctx).length <= MAX_CONTEXT_BYTES,
    { message: `existingContext must be under ${MAX_CONTEXT_BYTES} bytes` },
  ).optional(),
});

type GenerateDiagramInput = z.infer<typeof generateDiagramSchema>;

/**
 * Shared by `/api/generate-diagram` and its `/streaming` alias so quota,
 * credits, capacity and model validation can never diverge between them.
 */
export async function POST(req: NextRequest) {
  // Tier-aware quota enforcement (claims a slot for signed-in users)
  const quotaCheck = await checkAIGenerationQuota(req);

  if (!quotaCheck.allowed) {
    return NextResponse.json(
      {
        error: quotaCheck.error,
        code: 'QUOTA_EXCEEDED',
        status: 429,
        remaining: quotaCheck.remaining || 0,
        upgradePrompt: quotaCheck.tier === 'guest' ? 'Sign in for more generations' : undefined,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(quotaCheck.remaining || 0),
        },
      }
    );
  }

  // Set once credits are reserved; any failure before that point only needs
  // to give the quota slot back.
  let reservationId: string | undefined;
  const releaseOnFailure = async () => {
    if (reservationId) await refundCredits(reservationId);
    await releaseAIGeneration(quotaCheck.claimedUserId);
  };

  try {
    // Parse and validate request body with Zod
    const body = await req.json();
    const validatedInput = generateDiagramSchema.safeParse(body);

    if (!validatedInput.success) {
      await releaseOnFailure();
      const errorMessage = validatedInput.error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return NextResponse.json(
        { error: errorMessage || 'Invalid request body', code: 'VALIDATION_ERROR', status: 400 },
        { status: 400 }
      );
    }

    const { description, systemType, complexity, model, diagramSize, detailLevel, stream, existingContext } = validatedInput.data as GenerateDiagramInput;
    const isEdit = Boolean(existingContext && (existingContext.nodes.length || existingContext.edges.length));
    const effectiveDiagramSize = diagramSize ?? (detailLevel === 1 ? 'small' : detailLevel === 3 ? 'large' : 'medium');
    const requestedDetailLevel = (detailLevel ?? 2) as DetailLevel;
    const creditSnapshot = await getCreditSnapshot(req);
    const creditCost = CREDIT_POLICY.costs[requestedDetailLevel];
    if (creditSnapshot.balance < creditCost) {
      await releaseOnFailure();
      return NextResponse.json(
        { error: 'Not enough credits for this generation.', code: 'INSUFFICIENT_CREDITS', required: creditCost, ...creditSnapshot },
        { status: 402 },
      );
    }

    // Fast path: an identical prompt+model+detail request was generated recently.
    // Regenerate re-submits the same prompt, so this serves it instantly instead
    // of re-running the full LLM pipeline (see lib/ai/services/diagramCache.ts).
    // Edits depend on the canvas, which isn't part of the cache key.
    const cached = isEdit ? null : getCachedDiagram(description, detailLevel, model);
    if (cached) {
      // Cache hits are free — give back the claimed quota slot.
      await releaseAIGeneration(quotaCheck.claimedUserId);
      return NextResponse.json({
        success: true,
        data: cached,
        progress: [],
        cached: true,
        credits: creditSnapshot,
      });
    }

    const userIntent: UserIntent = {
      description: description.trim(),
      systemType: systemType ?? inferSystemType(description),
      complexity: complexity ?? inferComplexity(description),
      model,
      diagramSize: effectiveDiagramSize,
      detailLevel,
      ...(isEdit ? { existingContext: existingContext as UserIntent['existingContext'] } : {}),
    };

    // Reserve credits up front (atomic per payer) instead of charging after
    // generation, which let concurrent requests overspend or go uncharged.
    const reservation = await reserveCredits(req, requestedDetailLevel, {
      description: description.substring(0, 100),
    });
    if (!reservation.allowed) {
      await releaseOnFailure();
      return NextResponse.json(
        { error: 'Not enough credits for this generation.', code: 'INSUFFICIENT_CREDITS', ...reservation },
        { status: 402 },
      );
    }
    reservationId = reservation.reservationId;

    const generateAndFinalize = async (onProgress?: (progress: GenerationProgress) => void) => {
      const releaseCapacity = await acquireAiCapacity(getGenerationBudget(description, requestedDetailLevel));
      const progressEvents: GenerationProgress[] = [];
      let result;
      try {
        result = await generateDiagram(userIntent, (progress) => {
          progressEvents.push(progress);
          onProgress?.(progress);
        });
      } finally {
        releaseCapacity();
      }

      if (!isEdit) setCachedDiagram(description, detailLevel, model, result);

      // Non-blocking telemetry — response returns 30–80 ms earlier (server-after-nonblocking)
      const sessionForTelemetry = getSessionFromRequest(req);
      after(async () => {
        const session = await sessionForTelemetry;
        const uid = session?.user?.id ?? null;
        await Promise.all([
          incrementAIGeneration(uid),
          logUsage(uid, getGuestId(req), 'ai_generation', {
            description: description.substring(0, 100),
            nodeCount: result.nodes?.length || 0,
          }),
        ]);
      });

      return {
        success: true,
        data: result,
        progress: progressEvents,
        quotaRemaining: quotaCheck.remaining,
        credits: { ...creditSnapshot, balance: reservation.balance },
      };
    };

    if (stream) {
      const encoder = new TextEncoder();
      let controllerClosed = false;
      const responseStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const sendEvent = (event: Record<string, unknown>) => {
            if (controllerClosed) return;
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            } catch {
              controllerClosed = true;
            }
          };

          sendEvent({ type: 'start', message: 'Starting generation...' });
          sendEvent({
            type: 'progress',
            phase: 'planning',
            iteration: 0,
            currentAgent: 'capacity',
            score: 0,
            message: 'Preparing diagram generation...',
            progress: 2,
          });

          try {
            const payload = await generateAndFinalize((progress) => sendEvent({ type: 'progress', ...progress }));
            sendEvent({ type: 'complete', ...payload });
          } catch (error) {
            await releaseOnFailure();
            logger.error('[API] Streaming generation failed:', error);
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            const err = error as Error & { status?: number; code?: string };
            if (error instanceof CapacityBusyError) {
              sendEvent({
                type: 'error',
                success: false,
                error: error.code,
                code: error.code,
                retryable: true,
                details: error.message,
              });
            } else if (isTokenExhaustedError({ status: err.status, message })) {
              sendEvent({
                type: 'error',
                success: false,
                error: err.status === 402 ? 'payment_required' : 'rate_limited',
                details: message,
                userMessage: SERVER_BUSY_USER_MESSAGE,
              });
            } else {
              sendEvent({ type: 'error', success: false, error: 'generation_failed', details: message });
            }
          } finally {
            if (!controllerClosed) controller.close();
          }
        },
        cancel() {
          controllerClosed = true;
        },
      });

      return new Response(responseStream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    return NextResponse.json(await generateAndFinalize());

  } catch (error) {
    await releaseOnFailure();
    logger.error('[API] Generation failed:', error);

    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    const err = error as Error & { status?: number };

    if (error instanceof CapacityBusyError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code, retryable: true }, { status: 503 });
    }

    // Out of token budget / rate-limited / credits exhausted → friendly busy message
    if (isTokenExhaustedError({ status: err.status, message })) {
      return NextResponse.json(
        {
          success: false,
          error: err.status === 402 ? 'payment_required' : 'rate_limited',
          details: message,
          userMessage: SERVER_BUSY_USER_MESSAGE,
        },
        { status: err.status === 402 ? 503 : 429 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'generation_failed',
        details: message,
      },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Diagram generation API is running',
    endpoints: {
      POST: 'Generate a new architecture diagram',
    },
  });
}
