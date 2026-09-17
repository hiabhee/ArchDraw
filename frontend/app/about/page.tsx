import type { Metadata } from 'next';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About — ArchDraw',
  description: 'ArchDraw is built by engineers who think in systems. Learn why we made a diagram tool that understands architecture.',
  alternates: { canonical: 'https://archdraw.hiabhee.online/about' },
  openGraph: {
    type: 'website',
    url: 'https://archdraw.hiabhee.online/about',
    title: 'About — ArchDraw',
    description: 'Why we built ArchDraw — an architecture tool that maps systems, not just boxes.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'About ArchDraw' }],
  },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About ArchDraw',
  url: 'https://archdraw.hiabhee.online/about',
  description: 'ArchDraw turns repos, prompts and Mermaid into editable architecture diagrams.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f7f7f5] text-[#1c1c1a]">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <main className="flex-1 max-w-[1160px] w-full mx-auto px-6 pt-24 pb-16">
        <p className="text-[11px] font-bold tracking-[2px] uppercase text-[#5a6066] mb-3">About</p>
        <h1 className="font-bold tracking-tight leading-[0.95] max-w-3xl" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '-0.05em' }}>
          A diagram tool that <em className="text-[#155e9c] font-normal">understands</em> systems.
        </h1>
        <p className="mt-4 text-sm leading-relaxed max-w-2xl text-[#5a6066]">
          ArchDraw was started to fix one workflow: turning a codebase you inherit into a diagram your team can discuss. Draw.io gave you boxes; we give you a pipeline that reads your repo, respects tiers, and lays out a readable graph.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="bg-white border border-[#e4e4df] rounded-xl p-6">
            <h3 className="text-sm font-bold mb-2">Engineer-first</h3>
            <p className="text-xs text-[#5a6066] leading-relaxed">Built on React Flow + Dagre, with the same layout engine the editor uses. What you see on the landing is what you edit.</p>
          </div>
          <div className="bg-white border border-[#e4e4df] rounded-xl p-6">
            <h3 className="text-sm font-bold mb-2">AI with guardrails</h3>
            <p className="text-xs text-[#5a6066] leading-relaxed">Prompt → Mermaid → Validate → Dagre. Edges flow left→right, auth never bypasses the gateway, media always has storage → transcode → CDN.</p>
          </div>
          <div className="bg-white border border-[#e4e4df] rounded-xl p-6">
            <h3 className="text-sm font-bold mb-2">Open & local</h3>
            <p className="text-xs text-[#5a6066] leading-relaxed">MCP server is local stdio JSON-RPC. Your canvas stays yours; export to PNG/SVG/JSON/Mermaid anytime.</p>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Link href="/#generate" className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#1E90FF] hover:bg-[#155e9c] px-5 py-3 rounded-lg transition-colors">Map your codebase →</Link>
          <Link href="/docs" className="inline-flex items-center text-sm font-semibold border border-[#e4e4df] bg-white hover:bg-[#fbfbfa] px-5 py-3 rounded-lg">Read docs</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
