import { describe, expect, it } from 'vitest';
import {
  clampToSizeGrid,
  getConcernColor,
  resolveConcern,
  SIZE_L,
  SIZE_M,
  SIZE_S,
  themePrimaryColor,
  themeToNodeTypeStyles,
} from '@/lib/theme/stylingConstants';

describe('architecture visual tokens', () => {
  it('maps categories to semantic concerns', () => {
    expect(resolveConcern('postgres')).toBe('data');
    expect(resolveConcern('kafka-queue')).toBe('async');
    expect(resolveConcern('browser-client')).toBe('client');
    expect(resolveConcern('stripe')).toBe('external');
    expect(resolveConcern('api-gateway')).toBe('compute');
  });

  it('returns muted concern accents', () => {
    expect(getConcernColor('database')).toBe('#334155');
    expect(getConcernColor('queue')).toBe('#c2410c');
    expect(getConcernColor('service')).toBe('#0f766e');
  });

  it('snaps widths to the optical grid', () => {
    expect(clampToSizeGrid(150)).toBe(SIZE_S);
    expect(clampToSizeGrid(200)).toBe(SIZE_M);
    expect(clampToSizeGrid(260)).toBe(SIZE_L);
    expect(clampToSizeGrid(400)).toBe(SIZE_L);
  });

  it('builds theme node styles from packs', () => {
    expect(themePrimaryColor('forest-green')).toMatch(/^#/);
    const styles = themeToNodeTypeStyles('slate');
    expect(styles.data).toBeTruthy();
    expect(styles.queue).toBeTruthy();
    expect(styles.client).toBeTruthy();
  });
});
