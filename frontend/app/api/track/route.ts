import { NextRequest, NextResponse } from 'next/server';
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

  // Upsert visitor
  let visitor;
  try {
    const existingVisitor = await prisma.visitor.findUnique({
      where: { anonId },
      select: { id: true, firstReferrer: true },
    });

    const visitorUpdate: Record<string, unknown> = {
      lastSeenAt: new Date(),
      userAgent,
      isInternal: is_internal || false,
    };

    if (cfCountry) visitorUpdate.country = cfCountry;

    // Set first_referrer and first_utm only on first visit
    if (!existingVisitor) {
      if (referrer) visitorUpdate.firstReferrer = referrer;
      const utm: Record<string, string> = {};
      if (utm_source) utm.source = utm_source;
      if (utm_medium) utm.medium = utm_medium;
      if (utm_campaign) utm.campaign = utm_campaign;
      if (Object.keys(utm).length > 0) visitorUpdate.firstUtm = utm;
    }

    visitor = await withRetry(() => prisma.visitor.upsert({
      where: { anonId },
      create: {
        anonId,
        ...visitorUpdate,
      } as never,
      update: visitorUpdate,
      select: { id: true },
    }));
  } catch (err) {
    console.error('[Analytics] Failed to upsert visitor:', err);
    return NextResponse.json({ error: 'Failed to upsert visitor' }, { status: 500 });
  }

  // Determine device type
  const ua = userAgent.toLowerCase();
  const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile'
    : /tablet|ipad/i.test(ua) ? 'tablet'
    : 'desktop';

  // Upsert session
  try {
    const existingSession = await prisma.visitorSession.findUnique({
      where: { id: session_id },
      select: { id: true, startedAt: true },
    });

    if (!existingSession) {
      const entryPage = events.length > 0 ? events[0].page_path : null;
      await withRetry(() => prisma.visitorSession.create({
        data: {
          id: session_id,
          visitorId: visitor.id,
          entryPage,
          deviceType,
          startedAt: new Date(),
        },
      }));
    } else {
      const exitPage = events.length > 0 ? events[events.length - 1].page_path : null;
      const durationSeconds = Math.round(
        (Date.now() - new Date(existingSession.startedAt).getTime()) / 1000
      );
      await withRetry(() => prisma.visitorSession.update({
        where: { id: session_id },
        data: {
          endedAt: new Date(),
          durationSeconds,
          exitPage,
        },
      }));
    }
  } catch (err) {
    console.error('[Analytics] Failed to upsert session:', err);
    // Continue — events are more important than session metadata
  }

  // Batch insert events
  try {
    const rows = events.map((e) => ({
      sessionId: session_id,
      visitorId: visitor.id,
      eventType: e.event_type,
      eventName: e.event_name || null,
      pagePath: e.page_path,
      payload: (e.payload || {}) as object,
    }));

    await withRetry(() => prisma.event.createMany({ data: rows }));
  } catch (err) {
    console.error('[Analytics] Failed to insert events:', err);
    return NextResponse.json({ error: 'Failed to insert events' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recorded: events.length }, { status: 200 });
}
