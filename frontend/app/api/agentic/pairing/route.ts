import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/server/ip';
import { hashAgenticSecret } from '@/lib/agentic-auth';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PAIRING_TTL_MS = 10 * 60 * 1000;
const startAttempts = new Map<string, { count: number; resetAt: number }>();

function createUserCode() {
  return Array.from(randomBytes(12), (byte) => USER_CODE_ALPHABET[byte & 31]).join('');
}

function isPairingStartRateLimited(request: NextRequest) {
  const now = Date.now();
  const ip = getClientIP(request);
  const existing = startAttempts.get(ip);

  if (!existing || now >= existing.resetAt) {
    if (!existing && startAttempts.size >= 5_000) {
      for (const [key, entry] of startAttempts) {
        if (now >= entry.resetAt) startAttempts.delete(key);
      }
      if (startAttempts.size >= 5_000) return true;
    }
    startAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }

  existing.count += 1;
  return existing.count > 10;
}

export async function POST(request: NextRequest) {
  if (isPairingStartRateLimited(request)) {
    return NextResponse.json(
      { error: 'Too many pairing requests. Try again in 15 minutes.' },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const userCode = createUserCode();
    const pollToken = `adp_${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    const pairing = await prisma.agenticPairingRequest.create({
      data: {
        userCodeHash: hashAgenticSecret(userCode),
        pollTokenHash: hashAgenticSecret(pollToken),
        expiresAt,
      },
      select: { id: true },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.json(
      {
        pairingId: pairing.id,
        userCode,
        pollToken,
        verificationUrl: new URL('/connect-agent', baseUrl).toString(),
        expiresAt: expiresAt.toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logger.error('Agentic pairing start error:', error);
    return NextResponse.json(
      { error: 'Unable to start pairing' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
