import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@/data/templates';
import { layoutDiagramViaMermaid } from '@/lib/diagram/mermaid/relayout';
import { measureLayoutAesthetics } from '../layout/layoutAesthetics';

/**
 * Every shipped template, in both directions, laid out the way the app lays it
 * out and held to two ratchets:
 *
 * - `STRAIGHT_FLOOR`: the share of one-to-one links that run dead straight.
 * - `FAN_CEILING`: the largest miss, in px, between a fan's parent and the mean
 *   of its branches (fans that skip columns are not branches; see
 *   `layoutAesthetics.ts`).
 *
 * Values are the ones measured when this shipped. Raise a floor or lower a
 * ceiling as the layout improves, never the other way. Templates with no entry
 * use the defaults.
 */
const DEFAULT_STRAIGHT_FLOOR = 1;
const DEFAULT_FAN_CEILING = 10;

const STRAIGHT_FLOOR: Record<string, number> = {};

/** Key: `${template id}:${LR|TD}`. Every template not listed here must be within the default. */
const FAN_CEILING: Record<string, number> = {
  // Dense and flat (56 nodes): interlocking fans that cannot all be centred.
  'archdraw_self:LR': 350,
  'archdraw_self:TD': 535,
  // A triangle of mutual fans (controller → model + view, model → view) cannot
  // centre all three at once; this is the best the solver finds.
  'repo_to_diagram:LR': 65,
  'repo_to_diagram:TD': 115,
  'mvc:LR': 65,
  'mvc:TD': 115,
  // Accuracy fixes: Netflix clients call the API gateway directly (not through Open Connect),
  // and Search's index no longer "syncs" back to the DB. Both leave fans no layout can centre.
  'netflix:LR': 155,
  'netflix:TD': 285,
  'search:LR': 60,
  'search:TD': 112,
};

describe('layout aesthetics across every shipped template', () => {
  it('keeps one-to-one links straight and fans centred within their ratchet', async () => {
    for (const template of TEMPLATES) {
      for (const direction of ['LR', 'TD'] as const) {
        // Folding wraps a long flow into rows and splits fans across them on purpose; this measures the symmetry engine's own layout.
        const laid = await layoutDiagramViaMermaid(template.nodes, template.edges, direction, { foldLongFlows: false });
        const score = measureLayoutAesthetics(laid.nodes, laid.edges, direction);
        const label = `${template.id} ${direction}`;
        expect(score.straightEdgeRatio, `${label} straight links`).toBeGreaterThanOrEqual(STRAIGHT_FLOOR[template.id] ?? DEFAULT_STRAIGHT_FLOOR);
        expect(score.fanCenteringError, `${label} fan centring (px)`).toBeLessThanOrEqual(FAN_CEILING[`${template.id}:${direction}`] ?? DEFAULT_FAN_CEILING);
      }
    }
  }, 300_000);
});
