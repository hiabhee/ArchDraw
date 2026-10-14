'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './LiveLanding.module.css';

interface Wire { d: string; label: { x: number; y: number }; end: { x: number; y: number } }

/**
 * An orthogonal canvas edge from the selected headline's right handle to the
 * command button, measured from the DOM so it follows the real layout. Drawn
 * only when the two sit side by side.
 */
export function HeadlineWire() {
  const ref = useRef<SVGSVGElement>(null);
  const [wire, setWire] = useState<Wire | null>(null);

  useEffect(() => {
    const svg = ref.current;
    const host = svg?.parentElement;
    if (!svg || !host) return;
    const measure = () => {
      const from = host.querySelector('[data-wire-from]');
      const to = host.querySelector('[data-wire-to]');
      if (!from || !to) return setWire(null);
      const box = host.getBoundingClientRect();
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const fx = a.right - box.left + 10;
      const fy = a.top + a.height / 2 - box.top;
      const tx = b.left - box.left - 4;
      const ty = b.top + b.height / 2 - box.top;
      if (tx - fx < 40) return setWire(null);
      const mx = Math.round(fx + (tx - fx) / 2);
      const r = Math.min(10, Math.abs(ty - fy) / 2);
      const dir = ty < fy ? -1 : 1;
      setWire({
        d: `M${fx},${fy} H${mx - r} Q${mx},${fy} ${mx},${fy + dir * r} V${ty - dir * r} Q${mx},${ty} ${mx + r},${ty} H${tx}`,
        label: { x: mx, y: (fy + ty) / 2 },
        end: { x: tx, y: ty },
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, []);

  return (
    <svg ref={ref} className={styles.wire} aria-hidden="true">
      {wire && (
        <>
          <path d={wire.d} className={styles.wirePath} />
          <path d={`M${wire.end.x - 8},${wire.end.y - 4.5} L${wire.end.x},${wire.end.y} L${wire.end.x - 8},${wire.end.y + 4.5} Z`} className={styles.wireHead} />
          <g transform={`translate(${wire.label.x},${wire.label.y})`}>
            <rect x={-36} y={-10} width={72} height={20} rx={10} className={styles.wirePill} />
            <text y={4} textAnchor="middle" className={styles.wireLabel}>find out</text>
          </g>
        </>
      )}
    </svg>
  );
}
