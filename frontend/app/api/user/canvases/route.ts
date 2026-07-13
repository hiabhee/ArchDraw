import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserCanvases, upsertUserCanvas } from '@/lib/db';
import { headers } from 'next/headers';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const canvases = await getUserCanvases(session.user.id);
  return NextResponse.json(canvases);
}

export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const result = await upsertUserCanvas(session.user.id, body);
  return NextResponse.json(result);
}
