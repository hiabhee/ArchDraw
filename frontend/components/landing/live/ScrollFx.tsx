'use client';

import { useRef, useState, type ReactNode } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import styles from './ScrollFx.module.css';

/**
 * Scroll-linked motion for the live landing. Everything is driven by scroll
 * position (not time), eased with a light spring, and switched off for
 * visitors who prefer reduced motion.
 */

const SPRING = { stiffness: 120, damping: 26, mass: 0.4 };

/** Thin amber bar under the nav that fills as the page scrolls. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, SPRING);
  return <motion.div className={styles.progress} style={{ scaleX }} aria-hidden="true" />;
}

/** The hero map rises out of a tilt and settles flat as it scrolls into view. */
export function ScrollTilt({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 0.18'] });
  const p = useSpring(scrollYProgress, SPRING);
  const rotateX = useTransform(p, [0, 1], [16, 0]);
  const scale = useTransform(p, [0, 1], [0.9, 1]);
  const y = useTransform(p, [0, 1], [40, 0]);
  return (
    <div ref={ref} className={`${styles.perspective} ${className ?? ''}`}>
      <motion.div style={reduce ? undefined : { rotateX, scale, y, transformOrigin: '50% 0%' }}>{children}</motion.div>
    </div>
  );
}

/** Moves its content against the scroll; positive `speed` drifts up, negative down. */
export function Parallax({ children, speed = 60, className }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(useSpring(scrollYProgress, SPRING), [0, 1], [speed, -speed]);
  return <motion.div ref={ref} className={className} style={reduce ? undefined : { y }}>{children}</motion.div>;
}

interface Tab { before: string; after: string; tone?: 'attention' | 'done'; color?: string }

/**
 * Six terminal tabs titled "claude" that turn, one by one as you scroll, into
 * the titles ArchDraw gives them ("● Otter needs you", "✓ Fox · your turn"…).
 */
export function MorphingTabs({ tabs }: { tabs: Tab[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [named, setNamed] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'start 0.35'] });
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const next = Math.max(0, Math.min(tabs.length, Math.floor(v * (tabs.length + 1))));
    setNamed((current) => (current === next ? current : next));
  });
  const count = reduce ? tabs.length : named;
  const done = count === tabs.length;
  return (
    <div ref={ref} className={styles.tabsBlock}>
      <div className={styles.tabsHead}>
        <span>Your terminal tabs</span>
        <span className={styles.tabsState} data-done={done || undefined}>{done ? 'named by ArchDraw' : `claude × ${tabs.length - count}`}</span>
      </div>
      <div className={styles.tabStrip} role="img" aria-label="Six terminal tabs titled claude become Otter needs you, Fox your turn, Owl, Lynx, Heron and Gecko">
        {tabs.map((tab, i) => {
          const on = i < count;
          return (
            <span key={i} className={styles.tab} data-on={on || undefined} data-tone={on ? tab.tone : undefined}>
              <span className={styles.face} data-side="before">claude</span>
              <span className={styles.face} data-side="after">
                {tab.tone === 'attention' && <i className={styles.dot} />}
                {tab.tone === 'done' && <b style={{ color: tab.color }}>✓</b>}
                {tab.after}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** The three steps, lit in turn by a rail that fills as you scroll past them. */
export function ScrollSteps({ steps }: { steps: { n: string; title: string; body: string }[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.7', 'end 0.55'] });
  const fill = useSpring(scrollYProgress, SPRING);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const next = Math.min(steps.length - 1, Math.floor(v * steps.length));
    setActive((current) => (current === next ? current : next));
  });
  return (
    <ol ref={ref} className={styles.steps}>
      <span className={styles.rail} aria-hidden="true"><motion.i style={{ scaleY: reduce ? 1 : fill }} /></span>
      {steps.map((step, i) => (
        <li key={step.n} className={styles.step} data-active={reduce || i <= active || undefined}>
          <span className={styles.stepN}>{step.n}</span>
          <div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Headline words that rise into place one by one as the heading scrolls in. */
export function WordRise({ text, className, italic }: { text: string; className?: string; italic?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.95', 'start 0.55'] });
  const words = text.split(' ').filter(Boolean);
  const all = italic ? [...words.map((w) => ({ w, em: false })), ...italic.split(' ').map((w) => ({ w, em: true }))] : words.map((w) => ({ w, em: false }));
  return (
    <span ref={ref} className={className}>
      {all.map(({ w, em }, i) => (
        <Word key={i} progress={scrollYProgress} index={i} total={all.length} reduce={!!reduce} em={em}>{w}</Word>
      ))}
    </span>
  );
}

function Word({ children, progress, index, total, reduce, em }: {
  children: string; progress: ReturnType<typeof useScroll>['scrollYProgress']; index: number; total: number; reduce: boolean; em: boolean;
}) {
  const start = (index / total) * 0.6;
  const opacity = useTransform(progress, [start, start + 0.4], [0.12, 1]);
  const y = useTransform(progress, [start, start + 0.4], ['0.35em', '0em']);
  const Tag = em ? motion.em : motion.span;
  return (
    <>
      <Tag className={styles.word} style={reduce ? undefined : { opacity, y }}>{children}</Tag>{' '}
    </>
  );
}
