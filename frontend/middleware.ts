import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Nonce-based Content-Security-Policy for page routes.
 *
 * - Per-request nonce + 'strict-dynamic' replaces production 'unsafe-inline'
 *   for scripts (see OWASP/Next.js CSP guidance).
 * - Host sources (vercel-scripts, vercel.live) are kept as fallback for
 *   CSP2-only browsers; CSP3 browsers ignore them under 'strict-dynamic'.
 * - /embed/* is excluded here and keeps its own static policy from
 *   next.config.ts so third-party frame-ancestors configuration stays intact.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  const csp = [
    `default-src 'self'`,
    `script-src 'self' blob: 'nonce-${nonce}' 'strict-dynamic'${
      isDev ? " 'unsafe-eval'" : ''
    } https://*.vercel-scripts.com https://vercel.live`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' https://*.groq.com https://api.groq.com https://*.vercel-scripts.com https://vercel.live wss://vercel.live https://archdraw.hiabhee.online wss://archdraw.hiabhee.online`,
    `frame-src 'self' https://vercel.live https://accounts.google.com`,
    `frame-ancestors 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  // Next.js reads this header to stamp its bootstrap scripts with the nonce.
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|embed|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
