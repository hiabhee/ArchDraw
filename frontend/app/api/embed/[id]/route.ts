import { NextRequest, NextResponse } from 'next/server';
import { redis, redisKeys } from '@/lib/redis';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import logger from '@/lib/logger';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

function getRateLimitKey(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  return `embed:${ip}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
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

interface DiagramData {
  nodes: unknown[];
  edges: unknown[];
  label?: string;
  createdAt: string;
  source?: 'mcp' | 'manual';
}

interface DiagramResponse {
  id: string;
  canvas_name: string;
  nodes: unknown[];
  edges: unknown[];
}

const ALLOWED_ORIGINS = [
  'https://archdraw.hiabhee.online',
  'http://localhost:3000',
  'http://localhost:3001',
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

  // Try local session store first
  const STORAGE_FILE = path.join(process.cwd(), '.diagram-sessions.json');
  let sessionData: DiagramData | null = null;
  
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const store = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8')) as Record<string, DiagramData>;
      sessionData = store[id] || null;
    }
  } catch {
    // Continue to Redis
  }

  // Return from session store if found
  if (sessionData) {
    logger.log(`[Embed] SESSION-STORE-HIT: ${id}`);
    const response: DiagramResponse = {
      id,
      canvas_name: sessionData.label || 'Shared Diagram',
      nodes: sessionData.nodes,
      edges: sessionData.edges,
    };
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': corsOrigin,
      },
    });
  }

  // Try Redis cache second
  let data: SharedCanvas | null = null;
  try {
    data = await redis.get<SharedCanvas>(redisKeys.sharedCanvas(id));
  } catch {
    // Redis failed, continue to Neon
  }

  // Neon/Prisma fallback
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

    data = row as unknown as SharedCanvas;

    // Cache to Redis with 24-hour TTL
    try {
      await redis.set(redisKeys.sharedCanvas(id), data, { ex: 86400 });
    } catch {
      // Redis write failed, continue
    }
  }

  const response: DiagramResponse = {
    id: data.id,
    canvas_name: data.canvas_name,
    nodes: data.nodes,
    edges: data.edges,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'X-Frame-Options': 'ALLOWALL',
    },
  });
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
