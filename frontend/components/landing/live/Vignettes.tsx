import styles from './Vignettes.module.css';

/** Small looping illustrations for the feature grid. CSS-only, no JS. */

function Star({ x, y, color, hollow, className }: { x: number; y: number; color: string; hollow?: boolean; className?: string }) {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? 8 : 3.6;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    pts.push(`${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`);
  }
  return <polygon points={pts.join(' ')} fill={hollow ? 'none' : color} stroke={color} strokeWidth={1.5} strokeLinejoin="round" className={className} />;
}

export function NeedsYouVignette() {
  return (
    <div className={styles.queue} aria-hidden="true">
      <div className={styles.queueRow} data-kind="waiting">
        <i /><b>Otter</b><span>needs permission</span><time>4:12</time>
      </div>
      <div className={styles.queueRow} data-kind="waiting" style={{ animationDelay: '.15s' }}>
        <i /><b>Gecko</b><span>needs permission</span><time>0:38</time>
      </div>
      <div className={styles.queueRow} data-kind="done">
        <i /><b>Fox</b><span>finished · your turn</span><time>1:05</time>
      </div>
      <div className={styles.tabTitle}><span className={styles.dotAmber} /> Otter needs you</div>
    </div>
  );
}

export function ConstructionVignette() {
  return (
    <svg viewBox="0 0 320 150" className={styles.svg} aria-hidden="true">
      <rect x="16" y="45" width="110" height="46" rx="9" className={styles.box} />
      <text x="71" y="73" textAnchor="middle" className={styles.boxText}>Payments</text>
      <path d="M126 68 H186" className={styles.wire} />
      <g className={styles.plotPhase}>
        <rect x="186" y="45" width="118" height="46" rx="9" className={styles.plot} />
        <text x="245" y="64" textAnchor="middle" className={styles.plotTitle}>NOT ON THE MAP YET</text>
        <text x="245" y="80" textAnchor="middle" className={styles.plotPath}>workers/refunds/</text>
      </g>
      <g className={styles.mappedPhase}>
        <rect x="186" y="45" width="118" height="46" rx="9" className={styles.boxNew} />
        <text x="245" y="73" textAnchor="middle" className={styles.boxText}>Refund worker</text>
        <rect x="270" y="36" width="34" height="15" rx="7.5" className={styles.newBadge} />
        <text x="287" y="47" textAnchor="middle" className={styles.newBadgeText}>New</text>
      </g>
      <Star x={245} y={112} color="#ffb057" className={styles.workingStar} />
    </svg>
  );
}

export function LevelsVignette() {
  return (
    <svg viewBox="0 0 320 150" className={styles.svg} aria-hidden="true">
      <g className={styles.overviewPhase}>
        <rect x="40" y="48" width="104" height="46" rx="9" className={styles.box} />
        <text x="92" y="76" textAnchor="middle" className={styles.boxText}>Orders</text>
        <path d="M144 71 H176" className={styles.wire} />
        <rect x="176" y="48" width="104" height="46" rx="9" className={styles.box} />
        <text x="228" y="76" textAnchor="middle" className={styles.boxText}>Payments</text>
      </g>
      <g className={styles.detailPhase}>
        <rect x="14" y="18" width="142" height="116" rx="12" className={styles.group} />
        <text x="26" y="36" className={styles.groupText}>ORDERS</text>
        <rect x="26" y="46" width="118" height="24" rx="6" className={styles.part} />
        <text x="36" y="62" className={styles.partText}>cart.ts</text>
        <rect x="26" y="76" width="118" height="24" rx="6" className={styles.part} />
        <text x="36" y="92" className={styles.partText}>checkout/</text>
        <rect x="26" y="106" width="118" height="20" rx="6" className={styles.part} />
        <text x="36" y="120" className={styles.partText}>order-events.ts</text>
        <rect x="166" y="18" width="142" height="116" rx="12" className={styles.group} />
        <text x="178" y="36" className={styles.groupText}>PAYMENTS</text>
        <rect x="178" y="46" width="118" height="24" rx="6" className={styles.part} />
        <text x="188" y="62" className={styles.partText}>charge.ts</text>
        <rect x="178" y="76" width="118" height="24" rx="6" className={styles.partActive} />
        <text x="188" y="92" className={styles.partText}>refunds.ts</text>
        <Star x={286} y={88} color="#7cb4ff" />
      </g>
    </svg>
  );
}

export function AimVignette() {
  return (
    <svg viewBox="10 22 304 122" className={styles.svg} aria-hidden="true">
      <rect x="196" y="30" width="110" height="46" rx="9" className={styles.box} />
      <text x="251" y="58" textAnchor="middle" className={styles.boxText}>Search</text>
      <path d="M60 104 L251 76" className={styles.aimLine} />
      <Star x={60} y={104} color="#62dcf0" hollow />
      <g transform="translate(16 118)">
        <rect width="100" height="19" rx="9.5" className={styles.tag} />
        <text x="9" y="13" className={styles.tagText}>Heron · <tspan fill="#62dcf0">→ Search?</tspan></text>
      </g>
      <g transform="translate(148 112)">
        <rect width="160" height="26" rx="7" className={styles.prompt} />
        <text x="10" y="17" className={styles.promptText}>› fix the search ranking</text>
      </g>
    </svg>
  );
}

export function WatchLinkVignette() {
  return (
    <div className={styles.link} aria-hidden="true">
      <div className={styles.urlBar}>
        <span className={styles.lock} />
        archdraw.hiabhee.online/live/<b>7ca1…e2f9</b>
      </div>
      <ul className={styles.linkFacts}>
        <li>Read-only</li>
        <li>No sign-in to watch</li>
        <li>File paths hidden</li>
      </ul>
    </div>
  );
}

export function CoverageVignette() {
  return (
    <div className={styles.coverage} aria-hidden="true">
      <div className={styles.coverageHead}><span>map covers</span><b className={styles.coverageNum} /></div>
      <div className={styles.meter}><span /></div>
      <p className={styles.coverageNote}>
        <span className={styles.dotAmber} /> 3 edited files aren&apos;t on the map
      </p>
    </div>
  );
}
