import type { CSSProperties } from 'react';
import type { Edge, Node } from 'reactflow';
import { recomputeSubgraphBounds } from './recomputeSubgraphBounds';

/**
 * Merge a freshly laid-out Mermaid graph into an existing canvas while keeping
 * the user's layout: existing leaf nodes keep their absolute positions and
 * sizes, new leaves are shifted into the existing coordinate space (by the
 * average offset of matched nodes), and group bounds are recomputed around
 * their children. Shared by the Mermaid code panel and live-project publishes.
 */

export interface MergedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  width: number;
  height: number;
  style?: CSSProperties;
  zIndex?: number;
  absX: number;
  absY: number;
  isGroup: boolean;
  parentId?: string;
  parentNode?: string;
  extent?: 'parent' | [[number, number], [number, number]];
}

export interface MergePreservingLayoutOptions {
  /** Direction changed: take the fresh layout wholesale. */
  directionChanged?: boolean;
  /** Push new leaves down until they don't overlap other leaves. */
  avoidOverlap?: boolean;
}

type AnyNode = Node & { parentNode?: string };

const OVERLAP_GAP = 40;
const MAX_OVERLAP_STEPS = 60;

function absPosition(nodes: AnyNode[], nodeId: string) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node?.position) return null;
  let x = node.position.x;
  let y = node.position.y;
  // Walk the full parent chain — summing only the direct parent misses
  // grandparent offsets on 2+-level nested groups.
  let currentParent = node.parentNode;
  const seen = new Set<string>([node.id]);
  while (currentParent && !seen.has(currentParent)) {
    seen.add(currentParent);
    const parent = nodes.find((p) => p.id === currentParent);
    if (!parent?.position) break;
    x += parent.position.x;
    y += parent.position.y;
    currentParent = parent.parentNode;
  }
  return { x, y };
}

function isGroupNode(node: AnyNode) {
  return node.type === 'groupNode' || Boolean((node.data as { isGroup?: boolean } | undefined)?.isGroup);
}

function overlaps(a: MergedNode, b: MergedNode) {
  return (
    a.absX < b.absX + b.width + OVERLAP_GAP &&
    a.absX + a.width + OVERLAP_GAP > b.absX &&
    a.absY < b.absY + b.height + OVERLAP_GAP &&
    a.absY + a.height + OVERLAP_GAP > b.absY
  );
}

/** Move each new leaf down past any leaf it overlaps (existing leaves never move). */
function separateNewLeaves(leaves: MergedNode[], newIds: Set<string>) {
  const placed = leaves.filter((n) => !newIds.has(n.id));
  for (const leaf of leaves) {
    if (!newIds.has(leaf.id)) continue;
    for (let step = 0; step < MAX_OVERLAP_STEPS; step++) {
      const hit = placed.find((other) => overlaps(leaf, other));
      if (!hit) break;
      leaf.absY = hit.absY + hit.height + OVERLAP_GAP;
    }
    placed.push(leaf);
  }
}

export function mergePreservingLayout(
  existingNodes: Node[],
  laidOut: { nodes: Node[]; edges: Edge[] },
  options: MergePreservingLayoutOptions = {},
): { nodes: MergedNode[]; edges: Edge[] } {
  const existing = existingNodes as AnyNode[];
  const parsed = laidOut.nodes as AnyNode[];
  const directionChanged = Boolean(options.directionChanged);

  // Average offset of matched leaves maps the fresh layout into the canvas's space.
  let sumDeltaX = 0;
  let sumDeltaY = 0;
  let matchedCount = 0;
  for (const node of parsed) {
    if (isGroupNode(node)) continue;
    const existingAbs = absPosition(existing, node.id);
    const parsedAbs = absPosition(parsed, node.id);
    if (existingAbs && parsedAbs) {
      sumDeltaX += existingAbs.x - parsedAbs.x;
      sumDeltaY += existingAbs.y - parsedAbs.y;
      matchedCount++;
    }
  }
  const avgDeltaX = matchedCount > 0 ? sumDeltaX / matchedCount : 0;
  const avgDeltaY = matchedCount > 0 ? sumDeltaY / matchedCount : 0;

  const leaves = new Map<string, MergedNode>();
  const subgraphs = new Map<string, MergedNode>();
  const newLeafIds = new Set<string>();

  for (const node of parsed) {
    const isGroup = isGroupNode(node);
    const existingNode = existing.find((n) => n.id === node.id);
    const preserveNode = existingNode && !isGroup && !directionChanged;

    let absX = 0;
    let absY = 0;
    const parsedAbs = absPosition(parsed, node.id);
    if (parsedAbs) {
      absX = parsedAbs.x;
      absY = parsedAbs.y;
    }

    if (preserveNode) {
      const existingAbs = absPosition(existing, node.id);
      if (existingAbs) {
        absX = existingAbs.x;
        absY = existingAbs.y;
      }
    } else if (!isGroup) {
      absX += avgDeltaX;
      absY += avgDeltaY;
      if (!existingNode) newLeafIds.add(node.id);
    }

    const labelChanged = existingNode && (
      node.data?.label !== existingNode.data?.label ||
      node.data?.subtitle !== existingNode.data?.subtitle
    );
    const keepSize = preserveNode && !labelChanged;

    const merged: MergedNode = {
      id: node.id,
      type: isGroup ? 'groupNode' : (existingNode?.type || 'shapeNode'),
      position: directionChanged ? { ...node.position } : { x: absX, y: absY },
      data: {
        ...(existingNode?.data || {}),
        ...node.data,
        ...(existingNode?.data?.iconSource === 'manual' && existingNode.data.icon
          ? { icon: existingNode.data.icon, iconSource: 'manual' }
          : {}),
      },
      width: keepSize ? (existingNode.width ?? node.width ?? 100) : (node.width ?? 100),
      height: keepSize ? (existingNode.height ?? node.height ?? 60) : (node.height ?? 60),
      style: keepSize
        ? (existingNode.style ? { ...existingNode.style } : (node.style ? { ...node.style } : undefined))
        : (node.style ? { ...node.style } : undefined),
      zIndex: node.zIndex,
      absX,
      absY,
      isGroup,
    };

    if (node.parentNode && parsed.some((n) => n.id === node.parentNode)) {
      merged.parentId = node.parentNode;
      merged.parentNode = node.parentNode;
      merged.extent = 'parent';
    }

    (isGroup ? subgraphs : leaves).set(node.id, merged);
  }

  if (!directionChanged && options.avoidOverlap) {
    separateNewLeaves(Array.from(leaves.values()), newLeafIds);
  }

  const childIdsByParent = new Map<string, string[]>();
  if (!directionChanged && subgraphs.size > 0) {
    for (const node of [...leaves.values(), ...subgraphs.values()]) {
      if (node.parentNode && subgraphs.has(node.parentNode)) {
        const list = childIdsByParent.get(node.parentNode) ?? [];
        list.push(node.id);
        childIdsByParent.set(node.parentNode, list);
      }
    }
    recomputeSubgraphBounds([...subgraphs.values(), ...leaves.values()]);
  }

  if (!directionChanged) {
    for (const node of leaves.values()) {
      if (!node.parentNode) node.position = { x: node.absX, y: node.absY };
    }
    for (const subgraph of subgraphs.values()) {
      if ((childIdsByParent.get(subgraph.id) ?? []).length > 0) continue;
      const existingNode = existing.find((n) => n.id === subgraph.id);
      if (existingNode?.position) {
        subgraph.position = { ...existingNode.position };
        subgraph.width = existingNode.width ?? subgraph.width;
        subgraph.height = existingNode.height ?? subgraph.height;
        subgraph.style = existingNode.style;
      } else {
        subgraph.position = { x: subgraph.absX, y: subgraph.absY };
      }
    }
  }

  const edges = laidOut.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: 'simpleFloating',
    label: edge.label,
    data: edge.data,
    animated: edge.animated,
  })) as Edge[];

  return { nodes: [...subgraphs.values(), ...leaves.values()], edges };
}
