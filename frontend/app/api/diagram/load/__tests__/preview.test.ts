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
  });

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
