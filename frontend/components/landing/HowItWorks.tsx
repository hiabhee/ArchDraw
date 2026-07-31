'use client';

import { motion } from 'framer-motion';
import { PencilLine, Wand2, Share2 } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    icon: PencilLine,
    title: 'Describe',
    desc: 'Type your architecture in plain English, paste Mermaid, or import a file. The AI understands your intent.',
    color: '#1E90FF',
  },
  {
    number: '02',
    icon: Wand2,
    title: 'Generate',
    desc: 'ArchDraw validates, enriches, and auto-lays out your diagram. No more dragging boxes or untangling lines.',
    color: '#10B981',
  },
  {
    number: '03',
    icon: Share2,
    title: 'Share',
    desc: 'Export to PNG or SVG, or generate a live shareable link. Your diagram is ready in any context.',
    color: '#F59E0B',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 px-6 bg-[#f1f1eb]/30 border-y border-[#e4e4df] relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
           style={{
             backgroundImage: 'radial-gradient(circle, #1c1c1a 1px, transparent 1px)',
             backgroundSize: '24px 24px',
           }}
      />

      <div className="max-w-[1280px] mx-auto relative">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-20"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-[11px] font-bold tracking-[2px] uppercase text-[#8a8f98] block mb-3">
            How it works
          </span>
          <h2
            className="text-[#1c1c1a] font-bold leading-[1.1] tracking-tight"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            From description to diagram in 3 steps
          </h2>
          <p className="mt-4 text-sm md:text-base text-[#575752] leading-relaxed">
            No learning curve. No manual alignment. Just describe what you want and watch it take shape.
          </p>
        </motion.div>

        <div className="relative">
          <div className="hidden md:block absolute top-[60px] left-[calc(16.67%+48px)] right-[calc(16.67%+48px)] h-[1px]">
            <div className="w-full h-full bg-gradient-to-r from-transparent via-[#d0d0cc] to-transparent" />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-brand to-transparent"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
              style={{
                animation: 'shimmerLine 2.4s ease-in-out infinite',
                backgroundSize: '200% 100%',
              }}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-6 relative">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                className="relative flex flex-col items-center text-center"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.15,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <motion.div
                  className="relative w-[120px] h-[120px] rounded-2xl bg-white border border-[#e4e4df] shadow-sm flex items-center justify-center mb-7"
                  whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className="absolute inset-2 rounded-xl opacity-10"
                    style={{ background: `radial-gradient(circle, ${step.color}, transparent 70%)` }}
                  />
                  <div className="relative z-10 flex flex-col items-center gap-1">
                    <step.icon className="w-5 h-5" style={{ color: step.color }} />
                    <span
                      className="text-2xl font-extrabold"
                      style={{ color: step.color }}
                    >
                      {step.number}
                    </span>
                  </div>
                </motion.div>

                <h3 className="text-xl font-bold text-[#1c1c1a] mb-3 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-sm text-[#575752] leading-relaxed max-w-[280px]">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
