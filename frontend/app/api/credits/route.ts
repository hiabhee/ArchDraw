import { NextRequest, NextResponse } from 'next/server';
import { getCreditSnapshot } from '@/lib/credits';

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await getCreditSnapshot(req));
  } catch {
    return NextResponse.json({ error: 'Credits unavailable' }, { status: 503 });
  }
}
