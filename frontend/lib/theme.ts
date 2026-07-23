'use client';

import { useTheme as useNextTheme } from 'next-themes';
import { useDiagramStore } from '@/store/diagramStore';

export type Theme = 'dark' | 'light';

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  const darkMode = useDiagramStore((s) => s.darkMode);
  const isDark = resolvedTheme === 'dark';

  return {
    theme: (resolvedTheme || 'dark') as Theme,
    isDark,
    darkMode,
    setTheme,
  };
}

export function useCanvasTheme() {
  const darkMode = useDiagramStore((s) => s.darkMode);

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
