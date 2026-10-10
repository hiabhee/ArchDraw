import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import logger from '@/lib/logger';

export const runtime = 'nodejs';

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || '';

const identifySchema = z.object({
  anon_id: z.string().min(1),
  user_id: z.string().min(1),
});

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    logger.warn('[Analytics] identify: DATABASE_URL is not set');
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = identifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { anon_id, user_id } = parsed.data;
  const isInternal = ADMIN_USER_ID && user_id === ADMIN_USER_ID;

  after(async () => {
    try {
      await prisma.visitor.update({
        where: { anonId: anon_id },
        data: {
          userId: user_id,
          lastSeenAt: new Date(),
          ...(isInternal ? { isInternal: true } : {}),
        },
      });
    } catch (err) {
      logger.error('[Analytics] Failed to identify visitor (background):', err);
    }
  });

  return NextResponse.json({ ok: true });
}
