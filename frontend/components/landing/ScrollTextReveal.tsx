'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import styles from './ScrollTextReveal.module.css';

type ScrollTextRevealProps = {
  children: ReactNode;
  className?: string;
  eager?: boolean;
};

export function ScrollTextReveal({ children, className, eager = false }: ScrollTextRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    element.dataset.ready = 'true';
    const reveal = () => {
      requestAnimationFrame(() => {
        element.dataset.revealed = 'true';
      });
    };
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight * (eager ? 0.92 : 0.82) && rect.bottom > 0) {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      reveal();
      observer.disconnect();
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

    observer.observe(element);
    return () => observer.disconnect();
  }, [eager]);

  return (
    <span ref={ref} className={`${styles.reveal}${className ? ` ${className}` : ''}`} data-ready="false" data-revealed="false">
      {children}
    </span>
  );
}
