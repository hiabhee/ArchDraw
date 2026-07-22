import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || '';

const identifySchema = z.object({
  anon_id: z.string().min(1),
  user_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
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

  try {
    await prisma.visitor.update({
      where: { anonId: anon_id },
      data: {
        userId: user_id,
        lastSeenAt: new Date(),
        ...(isInternal ? { isInternal: true } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to identify' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
