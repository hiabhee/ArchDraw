import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Colors come from the semantic tokens in `app/globals.css` (`bg-surface-page`,
 * `text-text-primary`, `bg-brand`, `text-success`, the `--night-*` palette, ...).
 * A raw hex value or a raw Tailwind palette class (`bg-slate-500`) in a UI file
 * bypasses them, so the same color gets spelled five slightly different ways.
 *
 * This is a ratchet: each area may use no more raw colors than it does today.
 * When you replace some, LOWER its number here; never raise one. A new color
 * belongs in `globals.css` first. (Canvas, SVG/PNG export and chart colors live
 * in `lib/theme`, which this does not scan: exported images cannot use CSS
 * variables.)
 */
const ROOTS = ['components', 'app'];
const SKIP = [/__tests__/, /\.test\./, /^app\/globals\.css$/, /^app\/api\//, /\.json$/];

const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;
const PALETTE = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|decoration|accent|caret|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

const BASELINE_HEX: Record<string, number> = {
  'app/.well-known': 0,
  'app/about': 0,
  'app/admin': 0,
  'app/agent-skill': 0,
  'app/auth': 0,
  'app/blogs': 1,
  'app/changelog.json': 0,
  'app/connect-agent': 0,
  'app/contact': 0,
  'app/dashboard': 0,
  'app/docs': 7,
  'app/editor': 2,
  'app/embed': 11,
  'app/error.tsx': 0,
  'app/faq': 0,
  'app/humans.txt': 0,
  'app/layout.tsx': 2,
  'app/live': 0,
  'app/llms-full.txt': 4,
  'app/llms.txt': 0,
  'app/login': 9,
  'app/mcp': 0,
  'app/not-found.tsx': 0,
  'app/openapi.json': 0,
  'app/openapi.yaml': 0,
  'app/page.tsx': 0,
  'app/pricing': 0,
  'app/privacy': 0,
  'app/repo-diagram': 0,
  'app/robots.ts': 0,
  'app/share': 0,
  'app/sitemap.ts': 0,
  'app/terms': 0,
  'app/test': 0,
  'app/tutorials': 28,
  'components/agent-skill': 0,
  'components/auth': 12,
  'components/canvas': 198,
  'components/dashboard': 46,
  'components/editor': 47,
  'components/icons': 1,
  'components/jev': 4,
  'components/landing': 56,
  'components/providers': 0,
  'components/tutorial': 22,
  'components/ui': 0,
  'components/viewers': 13,
};
const BASELINE_PALETTE: Record<string, number> = {
  'app/.well-known': 0,
  'app/about': 0,
  'app/admin': 16,
  'app/agent-skill': 3,
  'app/auth': 0,
  'app/blogs': 0,
  'app/changelog.json': 0,
  'app/connect-agent': 6,
  'app/contact': 0,
  'app/dashboard': 0,
  'app/docs': 3,
  'app/editor': 0,
  'app/embed': 0,
  'app/error.tsx': 0,
  'app/faq': 0,
  'app/humans.txt': 0,
  'app/layout.tsx': 0,
  'app/live': 0,
  'app/llms-full.txt': 0,
  'app/llms.txt': 0,
  'app/login': 0,
  'app/mcp': 0,
  'app/not-found.tsx': 0,
  'app/openapi.json': 0,
  'app/openapi.yaml': 0,
  'app/page.tsx': 0,
  'app/pricing': 0,
  'app/privacy': 0,
  'app/repo-diagram': 0,
  'app/robots.ts': 0,
  'app/share': 2,
  'app/sitemap.ts': 0,
  'app/terms': 0,
  'app/test': 0,
  'app/tutorials': 25,
  'components/agent-skill': 0,
  'components/auth': 13,
  'components/canvas': 12,
  'components/dashboard': 6,
  'components/editor': 43,
  'components/icons': 0,
  'components/jev': 0,
  'components/landing': 2,
  'components/providers': 0,
  'components/tutorial': 127,
  'components/ui': 6,
  'components/viewers': 16,
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(path);
  }
  return out;
}

function count() {
  const hex: Record<string, number> = {};
  const palette: Record<string, number> = {};
  for (const root of ROOTS) {
    for (const file of walk(join(process.cwd(), root))) {
      const rel = relative(process.cwd(), file).split('\\').join('/');
      if (SKIP.some(pattern => pattern.test(rel))) continue;
      const area = rel.split('/').slice(0, 2).join('/');
      const text = readFileSync(file, 'utf8');
      hex[area] = (hex[area] ?? 0) + (text.match(HEX)?.length ?? 0);
      palette[area] = (palette[area] ?? 0) + (text.match(PALETTE)?.length ?? 0);
    }
  }
  return { hex, palette };
}

describe('design system: colors come from tokens', () => {
  const found = count();

  it('uses no more raw hex colors per area than the baseline', () => {
    for (const [area, n] of Object.entries(found.hex)) {
      expect(n, `${area}: ${n} raw hex colors, baseline ${BASELINE_HEX[area] ?? 0}. Use a token from app/globals.css (e.g. bg-brand, text-text-muted).`)
        .toBeLessThanOrEqual(BASELINE_HEX[area] ?? 0);
    }
  });

  it('uses no more raw Tailwind palette classes per area than the baseline', () => {
    for (const [area, n] of Object.entries(found.palette)) {
      expect(n, `${area}: ${n} raw palette classes (bg-slate-500 ...), baseline ${BASELINE_PALETTE[area] ?? 0}. Use a semantic token (bg-surface-panel, text-text-secondary, ...).`)
        .toBeLessThanOrEqual(BASELINE_PALETTE[area] ?? 0);
    }
  });
});
