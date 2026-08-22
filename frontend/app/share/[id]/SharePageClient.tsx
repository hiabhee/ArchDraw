'use client';

import { useEffect } from 'react';
import { SharedCanvasViewer } from '@/components/SharedCanvasViewer';
import { analytics } from '@/lib/analytics';

export interface SharedCanvas {
  id: string;
  canvas_name: string;
  nodes: unknown[];
  edges: unknown[];
}

interface SharePageClientProps {
  canvas: SharedCanvas;
}

export default function SharePageClient({ canvas }: SharePageClientProps) {
  useEffect(() => {
    analytics.track({
      event_type: 'share_view',
      event_name: 'success',
      page_path: window.location.pathname,
      payload: { share_id: canvas.id, node_count: canvas.nodes?.length },
    });
  }, [canvas.id, canvas.nodes]);

  return <SharedCanvasViewer canvas={canvas} />;
}
