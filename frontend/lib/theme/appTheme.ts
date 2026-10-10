'use client';

import { useTheme as useNextTheme } from 'next-themes';
import { useDiagramStore } from '@/store/diagramStore';
import { useCanvasHost } from '@/lib/diagram/canvas/CanvasHostContext';

export type Theme = 'dark' | 'light';

/** App (chrome) theme — next-themes is the source of truth. */
export function useTheme() {
  const { setTheme, resolvedTheme } = useNextTheme();
  const isDark = resolvedTheme === 'dark';

  return {
    theme: (resolvedTheme || 'dark') as Theme,
    isDark,
    setTheme,
  };
}

/**
 * Canvas theme. A host (embed/share) may pin it; otherwise it follows the app
 * theme via `store.darkMode`, which ThemeProvider mirrors from next-themes.
 */
export function useCanvasTheme() {
  const hostIsDark = useCanvasHost().isDark;
  const storeDarkMode = useDiagramStore((s) => s.darkMode);
  const darkMode = hostIsDark ?? storeDarkMode;

  return {
    isDark: darkMode,
    resolvedTheme: (darkMode ? 'dark' : 'light') as Theme,
  };
}

export const THEME_TOKENS = {
  dark: {
    canvasBg: 'hsl(var(--canvas-bg))',
    gridColor: 'hsl(var(--grid-color))',
    textColor: 'hsl(var(--foreground))',
    cardBg: 'hsl(var(--card))',
    cardBorder: '1px solid hsl(var(--border) / 0.3)',
    cardShadow: '0 1px 4px rgba(0,0,0,0.3)',
  },
  light: {
    canvasBg: 'hsl(var(--canvas-bg))',
    gridColor: 'hsl(var(--grid-color))',
    textColor: 'hsl(var(--foreground))',
    cardBg: 'hsl(var(--card))',
    cardBorder: '1px solid hsl(var(--border) / 0.3)',
    cardShadow: '0 1px 4px rgba(0,0,0,0.1)',
  },
} as const;
