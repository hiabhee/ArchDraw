import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/server/prisma';
import logger from '@/lib/logger';
import { checkRateLimitWithFallback } from '@/lib/server/redis';
import { getClientIP } from '@/lib/server/ip';
import { IMAGE_STYLES, ImageUnavailableError, renderDiagramImage } from '@/lib/server/diagramImage';

export const runtime = 'nodejs';

/** Images are cheap to ask for and costly to draw, so they are throttled per client. */
const IMAGE_LIMIT_PER_HOUR = 120;

const QuerySchema = z.object({
  format: z.enum(['png', 'svg']).default('png'),
  style: z.enum(IMAGE_STYLES).default('sketch'),
  theme: z.enum(['light', 'dark']).default('light'),
  grid: z.enum(['on', 'off']).default('on'),
  colorTheme: z.string().regex(/^[a-z0-9-]{1,32}$/).optional(),
  scale: z.coerce.number().min(1).max(3).default(2),
});

/**
 * A shared diagram as an image: `/api/diagram/image/<sessionId>?style=sketch&format=png`.
 * Sessions are world-readable (the share page shows the same), so there is no sign-in; the
 * link expires with the session. Drawn in the hand-drawn (sketch) look unless asked otherwise.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const query = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!query.success) {
      return NextResponse.json({ error: 'Invalid image options', details: query.error.flatten() }, { status: 400 });
    }

    const limit = await checkRateLimitWithFallback(`diagram-image:ip:${getClientIP(request)}`, IMAGE_LIMIT_PER_HOUR, 3600);
    if (!limit.allowed) {
      const retryAfter = Math.max(1, limit.resetAt - Math.floor(Date.now() / 1000));
      return NextResponse.json({ error: 'Too many image requests. Please try again later.', code: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
    }

    const shared = await prisma.sharedCanvas.findUnique({
      where: { id: sessionId },
      select: { canvasName: true, nodes: true, edges: true, expiresAt: true, revision: true },
    });
    if (!shared) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (shared.expiresAt && new Date(shared.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Session has expired' }, { status: 410 });
    }

    const image = await renderDiagramImage(shared.nodes as unknown[], shared.edges as unknown[], { ...query.data, grid: query.data.grid === 'on' });
    const name = (shared.canvasName || 'diagram').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'diagram';
    const body = typeof image.body === 'string' ? image.body : new Uint8Array(image.body);
    return new NextResponse(body, {
      headers: {
        'Content-Type': image.contentType,
        'Content-Disposition': `inline; filename="${name}.${query.data.format}"`,
        // Short, so an updated drawing shows up quickly; the revision lets a cache tell versions apart.
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        ETag: `"${sessionId}-${shared.revision ?? 0}-${query.data.style}${query.data.colorTheme ? `-${query.data.colorTheme}` : ''}-${query.data.theme}-${query.data.grid}-${query.data.format}-${query.data.scale}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof ImageUnavailableError) return NextResponse.json({ error: error.message }, { status: 501 });
    logger.error('diagram image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
