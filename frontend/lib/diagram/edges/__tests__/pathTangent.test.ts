import { describe, expect, it } from 'vitest';
import { pathEndTangentAngle } from '../pathTangent';

const deg = (radians: number | null) => (radians === null ? null : Math.round((radians * 180) / Math.PI) + 0);

describe('pathEndTangentAngle', () => {
  it('follows a straight line', () => {
    expect(deg(pathEndTangentAngle('M 0 0 L 100 0'))).toBe(0);
    expect(deg(pathEndTangentAngle('M 0 0 L 0 -50'))).toBe(-90);
    expect(deg(pathEndTangentAngle('M 10 10 L 0 10'))).toBe(180);
  });

  it('uses the last run, not a point a fixed share back (long edge, short last run)', () => {
    // 400px down, then a 16px run to the right into the target: the head must point right.
    expect(deg(pathEndTangentAngle('M 0 0 L 0 400 L 16 400'))).toBe(0);
    expect(deg(pathEndTangentAngle('M 0 0 V 400 H 16'))).toBe(0);
  });

  it('reads the arrival direction of curves', () => {
    expect(deg(pathEndTangentAngle('M 0 0 L 50 0 Q 60 0 60 10'))).toBe(90);
    expect(deg(pathEndTangentAngle('M 0 0 C 20 0 40 20 60 20'))).toBe(0);
    expect(deg(pathEndTangentAngle('M 0 0 C 0 20 20 40 40 40'))).toBe(0);
  });

  it('handles relative commands and implicit repeats', () => {
    expect(deg(pathEndTangentAngle('m 0 0 l 10 0 0 10'))).toBe(90);
    expect(deg(pathEndTangentAngle('M 0 0 h 30 v -20'))).toBe(-90);
  });

  it('reads rounded corners (arcs), the way the edge router draws them', () => {
    // Right, then a quarter turn down (clockwise on screen): arrives heading down.
    expect(deg(pathEndTangentAngle('M 0,0 L 40,0 A 10,10 0 0,1 50,10'))).toBe(90);
    // Right, then a quarter turn up (counter-clockwise): arrives heading up.
    expect(deg(pathEndTangentAngle('M 0,0 L 40,0 A 10,10 0 0,0 50,-10'))).toBe(-90);
    // Down, then a quarter turn to the right.
    expect(deg(pathEndTangentAngle('M 0,0 L 0,40 A 10,10 0 0,0 10,50'))).toBe(0);
  });

  it('uses the final run after a rounded corner (short last run into a target)', () => {
    // Long run down, a corner, then a 16px run right into the target: must point right.
    expect(deg(pathEndTangentAngle('M 0,0 L 0,400 L 0,390 A 10,10 0 0,0 10,400 L 26,400'))).toBe(0);
  });

  it('skips a zero-length final segment', () => {
    expect(deg(pathEndTangentAngle('M 0 0 L 30 0 L 30 0'))).toBe(0);
  });

  it('returns null for paths it cannot read', () => {
    expect(pathEndTangentAngle('')).toBeNull();
    expect(pathEndTangentAngle('M 0 0')).toBeNull();
    // Elliptical or rotated arcs and smooth-curve shorthands are not drawn by the router.
    expect(pathEndTangentAngle('M 0 0 A 5 8 0 0 1 10 10')).toBeNull();
    expect(pathEndTangentAngle('M 0 0 S 5 5 10 10')).toBeNull();
  });
});
