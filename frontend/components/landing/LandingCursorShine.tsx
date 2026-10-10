'use client';

import { useCallback, useRef, type PointerEvent, type ReactNode } from 'react';
import styles from './LandingCursorShine.module.css';

export function LandingCursorShine({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root || event.pointerType !== 'mouse') return;
    const overlay = root.querySelector<HTMLElement>('[data-cursor-shine-overlay]');
    if (!overlay) return;

    if ((event.target as HTMLElement).closest('[data-cursor-shine-exclude]')) {
      overlay.style.opacity = '0';
      return;
    }

    const bounds = root.getBoundingClientRect();
    overlay.style.setProperty('--shine-x', `${event.clientX - bounds.left}px`);
    overlay.style.setProperty('--shine-y', `${event.clientY - bounds.top}px`);
    overlay.style.opacity = '1';
  }, []);

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
