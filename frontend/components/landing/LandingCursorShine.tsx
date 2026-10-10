'use client';

import { useCallback, useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import styles from './LandingCursorShine.module.css';

export function LandingCursorShine({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Cached root bounds — getBoundingClientRect() forces a sync layout, so
  // never call it per pointermove. Refresh on scroll/resize instead.
  const boundsRef = useRef<{ left: number; top: number } | null>(null);
  const rafRef = useRef(0);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const bounds = root.getBoundingClientRect();
    boundsRef.current = { left: bounds.left, top: bounds.top };
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(rafRef.current);
    };
  }, [measure]);

  const flush = useCallback(() => {
    rafRef.current = 0;
    const root = rootRef.current;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!root || !pending) return;
    const overlay = root.querySelector<HTMLElement>('[data-cursor-shine-overlay]');
    if (!overlay) return;
    if (!boundsRef.current) measure();
    const bounds = boundsRef.current;
    if (!bounds) return;
    overlay.style.setProperty('--shine-x', `${pending.x - bounds.left}px`);
    overlay.style.setProperty('--shine-y', `${pending.y - bounds.top}px`);
    overlay.style.opacity = '1';
  }, [measure]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root || event.pointerType !== 'mouse') return;
    const overlay = root.querySelector<HTMLElement>('[data-cursor-shine-overlay]');
    if (!overlay) return;

    if ((event.target as HTMLElement).closest('[data-cursor-shine-exclude]')) {
      overlay.style.opacity = '0';
      return;
    }

    // Coalesce moves to one style write per frame — no layout reads here.
    pendingRef.current = { x: event.clientX, y: event.clientY };
    if (!rafRef.current) rafRef.current = requestAnimationFrame(flush);
  }, [flush]);

  const handlePointerLeave = useCallback(() => {
    const overlay = rootRef.current?.querySelector<HTMLElement>('[data-cursor-shine-overlay]');
    if (overlay) overlay.style.opacity = '0';
  }, []);

  return (
    <div
      ref={rootRef}
      className={className}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className={styles.shine} data-cursor-shine-overlay aria-hidden="true" />
      {children}
    </div>
  );
}
