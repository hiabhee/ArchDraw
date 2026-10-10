'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';

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
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: 'min(320px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 80px)',
      }}
      className="z-[10000] pointer-events-auto overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.06)]"
    >
      {/* Step progress */}
      <div className="flex items-center gap-1.5 mb-4">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <motion.div
            key={i}
            animate={{
              scale: i === step - 1 ? 1.25 : 1,
            }}
            transition={{ duration: 0.3 }}
            className={`h-1.5 rounded-full transition-colors duration-300 ${
              i < step - 1
                ? 'w-4 bg-brand'
                : i === step - 1
                  ? 'w-6 bg-brand'
                  : 'w-1.5 bg-border'
            }`}
          />
        ))}
        <span className="ml-2 text-[11px] font-medium text-muted-foreground tracking-wide">
          Step {step} of {totalSteps}
        </span>
      </div>

      {/* Title */}
      <motion.p
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.08, duration: 0.3 }}
        className="text-base font-bold text-foreground tracking-tight mb-2"
      >
        {title}
      </motion.p>

      {/* Description */}
      <motion.p
        aria-live="polite"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.14, duration: 0.3 }}
        className="text-[13px] text-muted-foreground leading-relaxed mb-4"
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
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-[#22C55E]/25 bg-[#DCFCE7] px-3 py-1.5 mb-4 text-xs font-semibold text-[#16A34A]"
          >
            <Check className="w-3.5 h-3.5" />
            Component added! Click Next to continue.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1.5"
        >
          Skip guide
        </button>

        <motion.button
          ref={primaryBtnRef}
          type="button"
          onClick={onNext}
          disabled={!!nextDisabled}
          whileHover={!nextDisabled ? { scale: 1.02 } : {}}
          whileTap={!nextDisabled ? { scale: 0.98 } : {}}
          transition={{ duration: 0.15 }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-[13px] font-semibold transition-all ${
            nextDisabled
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-brand text-white hover:bg-brand-hover shadow-[0_4px_16px_rgba(30,144,255,0.30)] cursor-pointer'
          }`}
        >
          {isLastStep ? (
            <>
              Finish
              <Check className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              Next
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
