import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import { layoutDiagramViaMermaid } from '@/lib/diagram/mermaid/relayout';
import { measureLayoutAesthetics } from '../layout/layoutAesthetics';
import { randomDiagram, type RandomDiagramOptions } from './fixtures/randomDiagrams';

/**
 * The layout principles are the same for every diagram, not just the shipped
 * templates, so they are checked on seeded random diagrams of every shape the
 * app produces: flat and grouped, sparse and dense, left-to-right and top-down.
 *
 * Hard principles hold for each diagram, no exceptions:
 *  - the layout succeeds,
 *  - no two nodes overlap,
 *  - every node stays inside its group's frame.
 *
 * Design principles can't always be met (interlocking fans contradict each
 * other, and a complete bipartite layer cannot be centred at all), so they are
 * ratcheted on the mean over many diagrams. Values are what was measured when
 * this shipped; lower them as the layout improves, never raise them.
 */
const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);

const MEAN_FAN_MISS_CEILING: Record<string, number> = {
  'sparse flat': 50,
  'sparse grouped': 35,
  'dense flat': 75,
  'dense grouped': 70,
};

interface Box { id: string; group: boolean; parent?: string; x: number; y: number; w: number; h: number }

function absoluteBoxes(nodes: Node[]): Box[] {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const origin = (node: Node): { x: number; y: number } => {
    const parent = node.parentNode;
    const base = parent && byId.has(parent) ? origin(byId.get(parent)!) : { x: 0, y: 0 };
    return { x: node.position.x + base.x, y: node.position.y + base.y };
  };
  return nodes.map(node => ({
    id: node.id,
    group: node.type === 'groupNode',
    parent: node.parentNode,
    ...origin(node),
    w: node.width ?? 0,
    h: node.height ?? 0,
  }));
}

// The symmetry measures here are taken on the engine's own layout, before a long flow is folded into rows (see layoutReadability.test.ts).
describe('layout principles hold for any diagram', () => {
  const classes: Array<[string, RandomDiagramOptions]> = [
    ['sparse flat', { density: 'sparse', groups: false }],
    ['sparse grouped', { density: 'sparse', groups: true }],
    ['dense flat', { density: 'dense', groups: false }],
    ['dense grouped', { density: 'dense', groups: true }],
  ];

  for (const [name, options] of classes) {
    it(`${name}: no overlaps, groups contain their nodes, fans stay near centre`, async () => {
      let total = 0;
      let count = 0;
      for (const seed of SEEDS) {
        const diagram = randomDiagram(seed, options);
        for (const direction of ['LR', 'TD'] as const) {
          const label = `${diagram.id} ${direction}`;
          const laid = await layoutDiagramViaMermaid(diagram.nodes, diagram.edges, direction, { foldLongFlows: false });
          expect(laid.success, `${label} succeeds`).toBe(true);

          const boxes = absoluteBoxes(laid.nodes);
          const leaves = boxes.filter(box => !box.group);
          expect(leaves.length, `${label} keeps every node`).toBe(diagram.nodes.filter(node => node.type !== 'groupNode').length);
          for (let i = 0; i < leaves.length; i++) {
            for (let j = i + 1; j < leaves.length; j++) {
              const a = leaves[i], b = leaves[j];
              const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
              expect(overlap, `${label}: ${a.id} overlaps ${b.id}`).toBe(false);
            }
          }
          for (const leaf of leaves) {
            if (!leaf.parent) continue;
            const frame = boxes.find(box => box.id === leaf.parent)!;
            const inside = leaf.x >= frame.x - 0.5 && leaf.y >= frame.y - 0.5 && leaf.x + leaf.w <= frame.x + frame.w + 0.5 && leaf.y + leaf.h <= frame.y + frame.h + 0.5;
            expect(inside, `${label}: ${leaf.id} inside ${leaf.parent}`).toBe(true);
          }

          const score = measureLayoutAesthetics(laid.nodes, laid.edges, direction);
          total += score.fanCenteringError;
          count++;
        }
      }
      expect(total / count, `${name}: mean worst-fan miss (px)`).toBeLessThanOrEqual(MEAN_FAN_MISS_CEILING[name]);
    }, 300_000);
  }
});
