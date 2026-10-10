import { NextRequest, NextResponse } from 'next/server';
import { getComponentTemplatesByIds } from '@/lib/db';
import { getUserTier } from '@/lib/userQuotas';
import { getSessionFromRequest } from '@/lib/middleware/quotaCheck';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids');
  if (!idsParam) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 });
  }
  try {
    const session = await getSessionFromRequest(req);
    const userId = session?.user?.id;
    const tier = getUserTier(userId);

    const ids = idsParam.split(',').filter(Boolean);
    const templates = await getComponentTemplatesByIds(ids);

    if (tier === 'guest') {
      return NextResponse.json({ templates: [], tier, upgradeCTA: 'Sign in to unlock component templates' });
    }

    return NextResponse.json(templates);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
