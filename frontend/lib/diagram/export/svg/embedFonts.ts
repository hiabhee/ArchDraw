/**
 * Snapshot the page's loaded @font-face rules into a self-contained CSS
 * string for export SVGs.
 *
 * Rasterizing an SVG via <img> + canvas runs in an isolated context with no
 * access to document fonts — <text> silently falls back to system fonts and
 * the export stops looking like the canvas. Inlining the actual woff2 bytes
 * as data URLs keeps Inter / Space Grotesk / handwriting faces identical.
 * Best-effort: any failure yields '' and the caller falls back to stacks.
 */

const EXPORT_FONT_FAMILIES = new Set([
  'inter',
  'ibm plex sans',
  'space grotesk',
  'caveat',
  'patrick hand',
  'nanum pen script',
  'geist',
]);

const MAX_FONT_FILES = 12;
const MAX_FONT_BYTES = 600_000;

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function normalizeFamily(ruleText: string): string | null {
  const match = ruleText.match(/font-family\s*:\s*([^;]+);/i);
  if (!match) return null;
  return match[1].split(',')[0]?.trim().replace(/^["']|["']$/g, '').toLowerCase() ?? null;
}

export async function inlineFontUrlsInCss(
  cssText: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const urls = Array.from(cssText.matchAll(/url\(\s*(https?:[^)]+|blob:[^)]+?)\s*\)/gi));
  let out = cssText;
  for (const match of urls) {
    const url = match[1].replace(/^["']|["']$/g, '');
    try {
      const res = await fetchImpl(url);
      if (!res.ok) continue;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > MAX_FONT_BYTES) continue;
      const mime = url.endsWith('.woff2') ? 'font/woff2' : url.endsWith('.woff') ? 'font/woff' : 'font/ttf';
      out = out.split(match[0]).join(`url(data:${mime};base64,${base64Encode(buf)})`);
    } catch {
      // keep the remote url — harmless if unreachable in isolation
    }
  }
  return out;
}

export async function buildExportFontCss(): Promise<string> {
  if (typeof document === 'undefined' || typeof fetch === 'undefined') return '';
  const rules: string[] = [];
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let cssRules: CSSRuleList | null = null;
      try {
        cssRules = sheet.cssRules;
      } catch {
        continue; // cross-origin sheet — unreadable, skip
      }
      if (!cssRules) continue;
      for (const rule of Array.from(cssRules)) {
        if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
        const text = rule.cssText;
        const family = normalizeFamily(text);
        if (!family || !EXPORT_FONT_FAMILIES.has(family)) continue;
        if (rules.length >= MAX_FONT_FILES) break;
        rules.push(text);
      }
      if (rules.length >= MAX_FONT_FILES) break;
    }
  } catch {
    return '';
  }
  if (rules.length === 0) return '';

  const inlined = await Promise.all(rules.map((text) => inlineFontUrlsInCss(text)));
  return inlined.join('\n');
}
