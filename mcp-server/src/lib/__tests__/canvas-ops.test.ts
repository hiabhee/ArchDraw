import { describe, expect, it } from 'vitest';
import { applyDrawOps, DrawError, type CanvasNode } from '../canvas-ops.js';
import { DrawOpSchema, type DrawOp } from '../schema.js';

const run = (ops: DrawOp[], nodes: CanvasNode[] = [], edges: never[] = []) => applyDrawOps(nodes, edges, ops);
const node = (result: ReturnType<typeof run>, id: string) => result.nodes.find(n => n.id === id)!;

describe('text', () => {
  it('places text at a canvas position with the size the editor reserves', () => {
    const r = run([{ op: 'text', text: 'Hello', x: 100, y: 50, size: 'large', bold: true, color: '#ff0000' }]);
    const t = r.nodes[0];
    expect(t.type).toBe('textLabelNode');
    expect(t.position).toEqual({ x: 100, y: 50 });
    expect(t.data).toMatchObject({ text: 'Hello', fontSize: 'large', bold: true, color: '#ff0000' });
    expect(t.width).toBeGreaterThan(60);
    expect(r.steps[0].ids).toEqual([t.id]);
  });

  it('allows an empty text box to be filled in later', () => {
    const r = run([{ op: 'text', text: '', x: 0, y: 0 }]);
    expect(r.nodes[0].data.text).toBe('');
    expect(r.nodes[0].height).toBeGreaterThanOrEqual(100);
  });
});

describe('card', () => {
  it('makes a blank card to write in, the way a double-click on the canvas does', () => {
    const r = run([{ op: 'card', x: 10, y: 20 }]);
    const c = r.nodes[0];
    expect(c.type).toBe('shapeNode');
    expect(c.data).toMatchObject({ label: '', shape: 'rounded-rectangle' });
    expect(c.data.nodeWidth).toBe(c.width);
    expect(c.data.nodeHeight).toBe(c.height);
  });

  it('takes a title, subtitle, shape and colours', () => {
    const r = run([{ op: 'card', x: 0, y: 0, title: 'Decide', subtitle: 'yes / no', shape: 'diamond', color: '#3b82f6', fill: '#0f172a' }]);
    expect(r.nodes[0].data).toMatchObject({ label: 'Decide', subtitle: 'yes / no', shape: 'diamond', strokeColor: '#3b82f6', fillColor: '#0f172a' });
  });

  it('maps rectangle to the rounded card the editor draws', () => {
    expect(run([{ op: 'card', x: 0, y: 0, shape: 'rectangle' }]).nodes[0].data.shape).toBe('rounded-rectangle');
  });
});

describe('note and component', () => {
  it('makes a note with a title and a body, both optional', () => {
    const r = run([{ op: 'note', x: 0, y: 0, title: 'TODO', body: 'ship it' }, { op: 'note', x: 300, y: 0 }]);
    expect(r.nodes[0]).toMatchObject({ type: 'annotationNode', data: { title: 'TODO', body: 'ship it' } });
    expect(r.nodes[1].data).toMatchObject({ title: '', body: '' });
  });

  it('makes an architecture component coloured by its tier', () => {
    const r = run([{ op: 'component', x: 0, y: 0, label: 'API', tier: 'data', subtitle: 'Postgres' }]);
    expect(r.nodes[0]).toMatchObject({ type: 'systemNode', data: { label: 'API', tier: 'data', subtitle: 'Postgres' } });
  });
});

describe('ids', () => {
  it('generates unique ids and refuses a taken one', () => {
    const r = run([{ op: 'text', text: 'a', x: 0, y: 0 }, { op: 'text', text: 'b', x: 0, y: 0 }]);
    expect(new Set(r.nodes.map(n => n.id)).size).toBe(2);
    expect(() => run([{ op: 'text', id: 'x', text: 'a', x: 0, y: 0 }, { op: 'card', id: 'x', x: 0, y: 0 }])).toThrow(/already used/);
  });
});

describe('group', () => {
  const two = (): DrawOp[] => [
    { op: 'card', id: 'a', x: 100, y: 200, width: 200, height: 80 },
    { op: 'card', id: 'b', x: 400, y: 260, width: 200, height: 80 },
  ];

  it('wraps its children and stores their positions relative to it', () => {
    const r = run([...two(), { op: 'group', id: 'g', label: 'Back end', children: ['a', 'b'] }]);
    const g = node(r, 'g');
    expect(g.position).toEqual({ x: 100 - 28, y: 200 - 48 });
    expect(g.width).toBe(500 + 56);
    expect(node(r, 'a')).toMatchObject({ parentNode: 'g', position: { x: 28, y: 48 } });
    expect(node(r, 'b').position).toEqual({ x: 328, y: 108 });
  });

  it('keeps the group before its children', () => {
    const r = run([...two(), { op: 'group', id: 'g', children: ['a', 'b'] }]);
    const order = r.nodes.map(n => n.id);
    expect(order.indexOf('g')).toBeLessThan(order.indexOf('a'));
    expect(order.indexOf('g')).toBeLessThan(order.indexOf('b'));
  });

  it('can be a fixed frame and take children later by update', () => {
    const r = run([{ op: 'group', id: 'g', x: 0, y: 0, width: 400, height: 300 }, { op: 'card', id: 'a', x: 50, y: 80 }, { op: 'update', id: 'a', parent: 'g' }]);
    expect(node(r, 'a')).toMatchObject({ parentNode: 'g', position: { x: 50, y: 80 } });
    expect(r.nodes.map(n => n.id).indexOf('g')).toBeLessThan(r.nodes.map(n => n.id).indexOf('a'));
  });

  it('needs children or a full frame', () => {
    expect(() => run([{ op: 'group', label: 'empty' }])).toThrow(/children to wrap/);
  });

  it('puts a node inside a group at the canvas position given', () => {
    const r = run([{ op: 'group', id: 'g', x: 200, y: 100, width: 400, height: 300 }, { op: 'text', id: 't', text: 'hi', x: 250, y: 160, parent: 'g' }]);
    expect(node(r, 't').position).toEqual({ x: 50, y: 60 });
  });

  it('refuses a node inside itself', () => {
    expect(() => run([{ op: 'group', id: 'g', x: 0, y: 0, width: 300, height: 300 }, { op: 'group', id: 'h', x: 10, y: 10, width: 100, height: 100 }, { op: 'update', id: 'h', parent: 'g' }, { op: 'update', id: 'g', parent: 'h' }])).toThrow(/inside itself/);
  });
});

describe('connect', () => {
  const pair: DrawOp[] = [{ op: 'card', id: 'a', x: 0, y: 0 }, { op: 'card', id: 'b', x: 400, y: 0 }];

  it('draws a connection with a label and style', () => {
    const r = run([...pair, { op: 'connect', from: 'a', to: 'b', label: 'sends', style: 'dashed', fromSide: 'right', toSide: 'left' }]);
    expect(r.edges[0]).toMatchObject({ source: 'a', target: 'b', type: 'simpleFloating', label: 'sends', animated: true });
    expect(r.edges[0].data).toMatchObject({ edgeVariant: 'dashed', laneSourceSide: 'right', laneTargetSide: 'left' });
  });

  it('points both ways when asked', () => {
    const r = run([...pair, { op: 'connect', from: 'a', to: 'b', arrow: 'both' }]);
    expect((r.edges[0].data as Record<string, unknown>).edgeVariant).toBe('bidirectional');
  });

  it('refuses a missing node, a self-loop and a connection to a group', () => {
    expect(() => run([...pair, { op: 'connect', from: 'a', to: 'nope' }])).toThrow(/no node "nope"/);
    expect(() => run([...pair, { op: 'connect', from: 'a', to: 'a' }])).toThrow(/itself/);
    expect(() => run([...pair, { op: 'group', id: 'g', children: ['a'] }, { op: 'connect', from: 'g', to: 'b' }])).toThrow(/group/);
  });
});

describe('update', () => {
  it('changes only what applies to the kind of node, and says what does not', () => {
    const r = run([{ op: 'text', id: 't', text: 'old', x: 0, y: 0 }, { op: 'update', id: 't', text: 'a longer line of new text', size: 'large' }]);
    expect(node(r, 't').data).toMatchObject({ text: 'a longer line of new text', fontSize: 'large' });
    expect(node(r, 't').width).toBeGreaterThan(300);
    expect(() => run([{ op: 'text', id: 't', text: 'x', x: 0, y: 0 }, { op: 'update', id: 't', fill: '#000000' }])).toThrow(/fill cannot be set on a textLabelNode/);
    expect(() => run([{ op: 'text', id: 't', text: 'x', x: 0, y: 0 }, { op: 'update', id: 't' }])).toThrow(/nothing to change/);
  });

  it('writes into a blank card', () => {
    const r = run([{ op: 'card', id: 'c', x: 0, y: 0 }, { op: 'update', id: 'c', title: 'Filled in', subtitle: 'and more' }]);
    expect(node(r, 'c').data).toMatchObject({ label: 'Filled in', subtitle: 'and more' });
  });

  it('restyles a connection', () => {
    const r = run([{ op: 'card', id: 'a', x: 0, y: 0 }, { op: 'card', id: 'b', x: 400, y: 0 }, { op: 'connect', id: 'e', from: 'a', to: 'b' }, { op: 'update', id: 'e', label: 'now', style: 'thick', color: '#ef4444' }]);
    expect(r.edges[0]).toMatchObject({ label: 'now', style: { stroke: '#ef4444', strokeWidth: 4 } });
  });

  it('moves a node to a canvas position even inside a group', () => {
    const r = run([{ op: 'card', id: 'a', x: 100, y: 100 }, { op: 'group', id: 'g', children: ['a'] }, { op: 'update', id: 'a', x: 500, y: 400 }]);
    const g = node(r, 'g');
    expect(node(r, 'a').position).toEqual({ x: 500 - g.position.x, y: 400 - g.position.y });
  });
});

describe('move, align, distribute', () => {
  const row = (): DrawOp[] => [
    { op: 'card', id: 'a', x: 0, y: 10, width: 100, height: 50 },
    { op: 'card', id: 'b', x: 150, y: 40, width: 100, height: 80 },
    { op: 'card', id: 'c', x: 700, y: 0, width: 100, height: 60 },
  ];

  it('shifts a selection, or puts it at a place', () => {
    const shifted = run([...row(), { op: 'move', ids: ['a', 'b'], dx: 10, dy: -5 }]);
    expect(node(shifted, 'a').position).toEqual({ x: 10, y: 5 });
    expect(node(shifted, 'b').position).toEqual({ x: 160, y: 35 });
    const placed = run([...row(), { op: 'move', ids: ['a', 'b'], x: 1000, y: 1000 }]);
    expect(node(placed, 'a').position).toEqual({ x: 1000, y: 1000 });
    expect(node(placed, 'b').position).toEqual({ x: 1150, y: 1030 });
    expect(() => run([...row(), { op: 'move', ids: ['a'] }])).toThrow(/either dx/);
  });

  it('does not move a child twice when its group moves with it', () => {
    const r = run([{ op: 'card', id: 'a', x: 100, y: 100 }, { op: 'group', id: 'g', children: ['a'] }, { op: 'move', ids: ['g', 'a'], dx: 50, dy: 0 }]);
    expect(node(r, 'a').position).toEqual({ x: 28, y: 48 });
    expect(node(r, 'g').position.x).toBe(72 + 50);
  });

  it('aligns edges and centres', () => {
    expect(node(run([...row(), { op: 'align', ids: ['a', 'b', 'c'], mode: 'top' }]), 'b').position.y).toBe(0);
    expect(node(run([...row(), { op: 'align', ids: ['a', 'b', 'c'], mode: 'left' }]), 'c').position.x).toBe(0);
    expect(node(run([...row(), { op: 'align', ids: ['a', 'b', 'c'], mode: 'right' }]), 'a').position.x).toBe(700);
    const middle = run([...row(), { op: 'align', ids: ['a', 'b'], mode: 'middle' }]);
    expect(node(middle, 'a').position.y + 25).toBeCloseTo(node(middle, 'b').position.y + 40);
  });

  it('spreads evenly between the outermost, or by a fixed gap', () => {
    const even = run([...row(), { op: 'distribute', ids: ['a', 'b', 'c'], axis: 'horizontal' }]);
    expect(node(even, 'a').position.x).toBe(0);
    expect(node(even, 'c').position.x).toBe(700);
    expect(node(even, "b").position.x).toBe(350);
    const fixed = run([...row(), { op: 'distribute', ids: ['a', 'b', 'c'], axis: 'horizontal', gap: 20 }]);
    expect([node(fixed, 'a').position.x, node(fixed, 'b').position.x, node(fixed, 'c').position.x]).toEqual([0, 120, 240]);
  });
});

describe('remove and clear', () => {
  it('removes a node with its connections, and frees the children of a group where they are', () => {
    const r = run([
      { op: 'card', id: 'a', x: 100, y: 100 }, { op: 'card', id: 'b', x: 500, y: 100 },
      { op: 'connect', id: 'e', from: 'a', to: 'b' },
      { op: 'group', id: 'g', children: ['a'] },
      { op: 'remove', ids: ['g'] },
    ]);
    expect(r.nodes.map(n => n.id)).toEqual(['a', 'b']);
    expect(node(r, 'a')).toMatchObject({ position: { x: 100, y: 100 } });
    expect(node(r, 'a').parentNode).toBeUndefined();
    expect(r.edges).toHaveLength(1);
    expect(run([{ op: 'card', id: 'a', x: 0, y: 0 }, { op: 'card', id: 'b', x: 300, y: 0 }, { op: 'connect', id: 'e', from: 'a', to: 'b' }, { op: 'remove', ids: ['a'] }]).edges).toHaveLength(0);
  });

  it('removes a connection by id and refuses an unknown id', () => {
    const r = run([{ op: 'card', id: 'a', x: 0, y: 0 }, { op: 'card', id: 'b', x: 300, y: 0 }, { op: 'connect', id: 'e', from: 'a', to: 'b' }, { op: 'remove', ids: ['e'] }]);
    expect(r.nodes).toHaveLength(2);
    expect(r.edges).toHaveLength(0);
    expect(() => run([{ op: 'remove', ids: ['nothing'] }])).toThrow(DrawError);
  });

  it('starts over on clear and says so', () => {
    const r = run([{ op: 'card', x: 0, y: 0 }, { op: 'clear' }, { op: 'text', text: 'fresh', x: 0, y: 0 }]);
    expect(r.cleared).toBe(true);
    expect(r.nodes).toHaveLength(1);
  });
});

describe('atomic', () => {
  it('names the failing operation and changes nothing in the input', () => {
    const existing: CanvasNode[] = [{ id: 'keep', type: 'shapeNode', position: { x: 1, y: 2 }, data: { label: 'k' } }];
    const before = JSON.stringify(existing);
    try {
      applyDrawOps(existing, [], [{ op: 'card', x: 0, y: 0 }, { op: 'connect', from: 'keep', to: 'missing' }]);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DrawError);
      expect((error as DrawError).index).toBe(1);
      expect((error as Error).message).toMatch(/Operation 2 \(connect\)/);
    }
    expect(JSON.stringify(existing)).toBe(before);
  });

  it('keeps the nodes the canvas already had', () => {
    const existing: CanvasNode[] = [{ id: 'keep', type: 'shapeNode', position: { x: 1, y: 2 }, data: { label: 'k' } }];
    const r = applyDrawOps(existing, [], [{ op: 'text', text: 'new', x: 0, y: 0 }]);
    expect(r.nodes.map(n => n.id)).toContain('keep');
    expect(r.nodes).toHaveLength(2);
  });
});

describe('schema', () => {
  it('rejects bad input before any drawing', () => {
    expect(DrawOpSchema.safeParse({ op: 'text', text: 'x', x: 0 }).success).toBe(false);
    expect(DrawOpSchema.safeParse({ op: 'card', x: 0, y: 0, color: 'red' }).success).toBe(false);
    expect(DrawOpSchema.safeParse({ op: 'card', x: Infinity, y: 0 }).success).toBe(false);
    expect(DrawOpSchema.safeParse({ op: 'card', id: 'has space', x: 0, y: 0 }).success).toBe(false);
    expect(DrawOpSchema.safeParse({ op: 'wiggle' }).success).toBe(false);
    expect(DrawOpSchema.safeParse({ op: 'card', x: 0, y: 0, shape: 'blob' }).success).toBe(false);
  });
});
