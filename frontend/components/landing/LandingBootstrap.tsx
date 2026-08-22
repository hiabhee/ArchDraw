'use client';

import { useEffect } from 'react';

export function LandingBootstrap() {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    try { localStorage.setItem('archdraw-theme', 'light'); } catch { /* localStorage may throw in private browsing */ }

    try {
      const hasVisited = localStorage.getItem('archdraw-visited');
      const fromSameOrigin = document.referrer.startsWith(window.location.origin);

      if (hasVisited && !fromSameOrigin) {
        window.location.replace('/editor');
        return;
      }

      localStorage.setItem('archdraw-visited', 'true');
    } catch { /* localStorage may throw in private browsing */ }
  }, []);

  return null;
}
