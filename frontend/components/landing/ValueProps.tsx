'use client';

import { motion } from 'framer-motion';
import { Sparkles, MousePointer2, Share2, Wand2, Code2, Zap } from 'lucide-react';

const VALUE_PROPS = [
  {
    icon: Wand2,
    title: 'Describe, don\u2019t draw',
    desc: 'Type your architecture in plain English or paste Mermaid. The AI handles structure, layout, and styling.',
    accent: '#1E90FF',
  },
  {
    icon: MousePointer2,
    title: 'Edit visually',
    desc: 'Drag nodes, connect services, and refine. Auto-layout keeps your diagram clean as you iterate.',
    accent: '#10B981',
  },
  {
    icon: Share2,
    title: 'Share anywhere',
    desc: 'Export to PNG, SVG, or a live link. Your diagrams look presentation-ready in every context.',
    accent: '#F59E0B',
  },
];

export function ValueProps() {
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
            Why ArchDraw
          </span>
          <h2
            className="text-[#1c1c1a] font-bold leading-[1.1] tracking-tight"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            The fastest way from idea to architecture
          </h2>
          <p className="mt-4 text-sm md:text-base text-[#575752] leading-relaxed">
            Stop fighting your diagramming tool. ArchDraw turns your thinking into a clean, structured diagram — so you can focus on the system, not the layout.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {VALUE_PROPS.map((prop, i) => (
            <motion.div
              key={prop.title}
              className="group relative bg-white border border-[#e4e4df] p-7 rounded-2xl overflow-hidden transition-colors duration-300 hover:border-[#cbd5e1]"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4 }}
            >
              <div
                className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `${prop.accent}18` }}
              />

              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 relative z-10"
                style={{
                  background: `${prop.accent}10`,
                  border: `1px solid ${prop.accent}25`,
                }}
              >
                <prop.icon className="w-5 h-5" style={{ color: prop.accent }} />
              </div>

              <h3 className="text-lg font-bold text-[#1c1c1a] mb-2 tracking-tight relative z-10">
                {prop.title}
              </h3>
              <p className="text-sm text-[#575752] leading-relaxed relative z-10">
                {prop.desc}
              </p>

              <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-[#8a8f98] group-hover:text-[#1c1c1a] transition-colors duration-300 relative z-10">
                <Sparkles className="w-3 h-3" />
                <span>AI-native</span>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#575752]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-[#10B981]" /> AI auto-layout — no manual alignment</span>
          <span className="text-[#e4e4df]">•</span>
          <span className="flex items-center gap-1.5"><Code2 className="w-3 h-3 text-[#1E90FF]" /> Mermaid-compatible</span>
          <span className="text-[#e4e4df]">•</span>
          <span className="flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-[#F59E0B]" /> AI that understands your stack</span>
        </motion.div>
      </div>
    </section>
  );
}
