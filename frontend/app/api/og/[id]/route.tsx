import { ImageResponse } from 'next/og';
import prisma from '@/lib/prisma';
import type { Node } from 'reactflow';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch diagram from Neon via Prisma
  const diagram = await prisma.sharedCanvas.findUnique({
    where: { id },
    select: { canvasName: true, nodes: true },
  });

  if (!diagram) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f172a',
            fontSize: 48,
          }}
        >
          📊
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }

  const nodes = (diagram.nodes as unknown as Node[]) || [];
  const nodeCount = nodes.length;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0f172a',
          padding: 48,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 32,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                background: '#595959',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="white" strokeWidth="2" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="white" strokeWidth="2" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="white" strokeWidth="2" />
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="white" strokeWidth="2" />
              </svg>
            </div>
            <span style={{ color: 'white', fontSize: 24, fontWeight: 600 }}>
              ArchDraw
            </span>
          </div>
          <span style={{ color: '#94a3b8', fontSize: 14 }}>
            {nodeCount} {nodeCount === 1 ? 'component' : 'components'}
          </span>
        </div>

        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: '#f1f5f9', fontSize: 36, fontWeight: 700 }}>
            {diagram.canvasName || 'Architecture Diagram'}
          </span>
          <span style={{ color: '#64748b', fontSize: 18, marginTop: 8 }}>
            Interactive system architecture diagram
          </span>
        </div>

        {/* Node preview grid */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 32,
            padding: 24,
            background: '#1e293b',
            borderRadius: 16,
          }}
        >
          {nodes.slice(0, 12).map((node, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: '#334155',
                borderRadius: 8,
                border: `1px solid ${node.data?.color || '#6B7280'}40`,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: node.data?.color || '#6B7280',
                }}
              />
              <span style={{ color: '#e2e8f0', fontSize: 12 }}>
                {node.data?.label || node.id}
              </span>
            </div>
          ))}
          {nodes.length > 12 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                background: '#334155',
                borderRadius: 8,
              }}
            >
              <span style={{ color: '#94a3b8', fontSize: 12 }}>
                +{nodes.length - 12} more
              </span>
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
