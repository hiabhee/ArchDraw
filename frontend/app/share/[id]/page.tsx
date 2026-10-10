import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import SharePageClient from './SharePageClient';

interface Props {
  params: Promise<{ id: string }>;
}

// User-generated content: always render on demand so new shares work instantly
// and expired ones stop resolving. Never pre-render or cache across requests.
export const dynamic = 'force-dynamic';

async function getSharedCanvas(id: string) {
  try {
    const shared = await prisma.sharedCanvas.findUnique({ where: { id } });

    if (!shared) {
      return { error: 'Diagram not found' as const };
    }

    if (shared.expiresAt && new Date(shared.expiresAt) < new Date()) {
      return { error: 'Share link has expired' as const };
    }

    const nodes = Array.isArray(shared.nodes) ? shared.nodes : [];
    const edges = Array.isArray(shared.edges) ? shared.edges : [];

    return {
      canvas: {
        id: shared.id,
        canvas_name: shared.canvasName,
        nodes,
        edges,
      },
      name: shared.canvasName,
    };
  } catch (error) {
    logger.error('Share page load error:', error);
    return { error: 'Failed to load diagram' as const };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getSharedCanvas(id);

  if ('error' in result) {
    return { title: 'Shared Diagram — ArchDraw' };
  }

  return {
    title: `${result.name || 'Shared Diagram'} — ArchDraw`,
    robots: { index: false },
  };
}

export default async function SharePage({ params }: Props) {
  const { id } = await params;
  const result = await getSharedCanvas(id);

  if ('error' in result) {
    return (
      <div className="min-h-screen bg-[hsl(var(--canvas-bg))] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto">
            <span className="text-2xl">🔒</span>
          </div>
          <div>
            <p className="text-foreground font-semibold text-lg">{result.error}</p>
            <p className="text-muted-foreground text-sm mt-1">
              This diagram may have expired or requires access.
            </p>
          </div>
          <Link
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Create your own diagram →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <SharePageClient
      canvas={result.canvas}
    />
  );
}
