import { NextRequest, NextResponse } from 'next/server';
import { generateDiagram } from '@/lib/ai/services/orchestrator';
import { AVAILABLE_MODELS } from '@/lib/ai/utils/apiKeyManager';
import type { UserIntent, GenerationProgress } from '@/lib/ai/types';
import logger from '@/lib/logger';
import { z } from 'zod';

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

// Rate limiting
const generateRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const GENERATE_RATE_WINDOW_MS = 60 * 1000;
const MAX_GENERATE_REQUESTS = 5;

function getGenerateRateKey(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  return `generate:${ip}`;
}

function checkGenerateRateLimit(key: string): boolean {
  const now = Date.now();
  const record = generateRateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    generateRateLimitMap.set(key, { count: 1, resetTime: now + GENERATE_RATE_WINDOW_MS });
    return true;
  }
  
  if (record.count >= MAX_GENERATE_REQUESTS) {
    return false;
  }
  
  record.count++;
  return true;
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateKey = getGenerateRateKey(req);
  if (!checkGenerateRateLimit(rateKey)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before generating another diagram.', code: 'RATE_LIMITED', status: 429 },
      { status: 429 }
    );
  }

  // Auth check removed - allow unauthenticated diagram generation
  // Auth is only required for sharing/exporting

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

    return NextResponse.json({
      success: true,
      data: result,
      progress: progressEvents,
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
