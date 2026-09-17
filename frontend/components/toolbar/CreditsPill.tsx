'use client';

import { useEffect, useState } from 'react';
import { Coins, Loader2 } from 'lucide-react';
import { CREDIT_POLICY } from '@/lib/creditPolicy';

type CreditState = { balance: number; allowance: number; costs: Record<string, number> };

export function CreditsPill() {
  const [credits, setCredits] = useState<CreditState | null>(null);

  const refresh = () => {
    fetch('/api/credits', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data && setCredits(data))
      .catch(() => undefined);
  };

  useEffect(() => {
    refresh();
    window.addEventListener('archdraw:credits-updated', refresh);
    return () => window.removeEventListener('archdraw:credits-updated', refresh);
  }, []);

  if (!credits) {
    return <span className="inline-flex h-8 w-16 items-center justify-center rounded-full border border-border/60 bg-background/70"><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /></span>;
  }

  return (
    <div className="group relative">
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 text-xs font-medium text-foreground shadow-sm" title={`${credits.balance} of ${credits.allowance} credits remaining`}>
        <Coins className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
        <span>{credits.balance}</span>
        <span className="hidden md:inline text-muted-foreground">credits</span>
      </span>
      <div className="pointer-events-none absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-border bg-popover p-3 text-[11px] text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <p className="font-medium">Generation cost</p>
        <p className="mt-1 text-muted-foreground">L1 {CREDIT_POLICY.costs[1]} · L2 {CREDIT_POLICY.costs[2]} · L3 {CREDIT_POLICY.costs[3]}</p>
      </div>
    </div>
  );
}
