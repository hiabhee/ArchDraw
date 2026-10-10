import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/server/prisma';
import logger from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Expired shares are already hidden by every read route (share, embed, og,
// export, session); this job deletes them so `shared_canvases` doesn't grow
// without bound now that MCP publishes a preview link on every generation.
const BATCH_SIZE = 500;
const MAX_BATCHES = 40; // ≤ 20k rows per run; the next run picks up the rest.

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Fail closed when
  // the secret isn't configured so the endpoint can't be triggered publicly.
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  let deleted = 0;
  try {
    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const expired = await prisma.sharedCanvas.findMany({
        where: { expiresAt: { lt: now } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (expired.length === 0) break;
      const result = await prisma.sharedCanvas.deleteMany({
        where: { id: { in: expired.map((row) => row.id) }, expiresAt: { lt: now } },
      });
      deleted += result.count;
      if (expired.length < BATCH_SIZE) break;
    }
    logger.info('[Cron] Deleted expired shared canvases', { deleted });
    return NextResponse.json({ deleted });
  } catch (error) {
    logger.error('[Cron] Expired share cleanup failed', { deleted, error });
    return NextResponse.json({ error: 'Cleanup failed', deleted }, { status: 500 });
  }
}
