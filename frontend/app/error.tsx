'use client';

import { useEffect } from 'react';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import logger from '@/lib/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f7f5] text-[#1c1c1a]">
      <LandingNav />
      <main className="flex-1 flex items-center justify-center px-6 pt-24 pb-16">
        <div className="max-w-[560px] w-full bg-white border border-[#e4e4df] rounded-xl p-10 text-center" style={{ boxShadow: '0 8px 24px rgba(28,28,26,0.04)' }}>
          <p className="text-[11px] font-bold tracking-[2px] uppercase text-[#5a6066] mb-3">Something went wrong</p>
          <h2 className="font-bold tracking-tight leading-[0.95] text-[#1c1c1a]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '-0.04em' }}>
            An <em className="text-[#155e9c] font-normal">unexpected</em> error
          </h2>
          <p className="mt-4 text-sm text-[#5a6066] leading-relaxed">
            Please try again. If the problem persists, contact us or check the status page.
          </p>
          <button
            onClick={reset}
            className="mt-6 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#1E90FF] hover:bg-[#1a7acc] active:bg-[#1668a8] px-5 py-3 rounded-lg transition-colors"
          >
            Try again
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
