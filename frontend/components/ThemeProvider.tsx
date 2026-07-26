'use client';

import { useEffect } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from 'next-themes';
import { useDiagramStore } from '@/store/diagramStore';
import { registerThemeSetter } from '@/lib/themeBridge';

function ThemeSync() {
  const { resolvedTheme, setTheme } = useNextTheme();

  // Mirror next-themes -> store.darkMode (store flag is a read-only view).
  useEffect(() => {
    if (resolvedTheme) {
      const isDark = resolvedTheme === 'dark';
      if (useDiagramStore.getState().darkMode !== isDark) {
        useDiagramStore.setState({ darkMode: isDark });
      }
    }
  }, [resolvedTheme]);

  // Register the next-themes setter so non-React code (toggleDarkMode in the
  // Zustand store) can change the theme without bypassing next-themes and
  // desyncing. Cleared on unmount.
  useEffect(() => {
    registerThemeSetter((t) => setTheme(t));
    return () => registerThemeSetter(null);
  }, [setTheme]);

  return null;
}

export function ThemeProvider({ 
  children, 
  ...props 
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <ThemeSync />
      {children}
    </NextThemesProvider>
  );
}
