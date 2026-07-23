'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SharedCanvasViewer } from '@/components/SharedCanvasViewer';
import { analytics } from '@/lib/analytics';
import { useTheme } from '@/lib/theme';

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

function normalizeSharePayload(result: Record<string, unknown>, id: string): ShareData | null {
  // Preferred shape from /api/share/[id]
  const canvas = result.canvas as SharedCanvas | undefined;
  if (canvas && Array.isArray(canvas.nodes) && Array.isArray(canvas.edges)) {
    return {
      canvas: {
        id: canvas.id || id,
        canvas_name: canvas.canvas_name || 'Shared Diagram',
        nodes: canvas.nodes,
        edges: canvas.edges,
      },
      access: (result.access as ShareData['access']) || {
        role: 'viewer',
        canEdit: false,
        users: [],
        accessType: 'anyone',
        linkPermission: 'viewer',
      },
    };
  }

  // Legacy shape: { success, diagram: { nodes, edges, label, ... } }
  const diagram = result.diagram as
    | {
        nodes?: unknown[];
        edges?: unknown[];
        label?: string;
        users?: ShareUser[];
        accessType?: string;
        linkPermission?: string;
      }
    | undefined;

  if (diagram && Array.isArray(diagram.nodes) && Array.isArray(diagram.edges)) {
    return {
      canvas: {
        id,
        canvas_name: diagram.label || 'Shared Diagram',
        nodes: diagram.nodes,
        edges: diagram.edges,
      },
      access: {
        role: 'viewer',
        canEdit: diagram.linkPermission === 'editor',
        users: diagram.users || [],
        accessType: diagram.accessType || 'anyone',
        linkPermission: diagram.linkPermission || 'viewer',
      },
    };
  }

  return null;
}

export default function SharePageClient({ id }: { id: string }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    fetch(`/api/share/${id}`)
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok || result.error) {
          setError(result.error || 'Diagram not found');
          analytics.track({
            event_type: 'share_view',
            event_name: 'error',
            page_path: window.location.pathname,
            payload: { share_id: id, error: result.error },
          });
          return;
        }

        const normalized = normalizeSharePayload(result, id);
        if (!normalized) {
          setError('Diagram not found');
          analytics.track({
            event_type: 'share_view',
            event_name: 'error',
            page_path: window.location.pathname,
            payload: { share_id: id, error: 'invalid_payload' },
          });
          return;
        }

        setData(normalized);
        analytics.track({
          event_type: 'share_view',
          event_name: 'success',
          page_path: window.location.pathname,
          payload: { share_id: id, node_count: normalized.canvas.nodes?.length },
        });
      })
      .catch(() => setError('Failed to load diagram'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div suppressHydrationWarning className={`${isDark ? 'dark' : ''} min-h-screen bg-[hsl(var(--canvas-bg))] flex items-center justify-center`}>
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div suppressHydrationWarning className={`${isDark ? 'dark' : ''} min-h-screen bg-[hsl(var(--canvas-bg))] flex items-center justify-center`}>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto">
            <span className="text-2xl">🔒</span>
          </div>
          <div>
            <p className="text-foreground font-semibold text-lg">{error}</p>
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

  return <SharedCanvasViewer canvas={data!.canvas} />;
}
