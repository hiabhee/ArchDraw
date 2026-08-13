'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    q: 'Is ArchDraw really free?',
    a: 'Yes — completely free while in beta. Paid plans will launch later, but everyone using it during beta gets a locked-in early-adopter discount.',
  },
  {
    q: 'Do I need an account to try it?',
    a: 'No. You can generate, explore, and design diagrams without signing up. Create an account only if you want to save or share.',
  },
  {
    q: 'How is this different from draw.io or Lucidchart?',
    a: 'ArchDraw generates the diagram for you. draw.io and Lucidchart are drawing canvases where you drag, connect, and align every box by hand; ArchDraw turns a plain-English description, a Mermaid snippet, or a GitHub repo URL into a fully auto-laid-out architecture diagram. See the comparison table in the section above for a full feature breakdown.',
  },
  {
    q: 'Can I export and share?',
    a: 'Yes. Export to PNG or SVG, or generate a permanent live link you can paste in Slack, docs, or email. Diagrams render pixel-perfect in every context.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Your prompts and diagrams are processed in-session and never stored on our servers or used to train any model. Your work stays yours.',
  },
];

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.a,
    },
  })),
};

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="py-24 px-6 bg-[#f1f1eb]/40 border-t border-[#e4e4df]"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <div className="max-w-[760px] mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-[11px] font-bold tracking-[2px] uppercase text-[#8a8f98] block mb-3">
            FAQ
          </span>
          <h2
            className="text-[#1c1c1a] font-bold leading-[1.1] tracking-tight"
            style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}
          >
            Common questions
          </h2>
        </motion.div>

        <div className="space-y-2.5">
          {FAQS.map((faq, i) => (
            <motion.div
              key={faq.q}
              className="bg-white border border-[#e4e4df] rounded-xl overflow-hidden transition-colors duration-200 hover:border-[#cbd5e1]"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left cursor-pointer select-none"
                aria-expanded={open === i}
              >
                <span className="text-sm md:text-base font-semibold text-[#1c1c1a] pr-4">
                  {faq.q}
                </span>
                <motion.span
                  animate={{ rotate: open === i ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="shrink-0"
                >
                  <ChevronDown className="w-4 h-4 text-[#8a8f98]" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 text-sm text-[#575752] leading-relaxed border-t border-[#e4e4df]/60 pt-4">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
