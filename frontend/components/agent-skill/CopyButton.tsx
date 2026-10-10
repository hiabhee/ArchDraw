'use client';

import { useState } from 'react';
import { Check, Clipboard } from 'lucide-react';

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      setFailed(true);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied to clipboard' : 'Copy code'}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface-page px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition hover:bg-surface-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {copied ? <Check size={13} aria-hidden="true" /> : <Clipboard size={13} aria-hidden="true" />}
      <span>{failed ? 'Select to copy' : copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
