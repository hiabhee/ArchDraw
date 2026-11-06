import { describe, expect, it } from 'vitest';
import { searchColumnOrder } from '../layout/columnOrder';
import { symmetrizeFans } from '../layout/symmetry';
import { measureLayoutResult } from '../layout/layoutAesthetics';
import type { LayoutParams, LayoutResult } from '../layout/LayoutEngine';
import { randomDiagram } from './fixtures/randomDiagrams';

const W = 200;
const H = 100;
const GAP = 40;

/** A plain layered placement of a random diagram: column = longest path from a source, rows stacked in id order. */
function layered(seed: number): { params: LayoutParams; result: LayoutResult } {
  const diagram = randomDiagram(seed, { density: 'sparse' });
  const depth = new Map<string, number>(diagram.nodes.map(node => [node.id, 0]));
  for (let pass = 0; pass < diagram.nodes.length; pass++) {
    for (const edge of diagram.edges) depth.set(edge.target, Math.max(depth.get(edge.target)!, depth.get(edge.source)! + 1));
  }
  const rows = new Map<number, number>();
  const nodes = diagram.nodes.map(node => {
    const column = depth.get(node.id)!;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return { id: node.id, width: W, height: H, x: column * 400, y: row * (H + GAP) };
  });
  const params: LayoutParams = {
    nodes: nodes.map(({ id, width, height }) => ({ id, width, height })),
    edges: diagram.edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target })),
    direction: 'LR',
  };
  return { params, result: { nodes, edges: [], warnings: [] } };
}

function crossings(result: LayoutResult, params: LayoutParams): number {
  const byId = new Map(result.nodes.map(node => [node.id, node]));
  let count = 0;
  for (let i = 0; i < params.edges.length; i++) {
    for (let j = i + 1; j < params.edges.length; j++) {
      const a = params.edges[i], b = params.edges[j];
      if (a.source === b.source || a.target === b.target) continue;
      const sa = byId.get(a.source)!, sb = byId.get(b.source)!, ta = byId.get(a.target)!, tb = byId.get(b.target)!;
      if (Math.abs(sa.x - sb.x) > 40 || Math.abs(ta.x - tb.x) > 40) continue;
      if ((sa.y - sb.y) * (ta.y - tb.y) < 0) count++;
    }
  }
  return count;
}

describe('searchColumnOrder', () => {
  it('leaves an already orderly layout untouched', () => {
    // A root centred on two children, each centred on two leaves: nothing to repair.
    const nodes = [
      { id: 'r', width: W, height: H, x: 0, y: 300 },
      { id: 'a', width: W, height: H, x: 400, y: 150 },
      { id: 'b', width: W, height: H, x: 400, y: 450 },
      { id: 'a1', width: W, height: H, x: 800, y: 50 },
      { id: 'a2', width: W, height: H, x: 800, y: 250 },
      { id: 'b1', width: W, height: H, x: 800, y: 350 },
      { id: 'b2', width: W, height: H, x: 800, y: 550 },
    ];
    const params: LayoutParams = {
      nodes: nodes.map(({ id, width, height }) => ({ id, width, height })),
      edges: [['r', 'a'], ['r', 'b'], ['a', 'a1'], ['a', 'a2'], ['b', 'b1'], ['b', 'b2']].map(([source, target], i) => ({ id: `e${i}`, source, target })),
      direction: 'LR',
    };
    const base: LayoutResult = { nodes, edges: [], warnings: [] };
    expect(searchColumnOrder(base, params, symmetrizeFans)).toBe(base);
  });

  it('never adds a crossing, loses a node, or overlaps two nodes, whatever the diagram', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { params, result } = layered(seed);
      const start = symmetrizeFans(result, params);
      const after = searchColumnOrder(start, params, symmetrizeFans);

      expect(after.nodes.map(node => node.id).sort(), `seed ${seed} keeps every node`).toEqual(start.nodes.map(node => node.id).sort());
      expect(crossings(after, params), `seed ${seed} crossings`).toBeLessThanOrEqual(crossings(start, params));
      for (let i = 0; i < after.nodes.length; i++) {
        for (let j = i + 1; j < after.nodes.length; j++) {
          const a = after.nodes[i], b = after.nodes[j];
          const overlap = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
          expect(overlap, `seed ${seed}: ${a.id} overlaps ${b.id}`).toBe(false);
        }
      }
    }
  });

  it('is deterministic', () => {
    const { params, result } = layered(7);
    const start = symmetrizeFans(result, params);
    const first = searchColumnOrder(start, params, symmetrizeFans);
    const second = searchColumnOrder(start, params, symmetrizeFans);
    expect(second.nodes).toEqual(first.nodes);
  });

  it('does not make the worst fan miss worse than the symmetry pass alone on the same diagrams, on average', () => {
    let before = 0;
    let after = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { params, result } = layered(seed);
      const start = symmetrizeFans(result, params);
      before += measureLayoutResult(start, params).fanErrorTotal;
      after += measureLayoutResult(searchColumnOrder(start, params, symmetrizeFans), params).fanErrorTotal;
    }
    expect(after).toBeLessThanOrEqual(before);
  });
});
