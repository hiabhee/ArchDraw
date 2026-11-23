'use client';

import { use, useEffect, useState } from 'react';
import { SignInButtons } from '@/components/auth/SignInButtons';
import { useAuthStore } from '@/store/authStore';
import { applyPreviewMoves, isPreviewId } from '@/lib/diagram/canvas/previewCopy';

export default function SavePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isPending = useAuthStore(state => state.loading);
  const userId = useAuthStore(state => state.user?.id);
  const [handoff, setHandoff] = useState<{ copy: string; moves: string }>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const isSignedIn = Boolean(userId && userId !== 'guest');

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const copy = new URLSearchParams(window.location.search).get('copy') ?? '';
      if (!isPreviewId(id) || !isPreviewId(copy)) {
        setError('Open the preview and choose Save to ArchDraw again.');
        return;
      }
      const fragment = window.location.hash.slice(1);
      try {
        const key = `archdraw-preview-copy:${id}:${copy}`;
        const moves = fragment || sessionStorage.getItem(key);
        if (!moves) throw new Error();
        if (fragment) sessionStorage.setItem(key, fragment);
        setHandoff({ copy, moves });
      } catch {
        setError('The preview layout could not be restored. Open the preview and try again.');
      }
    });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!handoff || !isSignedIn) return;
    const controller = new AbortController();
    const { signal } = controller;
    async function save(copy: string, moves: string) {
      try {
        const response = await fetch(`/api/diagram/session/${id}`, { signal });
        if (!response.ok) throw new Error('This diagram has expired or could not be opened.');
        const graph = await response.json();
        const nodes = applyPreviewMoves(graph.nodes, moves);
        const saved = await fetch('/api/user/canvases', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: copy, name: graph.label, nodes, edges: graph.edges, baseUpdatedAt: 0 }),
          signal,
        });
        if (!saved.ok) {
          const failure = await saved.json();
          // Reopening the same save link should open its copy without overwriting later edits.
          if (saved.status !== 409 || failure.code !== 'CANVAS_CONFLICT') {
            throw new Error(failure.error || 'The diagram could not be saved.');
          }
        }
        try { sessionStorage.removeItem(`archdraw-preview-copy:${id}:${copy}`); } catch { /* The save already succeeded. */ }
        if (!signal.aborted) window.location.replace(`/editor?canvas=${copy}`);
      } catch (cause) {
        if (!signal.aborted) setError(cause instanceof Error ? cause.message : 'The diagram could not be saved.');
      }
    }
    void save(handoff.copy, handoff.moves);
    return () => controller.abort();
  }, [attempt, handoff, id, isSignedIn]);

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-page p-6 text-text-primary">
      <section className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-semibold">Save to ArchDraw</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            {handoff && isSignedIn && (
              <button className="rounded-lg border border-border px-4 py-2" onClick={() => { setError(''); setAttempt(value => value + 1); }}>
                Try again
              </button>
            )}
          </>
        ) : isPending || !handoff || isSignedIn ? (
          <p role="status">{handoff && isSignedIn ? 'Saving your diagram…' : 'Opening your diagram…'}</p>
        ) : (
          <>
            <p>Sign in to save this layout to your ArchDraw account.</p>
            <SignInButtons callbackURL={`/share/${id}/save?copy=${handoff.copy}`} />
          </>
        )}
      </section>
    </main>
  );
}
