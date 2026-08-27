/**
 * Safe wrapper around html-to-image that handles cross-origin stylesheet
 * SecurityErrors when reading `cssRules`.
 *
 * html-to-image's `embedWebFonts` iterates `document.styleSheets` and
 * accesses `sheet.cssRules`. For cross-origin stylesheets (Google Fonts,
 * browser extensions like `chrome-extension://`, etc.) this throws:
 *   SecurityError: Failed to read the 'cssRules' property
 * Even though the library has try/catch, `<'cssRules' in sheet>` is
 * outside the try and some browsers/extensions still cause unhandled
 * rejections. See https://github.com/bubkoo/html-to-image/issues/361
 *
 * Strategy:
 * 1. Temporarily monkey-patch `CSSStyleSheet.prototype.cssRules` (and `.rules`)
 *    to swallow SecurityError and return an empty list. This makes the
 *    library's read safe regardless of origin or CSP.
 * 2. Try the export once with caller options. If it still throws a
 *    cssRules SecurityError, retry once with `skipFonts: true` which
 *    bypasses the entire `getCSSRules` codepath.
 */

import type { Options } from 'html-to-image/lib/types';

function isCssRulesSecurityError(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err);
  const name = (err as DOMException)?.name;
  return (
    name === 'SecurityError' ||
    msg.includes('cssRules') ||
    msg.includes('Cannot access rules')
  );
}

function patchCssRulesGetter(): (() => void) | null {
  if (typeof window === 'undefined' || typeof CSSStyleSheet === 'undefined') return null;

  const patches: Array<{ key: string; original: PropertyDescriptor }> = [];

  for (const key of ['cssRules', 'rules'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, key);
    if (!descriptor?.get) continue;
    const originalGet = descriptor.get;
    patches.push({ key, original: descriptor });
    try {
      Object.defineProperty(CSSStyleSheet.prototype, key, {
        get(this: CSSStyleSheet) {
          try {
            return originalGet.call(this);
          } catch (e) {
            if (isCssRulesSecurityError(e)) {
              // Return empty RuleList so html-to-image treats sheet as empty
              return [] as unknown as CSSRuleList;
            }
            throw e;
          }
        },
        configurable: true,
      });
    } catch {
      // If patch fails, ignore – fallback retry will handle it
      patches.pop();
    }
  }

  if (patches.length === 0) return null;

  return () => {
    for (const { key, original } of patches) {
      try {
        Object.defineProperty(CSSStyleSheet.prototype, key, original);
      } catch {
        // best-effort restore
      }
    }
  };
}

export async function safeToPng(element: HTMLElement, options: Options = {}): Promise<string> {
  const restore = patchCssRulesGetter();
  try {
    const { toPng } = await import('html-to-image');
    try {
      return await toPng(element, options);
    } catch (err) {
      if (isCssRulesSecurityError(err) && !options.skipFonts) {
        return await toPng(element, { ...options, skipFonts: true });
      }
      throw err;
    }
  } finally {
    restore?.();
  }
}

export async function safeToJpeg(element: HTMLElement, options: Options = {}): Promise<string> {
  const restore = patchCssRulesGetter();
  try {
    const { toJpeg } = await import('html-to-image');
    try {
      return await toJpeg(element, options);
    } catch (err) {
      if (isCssRulesSecurityError(err) && !options.skipFonts) {
        return await toJpeg(element, { ...options, skipFonts: true });
      }
      throw err;
    }
  } finally {
    restore?.();
  }
}

export async function safeToCanvas(element: HTMLElement, options: Options = {}): Promise<HTMLCanvasElement> {
  const restore = patchCssRulesGetter();
  try {
    const { toCanvas } = await import('html-to-image');
    try {
      return await toCanvas(element, options);
    } catch (err) {
      if (isCssRulesSecurityError(err) && !options.skipFonts) {
        return await toCanvas(element, { ...options, skipFonts: true });
      }
      throw err;
    }
  } finally {
    restore?.();
  }
}
