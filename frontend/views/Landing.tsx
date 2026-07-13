'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, {
  Background,
  BackgroundVariant,
  type NodeTypes,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useAuthStore } from '@/store/authStore';


const ICON: Record<string, string> = {
  Client: '🖥️',
  'API Gateway': '🔀',
  'Auth Service': '🔐',
  'Backend': '⚙️',
  'Database': '🗄️',
  'Cache': '⚡',
  'Queue': '📨',
  'Worker': '🔧',
};

function DemoNode({ data }: { data: { label: string; sub?: string } }) {
  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 10,
      padding: '10px 16px',
      minWidth: 130,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <span style={{ fontSize: 18 }}>{ICON[data.label] ?? '📦'}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', lineHeight: 1.2 }}>{data.label}</div>
        {data.sub && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{data.sub}</div>}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = { demo: DemoNode };

const DEMO_NODES: Node[] = [
  { id: 'client',   type: 'demo', position: { x: 0,   y: 120 }, data: { label: 'Client',        sub: 'Browser / Mobile' } },
  { id: 'apigw',    type: 'demo', position: { x: 200, y: 120 }, data: { label: 'API Gateway',   sub: 'Rate limiting' } },
  { id: 'auth',     type: 'demo', position: { x: 400, y: 20  }, data: { label: 'Auth Service',  sub: 'JWT / OAuth' } },
  { id: 'backend',  type: 'demo', position: { x: 400, y: 160 }, data: { label: 'Backend',       sub: 'Node.js' } },
  { id: 'db',       type: 'demo', position: { x: 620, y: 60  }, data: { label: 'Database',      sub: 'PostgreSQL' } },
  { id: 'cache',    type: 'demo', position: { x: 620, y: 200 }, data: { label: 'Cache',         sub: 'Redis' } },
  { id: 'queue',    type: 'demo', position: { x: 620, y: 320 }, data: { label: 'Queue',         sub: 'RabbitMQ' } },
  { id: 'worker',   type: 'demo', position: { x: 820, y: 320 }, data: { label: 'Worker',        sub: 'Background jobs' } },
];

const DEMO_EDGES: Edge[] = [
  { id: 'e1', source: 'client',  target: 'apigw',   type: 'smooth', animated: true,  style: { stroke: '#6B7280', strokeWidth: '2px' } },
  { id: 'e2', source: 'apigw',   target: 'auth',    type: 'smooth', animated: false, style: { stroke: '#6B7280', strokeWidth: '2px' } },
  { id: 'e3', source: 'apigw',   target: 'backend', type: 'smooth', animated: true,  style: { stroke: '#6B7280', strokeWidth: '2px' } },
  { id: 'e4', source: 'backend', target: 'db',      type: 'smooth', animated: false, style: { stroke: '#6B7280', strokeWidth: '2px' } },
  { id: 'e5', source: 'backend', target: 'cache',   type: 'smooth', animated: false, style: { stroke: '#6B7280', strokeWidth: '2px' } },
  { id: 'e6', source: 'backend', target: 'queue',   type: 'smooth', animated: true,  style: { stroke: '#6B7280', strokeWidth: '2px' } },
  { id: 'e7', source: 'queue',   target: 'worker',  type: 'smooth', animated: true,  style: { stroke: '#6B7280', strokeWidth: '2px' } },
];

function CanvasPreview() {
  return (
    <div style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }}>
      <ReactFlow
        nodes={DEMO_NODES}
        edges={DEMO_EDGES}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#f8fafc' }}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1.5} 
          color="#64748b" 
          style={{ opacity: 0.4 }}
        />
      </ReactFlow>
    </div>
  );
}

// Floating card styles
const cardStyle = {
  background: '#ffffff',
  borderRadius: 20,
  boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
};

const buttonPrimaryStyle = {
  background: '#595959',
  color: '#ffffff' as const,
  padding: '14px 28px',
  borderRadius: 12,
  border: 'none' as const,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer' as const,
  boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
  transition: 'all 0.2s ease',
};

const buttonSecondaryStyle = {
  background: '#f1f5f9',
  color: '#1e293b',
  padding: '14px 28px',
  borderRadius: 12,
  border: 'none' as const,
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer' as const,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  transition: 'all 0.2s ease',
};

export default function LandingPage() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user && user.id !== 'guest') {
      router.replace('/dashboard');
      return;
    }
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, [user, router]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F4F4F4',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '24px',
      boxSizing: 'border-box',
    }}>
      {/* Navbar - Floating pill */}
      <nav style={{
        ...cardStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        maxWidth: 1200,
        margin: '0 auto 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>⬡</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', letterSpacing: '-0.02em' }}>Archflow</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => router.push('/editor')}
            style={buttonSecondaryStyle}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.background = '#e2e8f0';
              (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.background = '#f1f5f9';
              (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
            }}
          >Sign in</button>
          <button
            onClick={() => router.push('/editor')}
            style={buttonPrimaryStyle}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.target as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(99,102,241,0.4)';
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.target as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(99,102,241,0.3)';
            }}
            onMouseDown={e => {
              (e.target as HTMLButtonElement).style.transform = 'scale(0.98)';
            }}
            onMouseUp={e => {
              (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
            }}
          >Start designing</button>
        </div>
      </nav>

      {/* Hero Section - Floating card */}
      <div style={{
        ...cardStyle,
        maxWidth: 1200,
        margin: '0 auto 32px',
        padding: '48px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 48,
        alignItems: 'center',
        minHeight: 500,
      }}>
        {/* Left - Text */}
        <div style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#f1f5f9', borderRadius: 999, padding: '6px 14px', marginBottom: 24,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#595959', display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#595959', letterSpacing: '0.04em' }}>NOW IN BETA</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 800,
            color: '#1e293b',
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            margin: '0 0 20px',
          }}>
            Design{' '}
            <span style={{
              background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>Systems,</span>
            <br />Not Documents
          </h1>

          <p style={{
            fontSize: 17, color: '#64748b', lineHeight: 1.7,
            maxWidth: 440, margin: '0 0 32px',
          }}>
            A visual canvas for building production-ready system architecture diagrams.
            Drag, connect, and think in systems.
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 40 }}>
            <button
              onClick={() => router.push('/editor')}
              style={buttonPrimaryStyle}
              onMouseEnter={e => {
                (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.target as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(99,102,241,0.4)';
              }}
              onMouseLeave={e => {
                (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.target as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(99,102,241,0.3)';
              }}
              onMouseDown={e => (e.target as HTMLButtonElement).style.transform = 'scale(0.98)'}
              onMouseUp={e => (e.target as HTMLButtonElement).style.transform = 'translateY(0)'}
            >
              Try it free →
            </button>
            <button
              onClick={() => router.push('/editor')}
              style={buttonSecondaryStyle}
              onMouseEnter={e => {
                (e.target as HTMLButtonElement).style.background = '#e2e8f0';
              }}
              onMouseLeave={e => {
                (e.target as HTMLButtonElement).style.background = '#f1f5f9';
              }}
            >Watch demo</button>
          </div>

          <span style={{ fontSize: 13, color: '#94a3b8' }}>No account needed to start</span>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 32, marginTop: 40 }}>
            {[
              ['150+', 'Components'],
              ['38', 'AWS Services'],
              ['∞', 'Canvas size']
            ].map(([val, label]) => (
              <div key={label}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b' }}>{val}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right - Canvas Preview */}
        <div style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s',
          position: 'relative',
          height: 400,
        }}>
          {/* Glow */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 380, height: 280,
            background: 'radial-gradient(ellipse, rgba(107,114,128,0.15) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(32px)',
            pointerEvents: 'none',
          }} />

          {/* Canvas Card */}
          <div style={{
            position: 'relative', zIndex: 1,
            width: '100%', height: '100%',
            borderRadius: 16,
            background: '#f8fafc',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}>
            {/* Fake toolbar */}
            <div style={{
              height: 36, background: '#ffffff',
              display: 'flex', alignItems: 'center',
              padding: '0 14px', gap: 6,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              {['#f87171', '#fbbf24', '#34d399'].map(c => (
                <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
              ))}
              <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>archdraw — system-design.af</span>
            </div>
            <div style={{ height: 'calc(100% - 36px)' }}>
              <CanvasPreview />
            </div>
          </div>
        </div>
      </div>

      {/* Features Section - Floating cards grid */}
      <div style={{
        ...cardStyle,
        maxWidth: 1200,
        margin: '0 auto 32px',
        padding: '40px 48px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{
            fontSize: '1.75rem', fontWeight: 700, color: '#1e293b', marginBottom: 12,
          }}>Everything you need to design systems</h2>
          <p style={{ fontSize: 15, color: '#64748b' }}>Powerful features that make architecture design effortless</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
        }}>
          {[
            { icon: '🧩', title: '150+ Components', desc: 'Pre-built AWS, Azure, GCP, and generic architecture components' },
            { icon: '⚡', title: 'AI Generation', desc: 'Describe your system in plain English and let AI build it' },
            { icon: '🎨', title: 'Beautiful Export', desc: 'Export to PNG, SVG, PDF with professional styling' },
            { icon: '🔗', title: 'Smart Connections', desc: 'Auto-routing edges with animated flow indicators' },
            { icon: '📋', title: 'Templates', desc: 'Start instantly with pre-built architecture patterns' },
            { icon: '👥', title: 'Share & Collaborate', desc: 'Share diagrams via link or embed anywhere' },
          ].map((feature, i) => (
            <div key={i} style={{
              background: '#f8fafc',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{feature.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>{feature.title}</h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Use Cases Section */}
      <div style={{
        ...cardStyle,
        maxWidth: 1200,
        margin: '0 auto 32px',
        padding: '40px 48px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{
            fontSize: '1.75rem', fontWeight: 700, color: '#1e293b', marginBottom: 12,
          }}>Who uses Archflow?</h2>
          <p style={{ fontSize: 15, color: '#64748b' }}>Used by developers, architects, and teams worldwide</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}>
          {[
            'System Design',
            'API Documentation',
            'Cloud Architecture',
            'Tech Specs',
          ].map((useCase, i) => (
            <div key={i} style={{
              background: '#f1f5f9',
              borderRadius: 14,
              padding: 20,
              textAlign: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{useCase}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div style={{
        ...cardStyle,
        maxWidth: 800,
        margin: '0 auto 32px',
        padding: '48px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
      }}>
        <h2 style={{
          fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', marginBottom: 12,
        }}>Ready to design?</h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', marginBottom: 32 }}>
          Start building beautiful architecture diagrams in seconds
        </p>
        <button
          onClick={() => router.push('/editor')}
          style={{
            background: '#ffffff',
color: '#595959',
             padding: '16px 32px',
            borderRadius: 12,
            border: 'none',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
            (e.target as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.target as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
          }}
        >
          Open Editor — It&apos;s Free
        </button>
      </div>

      {/* Footer - Floating card */}
      <footer style={{
        ...cardStyle,
        maxWidth: 1200,
        margin: '0 auto',
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12,
          }}>⬡</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Archflow</span>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {['About', 'Pricing', 'Contact', 'Privacy'].map(link => (
            <a key={link} href="#" style={{
              fontSize: 13, color: '#64748b', textDecoration: 'none',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.target as HTMLAnchorElement).style.color = '#1e293b'}
            onMouseLeave={e => (e.target as HTMLAnchorElement).style.color = '#64748b'}
            >{link}</a>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          © 2026 Archflow
        </div>
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        .react-flow__node { animation: float 4s ease-in-out infinite; }
        .react-flow__node:nth-child(2) { animation-delay: 0.4s; }
        .react-flow__node:nth-child(3) { animation-delay: 0.8s; }
        .react-flow__node:nth-child(4) { animation-delay: 1.2s; }
        .react-flow__node:nth-child(5) { animation-delay: 1.6s; }
        .react-flow__node:nth-child(6) { animation-delay: 2.0s; }
        .react-flow__node:nth-child(7) { animation-delay: 2.4s; }
        .react-flow__node:nth-child(8) { animation-delay: 2.8s; }
      `}</style>
    </div>
  );
}