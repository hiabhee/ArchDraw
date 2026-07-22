'use client';

import { useAuthStore } from '@/store/authStore';
import { getUserTier, getGuestQuotas } from '@/lib/userQuotas';
import { Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SignInButtons } from '@/components/SignInButtons';

interface QuotaData {
  aiGenerations: {
    used: number;
    limit: number;
    window: string;
  };
}

export function QuotaIndicator() {
  const { user } = useAuthStore();
  const tier = getUserTier(user?.id);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !!sessionStorage.getItem('quota-indicator-dismissed');
  });

  useEffect(() => {
    if (tier !== 'guest' || dismissed) return;

    fetch('/api/user/quota')
      .then(res => res.json())
      .then((data: QuotaData) => {
        setRemaining(data.aiGenerations.limit - data.aiGenerations.used);
      })
      .catch(() => setRemaining(null));
  }, [tier]);

  if (tier !== 'guest' || dismissed) return null;

  const quotas = getGuestQuotas();

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('quota-indicator-dismissed', 'true');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed bottom-4 right-4 z-40 w-full max-w-[280px] px-2 safe-area-bottom"
      >
        <div className="bg-card border border-border/40 rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] overflow-hidden backdrop-blur-sm">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-br from-[#1E90FF]/10 to-transparent border-b border-border/10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#1E90FF] to-[#4dabf7] flex items-center justify-center shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[12px] font-semibold text-foreground">Guest Mode</span>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-3 space-y-2">
            {remaining !== null && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">AI Generations</span>
                <span className="text-[13px] font-semibold text-foreground">
                  {remaining}/{quotas.aiGenerationsPerHour}
                  <span className="text-[11px] text-muted-foreground font-normal ml-1">this hour</span>
                </span>
              </div>
            )}
            
            <p className="text-[11px] text-muted-foreground/90 leading-relaxed">
              Sign in to get <strong className="text-foreground font-semibold">10 generations/day</strong> + saved canvases
            </p>
          </div>

          {/* CTA */}
          <div className="px-3 pb-3">
            <SignInButtons compact />
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-md hover:bg-secondary/50 text-muted-foreground/50 hover:text-muted-foreground transition-all duration-150"
            aria-label="Dismiss"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
