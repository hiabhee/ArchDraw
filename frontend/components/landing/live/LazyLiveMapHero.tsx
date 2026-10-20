'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { HeroGraphs } from './heroGraph';
import styles from './LiveMapHero.module.css';

/**
 * The hero map sits below the first screen and is most of the landing's
 * JavaScript (React Flow, the canvas, the agent atlas). Load it when it comes
 * into view or the visitor first scrolls or moves, so the headline and the
 * command paint first; the placeholder has the map's exact frame so nothing
 * shifts when it arrives.
 */
const LiveMapHero = dynamic(() => import('./LiveMapHero').then((m) => m.LiveMapHero), {
  ssr: false,
  loading: () => <MapFrame />,
});

function MapFrame() {
  return (
    <div className={`dark ${styles.frame}`} aria-hidden="true">
      <div className={styles.header} />
      <div className={styles.scroll}>
        <div className={styles.canvas} />
      </div>
    </div>
  );
}

export function LazyLiveMapHero({ graphs }: { graphs: HeroGraphs }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    // Visible, or the visitor starts scrolling or moving: either way it is
    // wanted soon, and the first paint never waits for it.
    const load = () => setNear(true);
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) load();
    }, { rootMargin: '200px 0px' });
    observer.observe(el);
    const events = ['scroll', 'pointermove', 'touchstart', 'keydown'] as const;
    for (const type of events) window.addEventListener(type, load, { once: true, passive: true });
    return () => {
      observer.disconnect();
      for (const type of events) window.removeEventListener(type, load);
    };
  }, [near]);
  return <div ref={ref}>{near ? <LiveMapHero graphs={graphs} /> : <MapFrame />}</div>;
}
