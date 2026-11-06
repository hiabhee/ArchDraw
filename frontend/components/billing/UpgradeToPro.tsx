'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface BillingStatus {
  plan: 'free' | 'pro';
  billingEnabled: boolean;
  maxProjects: number;
  portalUrl: string | null;
}

/**
 * The Pro upsell. Renders nothing until billing is configured on the server, so
 * shipping this before the Lemon Squeezy keys exist changes nothing for visitors.
 */
export function UpgradeToPro() {
  const router = useRouter();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/billing/status', { credentials: 'same-origin' })
      .then((r) => (r.ok ? (r.json() as Promise<BillingStatus>) : null))
      .then((s) => alive && setStatus(s))
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  if (!status?.billingEnabled) return null;

  const upgrade = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST', credentials: 'same-origin' });
      if (res.status === 401) { router.push('/login'); return; }
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error || 'Could not start checkout.');
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout.');
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 bg-surface-card border border-border-default rounded-2xl p-6">
      <div className="text-xs font-bold uppercase tracking-wider text-brand-text">Pro</div>
      <p className="mt-2 text-sm text-text-secondary">More live projects: keep every repository on its own map.</p>
      {status.plan === 'pro' ? (
        <p className="mt-4 text-sm text-text-primary">
          You are on Pro ({status.maxProjects} live projects).{' '}
          {status.portalUrl ? <a className="text-brand-text underline" href={status.portalUrl}>Manage billing</a> : null}
        </p>
      ) : (
        <button type="button" onClick={upgrade} disabled={busy} className="mt-4 w-full text-sm font-semibold text-white bg-brand hover:bg-brand-hover disabled:opacity-60 px-6 py-3 rounded-lg transition-colors">
          {busy ? 'Opening checkout…' : 'Upgrade to Pro'}
        </button>
      )}
      {error ? <p role="alert" className="mt-3 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
