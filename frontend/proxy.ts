import { NextResponse, type NextRequest } from 'next/server';
import { RETURNING_COOKIE, shouldResumeEditor } from '@/lib/site/returningVisitor';

/** Sends a returning visitor who opens `/` to the editor (see `lib/site/returningVisitor.ts`). */
export function proxy(request: NextRequest) {
  const resume = shouldResumeEditor({
    method: request.method,
    cookie: request.cookies.get(RETURNING_COOKIE)?.value,
    fetchSite: request.headers.get('sec-fetch-site'),
    searchParams: request.nextUrl.searchParams,
  });
  if (!resume) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/editor';
  url.search = '';
  return NextResponse.redirect(url, 307);
}

export const config = { matcher: '/' };
