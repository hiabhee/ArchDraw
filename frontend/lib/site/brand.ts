/**
 * Brand colours for places that need literal values instead of CSS tokens (web manifest,
 * generated icons). They mirror `app/globals.css`: `--night-page` / `--night-ink` (the dark
 * theme) and the light theme's `--surface-page` / `--text-primary`, which the mark in
 * `app/icon.svg`, `public/logo.*` and `components/ui/BrandMark.tsx` is drawn from.
 */
export const BRAND_COLORS = {
  nightPage: '#07080a',
  nightInk: '#ece9e2',
  lightPage: '#f7f7f5',
  lightInk: '#1c1c1a',
} as const;
