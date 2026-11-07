import { describe, expect, it } from 'vitest';
import { improveAreaOrder, MIN_AREA_ORDER_GAIN } from '../areaFlowOrder';

const links = (pairs: Array<[string, string, number?]>) => new Map(pairs.map(([a, b, n]) => [`${a}\u0000${b}`, n ?? 1]));

describe('improveAreaOrder', () => {
  it('leaves an order that already follows the flow alone', () => {
    const declared = ['clients', 'edge', 'core', 'data'];
    expect(improveAreaOrder(declared, links([['clients', 'edge'], ['edge', 'core'], ['core', 'data']]))).toEqual(declared);
  });

  it('puts an area right when several of its edges point backwards (data declared before the services that write to it)', () => {
    const order = improveAreaOrder(
      ['clients', 'data', 'core', 'ext'],
      links([['clients', 'core'], ['core', 'data', 3], ['core', 'ext', 2]]),
    );
    expect(order.indexOf('core')).toBeLessThan(order.indexOf('data'));
    expect(order.indexOf('clients')).toBeLessThan(order.indexOf('core'));
  });

  it('keeps a declared flow whose only problem is ordinary feedback (one edge back)', () => {
    const declared = ['ingest', 'training', 'inference', 'analysis'];
    const feedback = links([['ingest', 'training'], ['training', 'inference'], ['inference', 'analysis'], ['inference', 'training']]);
    expect(improveAreaOrder(declared, feedback)).toEqual(declared);
  });

  it('keeps a loop that cannot be removed, even if a reorder would trade one backward edge for another', () => {
    const declared = ['a', 'b', 'c'];
    expect(improveAreaOrder(declared, links([['a', 'b'], ['b', 'c'], ['c', 'a']]))).toEqual(declared);
  });

  it('needs a real gain before it moves anything', () => {
    expect(MIN_AREA_ORDER_GAIN).toBeGreaterThanOrEqual(2);
  });
});
