import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import {
  getCacheKey,
  hashQuestion,
  getCached,
  setCache,
  compressHistory,
} from '@/lib/tutorialCache';
import { getCachedResponse, cacheResponse } from '@/lib/db';
import { redis, redisKeys, checkRateLimit } from '@/lib/redis';
import staticCacheData from '@/data/tutorialCache.json';
import { z } from 'zod';
import logger from '@/lib/logger';

// Zod validation schema
const chatMessageSchema = z.object({
  tutorialId: z.string().min(1, 'Tutorial ID is required'),
  stepNumber: z.number().int().positive('Step number must be a positive integer'),
  stepTitle: z.string().min(1, 'Step title is required'),
  stepExplanation: z.string().min(1, 'Step explanation is required'),
  question: z.string().min(1, 'Question is required').max(2000, 'Question must be under 2000 characters'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  explainCount: z.number().int().optional(),
});

type ChatMessageInput = z.infer<typeof chatMessageSchema>;

/**
 * Get rate limit identifier from request.
 */
function getRateLimitIdentifier(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  return `chat:${ip.split(',')[0].trim()}`;
}

// ── Groq client ───────────────────────────────────────────────────────────────
let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured. AI features require this environment variable.');
    }
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert system design tutor guiding users through architecture diagramming. You lead every step — the user follows your cues.

STRICT RULES:
- Max 3 sentences per response. Never exceed this.
- Never use bullet points or lists.
- Be warm, direct, and technically precise.
- Always end with a clear next action or a forward-looking statement.
- CRITICAL: Never tell the user how to respond. Never say "respond with yes or no", "let me know", "click a button", or reference any UI element. Never ask open-ended questions like "What do you think?" Just ask or state naturally — the UI handles response options.

PHASE INSTRUCTIONS — you will receive a PHASE tag in every message:

PHASE:CONTEXT
Give a 2-3 sentence overview of this system at real scale — one striking fact, one architectural teaser, end with "Ready to build it?". Never mention steps or components yet.

PHASE:INTRO
Ask a single yes/no question about whether the user knows what this component does. 1-2 sentences max. Make it feel like a quick knowledge check, not a quiz. Do NOT tell the user how to answer.

PHASE:TEACHING
Explain what the component does and why it exists in this specific architecture. Use one concrete real-world analogy. End with the exact action: tell them to press ⌘K and search for the component name.

PHASE:TEACHING with RETEACH:true
Give a different angle on why this component matters — focus on what breaks without it. Use a failure scenario. End with the same action instruction.

PHASE:ACTION
Give one crisp instruction: exactly what to search for and add. Nothing else.

PHASE:CELEBRATION
Celebrate in one sentence. Then give one real-world insight about this component at scale. End by hinting at what comes next without revealing it.

PHASE:WRONG_COMPONENT
The user added a component but it's not the one needed for this step. Gently redirect them — acknowledge what they added, then tell them exactly what to search for instead. Keep it encouraging, not critical. One sentence max.

CONTEXT: You will also receive the tutorial ID, step number, component name, explanation, and action instruction. Use these to make responses specific — never generic.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Stream a plain string as a ReadableStream, word by word. */
function streamString(text: string, cacheHeader: string): Response {
  const encoder = new TextEncoder();
  const words = text.split(' ');
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < words.length; i++) {
        controller.enqueue(encoder.encode(i < words.length - 1 ? words[i] + ' ' : words[i]));
        await new Promise(r => setTimeout(r, 0));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Cache': cacheHeader,
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Keyword match: check if the free-text question is asking about the current
 * step's component. Catches ~60-70% of free-text questions.
 * Returns the cached teaching:0 response if matched.
 */
function tryKeywordMatch(
  question: string,
  tutorialId: string,
  stepNumber: number,
  stepTitle: string,
): string | null {
  const q = question.toLowerCase();
  // Normalize step title to keywords: "Add the API Gateway" → ["api", "gateway"]
  const titleWords = stepTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  const matched = titleWords.some(word => q.includes(word));
  if (!matched) return null;

  const teachingKey = `${tutorialId}:${stepNumber}:teaching:0`;
  return (staticCacheData as Record<string, string>)[teachingKey] ?? null;
}

/** Persist a free-text response to DB (fire-and-forget). */
function persistToDB(questionHash: string, response: string): void {
  if (!process.env.DATABASE_URL) return;
  try {
    cacheResponse(questionHash, response).catch((err) => {
      logger.error('[API] DB persist error:', err);
    });
  } catch {
    // Non-critical — ignore
  }
}

/** Look up a free-text question hash in the DB. */
async function lookupDB(questionHash: string): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await getCachedResponse(questionHash);
  } catch {
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limiting using Redis (configurable via environment variable)
  const ENABLE_RATE_LIMITING = process.env.ENABLE_RATE_LIMITING !== 'false'; // enabled by default
  
  if (ENABLE_RATE_LIMITING) {
    const identifier = getRateLimitIdentifier(req);
    
    try {
      const { allowed, remaining, resetAt } = await checkRateLimit(
        identifier,
        15, // max 15 requests
        60  // per 60 seconds
      );
      
      if (!allowed) {
        const waitSeconds = Math.ceil((resetAt - Math.floor(Date.now() / 1000)));
        logger.warn(`[API] Chat rate limit exceeded for ${identifier}`);
        
        return NextResponse.json(
          { 
            error: `Too many messages. Please wait ${waitSeconds} seconds before sending another message.`, 
            code: 'RATE_LIMITED', 
            status: 429 
          },
          { status: 429 }
        );
      }
      
      logger.debug(`[API] Chat rate limit check passed: ${remaining} remaining`);
    } catch (error) {
      // Rate limit check failed - log and allow request (graceful degradation - Option A)
      logger.error('[API] Chat rate limit check failed, allowing request (graceful degradation):', error);
      
      // Continue processing the request despite rate limit failure
      // This ensures the application remains functional even if Redis is down
    }
  } else {
    logger.debug('[API] Rate limiting disabled via ENABLE_RATE_LIMITING=false');
  }

  try {
    // Parse and validate request body with Zod
    const body = await req.json();
    const validatedInput = chatMessageSchema.safeParse(body);
    
    if (!validatedInput.success) {
      const errorMessage = validatedInput.error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return NextResponse.json(
        { error: errorMessage || 'Invalid request body', code: 'VALIDATION_ERROR', status: 400 },
        { status: 400 }
      );
    }

    const { tutorialId, stepNumber, stepTitle, stepExplanation, question, history = [], explainCount = 0 } = validatedInput.data as ChatMessageInput;

    // Netflix moved to static — no live tutorials currently
    const LIVE_TUTORIALS: string[] = [];
    if (!LIVE_TUTORIALS.includes(tutorialId)) {
      return NextResponse.json(
        { error: 'This tutorial uses static content' },
        { status: 403 },
      );
    }

    // Guard: require GROQ_API_KEY before attempting any Groq call
    if (!process.env.GROQ_API_KEY) {
      logger.error('[API] GROQ_API_KEY is not set — cannot serve AI responses');
      return NextResponse.json(
        { error: 'AI service unavailable — server misconfiguration' },
        { status: 503 },
      );
    }

    const phaseMatch = question.match(/PHASE:(\w+)/i);
    const rawPhase = phaseMatch ? phaseMatch[1].toLowerCase() : null;
    const isReteach = /RETEACH:true/i.test(question);
    const isFreeText = !rawPhase; // no PHASE tag = user typed a custom question

    // ── 1. Static pre-generated cache ────────────────────────────────────────
    if (rawPhase) {
      // Context phase uses a flat key without step number
      if (rawPhase === 'context') {
        const contextKey = `${tutorialId}:context`;
        const contextHit = (staticCacheData as Record<string, string>)[contextKey];
        if (contextHit) {
          logger.log(`[API] STATIC-HIT ${contextKey}`);
          return streamString(contextHit, 'STATIC-HIT');
        }
      }
      const staticExplainCount = isReteach ? (explainCount || 1) : explainCount;
      const staticKey = `${tutorialId}:${stepNumber}:${rawPhase}:${staticExplainCount}`;
      const staticHit = (staticCacheData as Record<string, string>)[staticKey];
      if (staticHit) {
        logger.log(`[API] STATIC-HIT ${staticKey}`);
        return streamString(staticHit, 'STATIC-HIT');
      }
      logger.log(`[API] STATIC-MISS ${staticKey}`);
    }

    // ── 2. Runtime in-memory cache (phase messages that missed static) ────────
    const qHash = hashQuestion(question);
    const runtimeKey = getCacheKey(tutorialId, stepNumber, 'question', qHash);
    const runtimeHit = getCached(runtimeKey);
    if (runtimeHit) {
      logger.log(`[API] RUNTIME-HIT ${runtimeKey}`);
      return NextResponse.json(
        { content: runtimeHit.content },
        { headers: { 'X-Cache': 'HIT' } },
      );
    }

    // ── 3. Upstash Redis cache ────────────────────────────────────────────────
    let redisKey: string;
    if (rawPhase === 'wrong_component') {
      redisKey = redisKeys.tutorialWrong(tutorialId, stepNumber);
    } else if (isFreeText) {
      redisKey = redisKeys.tutorialFreeText(qHash, tutorialId, stepNumber);
    } else {
      const staticExplainCount = isReteach ? (explainCount || 1) : explainCount;
      redisKey = redisKeys.tutorialPhase(tutorialId, stepNumber, rawPhase ?? 'unknown', staticExplainCount);
    }

    try {
      const redisHit = await redis.get<string>(redisKey);
      if (redisHit) {
        logger.log(`[API] REDIS-HIT ${redisKey}`);
        return streamString(redisHit, 'REDIS-HIT');
      }
      logger.log(`[API] REDIS-MISS ${redisKey}`);
    } catch (err) {
      // Redis unavailable — continue to Groq, don't fail the request
      logger.warn('[API] Redis lookup failed, falling through:', err);
    }

    // ── 4. Free-text keyword match → serve cached teaching response ───────────
    if (isFreeText) {
      const keywordHit = tryKeywordMatch(question, tutorialId, stepNumber, stepTitle);
      if (keywordHit) {
        logger.log(`[API] KEYWORD-HIT step=${stepNumber} q="${question.slice(0, 40)}"`);
        return streamString(keywordHit, 'KEYWORD-HIT');
      }

      // ── 5. DB persistent cache for free-text ──────────────────────────
      const dbHit = await lookupDB(qHash);
      if (dbHit) {
        logger.log(`[API] DB-HIT hash=${qHash}`);
        return streamString(dbHit, 'DB-HIT');
      }
    }

    // ── 6. Groq call ──────────────────────────────────────────────────────────
    logger.log(`[API] GROQ phase=${rawPhase ?? 'free-text'} step=${stepNumber}`);

    const contextMessage = `Current tutorial step ${stepNumber}: "${stepTitle}"\nContext: ${stepExplanation}`;
    const compressedHistory = compressHistory(history);
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: contextMessage },
      ...compressedHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: question },
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const completion = await getGroq().chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages,
            max_tokens: 180,
            temperature: 0.7,
            stream: true,
          });

          let fullText = '';
          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content ?? '';
            if (delta) {
              fullText += delta;
              controller.enqueue(encoder.encode(delta));
            }
          }

          const finalText = fullText.trim();
          if (finalText) {
            // Save to runtime cache
            setCache(runtimeKey, finalText, []);
            // Save to Upstash Redis (fire-and-forget)
            const ttl = isFreeText ? 604800 : undefined; // 7 days for free-text, no expiry for phase
            redis.set(redisKey, finalText, ttl ? { ex: ttl } : {}).catch(err =>
              logger.warn('[API] Redis write failed:', err)
            );
            // Save free-text responses to DB (fire-and-forget)
            if (isFreeText) persistToDB(qHash, finalText);
          }

          controller.close();
        } catch (err) {
          logger.error('[API] Groq stream error:', err);
          const fallback = stepExplanation || 'Let\'s continue building the architecture.';
          controller.enqueue(encoder.encode(fallback));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Cache': 'MISS',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    logger.error('Tutorial chat error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
