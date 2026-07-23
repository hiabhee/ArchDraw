import { NextRequest, NextResponse } from 'next/server';
import { generateDiagram } from '@/lib/ai/services/orchestrator';
import type { UserIntent, GenerationProgress } from '@/lib/ai/types';
import logger from '@/lib/logger';
import { z } from 'zod';
import { checkAIGenerationQuota, incrementAIGeneration, logUsage, getGuestId } from '@/lib/middleware/quotaCheck';

function inferSystemType(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('ecommerce') || lower.includes('shop') || lower.includes('order')) return 'E-commerce Platform';
  if (lower.includes('chat') || lower.includes('messaging') || lower.includes('realtime')) return 'Real-time Messaging';
  if (lower.includes('social') || lower.includes('twitter')) return 'Social Media Platform';
  if (lower.includes('streaming') || lower.includes('video') || lower.includes('netflix')) return 'Streaming Platform';
  if (lower.includes('payment') || lower.includes('transaction') || lower.includes('fintech')) return 'Payment System';
  if (lower.includes('iot') || lower.includes('sensor')) return 'IoT Platform';
  if (lower.includes('ml') || lower.includes('machine learning') || lower.includes('ai')) return 'ML/AI Platform';
  if (lower.includes('saas') || lower.includes('multi-tenant')) return 'SaaS Platform';
  return 'Monolith Architecture';
}

function inferComplexity(description: string): 'low' | 'medium' | 'high' {
  const lower = description.toLowerCase();
  const wordCount = description.split(/\s+/).length;
  const complexKeywords = ['microservices', 'distributed', 'event-driven', 'real-time', 'multi-tenant', 'caching', 'message queue', 'load balancer'];
  const complexCount = complexKeywords.filter(kw => lower.includes(kw)).length;
  if (complexCount >= 5 || wordCount > 50) return 'high';
  if (complexCount >= 2 || wordCount > 20) return 'medium';
  return 'low';
}

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

          // Disabled: API-level cache was causing same outputs for different prompts
          // Semantic caching is now handled in orchestrator with intent-aware keys
          // const cachedResult = diagramCache.get(description, model);
          // if (cachedResult) {
          //   sendEvent({ type: 'cached', message: 'Found cached result' });
          //   sendEvent({ type: 'complete', data: cachedResult });
          //   controller.close();
          //   return;
          // }

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

          // Disabled: Writing to diagramCache was causing repeated diagrams
          // diagramCache.set(description, { ... });

          const userId = (await import('@/lib/middleware/quotaCheck')).getSessionFromRequest(req).then(s => s?.user?.id ?? null);
          const resolvedUserId = await userId;
          await incrementAIGeneration(resolvedUserId);
          await logUsage(resolvedUserId, getGuestId(req), 'ai_generation', {
            description: description.substring(0, 100),
            nodeCount: result.nodes?.length || 0,
          });

          sendEvent({ type: 'complete', data: result, progress: 100 });
          controller.close();

        } catch (error) {
          logger.error('[StreamingAPI] Error:', error);
          if (!controllerClosed) {
            sendEvent({
              type: 'error',
              success: false,
              error: 'generation_failed',
              details: error instanceof Error ? error.message : 'Generation failed',
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

  // Disabled: Caching was causing repeated diagrams
  // const cachedResult = diagramCache.get(description, model);
  // if (cachedResult) { ... }

  const userIntent: UserIntent = {
    description: description.trim(),
    systemType: systemType ?? inferSystemType(description),
    complexity: complexity ?? inferComplexity(description),
    model,
    diagramSize,
  };

  try {
    const result = await generateDiagram(userIntent);

    const userId = (await import('@/lib/middleware/quotaCheck')).getSessionFromRequest(req).then(s => s?.user?.id ?? null);
    const resolvedUserId = await userId;
    await incrementAIGeneration(resolvedUserId);
    await logUsage(resolvedUserId, getGuestId(req), 'ai_generation', {
      description: description.substring(0, 100),
      nodeCount: result.nodes?.length || 0,
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
