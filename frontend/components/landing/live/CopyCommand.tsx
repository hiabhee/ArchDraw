'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import styles from './LiveLanding.module.css';

export const START_COMMAND = 'npx archdraw-live';

/** The one command, as a copy button. Tracked so the landing funnel can count copies. */
export function CopyCommand({ size = 'md', track }: { size?: 'md' | 'lg'; track: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(START_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard can be blocked; the command stays selectable */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      data-track={track}
      data-size={size}
      className={styles.command}
      aria-label={copied ? 'Copied' : `Copy ${START_COMMAND}`}
    >
      <span className={styles.prompt} aria-hidden="true">$</span>
      <code>{START_COMMAND}</code>
      <span className={styles.copyIcon} aria-hidden="true">
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </span>
      <span className={styles.copyHint} aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
