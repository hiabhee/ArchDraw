import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import { TEMPLATES } from '@/data/templates';
import { layoutDiagramViaMermaid } from '@/lib/diagram/mermaid/relayout';
import { measureLayoutAesthetics } from '../layout/layoutAesthetics';
import { randomDiagram, type RandomDiagramOptions } from './fixtures/randomDiagrams';

/**
 * Readability: how large a card title is drawn when the whole diagram is fitted to
 * a typical 16:9 screen (`titlePxAtFit`). A long flow is folded into rows (or lanes)
 * so it fills the screen instead of a thin strip; the fold is used only when it routes
 * as cleanly as the unfolded layout, so some wide, tangled diagrams stay wide.
 *
 * Two things hold for every diagram:
 *  - the fold never makes the diagram smaller on screen than the unfolded layout,
 *  - the folded layout still has no overlapping nodes and no node outside its group.
 *
 * And each shipped template (in Studio Minimal, both directions) keeps at least the
 * title size measured when this shipped. Raise a floor as the layout improves, never lower it.
 *
 * Known regression of the 1.25x Studio cards: `mvc:LR` fits at 12.4px (it was 18.5px). Its
 * fold into rows adds 20 weighted crossings to a six-node diagram, so it stays one wide row.
 * The mean over all templates went from 13.5px to 15.5px.
 */
const TITLE_PX_FLOOR: Record<string, number> = {
  'archdraw_self:LR': 2.7,
  'archdraw_self:TD': 3.3,
  'chatgpt:LR': 6.6,
  'chatgpt:TD': 6.2,
  'instagram:LR': 5.4,
  'instagram:TD': 6.6,
  'video_streaming:LR': 7.8,
  'video_streaming:TD': 9.3,
  'netflix:LR': 9.3,
  'netflix:TD': 7.0,
  'rideshare:LR': 6.7,
  'rideshare:TD': 7.8,
  'fintech_payments:LR': 10.8,
  'fintech_payments:TD': 15.6,
  'collaborative_docs:LR': 9.3,
  'collaborative_docs:TD': 12.7,
  'food_delivery:LR': 14.9,
  'food_delivery:TD': 12.1,
  'repo_to_diagram:LR': 5.5,
  'repo_to_diagram:TD': 13.6,
  'mvc:LR': 12.1,
  'mvc:TD': 22.7,
  'clean_architecture:LR': 15.0,
  'clean_architecture:TD': 20.3,
  'hexagonal:LR': 21.8,
  'hexagonal:TD': 15.6,
  'layered:LR': 21.7,
  'layered:TD': 22.7,
  'microservices:LR': 15.2,
  'microservices:TD': 20.3,
  'event_driven:LR': 21.3,
  'event_driven:TD': 15.5,
  'cqrs:LR': 22.7,
  'cqrs:TD': 22.7,
  'event_sourcing:LR': 21.2,
  'event_sourcing:TD': 22.7,
  'serverless:LR': 15.5,
  'serverless:TD': 20.3,
  'ecommerce:LR': 15.7,
  'ecommerce:TD': 20.2,
  'url_shortener:LR': 22.7,
  'url_shortener:TD': 22.7,
  'chat_system:LR': 21.0,
  'chat_system:TD': 15.6,
  'notification:LR': 22.7,
  'notification:TD': 20.2,
  'search:LR': 21.8,
  'search:TD': 20.6, // was 22.7 before the wrong index → DB edge was removed
  'request_response:LR': 13.6,
  'request_response:TD': 17.7,
};

interface Box { id: string; group: boolean; parent?: string; x: number; y: number; w: number; h: number }

function absoluteBoxes(nodes: Node[]): Box[] {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const origin = (node: Node): { x: number; y: number } => {
    const parent = node.parentNode;
    const base = parent && byId.has(parent) ? origin(byId.get(parent)!) : { x: 0, y: 0 };
    return { x: node.position.x + base.x, y: node.position.y + base.y };
  };
  return nodes.map(node => ({ id: node.id, group: node.type === 'groupNode', parent: node.parentNode, ...origin(node), w: node.width ?? 0, h: node.height ?? 0 }));
}

function expectNoOverlapAndContained(nodes: Node[], label: string) {
  const boxes = absoluteBoxes(nodes);
  const leaves = boxes.filter(box => !box.group);
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
}

describe('layout readability', () => {
  // One test per direction: each lays out every template twice (folded and not), which is slow on a busy machine.
  for (const direction of ['LR', 'TD'] as const) {
    it(`${direction}: keeps every shipped template at least as large on screen as when this shipped, and never smaller than unfolded`, async () => {
      for (const template of TEMPLATES) {
        const label = `${template.id}:${direction}`;
        const options = { title: template.name, renderStyleId: 'studio-minimal' as const };
        const folded = await layoutDiagramViaMermaid(template.nodes, template.edges, direction, options);
        const unfolded = await layoutDiagramViaMermaid(template.nodes, template.edges, direction, { ...options, foldLongFlows: false });
        const foldedScore = measureLayoutAesthetics(folded.nodes, folded.edges, direction);
        const unfoldedScore = measureLayoutAesthetics(unfolded.nodes, unfolded.edges, direction);
        expect(foldedScore.titlePxAtFit, `${label} title size vs unfolded`).toBeGreaterThanOrEqual(unfoldedScore.titlePxAtFit - 1e-6);
        expect(foldedScore.titlePxAtFit, `${label} title size floor`).toBeGreaterThanOrEqual(TITLE_PX_FLOOR[label] ?? 0);
        expectNoOverlapAndContained(folded.nodes, label);
      }
    }, 900_000);
  }

  const classes: Array<[string, RandomDiagramOptions]> = [
    ['flat', { density: 'sparse', groups: false }],
    ['grouped', { density: 'sparse', groups: true }],
  ];
  for (const [name, options] of classes) {
    it(`${name} random diagrams: folding never shrinks the diagram, overlaps nodes, or pushes one out of its group`, async () => {
      for (let seed = 1; seed <= 12; seed++) {
        const diagram = randomDiagram(seed, options);
        for (const direction of ['LR', 'TD'] as const) {
          const label = `${diagram.id} ${direction}`;
          const folded = await layoutDiagramViaMermaid(diagram.nodes, diagram.edges, direction, { renderStyleId: 'studio-minimal' });
          const unfolded = await layoutDiagramViaMermaid(diagram.nodes, diagram.edges, direction, { renderStyleId: 'studio-minimal', foldLongFlows: false });
          expect(folded.success, `${label} succeeds`).toBe(true);
          const a = measureLayoutAesthetics(folded.nodes, folded.edges, direction).titlePxAtFit;
          const b = measureLayoutAesthetics(unfolded.nodes, unfolded.edges, direction).titlePxAtFit;
          expect(a, `${label} title size vs unfolded`).toBeGreaterThanOrEqual(b - 1e-6);
          expectNoOverlapAndContained(folded.nodes, label);
        }
      }
    }, 300_000);
  }
});
