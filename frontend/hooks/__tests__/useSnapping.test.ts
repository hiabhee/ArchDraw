import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Node, NodeChange } from 'reactflow';
import { useSnapping } from '../useSnapping';
import { useDiagramStore } from '@/store/diagramStore';

const node = (id: string, x: number, y: number, parentNode?: string): Node => ({
  id, position: { x, y }, width: 100, height: 100, data: {}, parentNode,
});
function load(nodes: Node[]) {
  useDiagramStore.setState({ activeCanvasId: 'snap-test', canvases: [{ id: 'snap-test', name: 'Snap', nodes, edges: [] }] });
}
const move = (id: string, x: number, y: number): NodeChange => ({
  id, type: 'position', position: { x, y }, dragging: true,
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('canvas snapping', () => {
  it('snaps once without mutating incoming positions, and holds the snap on release', () => {
    load([node('a', 0, 0), node('b', 300, 100)]);
    const { result } = renderHook(useSnapping);
    const change = move('a', 0, 96);
    Object.freeze((change as { position: object }).position);
    Object.freeze(change);
    act(() => result.current.onNodesChange([change]));
    expect(useDiagramStore.getState().nodes[0].position).toEqual({ x: 0, y: 100 });
    act(() => result.current.onNodesChange([{ id: 'a', type: 'position', dragging: false, position: { x: 0, y: 96 } }]));
    expect(useDiagramStore.getState().nodes[0].position).toEqual({ x: 0, y: 100 });
    expect(useDiagramStore.getState().nodes[0].dragging).toBe(false);
  });

  it('preserves the offset between nodes dragged together', () => {
    load([node('a', 0, 0), node('b', 120, 0), node('guide', 400, 100)]);
    const { result } = renderHook(useSnapping);
    act(() => result.current.onNodesChange([move('a', 0, 96), move('b', 120, 96)]));
    const [a, b] = useDiagramStore.getState().nodes;
    expect(a.position.y).toBe(100);
    expect(b.position).toEqual({ x: a.position.x + 120, y: a.position.y });
  });

  it('resolves child positions relative to their parent when finding guides', () => {
    load([node('parent', 500, 500), node('child', 0, 0, 'parent'), node('guide', 800, 600)]);
    const { result } = renderHook(useSnapping);
    act(() => result.current.onNodesChange([move('child', 0, 96)]));
    expect(useDiagramStore.getState().nodes[1].position).toEqual({ x: 0, y: 100 });
  });

  it('allows Alt to bypass snapping and resets the modifier on blur', () => {
    load([node('a', 0, 0), node('b', 300, 100)]);
    const { result } = renderHook(useSnapping);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true })));
    act(() => result.current.onNodesChange([move('a', 0, 96)]));
    expect(useDiagramStore.getState().nodes[0].position.y).toBe(96);
    act(() => window.dispatchEvent(new Event('blur')));
    act(() => result.current.onNodesChange([move('a', 0, 96)]));
    expect(useDiagramStore.getState().nodes[0].position.y).toBe(100);
  });
});
