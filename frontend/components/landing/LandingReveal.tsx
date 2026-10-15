'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

type LandingRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  /** Share of the element that must be on screen before it reveals. */
  amount?: number;
  duration?: number;
  /** Blur while revealing; costly on very large elements. */
  blur?: boolean;
};

export function LandingReveal({ children, className, delay = 0, distance = 22, amount = 0.18, duration = 0.62, blur = true }: LandingRevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: distance, ...(blur ? { filter: 'blur(6px)' } : {}) }}
      whileInView={{ opacity: 1, y: 0, ...(blur ? { filter: 'blur(0px)' } : {}) }}
      viewport={{ once: true, amount }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
