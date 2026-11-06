/**
 * Quick-add (n / d / c / y): put a blank shape next to the node the user is
 * working on, select it, and keep it centred on the spot that was planned once
 * React Flow has measured it. The pure placement rules live in
 * `lib/diagram/geometry/quickAddPlacement.ts`; this file wires them to the store
 * and the React Flow instance.
 */
import { reactFlowRef } from '@/lib/client/reactFlowRef';
import { createBlankShapeNode } from '@/lib/component-library/factory';
import { nodeSize } from '@/lib/diagram/geometry/nodeBox';
import { placeQuickAddNode, type PlacementMemory } from '@/lib/diagram/geometry/quickAddPlacement';
import type { ShapeType } from '@/lib/diagram/nodes/shapeRegistry';
import type { DiagramState } from '@/store/diagram/types';

/** Frames to wait for React Flow to measure the new node before giving up. */
const MEASURE_FRAMES = 8;
const MIN_SHIFT = 0.5;

/**
 * A new node is placed with the factory's size, then drawn at its real size.
 * When the two differ, shift it so its centre stays where the placement put it,
 * so it lines up with the node it was placed beside.
 */
function keepNodeCentred(
  getStore: () => DiagramState,
  nodeId: string,
  planned: { width: number; height: number },
): void {
  // The size the node's current position assumes; updated after each shift.
  let assumed = planned;
  const step = (framesLeft: number) => {
    const drawn = reactFlowRef.instance?.getNode(nodeId);
    if (drawn?.width && drawn?.height) {
      const dx = (assumed.width - drawn.width) / 2;
      const dy = (assumed.height - drawn.height) / 2;
      if (Math.abs(dx) >= MIN_SHIFT || Math.abs(dy) >= MIN_SHIFT) {
        const state = getStore();
        state.setNodes(
          state.nodes.map((n) =>
            n.id === nodeId ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n,
          ),
        );
        assumed = { width: drawn.width, height: drawn.height };
      }
    }
    if (framesLeft > 0) requestAnimationFrame(() => step(framesLeft - 1));
  };
  requestAnimationFrame(() => step(MEASURE_FRAMES));
}

/**
 * Add a blank shape. Returns the memory the next quick-add should use (the new
 * node and the side it went to), or null when it was not placed beside a node.
 */
export function quickAddShape(options: {
  getStore: () => DiagramState;
  shape: ShapeType;
  memory: PlacementMemory | null;
  viewportCenter: { x: number; y: number };
}): PlacementMemory | null {
  const { getStore, shape, memory, viewportCenter } = options;
  const store = getStore();

  const blank = createBlankShapeNode(shape, { x: 0, y: 0 });
  const size = nodeSize(blank);

  // Sizes as drawn, where React Flow has measured them; stored sizes otherwise.
  const drawn = new Map((reactFlowRef.instance?.getNodes() ?? []).map((n) => [n.id, n]));
  const nodes = store.nodes.map((n) => {
    const d = drawn.get(n.id);
    return d?.width && d?.height ? { ...n, width: d.width, height: d.height } : n;
  });

  const placement = placeQuickAddNode({
    nodes,
    edges: store.edges,
    size,
    selectedIds: store.selectedNodeIds,
    primaryId: store.selectedNodeId,
    memory,
    viewportCenter,
  });

  const node = {
    ...blank,
    position: placement.position,
    ...(placement.parentNode ? { parentNode: placement.parentNode } : {}),
  };
  store.pushHistory();
  store.appendNode(node);
  // Select the new node so the next quick-add chains from it.
  store.setSelectedNodeId(node.id);
  store.setSelectedNodeIds([node.id]);
  keepNodeCentred(getStore, node.id, size);

  return placement.side ? { nodeId: node.id, side: placement.side } : null;
}
