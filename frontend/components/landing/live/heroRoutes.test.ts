import { describe, expect, it } from 'vitest';
import { computeDiagramGeometryPlan } from '@/lib/diagram/geometry/diagramGeometry';
import { measureLayoutAesthetics } from '@/lib/diagram/pipeline-shared/layout/layoutAesthetics';
import { buildHeroGraphs } from './heroGraph';

async function hero() {
  const { base } = await buildHeroGraphs();
  const plan = computeDiagramGeometryPlan(base.nodes, base.edges, { direction: 'LR' });
  const route = (source: string, target: string) => {
    const edge = base.edges.find((e) => e.source === source && e.target === target)!;
    return plan.routes.get(edge.id)!.waypoints;
  };
  return { base, plan, route };
}

describe('landing hero layout and routing', () => {
  it('is symmetric: every fan sits on the middle of its branches and columns are evenly spaced', async () => {
    const { base } = await hero();
    const score = measureLayoutAesthetics(base.nodes, base.edges, 'LR');
    expect(score.fans).toBeGreaterThanOrEqual(2);
    expect(score.fanCenteringError).toBeLessThan(1);
    expect(score.columnSpacingSpread).toBeLessThan(1);
  });

  it('draws the gateway fan-out as one shared trunk, with a straight line to the middle target', async () => {
    const { route } = await hero();
    expect(route('gateway', 'auth')).toHaveLength(4);
    expect(route('gateway', 'orders')).toHaveLength(4);
    expect(route('gateway', 'payments')).toHaveLength(2);
    const trunkX = new Set(['auth', 'orders'].map((target) => Math.round(route('gateway', target)[1].x)));
    expect(trunkX.size).toBe(1);
  });

  it('merges Web and Mobile into the gateway through one channel', async () => {
    const { route } = await hero();
    const web = route('web', 'gateway');
    const mobile = route('mobile', 'gateway');
    expect(web).toHaveLength(4);
    expect(mobile).toHaveLength(4);
    expect(Math.round(web[1].x)).toBe(Math.round(mobile[1].x));
  });

  it('routes edges between two groups through one channel instead of lanes at both ends', async () => {
    const { plan, route } = await hero();
    for (const [source, target] of [['auth', 'redis'], ['orders', 'email'], ['orders', 'search'], ['payments', 'stripe']]) {
      expect(route(source, target).length).toBeLessThanOrEqual(4);
    }
    expect(plan.quality.crossings).toBe(0);
  });

  it('gives every inter-group edge its own band: no shared bus, no forced crossing', async () => {
    const { plan, route } = await hero();
    // Orders feeds both Workers and Data, so those groups must sit in the order of their sources
    // (Workers above Data); otherwise Orders → Workers would have to cross Payments → Stripe.
    expect(plan.quality.unexplainedPrivateOverlapLength).toBe(0);
    expect(route('orders', 'email')[2].y).toBeLessThan(route('orders', 'postgres')[2].y);
    expect(route('payments', 'stripe')[2].y).toBeLessThan(route('auth', 'redis')[2].y);
  });
});
