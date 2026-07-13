'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';

export type EmailCaptureReason = 'share' | 'download';

interface Props {
  reason: EmailCaptureReason;
  onClose: () => void;
}

const COPY = {
  share:    { title: 'Share your diagram',  body: 'Sign in to generate a shareable link.' },
  download: { title: 'Save your work',      body: 'Sign in to download and sync your diagrams.' },
};

function saveGuestState(reason: EmailCaptureReason) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('pendingAction', reason);
}

export function EmailCaptureModal({ reason, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const copy = COPY[reason];

  const handleDismiss = () => {
    onClose();
  };

  const handleGoogle = async () => {
    saveGuestState(reason);
    setLoading(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}/auth/callback`,
      });
      if (error) { toast.error(error.message); setLoading(false); }
    } catch { toast.error('Something went wrong'); setLoading(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={handleDismiss} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl bg-card"
          style={{ boxShadow: '0 24px 48px hsl(var(--foreground) / 0.15)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{copy.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{copy.body}</p>
            </div>
            <button onClick={handleDismiss} className="p-2 rounded-xl hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 pb-5 space-y-3">
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-accent/50 hover:bg-accent rounded-xl transition-all text-sm font-medium text-foreground disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {loading ? 'Signing in…' : 'Continue with Google'}
            </button>

            <p className="text-center">
              <button type="button" onClick={handleDismiss} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Maybe later
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
