import { describe, expect, it } from 'vitest';
import { runMermaidPipeline } from '../pipeline';
import { getCachedDiagramGeometryPlan } from '@/lib/diagram/geometry/diagramGeometry';
import { generatePureSVG } from '@/lib/diagram/export/svgExport';

// A messaging system as an agent writes it: seven groups, 22 cards and 24 connections, with the
// data stores declared before the services that write to them.
const MESSAGING = (`graph LR
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
  bus --> group`);

describe('a dense grouped diagram', () => {
  it('is laid out so connections do not run through cards and the areas follow the flow', async () => {
    const result = await runMermaidPipeline(MESSAGING, { layoutProfile: 'studio-minimal', areaOrder: 'flow' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const nodes = result.data.nodes as unknown as Array<{ id: string; type?: string; parentNode?: string; position: { x: number } }>;
    const x = (id: string) => nodes.find((n) => n.id === id)!.position.x;
    // Writers come before the stores they write to, not after.
    expect(x('core')).toBeLessThan(x('data'));
    const plan = getCachedDiagramGeometryPlan(result.data.nodes as never, result.data.edges as never, { direction: 'LR' });
    // Far fewer connections drawn through a card than the 7-9 the default spacing leaves.
    expect(plan.quality.hardViolations).toBeLessThanOrEqual(2);
    expect(plan.quality.criticalPathDisconnectCount).toBe(0);
  }, 120000);

  it('exports every connection inside the image (a detour around the diagram is not cut off)', async () => {
    const result = await runMermaidPipeline(MESSAGING, { layoutProfile: 'studio-minimal', areaOrder: 'flow' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const svg = generatePureSVG(result.data.nodes as never, result.data.edges as never, false, '#ffffff', 'LR', 'studio-minimal', 'studio-minimal', 'all');
    const width = Number(/<svg[^>]*\swidth="([\d.]+)"/.exec(svg)![1]);
    const height = Number(/<svg[^>]*\sheight="([\d.]+)"/.exec(svg)![1]);
    const edgesGroup = svg.slice(svg.indexOf('<g id="edges">'), svg.indexOf('<g id="nodes">') > 0 ? svg.indexOf('<g id="nodes">') : undefined);
    let checked = 0;
    for (const match of edgesGroup.matchAll(/<path\s+d="([^"]+)"\s+fill="none"/g)) {
      // Points of the path: M / L pairs, Q and C pairs, and the end point of each arc (A).
      const points: Array<[number, number]> = [];
      for (const [, command, args] of match[1].matchAll(/([MLQCA])([^MLQCA]*)/g)) {
        const n = (args.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
        if (command === 'A') for (let k = 0; k + 6 < n.length; k += 7) points.push([n[k + 5], n[k + 6]]);
        else for (let k = 0; k + 1 < n.length; k += 2) points.push([n[k], n[k + 1]]);
      }
      for (const [x, y] of points) {
        expect(x, 'x inside the image').toBeGreaterThanOrEqual(-0.5);
        expect(x, 'x inside the image').toBeLessThanOrEqual(width + 0.5);
        expect(y, 'y inside the image').toBeGreaterThanOrEqual(-0.5);
        expect(y, 'y inside the image').toBeLessThanOrEqual(height + 0.5);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  }, 120000);
});
