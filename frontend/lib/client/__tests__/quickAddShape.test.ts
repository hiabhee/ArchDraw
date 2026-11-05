import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node } from 'reactflow';
import { reactFlowRef } from '../reactFlowRef';
import { quickAddShape } from '../quickAddShape';

type Fake = {
  nodes: Node[];
  edges: never[];
  selectedNodeIds: string[];
  selectedNodeId: string | null;
  pushHistory: ReturnType<typeof vi.fn>;
  appendNode: (n: Node) => void;
  setNodes: (n: Node[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
};

function fakeStore(nodes: Node[] = [], selected: string[] = []): Fake {
  const state: Fake = {
    nodes,
    edges: [],
    selectedNodeIds: selected,
    selectedNodeId: selected[0] ?? null,
    pushHistory: vi.fn(),
    appendNode: (n) => { state.nodes = [...state.nodes, n]; },
    setNodes: (n) => { state.nodes = n; },
    setSelectedNodeId: (id) => { state.selectedNodeId = id; },
    setSelectedNodeIds: (ids) => { state.selectedNodeIds = ids; },
  };
  return state;
}

const anchor = { id: 'a', type: 'shapeNode', position: { x: 0, y: 0 }, width: 200, height: 100, data: {} } as Node;
const CENTRE = { x: 1000, y: 1000 };

describe('quickAddShape', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reactFlowRef.instance = null;
  });
  afterEach(() => {
    vi.useRealTimers();
    reactFlowRef.instance = null;
  });

  it('places the node beside the selected one, selects it and remembers the side', () => {
    const store = fakeStore([anchor], ['a']);
    const memory = quickAddShape({ getStore: () => store as never, shape: 'rounded-rectangle', memory: null, viewportCenter: CENTRE });
    const added = store.nodes[1];
    expect(store.pushHistory).toHaveBeenCalledTimes(1);
    expect(added.position.x).toBe(200 + 80);
    // Vertically centred on the anchor (centre y 50).
    expect(added.position.y + (added.height ?? 0) / 2).toBe(50);
    expect(store.selectedNodeId).toBe(added.id);
    expect(store.selectedNodeIds).toEqual([added.id]);
    expect(memory).toEqual({ nodeId: added.id, side: 'right' });
  });

  it('uses the viewport centre when nothing is selected, and remembers nothing', () => {
    const store = fakeStore([]);
    const memory = quickAddShape({ getStore: () => store as never, shape: 'rounded-rectangle', memory: null, viewportCenter: CENTRE });
    const added = store.nodes[0];
    expect(added.position.x + (added.width ?? 0) / 2).toBe(CENTRE.x);
    expect(added.position.y + (added.height ?? 0) / 2).toBe(CENTRE.y);
    expect(memory).toBeNull();
  });

  it('keeps the planned centre once the node is drawn at a different size', () => {
    const store = fakeStore([anchor], ['a']);
    quickAddShape({ getStore: () => store as never, shape: 'rounded-rectangle', memory: null, viewportCenter: CENTRE });
    const added = store.nodes[1];
    const planned = { w: added.width ?? 0, h: added.height ?? 0 };
    const startX = added.position.x;
    const startY = added.position.y;
    // React Flow reports the node 40px wider and 20px taller than planned.
    reactFlowRef.instance = {
      getNodes: () => [],
      getNode: (id: string) => (id === added.id ? { id, width: planned.w + 40, height: planned.h + 20 } : undefined),
    } as never;
    vi.advanceTimersByTime(300);
    const moved = store.nodes[1];
    expect(moved.position.x).toBe(startX - 20);
    expect(moved.position.y).toBe(startY - 10);
    // Applied once: later frames see the same size and do not shift it again.
    vi.advanceTimersByTime(300);
    expect(store.nodes[1].position).toEqual(moved.position);
  });

  it('leaves the node alone when it is drawn at the planned size', () => {
    const store = fakeStore([anchor], ['a']);
    quickAddShape({ getStore: () => store as never, shape: 'rounded-rectangle', memory: null, viewportCenter: CENTRE });
    const added = store.nodes[1];
    const start = { ...added.position };
    reactFlowRef.instance = {
      getNodes: () => [],
      getNode: (id: string) => ({ id, width: added.width, height: added.height }),
    } as never;
    vi.advanceTimersByTime(300);
    expect(store.nodes[1].position).toEqual(start);
  });
});
