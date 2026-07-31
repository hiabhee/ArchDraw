'use client';

import { motion } from 'framer-motion';
import { GraduationCap, Layers, FileText, Rocket } from 'lucide-react';

const PERSONAS = [
  {
    icon: GraduationCap,
    title: 'Students',
    desc: 'Practice system-design interview diagrams without burning time on alignment.',
    color: '#1E90FF',
  },
  {
    icon: Layers,
    title: 'Engineers & teams',
    desc: 'Document real production architecture for onboarding, reviews, and READMEs.',
    color: '#10B981',
  },
  {
    icon: FileText,
    title: 'Technical writers',
    desc: 'Embed crisp, accurate diagrams in user docs without learning a design tool.',
    color: '#F59E0B',
  },
  {
    icon: Rocket,
    title: 'Founders & researchers',
    desc: 'Explain complex systems to stakeholders in one clear, professional view.',
    color: '#8B5CF6',
  },
];

export function UseCases() {
  return (
    <section className="py-24 px-6 bg-[#f7f7f5]">
      <div className="max-w-[1280px] mx-auto">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-[11px] font-bold tracking-[2px] uppercase text-[#8a8f98] block mb-3">
            Who it&apos;s for
          </span>
          <h2
            className="text-[#1c1c1a] font-bold leading-[1.1] tracking-tight"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            Built for anyone who explains systems visually
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PERSONAS.map((persona, i) => (
            <motion.div
              key={persona.title}
              className="group relative bg-white border border-[#e4e4df] p-6 rounded-2xl overflow-hidden transition-colors duration-300 hover:border-[#cbd5e1]"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: 0.5,
                delay: i * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={{ y: -3 }}
            >
              <div
                className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `${persona.color}15` }}
              />
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 relative z-10"
                style={{
                  background: `${persona.color}10`,
                  border: `1px solid ${persona.color}25`,
                }}
              >
                <persona.icon
                  className="w-5 h-5"
                  style={{ color: persona.color }}
                />
              </div>
              <h3 className="text-base font-bold text-[#1c1c1a] mb-2 tracking-tight relative z-10">
                {persona.title}
              </h3>
              <p className="text-sm text-[#575752] leading-relaxed relative z-10">
                {persona.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
