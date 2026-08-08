import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { getClientIP } from '@/lib/server/ip';
import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';

const checkRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const CHECK_RATE_WINDOW_MS = 60 * 1000;
const MAX_CHECK_REQUESTS = 10;

let checkAccessCount = 0;
function cleanupCheckExpired(): void {
  const now = Date.now();
  for (const [key, entry] of checkRateLimitMap) {
    if (now > entry.resetTime) checkRateLimitMap.delete(key);
  }
}

function getCheckRateKey(request: NextRequest): string {
  // Keys on the trusted-proxy-aware client IP — leftmost X-Forwarded-For is
  // client-controllable and would let an attacker reset this counter.
  return `check:${getClientIP(request)}`;
}

function checkCheckRateLimit(key: string): boolean {
  const now = Date.now();

  if (++checkAccessCount % 10 === 0) cleanupCheckExpired();

  const record = checkRateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    checkRateLimitMap.set(key, { count: 1, resetTime: now + CHECK_RATE_WINDOW_MS });
    return true;
  }
  
  if (record.count >= MAX_CHECK_REQUESTS) {
    return false;
  }
  
  record.count++;
  return true;
}

const tutorialCheckSchema = z.object({
  tutorialId: z.string().min(1, 'Tutorial ID is required'),
  stepNumber: z.number().int().positive('Step number must be a positive integer'),
  stepTitle: z.string().min(1, 'Step title is required'),
  stepExplanation: z.string().min(1, 'Step explanation is required'),
  requiredNodes: z.array(z.string()).optional(),
  requiredEdges: z.array(z.object({
    from: z.string(),
    to: z.string(),
  })).optional(),
  canvasNodes: z.array(z.object({
    label: z.string(),
  })),
  canvasEdges: z.array(z.object({
    source: z.string(),
    target: z.string(),
  })).optional(),
});

const SYSTEM_PROMPT = `You are an expert system design tutor reviewing a student's Netflix architecture diagram.
The student has placed nodes (components) and edges (connections) on a canvas.
Your job is to review their work for the current step and give concise, specific feedback.
Be encouraging but honest. Point out what's correct, what's missing or wrong, and one concrete improvement.
Keep your response under 120 words. Do not use bullet points — write in 2-3 short sentences.`;

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateKey = getCheckRateKey(req);
  if (!checkCheckRateLimit(rateKey)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before checking again.', code: 'RATE_LIMITED', status: 429 },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const validatedInput = tutorialCheckSchema.safeParse(body);
    
    if (!validatedInput.success) {
      const errorMessage = validatedInput.error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return NextResponse.json(
        { error: errorMessage || 'Invalid request body', code: 'VALIDATION_ERROR', status: 400 },
        { status: 400 }
      );
    }

    const {
      tutorialId,
      stepNumber,
      stepTitle,
      stepExplanation,
      requiredNodes = [],
      requiredEdges = [],
      canvasNodes,
      canvasEdges = [],
    } = validatedInput.data;

    const nodeList = canvasNodes.map((n) => n.label).join(', ') || 'none';
    const edgeList = canvasEdges.length > 0
      ? canvasEdges.map((e) => `${e.source} → ${e.target}`).join(', ')
      : 'none';
    const requiredNodeList = requiredNodes.join(', ') || 'none';
    const requiredEdgeList = requiredEdges.length > 0
      ? requiredEdges.map((e) => `${e.from} → ${e.to}`).join(', ')
      : 'none';

    const userPrompt = `Step ${stepNumber}: "${stepTitle}"
Goal: ${stepExplanation}

Required components: ${requiredNodeList}
Required connections: ${requiredEdgeList}

Student's canvas components: ${nodeList}
Student's canvas connections: ${edgeList}

Review the student's work for this step. Is it correct? What's good? What's missing or needs fixing?`;

    if (!apiKeyManager.hasGroq()) {
      return NextResponse.json(
        { error: 'AI tutorial check is not configured on this server.', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const completion = await apiKeyManager.executeWithGroq((groq) =>
            groq.chat.completions.create({
              model: 'llama-3.1-8b-instant',
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
              ],
              max_tokens: 200,
              temperature: 0.5,
              stream: true,
            })
          );

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content ?? '';
            if (delta) controller.enqueue(encoder.encode(delta));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    logger.error('Tutorial check error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
