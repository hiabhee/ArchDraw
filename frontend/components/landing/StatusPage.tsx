import type { ReactNode } from 'react';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import styles from './StatusPage.module.css';

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });
const body = Geist({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

/** A five-point star centred on (cx, cy), like the agent stars on the map. */
function starPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? r : r * 0.42;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

/** Two components on the map and a wire running off it into a dashed plot. */
function OffTheMap({ mark }: { mark: string }) {
  return (
    <svg className={styles.chart} viewBox="0 0 420 150" role="img" aria-hidden="true">
      <rect className={styles.node} x="1" y="56" width="104" height="38" rx="8" />
      <text className={styles.nodeLabel} x="53" y="79" textAnchor="middle">web app</text>
      <path className={styles.edge} d="M105 75 H150" />
      <rect className={styles.node} x="150" y="56" width="96" height="38" rx="8" />
      <text className={styles.nodeLabel} x="198" y="79" textAnchor="middle">api</text>
      <path className={styles.wire} d="M246 75 H306" />
      <rect className={styles.plot} x="306" y="22" width="112" height="106" rx="10" />
      <text className={styles.plotLabel} x="362" y="87" textAnchor="middle">{mark}</text>
      <line className={styles.pole} x1="280" y1="66" x2="280" y2="40" />
      <polygon className={styles.pennant} points="280,40 293,45 280,50" />
      <polygon className={styles.star} points={starPoints(280, 75, 9)} />
    </svg>
  );
}

export function StatusPage({ code, kicker, title, lead, actions, footnote }: {
  /** Drawn in the dashed plot ("404", "!"). */
  code: string;
  kicker: string;
  title: ReactNode;
  lead: string;
  actions: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <div className={`${styles.page} ${display.variable} ${body.variable} ${mono.variable}`}>
      <div className={styles.sky} aria-hidden="true" />
      <LandingNav />
      <main className={styles.main}>
        <div className={styles.inner}>
          <OffTheMap mark={code} />
          <p className={styles.kicker}><span className={styles.dot} aria-hidden="true" />{kicker}</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          <div className={styles.actions}>{actions}</div>
          {footnote}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export const statusStyles = { primary: styles.primary, secondary: styles.secondary, ref: styles.ref };
