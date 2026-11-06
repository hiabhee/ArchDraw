import { describe, expect, it } from 'vitest';
import { checkRawGraph, MAX_RAW_NODES, RAW_NODE_TYPES } from '../rawGraphGuard';

const node = (id: string, extra: Record<string, unknown> = {}) => ({ id, type: 'shapeNode', position: { x: 0, y: 0 }, width: 200, height: 90, data: { label: id }, ...extra });

describe('checkRawGraph', () => {
  it('accepts what the drawing tool sends', () => {
    const nodes = [node('a'), node('t', { type: 'textLabelNode' }), node('n', { type: 'annotationNode' }), node('g', { type: 'groupNode' })];
    expect(checkRawGraph(nodes, [{ id: 'e', source: 'a', target: 't' }])).toBeNull();
    expect(checkRawGraph([], [])).toBeNull();
  });

  it('accepts every type the canvas registers and nothing else', () => {
    for (const type of RAW_NODE_TYPES) expect(checkRawGraph([node('a', { type })], [])).toBeNull();
    expect(checkRawGraph([node('a', { type: 'scriptNode' })], [])).toMatch(/unsupported type/);
    expect(checkRawGraph([node('a', { type: undefined })], [])).toMatch(/unsupported type/);
  });

  it('rejects malformed nodes', () => {
    expect(checkRawGraph(['nope'], [])).toMatch(/object/);
    expect(checkRawGraph([node('')], [])).toMatch(/id/);
    expect(checkRawGraph([node('a'), node('a')], [])).toMatch(/Duplicate node/);
    expect(checkRawGraph([node('a', { position: { x: NaN, y: 0 } })], [])).toMatch(/position/);
    expect(checkRawGraph([node('a', { position: { x: 1e9, y: 0 } })], [])).toMatch(/position/);
    expect(checkRawGraph([node('a', { position: undefined })], [])).toMatch(/position/);
    expect(checkRawGraph([node('a', { width: -5 })], [])).toMatch(/size/);
    expect(checkRawGraph([node('a', { width: 1e9 })], [])).toMatch(/size/);
    expect(checkRawGraph([node('a', { data: 'x' })], [])).toMatch(/data/);
  });

  it('rejects malformed connections', () => {
    const nodes = [node('a'), node('b')];
    expect(checkRawGraph(nodes, [{ id: 'e', source: 'a', target: 'ghost' }])).toMatch(/does not exist/);
    expect(checkRawGraph(nodes, [{ id: 'e', source: 'a' }])).toMatch(/string id/);
    expect(checkRawGraph(nodes, [{ id: 'e', source: 'a', target: 'b' }, { id: 'e', source: 'b', target: 'a' }])).toMatch(/Duplicate connection/);
  });

  it('bounds the size of a canvas', () => {
    const many = Array.from({ length: MAX_RAW_NODES + 1 }, (_, i) => node(`n${i}`));
    expect(checkRawGraph(many, [])).toMatch(/at most/);
    expect(checkRawGraph([node('a', { data: { label: 'x'.repeat(2_100_000) } })], [])).toMatch(/too large/);
  });
});
