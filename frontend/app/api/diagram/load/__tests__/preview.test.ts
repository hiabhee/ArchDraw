import { NextRequest } from 'next/server';
import type { Node } from 'reactflow';
import { getEffectiveNodeDimensions } from '@/lib/diagram/nodes/shapeNodeDimensions';
import { resolveCanvasTokens } from '@/lib/theme/renderStyles';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/redis', () => ({
  checkRateLimitWithFallback: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 }),
}));
vi.mock('@/lib/server/prisma', () => ({ default: { sharedCanvas: { create: vi.fn() } } }));
vi.mock('@/lib/server/quotaCheck', () => ({ getSessionFromRequest: vi.fn().mockResolvedValue(null), logUsage: vi.fn() }));
vi.mock('@/lib/server/ip', () => ({ getClientIP: () => '203.0.113.7' }));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() } }));

import { POST } from '../route';

const post = (body: unknown) => new NextRequest('http://localhost/api/diagram/load', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const MERMAID = 'graph LR\n  subgraph api["API"]\n    Web[Web App] --> Server[API Server]\n  end\n  Server --> DB[(Postgres)]';

describe('POST /api/diagram/load preview', () => {
  it('draws the diagram with the SVG export when asked', async () => {
    const body = await (await POST(post({ mermaid: MERMAID, dryRun: true, preview: true }))).json();
    expect(body.previewSvg).toMatch(/^<svg[\s>]/);
    expect(body.previewSvg).toContain('API Server');
    // Rendered inside an <img>, so it must not depend on outside resources.
    expect(body.previewSvg).not.toMatch(/href="https?:/);
  });

  it('defaults the inline canvas to dark Studio Minimal and honors explicit preview styles', async () => {
    const input = { mermaid: MERMAID, dryRun: true, preview: true };
    const explicitCanvas = { ...input, previewStyle: 'studio', previewSurface: 'canvas' };
    const explicitMetallic = { ...explicitCanvas, previewStyle: 'studio-metallic' };
    const explicitLight = { ...input, previewStyle: 'studio', previewTheme: 'light' };
    const [defaultPreview, canvas, metallic, light] = await Promise.all([input, explicitCanvas, explicitMetallic, explicitLight].map(async options =>
      (await POST(post(options))).json(),
    ));

    expect(canvas.previewSvg).not.toContain('archdraw-metallic-sheen');
    expect(canvas.previewSvg).toContain('fill="#191d24"');
    expect(canvas.previewSvg).not.toContain('archdraw-background-pattern');
    expect(defaultPreview.previewSvg).toBe(canvas.previewSvg);
    expect(metallic.previewSvg).toContain('archdraw-metallic-sheen');
    expect(metallic.previewSvg).not.toContain('archdraw-background-pattern');
    expect(light.previewSvg).toContain('fill="#fdfdfc"');
  });

  it('draws a raw drawing hand-drawn when previewStyle is sketch, and keeps the Studio look otherwise', async () => {
    const nodes = [
      { id: 'a', type: 'textLabelNode', position: { x: 0, y: 0 }, width: 200, height: 100, data: { text: 'Whiteboard' } },
      { id: 'b', type: 'shapeNode', position: { x: 0, y: 200 }, width: 200, height: 90, data: { label: 'Idea', shape: 'rounded-rectangle' } },
    ];
    const sketch = await (await POST(post({ nodes, edges: [], dryRun: true, preview: true, previewStyle: 'sketch' }))).json();
    const clean = await (await POST(post({ nodes, edges: [], dryRun: true, preview: true }))).json();
    expect(sketch.previewSvg).toContain('Whiteboard');
    const paper = resolveCanvasTokens({ renderStyleId: 'sketch', colorThemeId: 'default', isDark: false }).cssVars['--arch-canvas-bg'];
    expect(sketch.previewSvg).toContain(paper); // the sketch paper
    expect(clean.previewSvg).not.toContain(paper);
    expect(sketch.previewSvg).not.toBe(clean.previewSvg);
    expect(clean.previewNodeSizes.b).toEqual(getEffectiveNodeDimensions(nodes[1], 'studio-minimal', 'all'));
    expect(clean.previewNodeSizes.b.width).toBeGreaterThan(nodes[1].width);
  });

  it('re-lays overlapping family-tree cards as a top-down hierarchy using their rendered sizes', async () => {
    const nodes: Node[] = [
      { id: 'parents', type: 'systemNode', position: { x: 0, y: 0 }, data: { label: 'Parents' } },
      { id: 'root', type: 'systemNode', position: { x: 0, y: 0 }, data: { label: 'Central figure', subtitle: 'Second generation' } },
      { id: 'branch-a', type: 'systemNode', position: { x: 0, y: 0 }, data: { label: 'Descendants in the first branch', subtitle: 'Children and grandchildren' } },
      { id: 'branch-b', type: 'systemNode', position: { x: 0, y: 0 }, data: { label: 'Descendants in the second branch' } },
    ];
    const edges = [
      { id: 'descent', source: 'parents', target: 'root', type: 'simpleFloating' },
      { id: 'first', source: 'root', target: 'branch-a', type: 'simpleFloating' },
      { id: 'second', source: 'root', target: 'branch-b', type: 'simpleFloating' },
    ];
    const response = await POST(post({
      nodes, edges, dryRun: true, preview: true, layout: { direction: 'TD', profile: 'studio-minimal', foldLongFlows: false },
    }));
    expect(response.status).toBe(200);
    const body = await response.json() as { nodes: Node[]; edges: typeof edges };
    const byId = new Map(body.nodes.map(node => [node.id, node]));
    expect(body.edges.map(({ id, source, target }) => ({ id, source, target }))).toEqual(edges.map(({ id, source, target }) => ({ id, source, target })));
    expect(byId.get('parents')!.position.y).toBeLessThan(byId.get('root')!.position.y);
    const [left, right] = [byId.get('branch-a')!, byId.get('branch-b')!].sort((a, b) => a.position.x - b.position.x);
    const leftSize = getEffectiveNodeDimensions(left, 'studio-minimal', 'all');
    const rightSize = getEffectiveNodeDimensions(right, 'studio-minimal', 'all');
    expect(left.position.y + leftSize.height / 2).toBeCloseTo(right.position.y + rightSize.height / 2);
    expect(left.position.x + leftSize.width).toBeLessThan(right.position.x);
  });

  it('renders a compact Studio Metallic preview on black while preserving its graph', async () => {
    const mermaid = `graph LR
  client["Client<br/>Creates or opens a short link"] -->|Create or resolve link| gateway["Load balancer"]
  gateway -->|Route request| api["URL shortener API"]
  api -->|Check cached redirect| cache["Redis cache"]
  api -->|Save or read URL mapping| db[("PostgreSQL")]
  api -.->|Schedule expiry| worker["Cleanup worker"]
  worker -->|Delete expired mappings| db`;
    const input = { mermaid, dryRun: true, preview: true, previewStyle: 'studio-metallic', previewTheme: 'dark' };
    const unfolded = await (await POST(post(input))).json();
    const compact = await (await POST(post({ ...input, layout: { autoDirection: true } }))).json();
    const aspectRatio = (svg: string) => {
      const match = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!;
      return Number(match[1]) / Number(match[2]);
    };

    expect(compact.previewSvg).toContain('fill="#000000"');
    expect(compact.previewSvg).toContain('url(#archdraw-metallic-sheen)');
    expect(aspectRatio(compact.previewSvg)).toBeLessThan(aspectRatio(unfolded.previewSvg) / 2);
    expect(compact.direction).toBe('TD');
    expect(compact.previewQuality).toMatchObject({
      hardViolations: 0, crossings: 0, labelCollisions: 0, criticalPathDisconnectCount: 0,
    });
    const row = (id: string) => compact.nodes.find((node: Node) => node.id === id).position.y;
    expect(row('client')).toBeLessThan(row('gateway'));
    expect(row('gateway')).toBeLessThan(row('api'));
    expect(row('api')).toBeLessThan(row('db'));
    expect(compact.nodes.map((node: Node) => node.id).sort()).toEqual(unfolded.nodes.map((node: Node) => node.id).sort());
    const connections = (edges: Array<{ source: string; target: string; label: string }>) =>
      edges.map(({ source, target, label }) => [source, target, label].join(':')).sort();
    expect(connections(compact.edges)).toEqual(connections(unfolded.edges));
  });

  it('leaves room for all labels in a dense rideshare preview', async () => {
    const mermaid = `graph LR
  subgraph apps["Mobile apps"]
    driver["Driver app"]
    rider["Rider app"]
  end
  subgraph market["Marketplace and maps"]
    location["Live driver location"]
    eta["Routing and Deep ETA"]
    h3["H3 geospatial index"]
    matching["Driver matching"]
    pricing["Upfront pricing"]
  end
  subgraph trip["Trip lifecycle"]
    api["Mobile APIs"]
    spanner[("Cloud Spanner")]
    fulfillment["Fulfillment"]
    ramen["RAMEN push platform"]
  end
  subgraph events["Trip events and payments"]
    kafka["Kafka event streams"]
    analytics["Analytics and ML"]
    payments["Payments platform"]
    balances["Entity balances"]
    providers["Payment providers"]
  end
  driver -->|Send GPS updates| location
  driver -->|Accept, start, end| api
  rider -->|Quote and book| api
  location -->|Latest driver positions| matching
  location -->|GPS for traffic estimates| eta
  location -->|Supply and demand by area| h3
  eta -->|Pickup ETA| matching
  eta -->|Travel time| pricing
  h3 -->|Local marketplace signals| pricing
  api -->|Get fare quote| pricing
  api -->|Send trip commands| fulfillment
  fulfillment -->|Request driver match| matching
  matching -->|Propose assignment| fulfillment
  fulfillment -->|Write trip and offer state| spanner
  fulfillment -.->|Offers and trip status| ramen
  location -.->|Live trip position| ramen
  ramen -.->|Offers and updates| driver
  ramen -.->|Ride updates| rider
  fulfillment -.->|Publish trip events| kafka
  kafka -.->|Trip and marketplace data| analytics
  kafka -.->|Completed trip| payments
  payments -->|Record money movements| balances
  payments -->|Collect and disburse| providers`;
    const response = await POST(post({
      mermaid, dryRun: true, preview: true, previewSurface: 'canvas', layout: { autoDirection: true },
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.previewSvg).toContain('Write trip and offer state');
    expect(body.previewQuality).toMatchObject({
      labelCollisions: 0, hardViolations: 0, criticalPathDisconnectCount: 0,
    });
    expect(body.direction).toBe('TD');
    expect(body.nodes.filter((node: Node) => node.type === 'groupNode')).toHaveLength(4);
    expect(body.nodes).toHaveLength(20);
    expect(body.edges).toHaveLength(23);
  }, 90000);

  it('refuses a raw drawing with a node type the canvas does not know', async () => {
    const response = await POST(post({ nodes: [{ id: 'x', type: 'scriptNode', position: { x: 0, y: 0 }, data: {} }], edges: [], dryRun: true }));
    expect(response.status).toBe(400);
  });

  it('leaves the SVG out unless asked', async () => {
    const body = await (await POST(post({ mermaid: MERMAID, dryRun: true }))).json();
    expect(body.previewSvg).toBeUndefined();
    expect(body.nodes.length).toBeGreaterThan(0);
  });

  it('re-lays out a graph sent as nodes and edges when asked, in the requested direction', async () => {
    const node = (id: string) => ({ id, type: 'shapeNode', position: { x: 0, y: 0 }, width: 200, height: 90, data: { label: id, shape: 'rounded-rectangle' } });
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [{ id: 'e1', source: 'a', target: 'b', type: 'simpleFloating' }, { id: 'e2', source: 'b', target: 'c', type: 'simpleFloating' }];
    const lr = await (await POST(post({ nodes, edges, dryRun: true, layout: { direction: 'LR' } }))).json();
    const td = await (await POST(post({ nodes, edges, dryRun: true, layout: { direction: 'TD' } }))).json();
    const at = (graph: { nodes: Array<{ id: string; position: { x: number; y: number } }> }, id: string) => graph.nodes.find((n) => n.id === id)!.position;
    expect(lr.nodes).toHaveLength(3);
    expect(at(lr, 'c').x).toBeGreaterThan(at(lr, 'a').x);
    expect(at(td, 'c').y).toBeGreaterThan(at(td, 'a').y);
    expect(lr.edges).toHaveLength(2);
  });

  it('rejects a layout direction it does not know', async () => {
    expect((await POST(post({ nodes: [], edges: [], dryRun: true, layout: { direction: 'sideways' } }))).status).toBe(400);
  });

  it('lays a grouped diagram out so every card sits inside its group and no two cards overlap', async () => {
    // A messaging-system diagram shaped like one an agent sends: seven groups, long two-line labels.
    const mermaid = `graph LR
  subgraph clients["Clients"]
    sender["Sender App<br/>iOS / Android / Web"]
    recipient["Recipient App<br/>multi-device"]
  end
  subgraph edge["Edge Layer"]
    lb["Load Balancer<br/>L4 TCP, sticky by user"]
    cdn["Media CDN<br/>edge cache for photos/video"]
  end
  subgraph rt["Real-time Messaging Tier (Erlang)"]
    chat["Chat / Connection Servers<br/>persistent TCP, Noise-encrypted"]
    presence["Presence Service<br/>online, last seen, typing"]
    registry["Session Registry<br/>userId to chat-server map"]
    router["Message Router<br/>1:1 delivery, ack tracking"]
  end
  subgraph async["Async Backbone"]
    offline["Offline Message Queue<br/>store-and-forward until ack"]
    bus["Event Bus<br/>receipts, analytics events"]
  end
  subgraph data["Data Stores"]
    udb[("User and Group DB<br/>profiles, contacts, groups")]
    blob[("Blob Storage<br/>encrypted media")]
    msgs[("Message Store<br/>pending msgs only, deleted on delivery")]
    cache[("In-memory Cache<br/>sessions, presence")]
  end
  subgraph core["Core Services"]
    auth["Auth / Registration<br/>phone number + OTP"]
    keys["Key Distribution Server<br/>Signal prekeys, identity keys"]
    notify["Notification Service<br/>wake offline devices"]
    group["Group Service<br/>membership, fan-out"]
    media["Media Service<br/>upload URLs, encrypted blobs"]
  end
  subgraph ext["External Services"]
    sms["SMS Gateway<br/>OTP delivery"]
    push["APNs / FCM<br/>mobile push"]
  end
  sender --> lb
  recipient --> lb
  sender --> cdn
  lb --> chat
  chat --> presence
  chat --> router
  chat --> registry
  router --> registry
  router --> offline
  router --> bus
  presence --> cache
  registry --> cache
  offline --> msgs
  offline --> notify
  notify --> push
  auth --> sms
  auth --> udb
  keys --> udb
  group --> udb
  group --> router
  media --> blob
  cdn --> blob
  chat --> media
  bus --> group`;
    const body = await (await POST(post({ mermaid, dryRun: true }))).json() as { nodes: Array<{ id: string; type?: string; parentNode?: string; position: { x: number; y: number }; width?: number; height?: number; style?: { width?: number; height?: number } }> };
    const byId = new Map(body.nodes.map((n) => [n.id, n]));
    // Group frames are as stored; a card is measured as the preview, share page and editor draw it
    // (Studio sizes), which is what the layout has to fit.
    const isGroup = (n: (typeof body.nodes)[number]) => n.type === 'groupNode';
    const size = (n: (typeof body.nodes)[number]) => {
      if (isGroup(n)) return { w: n.width ?? n.style?.width ?? 0, h: n.height ?? n.style?.height ?? 0 };
      const d = getEffectiveNodeDimensions(n as unknown as Node, 'studio-minimal', 'all');
      return { w: d.width, h: d.height };
    };
    const cards = body.nodes.filter((n) => n.parentNode);
    expect(cards.length).toBeGreaterThan(5);
    for (const card of cards) {
      const group = size(byId.get(card.parentNode!)!);
      const { w, h } = size(card);
      expect(card.position.x, card.id).toBeGreaterThanOrEqual(0);
      expect(card.position.y, card.id).toBeGreaterThanOrEqual(0);
      expect(card.position.x + w, `${card.id} right edge`).toBeLessThanOrEqual(group.w);
      expect(card.position.y + h, `${card.id} bottom edge`).toBeLessThanOrEqual(group.h);
    }
    for (const a of cards) for (const b of cards) {
      if (a.id >= b.id || a.parentNode !== b.parentNode) continue;
      const [sa, sb] = [size(a), size(b)];
      const apart = a.position.x + sa.w <= b.position.x || b.position.x + sb.w <= a.position.x || a.position.y + sa.h <= b.position.y || b.position.y + sb.h <= a.position.y;
      expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
    }
  });
});
