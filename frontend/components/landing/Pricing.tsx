'use client';

import { motion } from 'framer-motion';
import { Check, ArrowRight, Sparkles, Lock } from 'lucide-react';

const INCLUDES = [
  'Unlimited diagram generation',
  'Mermaid workspace editor',
  'Export to PNG, SVG & live links',
  'Real-time collaboration',
  'No credit card required',
];

export function Pricing() {
  return (
    <section
      id="pricing"
      className="py-24 px-6 bg-[#f7f7f5]"
    >
      <div className="max-w-[1100px] mx-auto">
        <motion.div
          className="text-center max-w-xl mx-auto mb-14"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-[11px] font-bold tracking-[2px] uppercase text-[#8a8f98] block mb-3">
            Pricing
          </span>
          <h2
            className="text-[#1c1c1a] font-bold leading-[1.1] tracking-tight"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            Free during beta
          </h2>
          <p className="mt-4 text-sm md:text-base text-[#575752] leading-relaxed">
            Paid plans are coming. Early users will get a permanently locked-in launch discount.
          </p>
        </motion.div>

        <motion.div
          className="max-w-[460px] mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative bg-white border border-[#e4e4df] rounded-2xl p-8 shadow-sm overflow-hidden">
            <div
              className="absolute -top-px left-1/2 -translate-x-1/2 bg-brand text-white text-[10px] font-bold tracking-[1.5px] uppercase px-3.5 py-1.5 rounded-b-lg shadow-sm"
            >
              Beta Pass
            </div>

            <div
              className="absolute -top-32 -left-32 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ background: 'radial-gradient(circle, #1E90FF, transparent 70%)' }}
            />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-[#1E90FF]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E90FF]">
                  Beta access
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-extrabold text-[#1c1c1a] tracking-tight">$0</span>
                <span className="text-sm text-[#575752] font-medium">/ free forever in beta</span>
              </div>
              <p className="text-sm text-[#575752] mb-7">
                Everything you need to design, share, and ship diagrams.
              </p>

              <ul className="space-y-3 mb-8 text-sm text-[#1c1c1a]">
                {INCLUDES.map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#10B981]/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-[#10B981]" strokeWidth={3} />
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <a
                href="/dashboard"
                data-track="pricing_get_started"
                className="group w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand-hover px-6 py-3.5 rounded-lg transition-all duration-200 shadow-[0_4px_16px_rgba(30,144,255,0.25)] hover:shadow-[0_6px_20px_rgba(30,144,255,0.35)] hover:-translate-y-0.5"
              >
                Get started free
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>

              <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[#8a8f98]">
                <Lock className="w-3 h-3" />
                <span>No credit card · No account required to try</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
