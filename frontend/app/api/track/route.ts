import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withRetry } from '@/lib/db-retry';

export const runtime = 'nodejs';

const eventSchema = z.object({
  event_type: z.string().max(50),
  event_name: z.string().max(100).optional(),
  page_path: z.string().max(500),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const trackSchema = z.object({
  events: z.array(eventSchema).max(50),
  session_id: z.string().uuid(),
  is_internal: z.boolean().optional(),
  referrer: z.string().max(2000).optional(),
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
let trackAccessCount = 0;
function cleanupTrackExpired(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 100;

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    console.warn('[Analytics] DATABASE_URL is not set — events are being dropped');
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_database_url' }, { status: 200 });
  }

  const anonId = req.cookies.get('ad_anon')?.value;
  if (!anonId) {
    console.warn('[Analytics] Missing ad_anon cookie');
    return NextResponse.json({ error: 'Missing anon_id cookie' }, { status: 400 });
  }

  // Rate limit per anon_id
  const now = Date.now();
  if (++trackAccessCount % 10 === 0) cleanupTrackExpired();
  const record = rateLimitMap.get(anonId);
  if (record && now < record.resetAt) {
    if (record.count >= RATE_LIMIT) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    record.count++;
  } else {
    rateLimitMap.set(anonId, { count: 1, resetAt: now + RATE_WINDOW_MS });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) {
    console.warn('[Analytics] Invalid payload:', parsed.error.flatten());
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { events, session_id, is_internal, referrer, utm_source, utm_medium, utm_campaign } = parsed.data;
  const userAgent = req.headers.get('user-agent') || '';
  const cfCountry = req.headers.get('cf-ipcountry') || req.headers.get('x-vercel-ip-country') || null;

  // Determine device type
  const ua = userAgent.toLowerCase();
  const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile'
    : /tablet|ipad/i.test(ua) ? 'tablet'
    : 'desktop';

  const entryPage = events.length > 0 ? events[0].page_path : null;
  const exitPage = events.length > 0 ? events[events.length - 1].page_path : null;

  const persistAnalytics = async () => {
    const visitorUpdate: Record<string, unknown> = {
      lastSeenAt: new Date(),
      userAgent,
      isInternal: is_internal || false,
    };
    if (cfCountry) visitorUpdate.country = cfCountry;

    const firstUtm: Record<string, string> = {};
    if (utm_source) firstUtm.source = utm_source;
    if (utm_medium) firstUtm.medium = utm_medium;
    if (utm_campaign) firstUtm.campaign = utm_campaign;

    try {
      const [visitor, existingSession] = await Promise.all([
        withRetry(() => prisma.visitor.upsert({
          where: { anonId },
          create: {
            anonId,
            ...visitorUpdate,
            ...(referrer ? { firstReferrer: referrer } : {}),
            ...(Object.keys(firstUtm).length > 0 ? { firstUtm: firstUtm } : {}),
          } as never,
          update: visitorUpdate,
          select: { id: true },
        })),
        prisma.visitorSession.findUnique({
          where: { id: session_id },
          select: { startedAt: true },
        }).catch(() => null),
      ]);

      const sessionWrite = existingSession
        ? withRetry(() => prisma.visitorSession.update({
            where: { id: session_id },
            data: {
              endedAt: new Date(),
              durationSeconds: Math.round(
                (Date.now() - new Date(existingSession.startedAt).getTime()) / 1000
              ),
              exitPage,
            },
          })).catch((err) => {
            console.error('[Analytics] Failed to update session:', err);
          })
        : withRetry(() => prisma.visitorSession.create({
            data: {
              id: session_id,
              visitorId: visitor.id,
              entryPage,
              deviceType,
              startedAt: new Date(),
            },
          })).catch((err) => {
            console.error('[Analytics] Failed to create session:', err);
          });

      const rows = events.map((e) => ({
        sessionId: session_id,
        visitorId: visitor.id,
        eventType: e.event_type,
        eventName: e.event_name || null,
        pagePath: e.page_path,
        payload: (e.payload || {}) as object,
      }));
      const eventsWrite = withRetry(() => prisma.event.createMany({ data: rows }));

      await Promise.all([sessionWrite, eventsWrite]);
    } catch (err) {
      console.error('[Analytics] Background track write failed:', err);
    }
  };

  // Defer DB writes so the calling client never waits on a cold Neon compute.
  // The response returns immediately; `after()` runs the writes after the
  // response is flushed (billed to the function's execution time, not the
  // user's request latency).
  try {
    after(persistAnalytics);
  } catch {
    // In non-request runtimes (e.g. some tests), `after` can be unavailable.
    // Fall back to inline persistence so payload validation behavior remains consistent.
    await persistAnalytics();
  }

  return NextResponse.json({ ok: true, recorded: events.length }, { status: 200 });
}
