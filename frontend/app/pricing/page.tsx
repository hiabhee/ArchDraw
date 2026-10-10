import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import { Check, Lock, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing — ArchDraw',
  description: 'Free during beta. 3 generations/hour for guests, 10/day when signed in. Canvas limits and export included. Paid plans coming.',
  alternates: { canonical: 'https://archdraw.hiabhee.online/pricing' },
  openGraph: {
    type: 'website',
    url: 'https://archdraw.hiabhee.online/pricing',
    title: 'Pricing — ArchDraw',
    description: 'Free during beta — generation quotas, canvas caps, and what you get.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw Pricing' }],
  },
};

const INCLUDES = ['Unlimited diagram generation in beta', 'Mermaid editor & import', 'PNG/SVG/JSON export', 'Live share links', 'Templates & tutorials', 'No credit card'];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'ArchDraw',
  description: 'Architecture diagram tool — free during beta',
  brand: { '@type': 'Brand', name: 'ArchDraw' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: 'https://archdraw.hiabhee.online/pricing' },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f7f7f5] text-[#1c1c1a]">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <main className="flex-1 max-w-[1160px] w-full mx-auto px-6 pt-24 pb-16">
        <p className="text-[11px] font-bold tracking-[2px] uppercase text-[#5a6066] mb-3">Pricing</p>
        <h1 className="font-bold tracking-tight leading-[0.95]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '-0.05em' }}>
          Free during <em className="text-[#155e9c] font-normal">beta</em>
        </h1>
        <p className="mt-3 text-sm text-[#5a6066] max-w-2xl leading-relaxed">Paid plans are coming. Early users get a locked-in launch discount. For now, build without limits.</p>

        <div className="mt-10 max-w-[560px]">
          <div className="bg-white border border-[#e4e4df] rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#1E90FF] text-white text-[10px] font-bold tracking-[1.5px] uppercase px-3.5 py-1.5 rounded-b-lg">Beta Pass</div>
            <div className="flex items-center gap-2 mb-4 text-[#1E90FF]"><Sparkles className="w-4 h-4" /><span className="text-xs font-bold uppercase tracking-wider">Beta access</span></div>
            <div className="flex items-baseline gap-2 mb-2"><span className="text-5xl font-extrabold tracking-tight">$0</span><span className="text-sm text-[#5a6066]">/ free in beta</span></div>
            <p className="text-sm text-[#5a6066] mb-6">Everything you need to ship diagrams.</p>
            <ul className="space-y-3 mb-8 text-sm">
              {INCLUDES.map((item) => (
                <li key={item} className="flex items-center gap-2.5"><span className="w-5 h-5 rounded-full bg-[#10B981]/10 grid place-items-center"><Check className="w-3 h-3 text-[#10B981]" strokeWidth={3} /></span>{item}</li>
              ))}
            </ul>
            <Link href="/#generate" className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#1E90FF] hover:bg-[#155e9c] px-6 py-3.5 rounded-lg transition-colors">Map your codebase →</Link>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#8a8f98]"><Lock className="w-3 h-3" />No credit card · Quotas reset hourly/daily</p>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
            <div className="bg-white border border-[#e4e4df] rounded-xl p-4"><div className="font-bold">Guest</div><p className="text-[#5a6066] mt-1">3 generations/hour, 1 canvas, 50 nodes</p></div>
            <div className="bg-white border border-[#e4e4df] rounded-xl p-4"><div className="font-bold">Signed-in</div><p className="text-[#5a6066] mt-1">10/day, 5 canvases, 150 nodes, share/SVG</p></div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
