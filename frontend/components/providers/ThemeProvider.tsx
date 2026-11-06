'use client';

import { useEffect } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { publishAppTheme, registerThemeSetter } from '@/lib/theme/themeBridge';

function ThemeSync() {
  const { resolvedTheme, setTheme } = useNextTheme();

  // Publish next-themes' theme; the diagram store mirrors it into
  // store.darkMode (a read-only view) when it is loaded.
  useEffect(() => {
    if (resolvedTheme) publishAppTheme(resolvedTheme === 'dark');
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
