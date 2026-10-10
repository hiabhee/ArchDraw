import { NextRequest } from 'next/server';
import { POST as loadPOST } from '@/app/api/diagram/load/route';
import { POST as exportPOST } from '@/app/api/diagram/export/route';
import { GET as sessionGET } from '@/app/api/diagram/session/[sessionId]/route';

/**
 * fetch() for MCP tools running inside the hosted endpoint.
 *
 * The tools talk to the ArchDraw API over HTTP. Inside the app we call the
 * route handlers directly instead: no network hop back to ourselves, and the
 * per-IP throttles on `/api/diagram/load` see the real MCP client's IP (copied
 * from the edge-set headers of the incoming request) rather than every hosted
 * user sharing the server's egress IP. Unknown URLs fall through to fetch().
 */

// Edge-set client-IP headers; getClientIP() trusts these. Cookies and
// Authorization are deliberately not forwarded.
const FORWARDED_HEADERS = ['x-vercel-forwarded-for', 'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'];

export function createInProcessFetch(incoming: Request, apiBase: string): typeof fetch {
  const origin = new URL(apiBase).origin;

  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== origin) return fetch(input, init);

    const headers = new Headers(init?.headers);
    for (const name of FORWARDED_HEADERS) {
      const value = incoming.headers.get(name);
      if (value) headers.set(name, value);
    }
    const request = new NextRequest(url, { ...init, headers } as ConstructorParameters<typeof NextRequest>[1]);
    const method = request.method.toUpperCase();

    if (url.pathname === '/api/diagram/load' && method === 'POST') return loadPOST(request);
    if (url.pathname === '/api/diagram/export' && method === 'POST') return exportPOST(request);
    const session = url.pathname.match(/^\/api\/diagram\/session\/([^/]+)$/);
    if (session && method === 'GET') {
      return sessionGET(request, { params: Promise.resolve({ sessionId: decodeURIComponent(session[1]) }) });
    }
    return fetch(input, init);
  };
}
