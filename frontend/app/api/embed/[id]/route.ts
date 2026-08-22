import { NextRequest, NextResponse } from 'next/server';
import { redis, redisKeys } from '@/lib/redis';
import prisma from '@/lib/prisma';
import { getClientIP } from '@/lib/server/ip';
import logger from '@/lib/logger';

export const runtime = 'nodejs';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

let accessCount = 0;
function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetTime) rateLimitMap.delete(key);
  }
}

function getRateLimitKey(request: NextRequest): string {
  // Keys on the trusted-proxy-aware client IP. The leftmost X-Forwarded-For
  // value is client-controllable, so keying on it would let an attacker
  // rotate the header to bypass the embed throttle.
  return `embed:${getClientIP(request)}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();

  // Sweep expired entries every 10 accesses to prevent unbounded growth.
  if (++accessCount % 10 === 0) cleanupExpired();

  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  record.count++;
  return true;
}

interface SharedCanvas {
  id: string;
  canvas_name: string;
  nodes: unknown[];
  edges: unknown[];
}

interface DiagramResponse {
  id: string;
  canvas_name: string;
  nodes: unknown[];
  edges: unknown[];
}

const ALLOWED_ORIGINS = [
  'https://archdraw.hiabhee.online',
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:3000', 'http://localhost:3001']
    : []),
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateKey = getRateLimitKey(request);
  if (!checkRateLimit(rateKey)) {
    return NextResponse.json(
      { error: 'Too many requests', code: 'RATE_LIMITED', status: 429 },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const origin = request.headers.get('origin') || '';
    
    // Validate origin
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) 
      ? origin 
      : ALLOWED_ORIGINS[0];

    // Check if ID is valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format' }, 
        { status: 400, headers: { 'Access-Control-Allow-Origin': corsOrigin } }
      );
    }

    // Try Redis cache first
    let data: SharedCanvas | null = null;
    try {
      data = await redis.get<SharedCanvas>(redisKeys.sharedCanvas(id));
    } catch {
      // Redis failed, continue to DB
    }

    // DB fallback
    if (!data) {
      const row = await prisma.sharedCanvas.findUnique({
        where: { id },
      });

      if (!row) {
        return NextResponse.json(
          { error: 'Diagram not found' }, 
          { status: 404, headers: { 'Access-Control-Allow-Origin': corsOrigin } }
        );
      }

      if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
        return NextResponse.json(
          { error: 'Share link has expired' }, 
          { status: 410, headers: { 'Access-Control-Allow-Origin': corsOrigin } }
        );
      }

      // Prisma uses canvasName; clients expect canvas_name.
      data = {
        id: row.id,
        canvas_name: row.canvasName,
        nodes: (row.nodes as unknown[]) ?? [],
        edges: (row.edges as unknown[]) ?? [],
      };

      // Cache to Redis with 24-hour TTL
      try {
        await redis.set(redisKeys.sharedCanvas(id), data, { ex: 86400 });
      } catch {
        // Redis write failed, continue
      }
    }

    const response: DiagramResponse = {
      id: data.id,
      canvas_name: data.canvas_name || 'Shared Diagram',
      nodes: data.nodes || [],
      edges: data.edges || [],
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    logger.error('Embed GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const corsOrigin = ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];
    
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
