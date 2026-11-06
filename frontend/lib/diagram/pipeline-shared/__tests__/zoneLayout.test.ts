import { describe, expect, it } from 'vitest';
import { runMermaidPipeline } from '@/lib/diagram/mermaid/pipeline';

/** A system with a central service: clients on one side, data zones, a processing zone and a queue pipeline. */
const HUB_SYSTEM = `graph LR
  desktop["Desktop"]
  mobile["Mobile"]
  nginx["NGINX"]
  multiplayer["Multiplayer"]
  subgraph checkpointing["Checkpointing"]
    redis[("Redis")]
    s3a[("S3")]
    sinatra["Sinatra"]
    postgres[("Postgres")]
  end
  subgraph journaling["Journaling"]
    dynamo[("DynamoDB")]
    s3b[("S3")]
  end
  subgraph mp["Multiplayer processes"]
    ts["TypeScript"]
    rust1["Rust one"]
    rust2["Rust two"]
  end
  users["Users"]
  api["Public API"]
  sqs["SQS"]
  worker["Pixie worker"]
  s3c[("S3")]
  pubsub["Redis pub/sub"]
  desktop -->|"wss"| nginx
  mobile -->|"wss"| nginx
  nginx -->|"hashed by file key"| multiplayer
  multiplayer -->|"selection API"| redis
  multiplayer -->|"upload checkpoint"| s3a
  multiplayer -->|"auth, session"| sinatra
  sinatra -->|"update rows"| postgres
  multiplayer -->|"write-ahead log"| dynamo
  multiplayer -->|"entries too large"| s3b
  multiplayer --> ts
  ts -->|"stdin/stdout"| rust1
  ts --> rust2
  users -->|"API endpoints"| api
  api --> sqs
  sqs --> worker
  worker -->|"upload"| s3c
  worker --> pubsub
  pubsub --> api
  api -->|"ensure all changes are saved"| multiplayer
`;

interface Box { x: number; y: number; w: number; h: number }

async function lay(source: string, layoutStyle?: 'flow' | 'zones') {
  const result = (await runMermaidPipeline(source, { layoutProfile: 'studio-minimal', areaOrder: 'flow', layoutStyle })) as unknown as {
    success: boolean;
    data: { nodes: Array<{ id: string; position: { x: number; y: number }; width?: number; height?: number; parentNode?: string }> };
  };
  expect(result.success).toBe(true);
  const nodes = result.data.nodes;
  const byId = new Map(nodes.map(node => [node.id, node]));
  const box = (id: string): Box => {
    const node = byId.get(id)!;
    const parent = node.parentNode ? box(node.parentNode) : { x: 0, y: 0, w: 0, h: 0 };
    return { x: parent.x + node.position.x, y: parent.y + node.position.y, w: node.width ?? 0, h: node.height ?? 0 };
  };
  return { nodes, box };
}

const centerX = (b: Box) => b.x + b.w / 2;
const centerY = (b: Box) => b.y + b.h / 2;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('hub-and-zones layout', () => {
  it('places clients left, data zones above, the processing zone right and the pipeline below the hub', async () => {
    const { box } = await lay(HUB_SYSTEM, 'zones');
    const hub = box('multiplayer');
    for (const client of ['desktop', 'mobile', 'nginx']) expect(box(client).x + box(client).w).toBeLessThanOrEqual(hub.x);
    for (const zone of ['checkpointing', 'journaling']) expect(box(zone).y + box(zone).h).toBeLessThanOrEqual(hub.y);
    expect(box('mp').x).toBeGreaterThanOrEqual(hub.x + hub.w);
    for (const step of ['users', 'api', 'sqs', 'worker']) expect(box(step).y).toBeGreaterThanOrEqual(hub.y + hub.h);
  });

  it('lays a zone above the hub out as a row, flowing away from the hub', async () => {
    const { box } = await lay(HUB_SYSTEM, 'zones');
    // Siblings share a row; what Sinatra writes to sits above it.
    expect(centerY(box('redis'))).toBeCloseTo(centerY(box('s3a')), 0);
    expect(centerY(box('redis'))).toBeCloseTo(centerY(box('sinatra')), 0);
    expect(box('postgres').y + box('postgres').h).toBeLessThanOrEqual(box('sinatra').y);
  });

  it('keeps every top-level unit apart and every child inside its zone', async () => {
    const { nodes, box } = await lay(HUB_SYSTEM, 'zones');
    const tops = nodes.filter(node => !node.parentNode).map(node => node.id);
    for (let i = 0; i < tops.length; i++) {
      for (let j = i + 1; j < tops.length; j++) expect(overlaps(box(tops[i]), box(tops[j])), `${tops[i]} / ${tops[j]}`).toBe(false);
    }
    for (const node of nodes.filter(item => item.parentNode)) {
      const child = box(node.id);
      const frame = box(node.parentNode!);
      expect(child.x).toBeGreaterThanOrEqual(frame.x);
      expect(child.y).toBeGreaterThanOrEqual(frame.y);
      expect(child.x + child.w).toBeLessThanOrEqual(frame.x + frame.w + 0.5);
      expect(child.y + child.h).toBeLessThanOrEqual(frame.y + frame.h + 0.5);
    }
  });

  it('centres the zones above and the chain below over the hub', async () => {
    const { box } = await lay(HUB_SYSTEM, 'zones');
    const hubX = centerX(box('multiplayer'));
    const above = [box('checkpointing'), box('journaling')];
    const spanLeft = Math.min(...above.map(b => b.x));
    const spanRight = Math.max(...above.map(b => b.x + b.w));
    expect((spanLeft + spanRight) / 2).toBeCloseTo(hubX, 0);
  });

  it('keeps the flow layout for a long pipeline where one busy component is not a real hub', async () => {
    const pipeline = `graph LR
  a["A"] --> b["B"] --> c["C"] --> gateway["Gateway"]
  gateway --> x1["X1"] --> y1["Y1"] --> z1["Z1"] --> sink["Sink"]
  gateway --> x2["X2"] --> y2["Y2"] --> z2["Z2"] --> sink
  gateway --> x3["X3"] --> y3["Y3"] --> z3["Z3"] --> sink
  sink --> report["Report"] --> archive["Archive"]
`;
    const flow = await lay(pipeline, 'flow');
    const zones = await lay(pipeline, 'zones');
    for (const node of flow.nodes) expect(zones.box(node.id)).toEqual(flow.box(node.id));
  });

  it('is off by default and falls back to the flow layout when there is no hub', async () => {
    const chain = `graph LR
  a["A"] --> b["B"] --> c["C"] --> d["D"] --> e["E"]
`;
    const flow = await lay(chain, 'flow');
    const zones = await lay(chain, 'zones');
    for (const node of flow.nodes) expect(zones.box(node.id)).toEqual(flow.box(node.id));
    const plain = await lay(HUB_SYSTEM);
    const explicit = await lay(HUB_SYSTEM, 'flow');
    for (const node of plain.nodes) expect(explicit.box(node.id)).toEqual(plain.box(node.id));
  });
});
