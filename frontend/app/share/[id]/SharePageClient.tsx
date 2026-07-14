'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SharedCanvasViewer } from '@/components/SharedCanvasViewer';
import { analytics } from '@/lib/analytics';

interface ShareUser {
  email: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: number;
}

interface SharedCanvas {
  id: string;
  canvas_name: string;
  nodes: unknown[];
  edges: unknown[];
}

interface ShareData {
  canvas: SharedCanvas;
  access: {
    role: string;
    canEdit: boolean;
    users: ShareUser[];
    accessType: string;
    linkPermission: string;
  };
}

export default function SharePageClient({ id }: { id: string }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/share/${id}`)
      .then(res => res.json())
      .then(result => {
        if (result.error) {
          setError(result.error);
          analytics.track({
            event_type: 'share_view',
            event_name: 'error',
            page_path: window.location.pathname,
            payload: { share_id: id, error: result.error },
          });
        } else {
          setData(result);
          analytics.track({
            event_type: 'share_view',
            event_name: 'success',
            page_path: window.location.pathname,
            payload: { share_id: id, node_count: result.canvas?.nodes?.length },
          });
        }
      })
      .catch(() => setError('Failed to load diagram'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto">
            <span className="text-2xl">🔒</span>
          </div>
          <div>
            <p className="text-white font-semibold text-lg">{error}</p>
            <p className="text-white/50 text-sm mt-1">This diagram may have expired or requires access.</p>
          </div>
          <Link
            href="/"
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Create your own diagram →
          </Link>
        </div>
      </div>
    );
  }

  return <SharedCanvasViewer canvas={data!.canvas} />;
}