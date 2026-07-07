import type { Node, Edge } from 'reactflow';

export interface EdgeManagementResult {
  nodes: Node[];
  edges: Edge[];
}

const LANE_DEGREE_THRESHOLD = 5;
const BUNDLE_DEGREE_THRESHOLD = 8;

const OUTGOING_LANE_SIDES = ['right', 'bottom', 'top', 'left'] as const;
const INCOMING_LANE_SIDES = ['left', 'top', 'bottom', 'right'] as const;

type GeometrySide = 'right' | 'bottom' | 'top' | 'left';

function computeIdealSide(laneNode: Node, otherNode: Node): GeometrySide {
  const lCx = laneNode.position.x + (laneNode.width ?? 180) / 2;
  const lCy = laneNode.position.y + (laneNode.height ?? 70) / 2;
  const oCx = otherNode.position.x + (otherNode.width ?? 180) / 2;
  const oCy = otherNode.position.y + (otherNode.height ?? 70) / 2;
  const dx = oCx - lCx;
  const dy = oCy - lCy;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  } else {
    return dy >= 0 ? 'bottom' : 'top';
  }
}

function assignGeometrySides(
  laneNodeId: string,
  connectedEdges: Edge[],
  nodes: Node[],
  isOutgoing: boolean,
  defaultCycle: string[]
): string[] {
  if (connectedEdges.length === 0) return [];

  const laneNode = nodes.find(n => n.id === laneNodeId);
  if (!laneNode) return connectedEdges.map((_, i) => defaultCycle[i % defaultCycle.length]);

  const allSides: GeometrySide[] = ['right', 'bottom', 'top', 'left'];

  // Compute ideal side for each edge based on relative node positions
  const idealSides: GeometrySide[] = connectedEdges.map(edge => {
    const otherNodeId = isOutgoing ? edge.target : edge.source;
    const otherNode = nodes.find(n => n.id === otherNodeId);
    if (!otherNode) return defaultCycle[0] as GeometrySide;
    return computeIdealSide(laneNode, otherNode);
  });

  // First pass: assign ideal sides, capping at 1 per side
  const counts: Record<GeometrySide, number> = { right: 0, bottom: 0, top: 0, left: 0 };
  const result: GeometrySide[] = new Array(connectedEdges.length);
  const pool: number[] = [];

  for (let i = 0; i < idealSides.length; i++) {
    const side = idealSides[i];
    if (counts[side] < 1) {
      result[i] = side;
      counts[side]++;
    } else {
      pool.push(i);
    }
  }

  // Second pass: distribute pooled edges round-robin with dynamic cap
  const cap = Math.ceil(connectedEdges.length / 4);
  let si = 0;
  for (const idx of pool) {
    while (true) {
      const side = allSides[si % allSides.length];
      si++;
      if (counts[side] < cap) {
        result[idx] = side;
        counts[side]++;
        break;
      }
    }
  }

  return result;
}

export function processEdgeManagement(nodes: Node[], edges: Edge[]): EdgeManagementResult {
  const nodeDegrees = new Map<string, number>();
  for (const edge of edges) {
    nodeDegrees.set(edge.source, (nodeDegrees.get(edge.source) || 0) + 1);
    nodeDegrees.set(edge.target, (nodeDegrees.get(edge.target) || 0) + 1);
  }

  const denseNodes = new Set<string>();
  const laneNodes = new Set<string>();
  for (const [nid, deg] of nodeDegrees) {
    if (deg > BUNDLE_DEGREE_THRESHOLD) {
      denseNodes.add(nid);
    } else if (deg >= LANE_DEGREE_THRESHOLD) {
      laneNodes.add(nid);
    }
  }

  if (denseNodes.size === 0 && laneNodes.size === 0) {
    return { nodes, edges };
  }

  const nodeParents = new Map<string, string>();
  const parentGroups = new Map<string, Node>();

  for (const node of nodes) {
    const isGroup = node.type === 'groupNode' || (node.data as any)?.isGroup === true;
    if (isGroup) {
      parentGroups.set(node.id, node);
    }
    const pId = node.parentId || (node as any).parentNode;
    if (pId) {
      nodeParents.set(node.id, pId);
    }
  }

  // Precompute geometry-aware lane-side assignments for each lane node
  const laneOutAssignments = new Map<string, string[]>();
  const laneInAssignments = new Map<string, string[]>();
  for (const nid of laneNodes) {
    const outgoing = edges.filter(e => e.source === nid);
    const incoming = edges.filter(e => e.target === nid);
    laneOutAssignments.set(nid, assignGeometrySides(nid, outgoing, nodes, true, [...OUTGOING_LANE_SIDES]));
    laneInAssignments.set(nid, assignGeometrySides(nid, incoming, nodes, false, [...INCOMING_LANE_SIDES]));
  }

  const finalEdges: Edge[] = [];
  const bundleGroups = new Map<string, Edge[]>();

  for (const edge of edges) {
    const edgeData = (edge.data as Record<string, unknown>) || {};
    const importance = (edgeData.importance as string) || 'secondary';
    const isPrimary = importance === 'primary';
    const isResponseEdge = !!(edgeData.responseLabel || edgeData.isReturn);
    const connectsDense = denseNodes.has(edge.source) || denseNodes.has(edge.target);
    const connectsLane = laneNodes.has(edge.source) || laneNodes.has(edge.target);

    if (isPrimary || isResponseEdge) {
      finalEdges.push(edge);
      continue;
    }

    if (!connectsDense && !connectsLane) {
      finalEdges.push(edge);
      continue;
    }

    // Dense nodes (>8 degree): bundle related edges
    if (connectsDense) {
      const targetParent = nodeParents.get(edge.target) || 'root';
      const sourceParent = nodeParents.get(edge.source) || 'root';
      const portType = edgeData.portType || 'outbound';
      const key = denseNodes.has(edge.source)
        ? `dense-out-${edge.source}-${targetParent}-${portType}`
        : `dense-in-${sourceParent}-${edge.target}-${portType}`;
      if (!bundleGroups.has(key)) {
        bundleGroups.set(key, []);
      }
      bundleGroups.get(key)!.push(edge);
      continue;
    }

    // Lane nodes (5-8 degree): distribute individual edges across different
    // handle sides instead of bundling. Compute round-robin side assignment.
    const updatedData: Record<string, unknown> = { ...edgeData };

    if (laneNodes.has(edge.source)) {
      const outgoing = edges.filter(e => e.source === edge.source);
      const idx = outgoing.findIndex(e => e.id === edge.id);
      const sides = laneOutAssignments.get(edge.source)!;
      if (idx >= 0 && idx < sides.length) {
        updatedData.laneSourceSide = sides[idx];
      }
    }
    if (laneNodes.has(edge.target)) {
      const incoming = edges.filter(e => e.target === edge.target);
      const idx = incoming.findIndex(e => e.id === edge.id);
      const sides = laneInAssignments.get(edge.target)!;
      if (idx >= 0 && idx < sides.length) {
        updatedData.laneTargetSide = sides[idx];
      }
    }

    finalEdges.push({
      ...edge,
      data: updatedData as any,
      style: undefined,
    });
  }

  // Resolve dense node bundles
  for (const [key, group] of bundleGroups) {
    if (group.length <= 1) {
      finalEdges.push(...group);
      continue;
    }

    const rep = group[0];
    const targetParent = nodeParents.get(rep.target);
    const targetParentLabel = targetParent ? parentGroups.get(targetParent)?.data?.label as string : null;
    const groupName = targetParentLabel ? `to ${targetParentLabel}` : '';

    const flowLabels = group
      .map(e => e.data?.label || e.label || 'request')
      .filter(Boolean)
      .slice(0, 2);

    const bundleLabel = `${flowLabels.join(' / ')} ${groupName} (${group.length} flows)`;

    const bundleEdge: Edge = {
      ...rep,
      id: `bundle-${rep.source}-${rep.target}-${key}`,
      label: bundleLabel,
      animated: true,
      data: {
        ...rep.data,
        label: bundleLabel,
        isBundle: true,
        isDenseBundle: true,
        bundledEdges: group,
        importance: 'secondary',
      },
      style: {
        ...rep.style,
        strokeWidth: 3.5,
        stroke: '#4f46e5',
        strokeDasharray: '0',
      },
    };

    finalEdges.push(bundleEdge);
  }

  return { nodes, edges: finalEdges };
}
