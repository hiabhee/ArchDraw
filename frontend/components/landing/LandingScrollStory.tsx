'use client';

import { useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import styles from './LandingScrollStory.module.css';
import { LandingCanvasPreview } from './LandingCanvasPreview';

const STORY_STEPS = [
  {
    number: '01',
    title: 'Start with an idea or a repo.',
    detail: 'Describe the services in plain language or paste a public GitHub URL. ArchDraw turns that input into an editable first map.',
  },
  {
    number: '02',
    title: 'Trace a request across services.',
    detail: 'Trace web and mobile requests through the load balancer and gateway, then follow chat traffic to storage, cache, and event services.',
  },
  {
    number: '03',
    title: 'Refine the architecture together.',
    detail: 'Move and group components, adjust the layout, edit Mermaid, then share or export the diagram with your team.',
  },
];

export function LandingScrollStory() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ['start 0.78', 'end 0.36'],
  });
  const easedProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 28, mass: 0.45 });
  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    if (reduceMotion) return;
    const nextStep = progress < 0.35 ? 0 : progress < 0.62 ? 1 : 2;
    setActiveStep((current) => (current === nextStep ? current : nextStep));
  });

  return (
    <section id="workflow" className={styles.storySection} aria-labelledby="story-title">
      <div className={styles.storyShell}>
        <div className={styles.storyIntro}>
          <p className={styles.kicker}>From input to architecture</p>
          <h2 id="story-title">Watch a system take shape.</h2>
          <p>Follow one diagram from the first signal to a map your team can keep editing.</p>
        </div>

        <div className={styles.progressRail} aria-hidden="true"><motion.span style={{ scaleX: reduceMotion ? 1 : easedProgress }} /></div>

        <div className={styles.storyBody}>
          <div ref={trackRef} className={styles.storyTrack}>
            {STORY_STEPS.map((step, index) => (
              <article key={step.number} className={styles.storyStep} data-active={activeStep === index || undefined}>
                <span className={styles.stepIndex}>{step.number}<i /></span>
                <div className={styles.stepText}>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </div>
              </article>
            ))}
          </div>
          <div className={styles.storyDiagram}>
            <LandingCanvasPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
