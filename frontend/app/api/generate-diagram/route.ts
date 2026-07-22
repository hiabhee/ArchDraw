import { NextRequest, NextResponse } from 'next/server';
import { generateDiagram } from '@/lib/ai/services/orchestrator';
import { AVAILABLE_MODELS } from '@/lib/ai/utils/apiKeyManager';
import type { UserIntent, GenerationProgress } from '@/lib/ai/types';
import logger from '@/lib/logger';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/redis';
import { checkAIGenerationQuota, incrementAIGeneration, logUsage, getGuestId } from '@/lib/middleware/quotaCheck';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Known model IDs the pipeline can route — serves as a clear rejection for
// obviously invalid model strings while remaining extensible.
const SUPPORTED_MODEL_IDS = new Set([
  ...AVAILABLE_MODELS.map(m => m.name),
  'llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-120b',
]);

// Zod validation schema
const generateDiagramSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  systemType: z.string().optional(),
  complexity: z.enum(['low', 'medium', 'high']).optional(),
  model: z.string().refine(
    val => !val || SUPPORTED_MODEL_IDS.has(val),
    { message: `Unsupported model. Supported: ${Array.from(SUPPORTED_MODEL_IDS).join(', ')}` }
  ).optional(),
  diagramSize: z.enum(['small', 'medium', 'large']).optional(),
  detailLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

type GenerateDiagramInput = z.infer<typeof generateDiagramSchema>;

/**
 * Get rate limit identifier from request.
 * Uses IP address, falls back to a generic identifier if unavailable.
 */
function getRateLimitIdentifier(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  return ip.split(',')[0].trim(); // Handle comma-separated IPs (proxy chains)
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

function inferSystemType(description: string): string {
  const lower = description.toLowerCase();

  if (lower.includes('ecommerce') || lower.includes('shop') || lower.includes('order')) {
    return 'E-commerce Platform';
  }
  if (lower.includes('chat') || lower.includes('messaging') || lower.includes('realtime')) {
    return 'Real-time Messaging';
  }
  if (lower.includes('social') || lower.includes('twitter') || lower.includes('instagram')) {
    return 'Social Media Platform';
  }
  if (lower.includes('streaming') || lower.includes('video') || lower.includes('netflix')) {
    return 'Streaming Platform';
  }
  if (lower.includes('payment') || lower.includes('transaction') || lower.includes('fintech')) {
    return 'Payment System';
  }
  if (lower.includes('iot') || lower.includes('sensor') || lower.includes('device')) {
    return 'IoT Platform';
  }
  if (lower.includes('ml') || lower.includes('machine learning') || lower.includes('ai')) {
    return 'ML/AI Platform';
  }
  if (lower.includes('saas') || lower.includes('multi-tenant')) {
    return 'SaaS Platform';
  }

  return 'Monolith Architecture';
}

function inferComplexity(description: string): 'low' | 'medium' | 'high' {
  const lower = description.toLowerCase();
  const wordCount = description.split(/\s+/).length;

  const complexKeywords = [
    'microservices', 'distributed', 'event-driven', 'real-time',
    'multi-tenant', 'caching', 'message queue', 'load balancer',
    'cdn', 'cdn', 'database', 'cache', 'queue', 'worker',
  ];

  const complexCount = complexKeywords.filter(kw => lower.includes(kw)).length;

  if (complexCount >= 5 || wordCount > 50) {
    return 'high';
  }
  if (complexCount >= 2 || wordCount > 20) {
    return 'medium';
  }
  return 'low';
}
