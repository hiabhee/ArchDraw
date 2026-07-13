import { NextResponse } from 'next/server';

// Better Auth handles OAuth callbacks at /api/auth/callback/{provider}.
// This route exists for backwards compatibility with any old links.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/dashboard`);
}
