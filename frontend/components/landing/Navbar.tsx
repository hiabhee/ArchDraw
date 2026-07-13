'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { AuthModal } from '@/components/AuthModal';

const NAV_LINKS = ['Features', 'Templates', 'Tutorials', 'Use Cases'];

export function Navbar() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    const handler = () => setAuthModalOpen(true);
    window.addEventListener('open-auth-modal', handler);
    return () => window.removeEventListener('open-auth-modal', handler);
  }, []);

  return (
    <>
      <header
        className="fixed top-0 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[1200px] mx-auto rounded-2xl bg-card shadow-soft-2"
        style={{ 
          padding: '18px 24px',
          marginTop: '16px'
        }}
      >
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image src="/image.png" alt="ArchDraw Logo" width={28} height={28} className="transition-transform group-hover:scale-105" />
            <span className="text-lg font-semibold text-foreground tracking-tight">ArchDraw</span>
          </Link>

          <nav className="hidden md:flex gap-8">
            {NAV_LINKS.map((item) => (
              <Link
                key={item}
                href={item === 'Tutorials' ? '/tutorials' : item === 'Blog' ? '/blog' : `#${item.toLowerCase().replace(' ', '-')}`}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {item}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-all"
            >
              Sign in
            </button>
            <button
              onClick={() => router.push('/editor')}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all shadow-soft-2"
            >
              Start designing
            </button>
          </div>

          <button
            className="md:hidden text-muted-foreground hover:text-foreground p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-border rounded-b-2xl mt-3 pt-2">
            <div className="px-2 pt-2 pb-6 space-y-1">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item}
                  href={item === 'Tutorials' ? '/tutorials' : item === 'Blog' ? '/blog' : `#${item.toLowerCase().replace(' ', '-')}`}
                  className="block px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl"
                  onClick={() => setMobileOpen(false)}
                >
                  {item}
                </Link>
              ))}

              <div className="pt-4 flex flex-col gap-3">
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    setAuthModalOpen(true);
                  }}
                  className="w-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-all"
                >
                  Sign in
                </button>
                <button
                  onClick={() => router.push('/editor')}
                  className="w-full px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all shadow-soft-2"
                >
                  Start designing
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </>
  );
}
