'use client';

import { useCallback, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Check, Clipboard } from 'lucide-react';
import Link from 'next/link';
import styles from './RevampedLanding.module.css';

const INSTALL_COMMAND = 'npx skills add hiabhee/archdraw-skill --skill archdraw-diagram';
const COPY_SPARKS = [
  [-28, -13], [-8, -24], [18, -20], [31, 1], [19, 20], [-7, 25], [-30, 10], [2, 4],
] as const;

export function LandingInstall() {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [particleBurst, setParticleBurst] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const trackPointer = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    const card = cardRef.current;
    if (!card) return;
    const bounds = card.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    card.style.setProperty('--tilt-x', `${(0.5 - y) * 5}deg`);
    card.style.setProperty('--tilt-y', `${(x - 0.5) * 7}deg`);
    card.style.setProperty('--shine-x', `${x * 100}%`);
    card.style.setProperty('--shine-y', `${y * 100}%`);
    card.style.setProperty('--card-lift', '-3px');
  }, []);

  const resetPointer = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
    card.style.setProperty('--card-lift', '0px');
  }, []);

  async function copySetup() {
    setParticleBurst((burst) => burst + 1);
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
    <div
      ref={cardRef}
      className={styles.installCard}
      data-cursor-shine-exclude
      onPointerMove={trackPointer}
      onPointerLeave={resetPointer}
      onPointerCancel={resetPointer}
    >
      <div className={styles.installCode}>
        <div className={styles.codeLanguage}><code>Terminal</code></div>
        <pre><code>{INSTALL_COMMAND}</code></pre>
        <button type="button" className={styles.copyButton} onClick={copySetup} aria-label={copied ? 'Command copied' : 'Copy command'}>
          {particleBurst > 0 && (
            <span key={particleBurst} className={styles.copyParticles} aria-hidden="true">
              {COPY_SPARKS.map(([x, y], index) => (
                <i
                  key={index}
                  style={{ '--spark-x': `${x}px`, '--spark-y': `${y}px` } as CSSProperties}
                />
              ))}
            </span>
          )}
          {copied ? <Check size={15} /> : <Clipboard size={15} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <p className={styles.installNote} role={copyFailed ? 'alert' : undefined}>
        {copyFailed ? 'Could not copy. Select the command above and copy it.' : <>Install the skill from your project root, then <Link href="/agent-skill" className="underline underline-offset-2 hover:text-white">connect the MCP server</Link>.</>}
      </p>
    </div>
  );
}
