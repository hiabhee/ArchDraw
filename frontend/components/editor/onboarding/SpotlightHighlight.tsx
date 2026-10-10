'use client';
import logger from '@/lib/logger';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SpotlightProps {
  targetSelector: string;
  padding?: number;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function SpotlightHighlight({ targetSelector, padding = 10 }: SpotlightProps) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    const update = () => {
      const el = document.querySelector(targetSelector);
      if (!el) {
        logger.warn('[Onboarding] Spotlight: element not found:', targetSelector);
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    update();
    const ro = new ResizeObserver(update);
    const el = document.querySelector(targetSelector);
    if (el) ro.observe(el);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [targetSelector]);

  return (
    <AnimatePresence>
      {rect && (
        <>
          {/* Dark overlay via box-shadow — the "cutout" effect */}
          <motion.div
            key={targetSelector}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'fixed',
              top: rect.top - padding,
              left: rect.left - padding,
              width: rect.width + padding * 2,
              height: rect.height + padding * 2,
              borderRadius: 10,
              boxShadow: '0 0 0 9999px hsl(0 0% 0% / 0.45)',
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          />

          {/* Animated indigo border ring */}
          <motion.div
            key={`ring-${targetSelector}`}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'fixed',
              top: rect.top - padding,
              left: rect.left - padding,
              width: rect.width + padding * 2,
              height: rect.height + padding * 2,
              borderRadius: 10,
              border: '1px solid rgba(30, 144, 255, 0.85)',
              boxShadow:
                '0 0 0 4px rgba(30, 144, 255, 0.12), 0 0 24px 4px rgba(30, 144, 255, 0.22)',
              zIndex: 10000,
              pointerEvents: 'none',
            }}
          />

          {/* Shimmer sweep animation */}
          <motion.div
            key={`shimmer-${targetSelector}`}
            style={{
              position: 'fixed',
              top: rect.top - padding,
              left: rect.left - padding,
              width: rect.width + padding * 2,
              height: rect.height + padding * 2,
              borderRadius: 10,
              overflow: 'hidden',
              zIndex: 10001,
              pointerEvents: 'none',
            }}
          >
            <motion.div
              animate={{ x: [-200, rect.width + 200] }}
              transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 80,
                height: '100%',
                background:
                  'linear-gradient(90deg, transparent, rgba(30, 144, 255, 0.2), transparent)',
                transform: 'skewX(-12deg)',
              }}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
