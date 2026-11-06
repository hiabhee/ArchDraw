import { describe, expect, it } from 'vitest';
import { MAX_OVERVIEW_COMPONENTS, overviewSizeWarning } from '../overviewSize';

const leaves = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, type: 'shapeNode' }));

describe('overviewSizeWarning', () => {
  it('stays quiet for an overview-sized map, counting leaves only', () => {
    const nodes = [...leaves(MAX_OVERVIEW_COMPONENTS), { id: 'area', type: 'groupNode' }, { id: 'note', type: 'textLabelNode' }];
    expect(overviewSizeWarning(nodes)).toBeNull();
  });

  it('points a fine-grained map at the detailed level', () => {
    const warning = overviewSizeWarning(leaves(38));
    expect(warning).toMatch(/38 components/);
    expect(warning).toMatch(/level: "detail"/);
  });
});
