import { NextRequest, NextResponse } from 'next/server';
import { getComponentTemplatesByIds } from '@/lib/db';

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids');
  if (!idsParam) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 });
  }
  try {
    const ids = idsParam.split(',').filter(Boolean);
    const templates = await getComponentTemplatesByIds(ids);
    return NextResponse.json(templates);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
