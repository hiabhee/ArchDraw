'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useDiagramStore } from '@/store/diagramStore';
import logger from '@/lib/logger';
import { sanitizeSVG } from '@/lib/utils/svg-sanitizer';

let mermaidInitialized = false;

async function initMermaid() {
  if (mermaidInitialized) return;
  const mermaid = await import('mermaid');
  mermaid.default.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose',
    sequence: {
      actorMargin: 50,
      boxMargin: 10,
      boxTextMargin: 5,
      noteMargin: 10,
      messageMargin: 35,
    },
  });
  mermaidInitialized = true;
}

export function SequenceDiagramViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const prevSyntaxRef = useRef<string | undefined>(undefined);
  const activeCanvasId = useDiagramStore((s) => s.activeCanvasId);
  const sequenceDiagrams = useDiagramStore((s) => s.sequenceDiagrams);

  const diagram = useMemo(() => 
    sequenceDiagrams[activeCanvasId],
    [sequenceDiagrams, activeCanvasId]
  );

  useEffect(() => {
    initMermaid();
  }, []);

  useEffect(() => {
    if (!diagram?.mermaidSyntax) {
      setSvg('');
      setError('');
      return;
    }

    if (diagram.mermaidSyntax === prevSyntaxRef.current) return;
    prevSyntaxRef.current = diagram.mermaidSyntax;

    let cancelled = false;

    const renderDiagram = async () => {
      try {
        const mermaid = await import('mermaid');
        const id = `mermaid-${Date.now().toString(36)}`;
        const { svg: rendered } = await mermaid.default.render(id, diagram.mermaidSyntax);
        
        if (!cancelled) {
          // Sanitize SVG to prevent XSS attacks
          const sanitized = sanitizeSVG(rendered);
          
          if (!sanitized) {
            logger.error('[SequenceDiagram] SVG sanitization produced empty result');
            setError('Failed to render sequence diagram: sanitization failed');
            setSvg('');
            return;
          }
          
          setSvg(sanitized);
          setError('');
        }
      } catch (err) {
        logger.error('Mermaid render error:', err);
        if (!cancelled) {
          setError('Failed to render sequence diagram');
          setSvg('');
        }
      }
    };

    renderDiagram();
    return () => { cancelled = true; };
  }, [diagram?.mermaidSyntax]);

  if (!diagram) {
    return (
      <div className="flex-1 flex items-center justify-center bg-canvas-bg">
        <p className="text-muted-foreground text-sm italic">No sequence diagram available for this canvas.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-canvas-bg">
        <div className="text-center p-8 max-w-2xl">
          <p className="text-red-500 font-medium mb-4">{error}</p>
          <div className="text-left bg-gray-900 text-gray-300 p-6 rounded-xl overflow-auto text-[11px] font-mono leading-relaxed border border-white/10 shadow-2xl">
            <pre>{diagram.mermaidSyntax}</pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 flex items-center justify-center bg-canvas-bg overflow-auto p-8 overscroll-contain"
      style={{ overscrollBehavior: 'contain' }}
    >
      <div 
        ref={containerRef}
        className="max-w-full bg-white p-4 sm:p-6 md:p-10 rounded-2xl shadow-xl border border-gray-100"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
