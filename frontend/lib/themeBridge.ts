/**
 * Theme bridge — the one legitimate non-React -> React-context seam.
 *
 * Why: `next-themes` only exposes `setTheme` as a React hook. The Zustand
 * diagram store is plain TS and cannot call that hook, so historically the
 * store wrote `localStorage['archdraw-theme']` and toggled the `.dark` class
 * directly (diagramStore.ts ~1480). That bypassed next-themes' internal React
 * state, so ThemeProvider's `resolvedTheme` and the persisted value desynced.
 *
 * This module holds a single registered `setTheme` callback that
 * ThemeProvider installs on mount (from the `next-themes` hook it owns). The
 * store's `toggleDarkMode` calls through here instead of poking localStorage
 * directly. If no provider is mounted (e.g. the bare embed viewer) the call
 * falls back to a safe direct write so the canvas still renders correctly.
 */

type ThemeSetter = (theme: 'dark' | 'light') => void;

let registeredSetter: ThemeSetter | null = null;

export function registerThemeSetter(setter: ThemeSetter | null): void {
  registeredSetter = setter;
}

/**
 * Apply a theme change. Prefer the next-themes bridge when a provider is
 * mounted; otherwise fall back to a persisted localStorage write + `.dark`
 * class toggle so canvas rendering still picks up the theme.
 */
export function applyThemeChange(nextDark: boolean): void {
  const theme: 'dark' | 'light' = nextDark ? 'dark' : 'light';

  if (registeredSetter) {
    registeredSetter(theme);
    return;
  }

  // Fallback — no ThemeProvider mounted (embed viewer, SSR tests).
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('archdraw-theme', theme);
  } catch {
    // Storage unavailable — ignore.
  }
  const root = document.documentElement;
  if (nextDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
}