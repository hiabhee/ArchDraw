'use client';

import { useEffect } from 'react';

export function LandingBootstrap() {
  useEffect(() => {
    try {
      localStorage.setItem('archdraw-visited', 'true');
    } catch { /* localStorage may throw in private browsing */ }
  }, []);

  return null;
}
