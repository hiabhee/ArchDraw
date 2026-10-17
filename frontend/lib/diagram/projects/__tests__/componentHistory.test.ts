import { describe, expect, it } from 'vitest';
import { componentScope, groupEditsByComponent, mergeBoutFiles, summarizeFiles } from '../componentHistory';

describe('component history helpers', () => {
  it('groups one report by component and detailed-map part', () => {
    const groups = groupEditsByComponent(
      { 'api/pay/charge.ts': 'payments', 'api/pay/refund.ts': 'payments', 'api/orders.ts': 'orders' },
      (path) => (path.includes('refund') ? 'payments__refunds' : null),
    );
    expect(groups).toEqual([
      { componentId: 'payments', detailComponentId: null, files: ['api/pay/charge.ts'] },
      { componentId: 'payments', detailComponentId: 'payments__refunds', files: ['api/pay/refund.ts'] },
      { componentId: 'orders', detailComponentId: null, files: ['api/orders.ts'] },
    ]);
  });

  it('moves a re-edited file to the end and keeps the newest files under the cap', () => {
    expect(mergeBoutFiles(['a', 'b', 'c'], ['a', 'd'])).toEqual(['b', 'c', 'a', 'd']);
    expect(mergeBoutFiles(['a', 'b', 'c'], ['d'], 3)).toEqual(['b', 'c', 'd']);
    expect(mergeBoutFiles('garbage', ['a'])).toEqual(['a']);
  });

  it('scopes an area to everything inside it', () => {
    const nodes = [
      { id: 'api' },
      { id: 'payments', parentNode: 'api' },
      { id: 'payments__refunds', parentId: 'payments' },
      { id: 'web' },
    ];
    expect(componentScope(nodes, 'api').sort()).toEqual(['api', 'payments', 'payments__refunds']);
    expect(componentScope(nodes, 'web')).toEqual(['web']);
  });

  it('summarizes the newest files, or only a count when paths are hidden', () => {
    expect(summarizeFiles(['src/a.ts', 'src/b.ts', 'src/c.ts'])).toBe('c.ts, b.ts +1');
    expect(summarizeFiles([], 3)).toBe('3 files');
    expect(summarizeFiles([], 0)).toBe('');
  });
});
