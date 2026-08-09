import { describe, expect, it } from 'vitest';
import {
  getUtf8ByteLength,
  wrapRasterInSvg,
  MAX_SVG_EXPORT_BYTES,
} from '@/lib/utils/optimizeSvgExport';

describe('optimizeSvgExport', () => {
  it('counts utf8 bytes', () => {
    expect(getUtf8ByteLength('abc')).toBe(3);
    expect(getUtf8ByteLength('é')).toBe(2);
  });

  it('wraps a raster data url in a minimal svg', () => {
    const svg = wrapRasterInSvg('data:image/jpeg;base64,AAA', 800, 600, '#ffffff');
    expect(svg).toContain('<image');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
    expect(svg).toContain('fill="#ffffff"');
  });

  it('defines a 3mb export budget', () => {
    expect(MAX_SVG_EXPORT_BYTES).toBe(3 * 1024 * 1024);
  });
});
