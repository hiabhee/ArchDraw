import type { Metadata } from 'next';
import { LiveWatchViewer } from '@/components/viewers/LiveWatchViewer';

interface Props {
  params: Promise<{ token: string }>;
}

// Live data: always render on demand.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Live project — ArchDraw',
  description: 'A live architecture diagram showing which coding-agent session is working on which component.',
  robots: { index: false, follow: false },
};

/** Read-only live project view; anyone with the link can watch, no sign-in. */
export default async function LiveWatchPage({ params }: Props) {
  const { token } = await params;
  return <LiveWatchViewer token={decodeURIComponent(token)} />;
}
