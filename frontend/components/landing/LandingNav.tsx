'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Why', href: '#why', track: 'nav_why' },
  { label: 'How it works', href: '#how-it-works', track: 'nav_how_it_works' },
  { label: 'Pricing', href: '#pricing', track: 'nav_pricing' },
  { label: 'Docs', href: '/docs', track: 'nav_docs' },
];

export function LandingNav({ outfitClassName }: { outfitClassName?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 h-14 transition-all duration-200 ${
        scrolled
          ? 'bg-[#f7f7f5]/85 backdrop-blur-xl border-b border-[#e4e4df]/60'
          : 'bg-[#f7f7f5]'
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(30,144,255,0.35)] transition-transform duration-200 group-hover:scale-105">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className={`text-sm font-bold text-[#1c1c1a] tracking-tight ${outfitClassName ?? ''}`}>
              ArchDraw
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                data-track={link.track}
                className="px-3 py-1.5 text-sm text-[#575752] hover:text-[#1c1c1a] rounded-md transition-colors duration-150 font-medium"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/dashboard"
            data-track="nav_sign_in"
            className="text-sm text-[#575752] hover:text-[#1c1c1a] px-4 py-1.5 rounded-lg border border-[#e4e4df] bg-white hover:bg-slate-50 transition-all duration-150 font-medium"
          >
            Sign in
          </a>
          <a
            href="/dashboard"
            data-track="nav_get_started"
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover px-4 py-1.5 rounded-lg transition-all duration-200 shadow-[0_4px_12px_rgba(30,144,255,0.2)] hover:shadow-[0_4px_18px_rgba(30,144,255,0.35)] hover:-translate-y-0.5"
          >
            Get started free
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-[#575752] hover:text-[#1c1c1a] transition-colors"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size="20" /> : <Menu size="20" />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-white border-b border-[#e4e4df] animate-in fade-in slide-in-from-top-4 duration-150">
          <div className="px-6 py-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm text-[#575752] hover:text-[#1c1c1a] py-3 transition-colors font-medium"
              >
                {link.label}
              </a>
            ))}
            <hr className="border-[#e4e4df] my-2" />
            <a
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="text-sm text-[#575752] hover:text-[#1c1c1a] py-3 transition-colors font-medium"
            >
              Sign in
            </a>
            <a
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-semibold text-center text-white bg-brand hover:bg-brand-hover px-4 py-3 rounded-lg transition-colors"
            >
              Get started free
            </a>
          </div>
        </div>
      )}
    </motion.header>
  );
}
