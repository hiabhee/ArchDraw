import { describe, it, expect } from 'vitest';
import { runMermaidPipeline } from '@/lib/mermaid/pipeline';
import { isDomainSuccess } from '@/lib/pipeline-core';

const NESTED = `graph TD
  subgraph Platform["E-commerce Platform"]
    subgraph Storefront
      web["Storefront"]
      checkout["Checkout"]
    end
    subgraph Payments
      pay["Payment Service"]
    end
  end
  subgraph Data
    db[("Postgres")]
  end
  web-->|places order| checkout
  checkout-->|charges| pay
  checkout-->|reads| db
  pay-->|writes| db`;

describe('nested subgraph round-trip', () => {
  it('produces nested groupNodes with parentNode set', async () => {
    const res = await runMermaidPipeline(NESTED);
    if (!isDomainSuccess(res)) throw new Error(res.error.message);
    const groups = res.data.nodes.filter((n: { type?: string }) => n.type === 'groupNode');
    const outer = groups.find((g) => g.id === 'Platform');
    const inner = groups.find((g) => g.id === 'Storefront');
    const leaf = res.data.nodes.find((n) => n.id === 'web');

    expect(outer).toBeDefined();
    expect(inner).toBeDefined();
    expect((inner as unknown as { parentNode?: string }).parentNode).toBe('Platform');
    expect((leaf as unknown as { parentNode?: string }).parentNode).toBe('Storefront');
    expect((outer as unknown as { parentNode?: string }).parentNode).toBeUndefined();
  });
});
