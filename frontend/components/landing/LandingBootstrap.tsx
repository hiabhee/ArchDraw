'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

export function LandingBootstrap() {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme('light');
    document.documentElement.classList.remove('dark');
    try { localStorage.setItem('archdraw-theme', 'light'); } catch { /* localStorage may throw in private browsing */ }

    try {
      localStorage.setItem('archdraw-visited', 'true');
    } catch { /* localStorage may throw in private browsing */ }
  }, [setTheme]);

  return null;
}
