import { NextResponse } from 'next/server';
import { auth } from '@/lib/server/auth';
import { deleteUserCanvas } from '@/lib/server/db';
import { headers } from 'next/headers';
import logger from '@/lib/logger';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const result = await deleteUserCanvas(session.user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('User canvas DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
