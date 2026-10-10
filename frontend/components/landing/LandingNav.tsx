'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { START_CTA_LABEL, startCtaHref } from './cta';

const NAV_LINKS = [
  { label: 'Features', href: '/#features', track: 'nav_features' },
  { label: 'How it works', href: '/#workflow', track: 'nav_how_it_works' },
  { label: 'Pricing', href: '/pricing', track: 'nav_pricing' },
  { label: 'Docs', href: '/docs', track: 'nav_docs' },
];

const DARK_NAV_LINKS = NAV_LINKS.filter((link) => link.label !== 'Features');

export function LandingNav({ outfitClassName, tone = 'light' }: { outfitClassName?: string; tone?: 'light' | 'dark' }) {
  const pathname = usePathname();
  const { user, initialized } = useAuthStore();
  const isAuthenticated = initialized && Boolean(user && user.id !== 'guest');
  const isDark = tone === 'dark';
  const navLinks = isDark ? DARK_NAV_LINKS : NAV_LINKS;
  const startHref = isDark ? (pathname === '/' ? '#generate' : '/#generate') : startCtaHref(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={isDark ? { y: 0, opacity: 1 } : { y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={isDark ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 h-14 transition-[background-color,border-color,backdrop-filter] duration-200 border-b ${
        scrolled
          ? isDark ? 'bg-black/90 backdrop-blur-xl border-white/[0.1]' : 'bg-[#f7f7f5]/85 backdrop-blur-xl border-[#e4e4df]/60'
          : 'bg-transparent border-transparent'
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className={`w-7 h-7 rounded-lg ${isDark ? 'bg-[#2563eb] shadow-[0_0_18px_rgba(37,99,235,0.35)]' : 'bg-brand shadow-[0_0_15px_rgba(30,144,255,0.35)]'} flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105`}>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className={`text-sm font-bold ${isDark ? 'text-[#f2f5f9]' : 'text-[#1c1c1a]'} tracking-tight ${outfitClassName ?? ''}`}>
              ArchDraw
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                data-track={link.track}
                className={`px-3 py-1.5 text-sm ${isDark ? 'text-[#aeb9c7] hover:text-[#f2f5f9]' : 'text-[#575752] hover:text-[#1c1c1a]'} rounded-md transition-colors duration-150 font-medium`}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <a
              href="/dashboard"
              data-track="nav_dashboard"
              className={`inline-flex items-center gap-1.5 text-sm font-semibold ${isDark ? 'bg-[#2563eb] text-white hover:bg-[#3b82f6] active:bg-[#1d4ed8]' : 'text-white bg-brand hover:bg-[#1a7acc] active:bg-[#1668a8]'} px-4 py-1.5 rounded-lg transition-colors duration-150 whitespace-nowrap`}
            >
              Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          ) : (
            <>
              <a
                href="/dashboard"
                data-track="nav_sign_in"
                className={`text-sm ${isDark ? 'text-[#b7c0cf] hover:text-white px-4 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.025] hover:bg-white/[0.07]' : 'text-[#575752] hover:text-[#1c1c1a] px-4 py-1.5 rounded-lg border border-[#e4e4df] bg-white hover:bg-slate-50'} transition-[color,background-color,border-color] duration-150 font-medium`}
              >
                Sign in
              </a>
              <a
                href={startHref}
                data-track="nav_get_started"
                className={`inline-flex items-center gap-1.5 text-sm font-semibold ${isDark ? 'bg-[#2563eb] text-white hover:bg-[#3b82f6] active:bg-[#1d4ed8]' : 'text-white bg-brand hover:bg-[#1a7acc] active:bg-[#1668a8]'} px-4 py-1.5 rounded-lg transition-colors duration-150 whitespace-nowrap`}
              >
                {isDark ? 'Start a diagram' : START_CTA_LABEL}
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </>
          )}
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`md:hidden p-2.5 ${isDark ? 'text-[#aeb9c7] hover:text-white' : 'text-[#575752] hover:text-[#1c1c1a]'} transition-colors`}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size="20" /> : <Menu size="20" />}
        </button>
      </div>

      {menuOpen && (
        <div className={`md:hidden ${isDark ? 'bg-black border-white/[0.09]' : 'bg-white border-[#e4e4df]'} border-b animate-in fade-in slide-in-from-top-4 duration-150`}>
          <div className="px-6 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`text-sm ${isDark ? 'text-[#aeb9c7] hover:text-white' : 'text-[#575752] hover:text-[#1c1c1a]'} py-3 transition-colors font-medium`}
              >
                {link.label}
              </a>
            ))}
            <hr className={`${isDark ? 'border-white/[0.09]' : 'border-[#e4e4df]'} my-2`} />
            {isAuthenticated ? (
              <a
                href="/dashboard"
                data-track="nav_dashboard"
                onClick={() => setMenuOpen(false)}
                className={`text-sm font-semibold text-center ${isDark ? 'bg-[#2563eb] text-white hover:bg-[#3b82f6]' : 'text-white bg-brand hover:bg-brand-hover'} px-4 py-3 rounded-lg transition-colors`}
              >
                Dashboard
              </a>
            ) : (
              <>
                <a
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className={`text-sm ${isDark ? 'text-[#aeb9c7] hover:text-white' : 'text-[#575752] hover:text-[#1c1c1a]'} py-3 transition-colors font-medium`}
                >
                  Sign in
                </a>
                <a
                  href={startHref}
                  onClick={() => setMenuOpen(false)}
                  className={`text-sm font-semibold text-center ${isDark ? 'bg-[#2563eb] text-white hover:bg-[#3b82f6]' : 'text-white bg-brand hover:bg-brand-hover'} px-4 py-3 rounded-lg transition-colors`}
                >
                  {isDark ? 'Start a diagram' : START_CTA_LABEL}
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </motion.header>
  );
}
