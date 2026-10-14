import { describe, expect, it } from 'vitest';
import { hexToRgba, toHex6 } from '@/lib/utils';

describe('toHex6', () => {
  it('passes through and lowercases #rrggbb', () => {
    expect(toHex6('#3B82F6')).toBe('#3b82f6');
  });

  it('expands #rgb shorthand', () => {
    expect(toHex6('#abc')).toBe('#aabbcc');
  });

  it('drops the alpha channel of #rrggbbaa', () => {
    expect(toHex6('#3b82f680')).toBe('#3b82f6');
  });

  it.each([undefined, null, '', 'red', 'rgb(1,2,3)', '#12', '#ggg', 'not-a-color'])(
    'rejects %s',
    (input) => {
      expect(toHex6(input as string | undefined)).toBeNull();
    },
  );

  it('produces values hexToRgba can parse', () => {
    expect(hexToRgba(toHex6('#fff')!, 0.5)).toBe('rgba(255,255,255,0.5)');
  });
});
