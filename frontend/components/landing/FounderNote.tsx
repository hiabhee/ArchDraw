'use client';

import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

export function FounderNote() {
  return (
    <section className="py-24 px-6 bg-[#f1f1eb]/40 border-y border-[#e4e4df]">
      <div className="max-w-[820px] mx-auto">
        <motion.div
          className="relative bg-white border border-[#e4e4df] rounded-2xl p-8 md:p-12 shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #1E90FF20, transparent 70%)' }}
          />

          <Quote className="w-10 h-10 text-[#1E90FF]/20 mb-2 relative z-10" />

          <blockquote className="relative z-10">
            <p className="text-lg md:text-2xl text-[#1c1c1a] leading-snug font-medium tracking-tight">
              &ldquo;I built ArchDraw because I kept losing more time formatting a diagram than thinking about the architecture itself. Now the AI handles layout — and I focus on the system.&rdquo;
            </p>
          </blockquote>

          <div className="mt-8 pt-6 border-t border-[#e4e4df] flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1E90FF] to-[#4dabf7] flex items-center justify-center text-white font-bold text-sm shadow-md">
              AS
            </div>
            <div>
              <div className="text-sm font-semibold text-[#1c1c1a]">
                Abhishek Suresh Jamdade
              </div>
              <div className="text-xs text-[#8a8f98]">
                Founder, ArchDraw · Building in public
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
