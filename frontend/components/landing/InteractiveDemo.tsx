'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const InteractiveLandingDemo = dynamic(
  () => import('@/components/landing/InteractiveLandingDemo'),
  {
    ssr: false,
    loading: () => <DemoPlaceholder />,
  }
);

function DemoPlaceholder() {
  return (
    <div className="w-full h-[400px] sm:h-[560px] lg:h-[700px] rounded-2xl bg-[#0f1011] border border-[#23252a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-brand/30 border-t-brand rounded-full animate-spin" />
        <span className="text-xs text-[#8a8f98] font-medium">Loading interactive canvas...</span>
      </div>
    </div>
  );
}

export function InteractiveDemo() {
  const sectionRef = useRef<HTMLElement>(null);
  // Hydration safety: the server always renders <DemoPlaceholder/>. We only
  // swap in the (ssr:false) dynamic demo after mount AND once the section
  // approaches the viewport, so the first client render matches the
  // server HTML byte-for-byte and all divergence happens post-hydration.
  const [loadDemo, setLoadDemo] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setLoadDemo(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLoadDemo(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 px-6 bg-[#f7f7f5] relative overflow-hidden">
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[320px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #1E90FF08, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />

      <div className="max-w-[1400px] mx-auto relative z-10">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[2px] uppercase text-[#1E90FF] bg-[#1E90FF]/8 px-3 py-1.5 rounded-full mb-3"
                style={{ background: 'rgba(30, 144, 255, 0.08)' }}>
            <Sparkles className="w-3 h-3" /> Try it out
          </span>
          <h2
            className="text-[#1c1c1a] font-bold leading-[1.1] tracking-tight"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            Try it right here — no sign-up needed
          </h2>
          <p className="mt-4 text-sm md:text-base text-[#575752] max-w-[520px] mx-auto leading-relaxed">
            This is a real ArchDraw canvas. Drag the nodes, zoom in, or type a prompt below.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {loadDemo ? <InteractiveLandingDemo /> : <DemoPlaceholder />}
        </motion.div>
      </div>
    </section>
  );
}
