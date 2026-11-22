import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import { applyPreviewMoves, previewCopyUrl } from './previewCopy';

const source = '0af78169-b8ae-44e4-a9ff-d8895b78ae93';
const copy = 'a1dd19ae-ae37-4147-b69b-0b69bb6f601c';
const initial: Node[] = [
  { id: 'node / 1', parentNode: 'area', position: { x: 8, y: 12 }, data: { label: 'Node' } },
  { id: 'area', position: { x: 20, y: 0 }, data: {} },
];

describe('saving a preview copy', () => {
  it('restores only the moved positions without changing parent links or node data', () => {
    const nodes = [{ ...initial[0], position: { x: 38.5, y: 65 } }, initial[1]];
    const url = new URL(previewCopyUrl(`https://archdraw.example/share/${source}?style=studio-metallic`, copy, initial, nodes));
    expect(url.pathname).toBe(`/share/${source}/save`);
    expect(url.search).toBe(`?copy=${copy}`);
    expect(JSON.parse(decodeURIComponent(url.hash.slice(1)))).toEqual([['node / 1', 38.5, 65]]);
    expect(applyPreviewMoves(initial, url.hash.slice(1))).toEqual(nodes);
  });

  it('rejects invalid coordinates and stays within the share route', () => {
    expect(() => applyPreviewMoves(initial, encodeURIComponent('[["node / 1",1e20,1]]'))).toThrow();
    expect(previewCopyUrl('https://archdraw.example/editor', copy, initial, initial)).toBe('');
  });
});
