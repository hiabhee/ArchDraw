'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  useBodyScrollLock(open);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}/auth/callback`,
      });
      if (error) {
        setError(error.message ?? 'Sign-in failed');
        setLoading(false);
      }
    } catch {
      setError('Sign-in failed');
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0, 0, 0, 0.3)' }}
        onClick={() => onOpenChange(false)}
      />
      <div
        className="relative w-full max-w-sm p-6 sm:p-8"
        style={{
          background: 'white',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)'
        }}
      >
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
          style={{ color: '#6B6B6B' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-1 pr-8">Sign in to ArchDraw</h2>
        <p className="text-sm mb-6 sm:mb-8" style={{ color: '#6B6B6B' }}>
          Export diagrams and sync across devices
        </p>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full min-h-[48px] py-3.5 px-4 text-sm font-medium rounded-[14px] transition-all hover:bg-gray-50 flex items-center justify-center gap-3 disabled:opacity-50"
          style={{ background: '#F8F8F8', color: '#1A1A1A' }}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>

        {error && (
          <p className="text-xs text-center mt-4" style={{ color: '#E5484D' }}>{error}</p>
        )}
      </div>
    </div>
  );
}
