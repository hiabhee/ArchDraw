'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { BrandMark } from '@/components/ui/BrandMark';

/** The site nav: night palette (the landing's), built only from the shared tokens. */
const NAV_LINKS = [
  { label: 'Templates', href: '/templates', track: 'nav_templates' },
  { label: 'Tutorials', href: '/tutorials', track: 'nav_tutorials' },
  { label: 'How it works', href: '/#how', track: 'nav_how_it_works' },
  { label: 'Privacy', href: '/#privacy', track: 'nav_privacy' },
  { label: 'Pricing', href: '/pricing', track: 'nav_pricing' },
  { label: 'Docs', href: '/docs', track: 'nav_docs' },
];

export function LandingNav({ outfitClassName }: { outfitClassName?: string }) {
  const { user, initialized } = useAuthStore();
  const isAuthenticated = initialized && Boolean(user && user.id !== 'guest');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: 0, opacity: 1 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 h-14 transition-[background-color,border-color,backdrop-filter] duration-200 border-b ${
        scrolled
          ? 'bg-surface-page/90 backdrop-blur-xl border-text-primary/10'
          : 'bg-transparent border-transparent'
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <BrandMark size={28} className="shadow-[0_0_18px_color-mix(in_oklab,var(--text-primary)_25%,transparent)] flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105" />
            <span className={`text-sm font-bold text-text-primary tracking-tight ${outfitClassName ?? ''}`}>
              ArchDraw
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                data-track={link.track}
                className={`px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary rounded-md transition-colors duration-150 font-medium`}
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
              className={`inline-flex items-center gap-1.5 text-sm font-semibold bg-text-primary text-surface-page hover:bg-white active:bg-text-secondary px-4 py-1.5 rounded-lg transition-colors duration-150 whitespace-nowrap`}
            >
              Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          ) : (
            <>
              <a
                href="/dashboard"
                data-track="nav_sign_in"
                className={`text-sm text-text-secondary hover:text-text-primary px-4 py-1.5 rounded-lg border border-text-primary/[0.12] bg-text-primary/[0.03] hover:bg-text-primary/[0.07] transition-[color,background-color,border-color] duration-150 font-medium`}
              >
                Sign in
              </a>
            </>
          )}
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2.5 text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size="20" /> : <Menu size="20" />}
        </button>
      </div>

      {menuOpen && (
        <div className={`md:hidden bg-surface-page border-text-primary/[0.09] border-b animate-in fade-in slide-in-from-top-4 duration-150`}>
          <div className="px-6 py-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`text-sm text-text-secondary hover:text-text-primary py-3 transition-colors font-medium`}
              >
                {link.label}
              </a>
            ))}
            <hr className="border-text-primary/[0.09] my-2" />
            {isAuthenticated ? (
              <a
                href="/dashboard"
                data-track="nav_dashboard"
                onClick={() => setMenuOpen(false)}
                className={`text-sm font-semibold text-center bg-text-primary text-surface-page hover:bg-white px-4 py-3 rounded-lg transition-colors`}
              >
                Dashboard
              </a>
            ) : (
              <>
                <a
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className={`text-sm text-text-secondary hover:text-text-primary py-3 transition-colors font-medium`}
                >
                  Sign in
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </motion.header>
  );
}
