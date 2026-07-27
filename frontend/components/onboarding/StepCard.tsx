'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StepCardProps {
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  isLastStep: boolean;
  nextDisabled?: boolean;
  stepCompleted?: boolean;
  onNext: () => void;
  onSkip: () => void;
  position: { top: number; left: number };
}

export function StepCard({
  step,
  totalSteps,
  title,
  description,
  isLastStep,
  nextDisabled,
  stepCompleted,
  onNext,
  onSkip,
  position,
}: StepCardProps) {
  const primaryBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = setTimeout(() => primaryBtnRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      key={step}
      role="dialog"
      aria-label={`Onboarding step ${step} of ${totalSteps}: ${title}`}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: 'min(320px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
        background: 'linear-gradient(135deg, #1a1d2e 0%, #141624 100%)',
        border: '1px solid rgba(89,89,89,0.35)',
        borderRadius: 16,
        padding: '22px 26px',
        boxShadow:
          '0 0 0 1px rgba(89,89,89,0.08), 0 12px 40px rgba(0,0,0,0.55), 0 0 60px rgba(89,89,89,0.06)',
        zIndex: 10000,
        pointerEvents: 'all',
      }}
    >
      {/* Step progress dots */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 12, alignItems: 'center' }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <motion.div
            key={i}
            animate={{
              background: i < step ? '#595959' : i === step - 1 ? '#8A8A8A' : '#2d3148',
              scale: i === step - 1 ? 1.35 : 1,
            }}
            transition={{ duration: 0.3 }}
            style={{ width: 7, height: 7, borderRadius: '50%' }}
          />
        ))}
        <span
          style={{
            marginLeft: 8,
            fontSize: 11,
            color: '#4b5563',
            fontFamily: 'inherit',
            letterSpacing: '0.02em',
          }}
        >
          Step {step} of {totalSteps}
        </span>
      </div>

      {/* Title */}
      <motion.p
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.08, duration: 0.3 }}
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: '#f9fafb',
          margin: '0 0 8px',
          fontFamily: 'inherit',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </motion.p>

      {/* Description */}
      <motion.p
        aria-live="polite"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.14, duration: 0.3 }}
        style={{
          fontSize: 13,
          color: '#8b95a8',
          lineHeight: 1.65,
          margin: '0 0 16px',
          fontFamily: 'inherit',
        }}
      >
        {description}
      </motion.p>

      {/* Completion badge (step 4) */}
      <AnimatePresence>
        {stepCompleted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 20,
              padding: '5px 12px',
              marginBottom: 14,
              fontSize: 12,
              color: '#4ade80',
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            <motion.span
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.4, ease: 'backOut' }}
            >
              ✓
            </motion.span>
            Component added! Click Next to continue.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Button row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <motion.button
          onClick={onSkip}
          whileHover={{ color: '#9ca3af' }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#4b5563',
            fontSize: 12,
            cursor: 'pointer',
            padding: '6px 0',
            fontFamily: 'inherit',
          }}
        >
          Skip guide
        </motion.button>

        <motion.button
          ref={primaryBtnRef}
          onClick={onNext}
          disabled={!!nextDisabled}
          whileHover={!nextDisabled ? { scale: 1.04, background: '#8A8A8A' } : {}}
          whileTap={!nextDisabled ? { scale: 0.97 } : {}}
          transition={{ duration: 0.15 }}
          style={{
            background: nextDisabled
              ? '#252840'
              : 'linear-gradient(135deg, #595959, #8A8A8A)',
            border: 'none',
            color: nextDisabled ? '#4b5563' : '#fff',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            padding: '9px 20px',
            cursor: nextDisabled ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: nextDisabled
              ? 'none'
              : '0 2px 12px rgba(99,102,241,0.4)',
            letterSpacing: '-0.01em',
          }}
        >
          {isLastStep ? 'Finish ✓' : 'Next →'}
        </motion.button>
      </div>
    </motion.div>
  );
}
