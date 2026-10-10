import { describe, expect, it } from 'vitest';
import { buildExportFontCss, inlineFontUrlsInCss } from '@/lib/diagram/export/svg/embedFonts';

describe('buildExportFontCss', () => {
  it('returns empty when no matching families are loaded', async () => {
    const style = document.createElement('style');
    style.setAttribute('data-test-font', '');
    style.textContent = `@font-face{font-family:SomeOther;font-weight:400;src:url(https://example.com/other.woff2)}`;
    document.head.appendChild(style);
    try {
      await expect(buildExportFontCss()).resolves.toBe('');
    } finally {
      style.remove();
    }
  });

  it('surfaces loaded matching families from the live stylesheet', async () => {
    const style = document.createElement('style');
    style.setAttribute('data-test-font', '');
    style.textContent = `@font-face{font-family:Inter;font-weight:600;src:url(https://example.com/inter.woff2)}`;
    document.head.appendChild(style);
    try {
      const css = await buildExportFontCss();
      // jsdom drops src when serializing cssRules; real browsers preserve it.
      // Either way the family must be picked up (inlining is covered below).
      expect(css).toMatch(/font-family:\s*Inter/);
    } finally {
      style.remove();
    }
  });
});

describe('inlineFontUrlsInCss', () => {
  const woff = `@font-face{font-family:Inter;font-weight:600;src:url(https://example.com/inter.woff2)}`;

  it('inlines woff2 bytes as data URLs', async () => {
    const bytes = new Uint8Array([0, 1, 2, 3]);
    const fetchImpl = (async () => ({
      ok: true,
      arrayBuffer: async () => bytes.buffer,
    })) as unknown as typeof fetch;
    const css = await inlineFontUrlsInCss(woff, fetchImpl);
    expect(css).toContain('font-family:Inter');
    expect(css).toContain('data:font/woff2;base64,');
    expect(css).not.toContain('https://example.com/inter.woff2');
  });

  it('keeps the remote url when the fetch fails', async () => {
    const grotesk = `@font-face{font-family:"Space Grotesk";src:url(https://example.com/grotesk.woff2)}`;
    const fetchImpl = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const css = await inlineFontUrlsInCss(grotesk, fetchImpl);
    expect(css).toContain('https://example.com/grotesk.woff2');
  });

  it('skips oversized or empty files', async () => {
    const empty = (async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as unknown as typeof fetch;
    await expect(inlineFontUrlsInCss(woff, empty)).resolves.toContain(
      'https://example.com/inter.woff2',
    );
  });
});
