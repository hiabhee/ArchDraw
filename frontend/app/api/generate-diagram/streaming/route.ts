import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { generateDiagram } from '@/lib/ai/services/orchestrator';
import { inferSystemType, inferComplexity } from '@/lib/ai/utils/promptInference';
import type { UserIntent, GenerationProgress } from '@/lib/ai/types';
import logger from '@/lib/logger';
import { isTokenExhaustedError, SERVER_BUSY_USER_MESSAGE } from '@/lib/ai/utils/apiKeyManager';
import { z } from 'zod';
import { checkAIGenerationQuota, getSessionFromRequest, incrementAIGeneration, logUsage, getGuestId } from '@/lib/middleware/quotaCheck';

export const runtime = 'nodejs';
export const maxDuration = 300;

const generateDiagramSchema = z.object({
  description: z.string().min(1),
  systemType: z.string().optional(),
  complexity: z.enum(['low', 'medium', 'high']).optional(),
  model: z.string().optional(),
  diagramSize: z.enum(['small', 'medium', 'large']).optional(),
  stream: z.boolean().optional().default(true),
  existingContext: z.any().optional(),
});

export async function POST(req: NextRequest) {
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

  try {
    const body = await req.json();
    const validatedInput = generateDiagramSchema.safeParse(body);
    
    if (!validatedInput.success) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { description, systemType, complexity, model, diagramSize, stream: enableStream, existingContext } = validatedInput.data;

    if (enableStream === false) {
      return handleNonStreaming(req, validatedInput.data);
    }

    const encoder = new TextEncoder();
    let controllerClosed = false;
    
    const responseStream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: Record<string, unknown>) => {
          if (controllerClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            controllerClosed = true;
          }
        };

        try {
          sendEvent({ type: 'start', message: 'Starting generation...' });

          // DISABLED: Prompt enhancement was causing issues
          // Enhancement should be done at the reasoning stage, not before
          const userIntent: UserIntent = {
            description: description,
            systemType: systemType ?? inferSystemType(description),
            complexity: complexity ?? inferComplexity(description),
            model,
            diagramSize,
            existingContext,
          };

          sendEvent({ type: 'progress', phase: 'planning', message: 'Analyzing request...', progress: 15 });

          const progressEvents: GenerationProgress[] = [];

          const result = await generateDiagram(
            userIntent,
            (progress) => {
              if (controllerClosed) return;
              progressEvents.push(progress);
              sendEvent({ type: 'progress', ...progress });
            }
          );

          // Telemetry — non-blocking; stream already has result, don't delay completion
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

          sendEvent({ type: 'complete', data: result, progress: 100 });
          controller.close();

        } catch (error) {
          logger.error('[StreamingAPI] Error:', error);
          const message = error instanceof Error ? error.message : 'Generation failed';
          if (!controllerClosed) {
            sendEvent({
              type: 'error',
              success: false,
              error: 'generation_failed',
              details: isTokenExhaustedError({ message })
                ? SERVER_BUSY_USER_MESSAGE
                : message,
            });
            controller.close();
          }
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    logger.error('[StreamingAPI] Request error:', error);
    return NextResponse.json(
      { error: 'Request failed' },
      { status: 500 }
    );
  }
}

async function handleNonStreaming(req: NextRequest, data: z.infer<typeof generateDiagramSchema>) {
  const { description, systemType, complexity, model, diagramSize } = data;

  const userIntent: UserIntent = {
    description: description.trim(),
    systemType: systemType ?? inferSystemType(description),
    complexity: complexity ?? inferComplexity(description),
    model,
    diagramSize,
  };

  try {
    const result = await generateDiagram(userIntent);

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

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[StreamingAPI] Non-streaming generation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'generation_failed',
        details: error instanceof Error ? error.message : 'Generation failed',
      },
      { status: 502 }
    );
  }
}
