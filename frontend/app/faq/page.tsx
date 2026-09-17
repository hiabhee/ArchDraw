import type { Metadata } from 'next';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'FAQ — ArchDraw',
  description: 'Frequently asked questions about ArchDraw — pricing, import, Mermaid, MCP, privacy, and more.',
  alternates: { canonical: 'https://archdraw.hiabhee.online/faq' },
  openGraph: {
    type: 'website',
    url: 'https://archdraw.hiabhee.online/faq',
    title: 'FAQ — ArchDraw',
    description: 'Answers to common questions about ArchDraw.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw FAQ' }],
  },
};

const FAQS = [
  { q: 'Is ArchDraw free?', a: 'Yes — free during beta. Guests get 3 generations/hour, signed-in users 10/day. Paid plans will come with a launch discount for early users.' },
  { q: 'Do I need an account?', a: 'No. Generate and explore without signing up. Sign in only to save canvases, share links, and export SVGs.' },
  { q: 'How is this different from draw.io / Lucidchart?', a: 'We generate the diagram for you from a prompt, Mermaid, or GitHub repo, with validated tiers and auto-layout. You edit, not draw from scratch.' },
  { q: 'Can I import Mermaid?', a: 'Yes. Paste Mermaid (graph LR/TD with subgraphs) — it round-trips via the same pipeline (React Flow → Mermaid → Dagre → positions).' },
  { q: 'What is the MCP server?', a: 'A local stdio JSON-RPC server that lets Claude/Cursor call tools like generate-diagram, update-diagram, fix-layout directly on your canvas.' },
  { q: 'Is my data private?', a: 'Prompts are processed per-session, not stored or used for training. Canvases are localStorage for guests, Supabase for signed-in users.' },
];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((faq) => ({ '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a } })),
};

export default function FAQPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f7f7f5] text-[#1c1c1a]">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <main className="flex-1 max-w-[760px] w-full mx-auto px-6 pt-24 pb-16">
        <p className="text-[11px] font-bold tracking-[2px] uppercase text-[#5a6066] mb-3">FAQ</p>
        <h1 className="font-bold tracking-tight leading-[0.95]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '-0.05em' }}>
          Common <em className="text-[#155e9c] font-normal">questions</em>
        </h1>

        <div className="mt-10 space-y-3">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group bg-white border border-[#e4e4df] rounded-xl open:shadow-[0_8px_24px_rgba(28,28,26,0.04)]">
              <summary className="flex items-center justify-between gap-4 px-5 py-4 text-sm font-semibold cursor-pointer list-none">
                <span>{faq.q}</span>
                <span className="shrink-0 text-[#8a8f98] group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <div className="px-5 pb-5 text-sm text-[#5a6066] leading-relaxed border-t border-[#e4e4df]/70 pt-3">{faq.a}</div>
            </details>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
