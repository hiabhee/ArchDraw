'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Lock, Sparkles } from 'lucide-react';

export function CTABanner() {
  return (
    <section className="py-24 px-6 bg-[#f7f7f5] relative overflow-hidden border-t border-[#e4e4df]">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #1E90FF10, transparent 70%)', filter: 'blur(80px)' }}
      />

      <motion.div
        className="absolute top-12 left-12 w-1.5 h-1.5 rounded-full bg-[#1E90FF]/40"
        animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-32 right-24 w-1 h-1 rounded-full bg-[#10B981]/40"
        animate={{ y: [0, 8, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div
        className="absolute bottom-20 left-1/3 w-1 h-1 rounded-full bg-[#F59E0B]/40"
        animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />

      <div className="max-w-[760px] mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[2px] uppercase text-[#1E90FF] bg-[#1E90FF]/8 px-3 py-1.5 rounded-full mb-6"
                style={{ background: 'rgba(30, 144, 255, 0.08)' }}>
            <Sparkles className="w-3 h-3" /> Ready in 30 seconds
          </span>
        </motion.div>

        <motion.h2
          className="text-[#1c1c1a] font-bold leading-[1.05] tracking-tight mb-5"
          style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)' }}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          Stop dragging boxes.
          <br />
          <span className="text-[#1E90FF]">Start describing systems.</span>
        </motion.h2>

        <motion.p
          className="text-base md:text-lg text-[#575752] max-w-[520px] mx-auto mb-9 leading-relaxed"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          Get clean, structured, presentation-ready diagrams in seconds. Free during beta — no credit card, no account required to try.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <a
            href="/dashboard"
            data-track="cta_generate_diagram"
            className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand-hover px-7 py-3.5 rounded-lg transition-all duration-200 shadow-[0_4px_20px_rgba(30,144,255,0.3)] hover:shadow-[0_8px_28px_rgba(30,144,255,0.45)] hover:-translate-y-0.5"
          >
            Generate my diagram free
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
          <a
            href="/dashboard/templates"
            data-track="cta_see_examples"
            className="w-full sm:w-auto text-sm font-semibold text-[#1c1c1a] bg-white border border-[#e4e4df] hover:bg-slate-50 px-7 py-3.5 rounded-lg transition-all duration-200 hover:-translate-y-0.5"
          >
            See example diagrams
          </a>
        </motion.div>

        <motion.div
          className="mt-6 text-xs text-[#8a8f98] flex items-center justify-center gap-1.5"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Lock className="w-3 h-3" />
          <span>Free during beta · No account required to try</span>
        </motion.div>
      </div>
    </section>
  );
}
