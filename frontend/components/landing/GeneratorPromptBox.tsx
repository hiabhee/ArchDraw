'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';

const MAX_PROMPT = 2000;

/**
 * Describe a system (or paste a GitHub URL) and open the editor generating it, through
 * the editor's existing `?generate=` entry point.
 */
export function GeneratorPromptBox({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const text = prompt.trim();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text) return;
    router.push(`/editor?generate=${encodeURIComponent(text.slice(0, MAX_PROMPT))}`);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border-default bg-surface-card p-3 shadow-2">
      <label htmlFor="generator-prompt" className="sr-only">Describe the system to draw</label>
      <textarea
        id="generator-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }}
        rows={3}
        maxLength={MAX_PROMPT}
        placeholder={placeholder}
        className="w-full resize-none bg-transparent px-2 py-1.5 text-base leading-7 text-text-primary outline-none placeholder:text-text-muted"
      />
      <div className="flex items-center justify-between gap-3 px-2 pt-2">
        <span className="text-xs text-text-muted">Describe a system or paste a GitHub repo URL</span>
        <button type="submit" disabled={!text} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50">
          <Sparkles size={16} aria-hidden="true" /> Generate diagram
        </button>
      </div>
    </form>
  );
}
