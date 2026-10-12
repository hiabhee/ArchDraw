import { describe, expect, it } from 'vitest';
import { isAutoCanvasName } from '../canvasNames';

describe('isAutoCanvasName', () => {
  it('recognises generated names', () => {
    expect(isAutoCanvasName('Giraffe')).toBe(true);
    expect(isAutoCanvasName('Wolf 2')).toBe(true);
    expect(isAutoCanvasName('Canvas 1')).toBe(true);
  });
  it('leaves names the user chose alone', () => {
    expect(isAutoCanvasName('Payments service')).toBe(false);
    expect(isAutoCanvasName('Giraffe tracker')).toBe(false);
    expect(isAutoCanvasName('ArchDraw')).toBe(false);
  });
});
