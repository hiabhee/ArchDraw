import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteUserCanvas } from '@/lib/db';
import { headers } from 'next/headers';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const result = await deleteUserCanvas(session.user.id, id);
  return NextResponse.json(result);
}
