'use client';

import { useEffect } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { useDiagramStore } from '@/store/diagramStore';
import { registerThemeSetter } from '@/lib/theme/themeBridge';

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

/** Toasts in the app theme (dark unless the visitor chose light). */
export function ThemedToaster() {
  const { resolvedTheme } = useNextTheme();
  return <Toaster position="bottom-right" theme={resolvedTheme === 'light' ? 'light' : 'dark'} richColors />;
}
