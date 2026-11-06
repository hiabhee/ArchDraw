import { describe, expect, it } from 'vitest';
import { buildShadowFilter, parseBoxShadow } from '../cssShadow';

describe('cssShadow', () => {
  it('reads each layer of the canvas card shadow', () => {
    expect(parseBoxShadow('rgba(0, 0, 0, 0.34) 0px 8px 22px 0px, rgba(0, 0, 0, 0.4) 0px 1px 3px 0px')).toEqual([
      { x: 0, y: 8, blur: 22, spread: 0, color: 'rgba(0, 0, 0, 0.34)' },
      { x: 0, y: 1, blur: 3, spread: 0, color: 'rgba(0, 0, 0, 0.4)' },
    ]);
  });

  it('skips inset layers and none', () => {
    expect(parseBoxShadow('inset 0 1px 0 rgba(255,255,255,.1)')).toEqual([]);
    expect(parseBoxShadow('none')).toEqual([]);
    expect(buildShadowFilter('s', 'none')).toBe('');
  });

  it('blurs by half the CSS blur radius, as browsers do', () => {
    const filter = buildShadowFilter('s', 'rgba(0,0,0,.3) 0px 8px 22px 0px');
    expect(filter).toContain('id="s"');
    expect(filter).toContain('stdDeviation="11"');
    expect(filter).toContain('dy="8"');
  });
});
