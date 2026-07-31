'use client';

import { motion } from 'framer-motion';

const TECH_LOGOS = [
  'AWS', 'GCP', 'Kubernetes', 'Node.js', 'PostgreSQL',
  'Redis', 'RabbitMQ', 'React', 'Docker', 'TypeScript',
];

export function SocialProof() {
  return (
    <section className="py-14 px-6 border-y border-[#e4e4df] bg-[#f1f1eb]/40 overflow-hidden">
      <div className="max-w-[1280px] mx-auto">
        <motion.p
          className="text-center text-[11px] font-bold tracking-[2px] uppercase text-[#8a8f98] mb-7"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          Built for the systems you already design around
        </motion.p>
        <div className="relative overflow-hidden mask-fade-x">
          <div
            className="flex gap-14 animate-marquee"
            style={{ width: 'max-content' }}
          >
            {[...TECH_LOGOS, ...TECH_LOGOS, ...TECH_LOGOS].map((name, i) => (
              <span
                key={i}
                className="text-sm text-[#575752]/80 hover:text-[#1c1c1a] whitespace-nowrap font-mono font-semibold transition-colors duration-200 select-none"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
