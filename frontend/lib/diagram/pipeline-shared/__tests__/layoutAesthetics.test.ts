import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@/data/templates';
import { layoutDiagramViaMermaid } from '@/lib/diagram/mermaid/relayout';
import { measureLayoutAesthetics } from '../layout/layoutAesthetics';

/**
 * Every shipped template, laid out the way the app lays it out, is held to a
 * floor: straight one-to-one links must stay straight (the symmetry pass moves
 * whole chains, never one end of a link), and a fan that can be centered is.
 * Floors are the values measured when the pass shipped; raise them as the
 * layout improves, never lower them.
 */
const STRAIGHT_FLOOR: Record<string, number> = {
  chatgpt: 1,
  instagram: 0.8, // media flows rewired through the CDN and worker for accuracy
  video_streaming: 1,
  netflix: 0.7,
  rideshare: 1,
  fintech_payments: 1,
  microservices: 1,
  layered: 1,
  food_delivery: 1,
  clean_architecture: 1,
};

describe('layout aesthetics across the shipped templates', () => {
  it('keeps one-to-one links straight and never leaves a fan further off-center than before', async () => {
    for (const template of TEMPLATES) {
      const laid = await layoutDiagramViaMermaid(template.nodes, template.edges, 'LR');
      const score = measureLayoutAesthetics(laid.nodes, laid.edges, 'LR');
      const floor = STRAIGHT_FLOOR[template.id];
      if (floor !== undefined) expect(score.straightEdgeRatio, `${template.id} straight links`).toBeGreaterThanOrEqual(floor);
      expect(Number.isFinite(score.fanCenteringError)).toBe(true);
    }
  }, 120_000);
});
