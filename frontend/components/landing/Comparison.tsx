'use client';

import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

type Cell = boolean | string;

interface ComparisonRow {
  feature: string;
  archdraw: Cell;
  drawio: Cell;
  lucidchart: Cell;
}

const ROWS: ComparisonRow[] = [
  { feature: 'AI diagram from plain English', archdraw: true, drawio: false, lucidchart: 'Limited' },
  { feature: 'Generate from a GitHub repo URL', archdraw: true, drawio: false, lucidchart: false },
  { feature: 'MCP server for AI assistants', archdraw: true, drawio: false, lucidchart: false },
  { feature: 'Auto-layout with subgraphs', archdraw: true, drawio: 'Manual', lucidchart: true },
  { feature: 'Live share links', archdraw: true, drawio: false, lucidchart: true },
  { feature: 'Export PNG / SVG / Mermaid / JSON', archdraw: true, drawio: 'SVG/PNG/XML', lucidchart: 'PNG/SVG/PDF' },
  { feature: 'Pricing', archdraw: 'Free during beta', drawio: 'Free', lucidchart: 'Freemium' },
];

function CellView({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600">
        <Check className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#8a8f98]/10 text-[#8a8f98]">
        <X className="w-3.5 h-3.5" />
      </span>
    );
  }
  return <span className="text-xs font-medium text-[#575752]">{value}</span>;
}

export function Comparison() {
  return (
    <section id="comparison" className="py-24 px-6 bg-[#f7f7f5]">
      <div className="max-w-[980px] mx-auto">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-[11px] font-bold tracking-[2px] uppercase text-[#8a8f98] block mb-3">
            ArchDraw vs draw.io vs Lucidchart
          </span>
          <h2
            className="text-[#1c1c1a] font-bold leading-[1.1] tracking-tight"
            style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}
          >
            ArchDraw is the diagramming tool that builds the diagram for you
          </h2>
          <p className="mt-4 text-sm md:text-base text-[#575752] leading-relaxed">
            draw.io and Lucidchart are drawing canvases: you drag, connect, and align every box by hand.
            ArchDraw generates a fully laid-out architecture diagram from a description, a Mermaid snippet,
            or a GitHub repo URL — and lets you keep editing visually afterward.
          </p>
        </motion.div>

        <motion.div
          className="bg-white border border-[#e4e4df] rounded-2xl overflow-hidden"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#e4e4df]">
                  <th className="p-4 text-xs font-bold text-[#1c1c1a]">Feature</th>
                  <th className="p-4 text-xs font-bold text-[#1c1c1a] text-center">
                    <span className="text-[#1E90FF]">ArchDraw</span>
                  </th>
                  <th className="p-4 text-xs font-semibold text-[#575752] text-center">draw.io</th>
                  <th className="p-4 text-xs font-semibold text-[#575752] text-center">Lucidchart</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.feature} className="border-b border-[#e4e4df]/60 last:border-0">
                    <td className="p-4 text-sm font-medium text-[#1c1c1a]">{row.feature}</td>
                    <td className="p-4 text-center"><CellView value={row.archdraw} /></td>
                    <td className="p-4 text-center"><CellView value={row.drawio} /></td>
                    <td className="p-4 text-center"><CellView value={row.lucidchart} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
