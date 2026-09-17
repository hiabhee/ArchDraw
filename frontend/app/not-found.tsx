import Link from 'next/link';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f7f7f5] text-[#1c1c1a]">
      <LandingNav />
      <main className="flex-1 flex items-center justify-center px-6 pt-24 pb-16">
        <div className="max-w-[560px] w-full bg-white border border-[#e4e4df] rounded-xl p-10 text-center" style={{ boxShadow: '0 8px 24px rgba(28,28,26,0.04)' }}>
          <p className="text-[11px] font-bold tracking-[2px] uppercase text-[#5a6066] mb-3">404 — Not found</p>
          <h1 className="font-bold tracking-tight leading-[0.95]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: 'clamp(2.5rem, 5vw, 4rem)', letterSpacing: '-0.05em' }}>
            Page <em className="text-[#155e9c] font-normal">not found</em>
          </h1>
          <p className="mt-4 text-sm text-[#5a6066] leading-relaxed">
            The page you’re looking for doesn’t exist or was moved. Check the URL or head back home.
          </p>
          <Link href="/" className="mt-6 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#1E90FF] hover:bg-[#1a7acc] active:bg-[#1668a8] px-5 py-3 rounded-lg transition-colors">
            Go home →
          </Link>
          <div className="mt-6 flex items-center justify-center gap-4 text-xs">
            <Link href="/docs" className="text-[#5a6066] hover:text-[#1c1c1a] underline underline-offset-2">Docs</Link>
            <span className="text-[#e4e4df]">·</span>
            <Link href="/contact" className="text-[#5a6066] hover:text-[#1c1c1a] underline underline-offset-2">Contact</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
