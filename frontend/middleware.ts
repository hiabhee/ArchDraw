import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    const visited = request.cookies.get('archdraw-visited');

    if (visited) {
      return NextResponse.redirect(new URL('/editor', request.url));
    }

    const response = NextResponse.next();
    response.cookies.set('archdraw-visited', 'true', {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/',
};
