import { NextRequest, NextResponse } from 'next/server';
import { generateDiagram } from '@/lib/ai/services/orchestrator';
import { MODELS, isKnownModel } from '@/lib/ai/models';
import { inferSystemType, inferComplexity } from '@/lib/ai/utils/promptInference';
import type { UserIntent, GenerationProgress } from '@/lib/ai/types';
import { get as getCachedDiagram, set as setCachedDiagram } from '@/lib/ai/services/diagramCache';
import logger from '@/lib/logger';
import { z } from 'zod';
import { getClientIP } from '@/lib/server/ip';
import { checkAIGenerationQuota, incrementAIGeneration, logUsage, getGuestId } from '@/lib/middleware/quotaCheck';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Known model IDs the pipeline can route — derived from the single source of
// truth in lib/ai/models.ts (shared by client and server so the offered
// dropdown and the accepted wire values can never diverge).
const SUPPORTED_MODEL_IDS = new Set(MODELS.map((m) => m.id));

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
});

type GenerateDiagramInput = z.infer<typeof generateDiagramSchema>;

/**
 * Get rate limit identifier from request.
 * Uses the trusted-proxy-aware client IP resolver so that a spoofable
 * leftmost X-Forwarded-For value cannot reset the rate-limit counter.
 */
function getRateLimitIdentifier(request: NextRequest): string {
  return getClientIP(request);
}

export async function POST(req: NextRequest) {
  // Tier-aware quota enforcement
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
    // Parse and validate request body with Zod
    const body = await req.json();
    const validatedInput = generateDiagramSchema.safeParse(body);
    
    if (!validatedInput.success) {
      const errorMessage = validatedInput.error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return NextResponse.json(
        { error: errorMessage || 'Invalid request body', code: 'VALIDATION_ERROR', status: 400 },
        { status: 400 }
      );
    }

    const { description, systemType, complexity, model, diagramSize, detailLevel } = validatedInput.data as GenerateDiagramInput;

    // Fast path: an identical prompt+model+detail request was generated recently.
    // Regenerate re-submits the same prompt, so this serves it instantly instead
    // of re-running the full LLM pipeline (see lib/ai/services/diagramCache.ts).
    const cached = getCachedDiagram(description, detailLevel, model);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        progress: [],
        cached: true,
      });
    }

    const userIntent: UserIntent = {
      description: description.trim(),
      systemType: systemType ?? inferSystemType(description),
      complexity: complexity ?? inferComplexity(description),
      model,
      diagramSize,
      detailLevel,
    };

    const progressEvents: GenerationProgress[] = [];

    const result = await generateDiagram(userIntent, (progress) => {
      progressEvents.push(progress);
    });

    setCachedDiagram(description, detailLevel, model, result);

    // Track usage
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
      progress: progressEvents,
      quotaRemaining: quotaCheck.remaining,
    });

  } catch (error) {
    logger.error('[API] Generation failed:', error);

    const message = error instanceof Error ? error.message : 'Unknown error occurred';

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



