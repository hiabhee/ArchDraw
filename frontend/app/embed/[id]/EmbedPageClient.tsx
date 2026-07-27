'use client';

import { useEffect, useState } from 'react';
import { EmbedCanvasViewer } from '@/components/embed/EmbedCanvasViewer';
import { analytics } from '@/lib/analytics';
import type { Node, Edge } from 'reactflow';

interface DiagramData {
  id: string;
  canvas_name: string;
  nodes: Node[];
  edges: Edge[];
}

interface EmbedPageClientProps {
  id: string;
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function EmbedPageClient({ id, searchParams }: EmbedPageClientProps) {
  const [diagram, setDiagram] = useState<DiagramData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const theme = searchParams.theme === 'light' ? 'light' : 'dark';
  const zoom = parseFloat(String(searchParams.zoom || '1'));
  const showControls = searchParams.controls !== 'false';
  const pathType = (searchParams.path as 'smooth' | 'step' | 'straight' | 'bezier') || 'smooth';

  useEffect(() => {
    const fetchDiagram = async () => {
      try {
        const response = await fetch(`/api/embed/${id}`);
        if (!response.ok) {
          setError(response.status === 404 ? 'not_found' : 'failed');
          analytics.track({
            event_type: 'embed_view',
            event_name: 'error',
            page_path: window.location.pathname,
            payload: { embed_id: id, status: response.status },
          });
          return;
        }
        const data = await response.json();
        setDiagram(data);
        analytics.track({
          event_type: 'embed_view',
          event_name: 'success',
          page_path: window.location.pathname,
          payload: { embed_id: id, node_count: data.nodes?.length },
        });
      } catch {
        setError('failed');
      } finally {
        setLoading(false);
      }
    };

    fetchDiagram();
  }, [id]);

  const styles: React.CSSProperties = {
    width: '100vw',
    height: '100dvh',
    margin: 0,
    padding: 0,
    overflow: 'hidden',
    background: theme === 'dark' ? '#0f172a' : '#ffffff',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  };

  if (loading) {
    return (
      <div style={styles}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}>
          <div style={{
            width: 32,
            height: 32,
            border: '3px solid transparent',
            borderTopColor: '#595959',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error === 'not_found') {
    return (
      <div style={styles}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📊</div>
          <p style={{ 
            color: theme === 'dark' ? '#f1f5f9' : '#1e293b', 
            fontSize: 18, 
            fontWeight: 600,
            margin: 0,
          }}>
            Diagram not found
          </p>
          <p style={{ 
            color: theme === 'dark' ? '#94a3b8' : '#64748b', 
            fontSize: 14, 
            marginTop: 8,
          }}>
            This diagram may have been deleted.
          </p>
        </div>
      </div>
    );
  }

  if (error === 'failed' || !diagram) {
    return (
      <div style={styles}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <p style={{ 
            color: theme === 'dark' ? '#f1f5f9' : '#1e293b', 
            fontSize: 18, 
            fontWeight: 600,
            margin: 0,
          }}>
            Failed to load diagram
          </p>
          <p style={{ 
            color: theme === 'dark' ? '#94a3b8' : '#64748b', 
            fontSize: 14, 
            marginTop: 8,
          }}>
            Please try refreshing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles}>
      <EmbedCanvasViewer
        nodes={diagram.nodes}
        edges={diagram.edges}
        theme={theme}
        zoom={zoom}
        showControls={showControls}
        pathType={pathType}
      />
    </div>
  );
}
