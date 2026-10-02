'use client';

import { useState } from 'react';
import { Check, Clipboard } from 'lucide-react';
import styles from './RevampedLanding.module.css';

const INSTALL_COMMAND = 'npx archdraw-agent setup';

export function LandingInstall() {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copySetup() {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  return (
    <div className={styles.installCard}>
      <div className={styles.installCode}>
        <div className={styles.codeLanguage}><code>Terminal</code></div>
        <pre><code>{INSTALL_COMMAND}</code></pre>
        <button type="button" className={styles.copyButton} onClick={copySetup} aria-label={copied ? 'Command copied' : 'Copy command'}>
          {copied ? <Check size={15} /> : <Clipboard size={15} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <p className={styles.installNote} role={copyFailed ? 'alert' : undefined}>
        {copyFailed ? 'Could not copy. Select the command above and copy it.' : 'Run this in your coding agent.'}
      </p>
    </div>
  );
}
