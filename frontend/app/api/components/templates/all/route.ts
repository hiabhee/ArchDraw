import { NextRequest, NextResponse } from 'next/server';
import { getAllComponentTemplates } from '@/lib/db';
import { getUserTier } from '@/lib/userQuotas';
import { getSessionFromRequest } from '@/lib/middleware/quotaCheck';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const userId = session?.user?.id;
    const tier = getUserTier(userId);

    const templates = await getAllComponentTemplates();

    if (tier === 'guest') {
      return NextResponse.json({ templates: [], tier, upgradeCTA: 'Sign in to unlock component templates' });
    }

    return NextResponse.json(templates);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
