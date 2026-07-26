import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WARMUP_CRON_SECRET = process.env.WARMUP_CRON_SECRET;

function isAuthorized(req: Request): boolean {
  if (!WARMUP_CRON_SECRET) return true; // Unprotected only when no secret configured (local dev)

  // External pingers (UptimeRobot etc.): `?secret=…`
  const url = new URL(req.url);
  if (url.searchParams.get('secret') === WARMUP_CRON_SECRET) return true;

  // Vercel Cron / header-based pingers: `Authorization: Bearer <secret>`
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.replace(/^Bearer\s+/i, '') === WARMUP_CRON_SECRET) return true;

  // Vercel's own cron auth header
  if (req.headers.get('x-vercel-cron-auth') === WARMUP_CRON_SECRET) return true;

  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    // Touch the DB to wake Neon compute and exercise the connection pool.
    // SELECT 1 is the cheapest probe that forces a real round-trip.
    await prisma.$queryRaw`SELECT 1`;
    const elapsed = Date.now() - startedAt;
    return NextResponse.json({ ok: true, role: 'warmup', elapsedMs: elapsed });
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    console.error('[warmup] DB ping failed:', err);
    return NextResponse.json({ ok: false, error: 'db_unreachable', elapsedMs: elapsed }, { status: 503 });
  }
}