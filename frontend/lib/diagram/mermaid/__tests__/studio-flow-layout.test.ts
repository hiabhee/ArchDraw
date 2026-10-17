import { describe, expect, it } from 'vitest';
import { runMermaidPipeline } from '../pipeline';

// Shape of an agent-published project map: sources in an External group feed
// an ingestion group that fans into a pipeline.
const MAP = `graph LR
  subgraph Orchestration["Orchestration"]
    runner("Pipeline Runner")
  end
  subgraph Ingestion["Ingestion"]
    scenes("Scene prep")
    tiles("Benchmark tiles")
    dem("Inventory & DEM")
    data[("Scene data")]
  end
  subgraph External["External"]
    glims["GLIMS WFS"]
    nird["NIRD archive"]
    planetary["Planetary Computer"]
  end
  runner --> scenes
  glims --> scenes
  nird --> tiles
  planetary --> dem
  scenes --> data
  tiles --> data
  dem --> data`;

type LaidOut = { id: string; parentNode?: string; position: { x: number; y: number }; width?: number; height?: number; style?: { width?: number } };

async function layout(profile?: 'studio-minimal') {
  const result = await runMermaidPipeline(MAP, { layoutProfile: profile });
  if (!result.success) throw new Error('pipeline failed');
  const nodes = result.data.nodes as unknown as LaidOut[];
  return { nodes, byId: new Map(nodes.map((node) => [node.id, node])) };
}

describe('studio-minimal project layout', () => {
  it('sizes cards as Studio draws them, so children sit evenly inside their group', async () => {
    const { nodes, byId } = await layout('studio-minimal');
    for (const node of nodes.filter((n) => n.parentNode)) {
      const group = byId.get(node.parentNode!)!;
      const groupWidth = group.width ?? group.style?.width ?? 0;
      expect(node.width).toBe(200);
      expect(node.height).toBeGreaterThanOrEqual(64);
      expect(node.position.x).toBeGreaterThanOrEqual(28);
      expect(groupWidth - node.position.x - node.width!).toBeGreaterThanOrEqual(28);
    }
  });

  it('keeps a group that only feeds the flow upstream instead of above it', async () => {
    const { byId } = await layout('studio-minimal');
    const external = byId.get('External')!;
    const ingestion = byId.get('Ingestion')!;
    expect(external.position.x + (external.width ?? 0)).toBeLessThan(ingestion.position.x);
  });

  it('orders independent group members by what they connect to', async () => {
    const { byId } = await layout('studio-minimal');
    const absY = (id: string) => byId.get(id)!.position.y + byId.get(byId.get(id)!.parentNode!)!.position.y;
    const targets = ['scenes', 'tiles', 'dem'].sort((a, b) => absY(a) - absY(b));
    const sourceOf: Record<string, string> = { scenes: 'glims', tiles: 'nird', dem: 'planetary' };
    const sources = ['glims', 'nird', 'planetary'].sort((a, b) => absY(a) - absY(b));
    expect(sources).toEqual(targets.map((target) => sourceOf[target]));
  });
});

// Areas listed in data-flow order with loops between them (a later stage
// feeding an earlier one), as Claude's project maps have.
const LOOPY = `graph LR
  subgraph Ingest["Ingest"]
    fetch("Fetch")
  end
  subgraph Training["Training"]
    train("Train")
  end
  subgraph Inference["Inference"]
    infer("Infer")
  end
  subgraph Analysis["Analysis"]
    analyse("Analyse")
  end
  fetch --> train
  train --> infer
  infer --> analyse
  infer --> train
  analyse --> train`;

async function areaXOrder(mermaid: string, areaOrder?: 'flow' | string[]) {
  const result = await runMermaidPipeline(mermaid, { layoutProfile: 'studio-minimal', areaOrder });
  if (!result.success) throw new Error('pipeline failed');
  return (result.data.nodes as unknown as LaidOut[])
    .filter((n) => !n.parentNode && ['Ingest', 'Training', 'Inference', 'Analysis'].includes(n.id))
    .sort((a, b) => a.position.x - b.position.x)
    .map((n) => n.id);
}

describe('areas in data-flow order', () => {
  it('keeps the declared stage order when later stages feed earlier ones', async () => {
    expect(await areaXOrder(LOOPY, 'flow')).toEqual(['Ingest', 'Training', 'Inference', 'Analysis']);
  });

  it('follows a given order (the overview) over the declaration order', async () => {
    const shuffled = LOOPY.replace(/  subgraph Training\["Training"\]\n    train\("Train"\)\n  end\n/, '') + '\n  subgraph Training["Training"]\n    train("Train")\n  end';
    expect(await areaXOrder(shuffled, ['Ingest', 'Training', 'Inference', 'Analysis'])).toEqual(['Ingest', 'Training', 'Inference', 'Analysis']);
  });

  it('keeps a data area in the flow when the spacing repair runs', async () => {
    const shop = `graph LR
  subgraph clients["Clients"]
    web["Web app"]
    mobile["Mobile app"]
  end
  subgraph api["API"]
    gateway["API gateway"]
    auth["Auth"]
    orders["Orders"]
    payments["Payments"]
  end
  subgraph workers["Workers"]
    email["Email worker"]
    search["Search indexer"]
  end
  subgraph data["Data and services"]
    postgres[("Postgres")]
    redis[("Redis")]
    stripe["Stripe"]
  end
  web -->|HTTPS| gateway
  mobile -->|HTTPS| gateway
  gateway --> auth
  gateway --> orders
  gateway --> payments
  auth -->|sessions| redis
  orders -.->|jobs| email
  orders -.->|index| search
  orders -->|writes| postgres
  payments -->|charges| stripe
  search -->|reads| postgres`;
    const result = await runMermaidPipeline(shop, { layoutProfile: 'studio-minimal', areaOrder: 'flow' });
    if (!result.success) throw new Error('pipeline failed');
    const box = new Map((result.data.nodes as unknown as LaidOut[]).filter((n) => !n.parentNode).map((n) => [n.id, n.position]));
    // Without flowAreas on the repair pass, Data became a sidecar lane above API.
    expect(box.get('data')!.x).toBeGreaterThan(box.get('workers')!.x);
    expect(box.get('data')!.y).toBeGreaterThanOrEqual(box.get('api')!.y);
  });
});
