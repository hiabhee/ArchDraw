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

// Export callers lazy-load this wrapper and its renderer together for DOM capture.
import { toCanvas, toJpeg, toPng, toSvg } from 'html-to-image';
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

async function capture<T>(
  render: (element: HTMLElement, options: Options) => Promise<T>,
  element: HTMLElement,
  options: Options,
): Promise<T> {
  const restore = patchCssRulesGetter();
  try {
    return await render(element, options);
  } catch (err) {
    if (isCssRulesSecurityError(err) && !options.skipFonts) {
      return await render(element, { ...options, skipFonts: true });
    }
    throw err;
  } finally {
    restore?.();
  }
}

export function safeToPng(element: HTMLElement, options: Options = {}): Promise<string> {
  return capture(toPng, element, options);
}

export function safeToJpeg(element: HTMLElement, options: Options = {}): Promise<string> {
  return capture(toJpeg, element, options);
}

export function safeToCanvas(element: HTMLElement, options: Options = {}): Promise<HTMLCanvasElement> {
  return capture(toCanvas, element, options);
}

export function safeToSvg(element: HTMLElement, options: Options = {}): Promise<string> {
  return capture(toSvg, element, options);
}
