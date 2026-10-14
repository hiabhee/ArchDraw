import type { Edge, Node } from 'reactflow';
import { runMermaidPipeline } from '@/lib/diagram/mermaid/pipeline';
import { isDomainSuccess } from '@/lib/diagram/pipeline-core';
import { publishGraph } from '@/lib/diagram/projects/publishGraph';
import type { StructureChange } from '@/lib/diagram/projects/structureDiff';

/**
 * The landing hero's live map, built exactly the way a live project's map is:
 * the same Mermaid pipeline options as `PUT /api/projects/:id/diagram`, and the
 * same publish merge when an agent adds a component (existing boxes keep their
 * place, the new one is placed beside them). Runs on the server at build time.
 */

export const BASE = `graph LR
  subgraph clients["Clients"]
    web["Web app<br/>Next.js storefront"]
    mobile["Mobile app<br/>iOS + Android"]
  end
  subgraph api["API"]
    gateway["API gateway<br/>routing + rate limits"]
    auth["Auth<br/>sessions + OAuth"]
    orders["Orders<br/>cart and checkout"]
    payments["Payments<br/>charges + refunds"]
  end
  subgraph workers["Workers"]
    email["Email worker<br/>receipts + alerts"]
    search["Search indexer<br/>product catalog"]
  end
  subgraph data["Data and services"]
    postgres[("Postgres<br/>orders, users")]
    redis[("Redis<br/>sessions + cache")]
    stripe["Stripe<br/>payments API"]
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
`;

/** What the map looks like after Lynx publishes the component it built. */
const WITH_REFUNDS = BASE
  .replace('    search["Search indexer<br/>product catalog"]\n', '    search["Search indexer<br/>product catalog"]\n    refunds["Refund worker<br/>retries + webhooks"]\n')
  .concat('  payments -.->|refunds| refunds\n');

export interface HeroGraph { nodes: Node[]; edges: Edge[] }
export interface HeroGraphs { base: HeroGraph; mapped: HeroGraph; change: StructureChange }

async function layout(mermaid: string): Promise<HeroGraph> {
  const result = await runMermaidPipeline(mermaid, { layoutProfile: 'studio-minimal', areaOrder: 'flow' });
  if (!isDomainSuccess(result)) throw new Error('Landing hero diagram failed to lay out');
  return { nodes: result.data.nodes as unknown as Node[], edges: result.data.edges as unknown as Edge[] };
}

let cached: Promise<HeroGraphs> | null = null;

export function buildHeroGraphs(): Promise<HeroGraphs> {
  cached ??= (async () => {
    const first = publishGraph({ existingNodes: [], laidOut: await layout(BASE), relayout: true, now: 0 });
    const second = publishGraph({ existingNodes: first.nodes, laidOut: await layout(WITH_REFUNDS), now: 0 });
    // Plain JSON so it crosses to the client component unchanged.
    const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
    return {
      base: plain({ nodes: first.nodes, edges: first.edges }),
      mapped: plain({ nodes: second.nodes, edges: second.edges }),
      change: second.change,
    };
  })();
  return cached;
}
