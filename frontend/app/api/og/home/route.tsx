import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

export async function GET(_request: Request) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          padding: 56,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#1E90FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ color: '#f8fafc', fontSize: 22, fontWeight: 600 }}>ArchDraw</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 920 }}>
          <span style={{ color: '#f8fafc', fontSize: 52, fontWeight: 700, lineHeight: 1.1 }}>
            Build accurate architecture diagrams in seconds — not hours
          </span>
          <span style={{ color: '#cbd5e1', fontSize: 24, lineHeight: 1.4 }}>
            Describe your system in plain English, Mermaid, or a GitHub repo URL. ArchDraw generates a
            styled, auto-laid-out architecture diagram you can edit, share, and export.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {['Plain English → Diagram', 'Mermaid-compatible', 'MCP server for AI agents'].map((chip) => (
            <span
              key={chip}
              style={{
                padding: '8px 16px',
                borderRadius: 9999,
                background: '#334155',
                border: '1px solid #475569',
                color: '#e2e8f0',
                fontSize: 16,
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
