import { NextRequest, NextResponse } from 'next/server';
import { handleMcpHttpRequest } from '@hiabhee/archdraw-mcp-server/server';
import logger from '@/lib/logger';
import { getClientIP } from '@/lib/server/ip';
import { checkRateLimitWithFallback } from '@/lib/server/redis';
import { SITE_URL } from '@/lib/site/discovery';
import { mcpWorkingSessionStore } from '@/lib/server/mcp/sessionStore';
import { createInProcessFetch } from '@/lib/server/mcp/inProcessFetch';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Hosted ArchDraw MCP server (Streamable HTTP, stateless JSON mode).
 *
 * Same tools as the npm stdio package (`@hiabhee/archdraw-mcp-server`), for
 * clients that can only reach remote servers — claude.ai / Claude apps, the
 * OpenAI directory. Unauthenticated like the stdio server: diagrams are
 * anonymous shares. Working sessions persist in Redis (`sessionStore.ts`);
 * tool → API calls run in-process (`inProcessFetch.ts`).
 */

const MAX_REQUEST_BYTES = 1_000_000;
const REQUESTS_PER_MINUTE = 120;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function jsonRpcError(status: number, message: string, extraHeaders?: Record<string, string>) {
  return withCors(NextResponse.json(
    { jsonrpc: '2.0', error: { code: -32000, message }, id: null },
    { status, headers: extraHeaders },
  ));
}

export async function POST(req: NextRequest) {
  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_REQUEST_BYTES) return jsonRpcError(413, 'Request body too large');

  const limit = await checkRateLimitWithFallback(`mcp:ip:${getClientIP(req)}`, REQUESTS_PER_MINUTE, 60);
  if (!limit.allowed) {
    const retryAfter = Math.max(1, limit.resetAt - Math.floor(Date.now() / 1000));
    return jsonRpcError(429, 'Too many requests. Please slow down.', { 'Retry-After': String(retryAfter) });
  }

  const body = await req.text();
  if (Buffer.byteLength(body) > MAX_REQUEST_BYTES) return jsonRpcError(413, 'Request body too large');

  const request = new Request(req.url, { method: 'POST', headers: req.headers, body });
  try {
    const response = await handleMcpHttpRequest(request, {
      sessionStore: mcpWorkingSessionStore,
      context: { apiBase: SITE_URL, fetch: createInProcessFetch(req, SITE_URL) },
    });
    return withCors(response);
  } catch (error) {
    logger.error('[MCP] Hosted request failed:', error);
    return jsonRpcError(500, 'Internal server error');
  }
}

// Stateless server: no server-initiated SSE stream and no sessions to delete.
export async function GET() {
  return jsonRpcError(405, 'Method not allowed. POST JSON-RPC messages to this endpoint.', { Allow: 'POST, OPTIONS' });
}

export async function DELETE() {
  return jsonRpcError(405, 'Method not allowed.', { Allow: 'POST, OPTIONS' });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
