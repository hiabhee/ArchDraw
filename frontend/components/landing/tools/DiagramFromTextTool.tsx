'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, ExternalLink, Loader2, Play } from 'lucide-react';

export const DEFAULT_DIAGRAM = `graph LR
  User[User] --> Web[Web App]
  Web -->|HTTPS| API[API Gateway]
  subgraph Backend
    API --> Orders[Order Service]
    API --> Auth[Auth Service]
    Orders --> Queue[(Message Queue)]
  end
  Orders --> DB[(Postgres)]
  Queue --> Email[Email Worker]`;

type Style = 'studio' | 'sketch';
const MAX_CHARS = 20_000;

/**
 * Free diagram generator: Mermaid flowchart text in, a laid-out diagram out, through the
 * same pipeline as the editor (`POST /api/diagram/load` with `dryRun` + `preview`, which
 * stores nothing). The SVG is shown as an <img>, so nothing in it can run as script.
 */
export function DiagramFromTextTool({ initial = DEFAULT_DIAGRAM }: { initial?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initial);
  const [style, setStyle] = useState<Style>('studio');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'render' | 'open' | null>(null);
  const firstRender = useRef(true);

  const render = useCallback(async (text: string, look: Style) => {
    if (!text.trim()) return;
    setBusy('render');
    setError(null);
    try {
      const res = await fetch('/api/diagram/load', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mermaid: text.slice(0, MAX_CHARS), dryRun: true, preview: true, previewStyle: look }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.previewSvg) {
        setError(res.status === 429 ? 'Too many diagrams in a short time. Wait a minute and try again.' : (body.error || 'That diagram could not be drawn. Check the syntax and try again.'));
        return;
      }
      setSvg(body.previewSvg as string);
    } catch {
      setError('Could not reach the diagram service. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (!firstRender.current) return;
    firstRender.current = false;
    void render(initial, 'studio');
  }, [initial, render]);

  function download(kind: 'svg' | 'png') {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const save = (href: string, name: string) => {
      const a = document.createElement('a');
      a.href = href;
      a.download = name;
      a.click();
    };
    if (kind === 'svg') {
      save(url, 'diagram.svg');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      save(canvas.toDataURL('image/png'), 'diagram.png');
    };
    img.src = url;
  }

  async function openInEditor() {
    if (!code.trim()) return;
    setBusy('open');
    setError(null);
    try {
      const res = await fetch('/api/diagram/load', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mermaid: code.slice(0, MAX_CHARS) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.sessionId) {
        setError(res.status === 429 ? 'Too many diagrams in a short time. Wait a minute and try again.' : 'Could not open the diagram in the editor.');
        return;
      }
      router.push(`/editor?session=${encodeURIComponent(body.sessionId)}`);
    } catch {
      setError('Could not reach the diagram service. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col rounded-2xl border border-border-default bg-surface-card">
        <label htmlFor="diagram-code" className="border-b border-border-default px-4 py-2.5 text-xs font-semibold text-text-secondary">Diagram text (Mermaid)</label>
        <textarea
          id="diagram-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void render(code, style); }}
          spellCheck={false}
          maxLength={MAX_CHARS}
          rows={16}
          className="min-h-[320px] flex-1 resize-y bg-transparent px-4 py-3 font-mono text-[13px] leading-6 text-text-primary outline-none"
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-border-default px-3 py-2.5">
          <button type="button" onClick={() => void render(code, style)} disabled={busy !== null || !code.trim()} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50">
            {busy === 'render' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />} Draw diagram
          </button>
          <label className="sr-only" htmlFor="diagram-style">Style</label>
          <select id="diagram-style" value={style} onChange={(e) => { const s = e.target.value as Style; setStyle(s); void render(code, s); }} className="rounded-lg border border-border-default bg-surface-page px-2.5 py-2 text-sm text-text-primary">
            <option value="studio">Clean</option>
            <option value="sketch">Hand-drawn</option>
          </select>
          <span className="ml-auto text-xs text-text-muted">⌘/Ctrl + Enter</span>
        </div>
      </div>

      <div className="flex min-h-[380px] flex-col rounded-2xl border border-border-default bg-surface-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-border-default px-3 py-2">
          <span className="text-xs font-semibold text-text-secondary">Preview</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => download('png')} disabled={!svg} className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-surface-card px-2.5 py-1.5 text-xs font-medium text-text-primary disabled:opacity-50"><Download size={13} aria-hidden="true" /> PNG</button>
            <button type="button" onClick={() => download('svg')} disabled={!svg} className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-surface-card px-2.5 py-1.5 text-xs font-medium text-text-primary disabled:opacity-50"><Download size={13} aria-hidden="true" /> SVG</button>
            <button type="button" onClick={() => void openInEditor()} disabled={busy !== null || !code.trim()} className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-surface-card px-2.5 py-1.5 text-xs font-medium text-text-primary disabled:opacity-50">
              {busy === 'open' ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <ExternalLink size={13} aria-hidden="true" />} Edit in ArchDraw
            </button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto p-4" aria-live="polite">
          {error ? (
            <p role="alert" className="max-w-sm text-center text-sm text-text-secondary">{error}</p>
          ) : svg ? (
            // eslint-disable-next-line @next/next/no-img-element -- generated SVG shown as an image so it cannot run script
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="Generated diagram" className="h-auto max-h-[560px] w-full object-contain" />
          ) : (
            <Loader2 size={20} className="animate-spin text-text-muted" aria-label="Drawing" />
          )}
        </div>
      </div>
    </div>
  );
}
