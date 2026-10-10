'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const EditorPage = dynamic(() => import('@/components/editor/Editor'), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: '100vh', background: '#0a0a12' }} />
  ),
});

// Canvas is open to everyone — no auth required
export default function EditorRoute() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a12' }} />}>
      <EditorPage />
    </Suspense>
  );
}
