import { describe, expect, it } from 'vitest';
import { measureText, wrapText } from '../textMeasure';

describe('textMeasure (server widths from the bundled Inter)', () => {
  it('measures in proportion to the font size', () => {
    const at16 = measureText('Load Balancer', 600, 16);
    expect(measureText('Load Balancer', 600, 32)).toBeCloseTo(at16 * 2, 5);
  });

  it('measures semibold wider than regular', () => {
    expect(measureText('Application Server', 600, 20)).toBeGreaterThan(measureText('Application Server', 400, 20));
  });

  it('adds letter spacing per character', () => {
    expect(measureText('abc', 400, 16, 1)).toBeCloseTo(measureText('abc', 400, 16) + 3, 5);
  });
});

describe('wrapText', () => {
  const opts = { weight: 400, px: 15.5 };

  it('keeps short text on one line', () => {
    expect(wrapText('Kong', 205, opts)).toEqual(['Kong']);
  });

  it('wraps at spaces and loses no words', () => {
    const lines = wrapText('Browser / Mobile — initiates request', 205, opts);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('Browser / Mobile — initiates request');
    for (const line of lines) expect(measureText(line, 400, 15.5)).toBeLessThanOrEqual(205);
  });

  it('breaks a single word that is wider than the line', () => {
    const lines = wrapText('Supercalifragilisticexpialidocious', 100, opts);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('Supercalifragilisticexpialidocious');
  });

  it('keeps explicit newlines and handles empty text', () => {
    expect(wrapText('a\nb', 200, opts)).toEqual(['a', 'b']);
    expect(wrapText('', 200, opts)).toEqual(['']);
  });
});
