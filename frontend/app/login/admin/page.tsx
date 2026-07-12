'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';

export default function AdminLoginPage() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        const data = await res.json();
        setError(data.error || 'Too many attempts');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError('Invalid passcode');
        setLoading(false);
        return;
      }

      router.replace('/admin');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Connection failed: ${msg}`);
      setLoading(false);
    }
  }, [passcode, router]);

  return (
    <div className="min-h-screen bg-[#010102] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <Shield className="w-7 h-7 text-[#1E90FF]" />
          <span className="text-xl font-semibold text-[#f7f8f8]">Admin Access</span>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Enter passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 bg-[#111113] border border-[#18191a] rounded-xl text-[#f7f8f8] placeholder-[#8a8f98] text-sm tracking-widest focus:outline-none focus:border-[#1E90FF] transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-[#f85149] text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !passcode}
            className="w-full py-3 bg-[#1E90FF] text-white text-sm font-medium rounded-xl hover:bg-[#1a7de0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verifying
              </span>
            ) : (
              'Verify'
            )}
          </button>
        </form>

        <p className="text-[10px] text-[#8a8f98] text-center mt-6">
          Contact your team lead if you need access.
        </p>
      </div>
    </div>
  );
}
