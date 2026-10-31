import { describe, expect, it } from 'vitest';
import { runMermaidPipeline } from '@/lib/diagram/mermaid/pipeline';

async function groupTops(mermaid: string) {
  const result: any = await runMermaidPipeline(mermaid, { layoutProfile: 'studio-minimal', areaOrder: 'flow' });
  const top = (id: string) => (result.data.nodes as any[]).find(n => n.id === id).position.y as number;
  return { top };
}

describe('stacked groups follow the order of what feeds them', () => {
  it('puts the group fed only by the top source above the group fed by the lower sources', async () => {
    // `hub` feeds both groups; `mid` and `low` feed only `big`. If `big` sat on top,
    // hub → small would have to cross mid → big and low → big.
    const { top } = await groupTops(`graph LR
  subgraph src["Sources"]
    hub["Hub"]
    mid["Mid"]
    low["Low"]
  end
  subgraph big["Big"]
    b1["B1"]
    b2["B2"]
    b3["B3"]
  end
  subgraph small["Small"]
    s1["S1"]
    s2["S2"]
  end
  hub --> b1
  mid --> b2
  low --> b3
  hub --> s1
  hub --> s2
`);
    expect(top('small')).toBeLessThan(top('big'));
  });

  it('leaves a group order that already avoids crossings alone', async () => {
    const { top } = await groupTops(`graph LR
  subgraph src["Sources"]
    a["A"]
    b["B"]
  end
  subgraph first["First"]
    f1["F1"]
  end
  subgraph second["Second"]
    s1["S1"]
  end
  a --> f1
  b --> s1
`);
    expect(top('first')).toBeLessThan(top('second'));
  });
});
