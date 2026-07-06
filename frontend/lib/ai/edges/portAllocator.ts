import type { ArchitectureNode, ArchitectureEdge } from '../types';
import type { TierType } from '../domain/tiers';
import { TIER_ORDER } from '../domain/tiers';

export interface PortAssignment {
  nodeId: string;
  ports: {
    source: string[];
    target: string[];
  };
}

export interface HandlePosition {
  position: 'left' | 'right' | 'top' | 'bottom';
  offset: number;
}

const PORT_POSITIONS: Record<string, HandlePosition[]> = {
  left: [
    { position: 'left', offset: 0.25 },
    { position: 'left', offset: 0.5 },
    { position: 'left', offset: 0.75 },
  ],
  right: [
    { position: 'right', offset: 0.25 },
    { position: 'right', offset: 0.5 },
    { position: 'right', offset: 0.75 },
  ],
  top: [
    { position: 'top', offset: 0.25 },
    { position: 'top', offset: 0.5 },
    { position: 'top', offset: 0.75 },
  ],
  bottom: [
    { position: 'bottom', offset: 0.25 },
    { position: 'bottom', offset: 0.5 },
    { position: 'bottom', offset: 0.75 },
  ],
};

export function allocatePorts(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[]
): Map<string, PortAssignment> {
  const portAssignments = new Map<string, PortAssignment>();

  const outgoingByNode = new Map<string, string[]>();
  const incomingByNode = new Map<string, string[]>();

  for (const edge of edges) {
    if (!outgoingByNode.has(edge.source)) {
      outgoingByNode.set(edge.source, []);
    }
    outgoingByNode.get(edge.source)!.push(edge.id);

    if (!incomingByNode.has(edge.target)) {
      incomingByNode.set(edge.target, []);
    }
    incomingByNode.get(edge.target)!.push(edge.id);
  }

  for (const node of nodes) {
    if (node.isGroup) continue;

    const outCount = outgoingByNode.get(node.id)?.length || 0;
    const inCount = incomingByNode.get(node.id)?.length || 0;

    const tier = (node.tier || node.layer) as TierType;
    const tierIndex = TIER_ORDER.indexOf(tier);

    let sourceSide: 'left' | 'right' | 'top' | 'bottom' = 'right';
    let targetSide: 'left' | 'right' | 'top' | 'bottom' = 'left';

    if (tier === 'data' || tier === 'observe' || tier === 'external') {
      sourceSide = 'left';
      targetSide = 'right';
    } else if (tier === 'client' || tier === 'edge') {
      sourceSide = 'right';
      targetSide = 'left';
    }

    const sourcePorts = allocatePortSide(node.id, sourceSide, outCount);
    const targetPorts = allocatePortSide(node.id, targetSide, inCount);

    portAssignments.set(node.id, {
      nodeId: node.id,
      ports: {
        source: sourcePorts,
        target: targetPorts,
      },
    });
  }

  return portAssignments;
}

function allocatePortSide(
  nodeId: string,
  side: 'left' | 'right' | 'top' | 'bottom',
  count: number
): string[] {
  if (count === 0) {
    return [`${nodeId}-port-${side}-default`];
  }

  const positions = PORT_POSITIONS[side];
  const ports: string[] = [];

  for (let i = 0; i < count; i++) {
    const posIndex = Math.min(i, positions.length - 1);
    const pos = positions[posIndex];
    ports.push(`${nodeId}-port-${side}-${i}`);
  }

  return ports;
}

export function assignHandlesToEdges(
  edges: ArchitectureEdge[],
  nodes: ArchitectureNode[],
  portAssignments: Map<string, PortAssignment>
): ArchitectureEdge[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const outgoingByNode = new Map<string, string[]>();
  const incomingByNode = new Map<string, string[]>();

  for (const edge of edges) {
    if (!outgoingByNode.has(edge.source)) {
      outgoingByNode.set(edge.source, []);
    }
    outgoingByNode.get(edge.source)!.push(edge.id);

    if (!incomingByNode.has(edge.target)) {
      incomingByNode.set(edge.target, []);
    }
    incomingByNode.get(edge.target)!.push(edge.id);
  }

  return edges.map(edge => {
    const sourcePorts = portAssignments.get(edge.source);
    const targetPorts = portAssignments.get(edge.target);

    const sourceIndex = outgoingByNode.get(edge.source)?.indexOf(edge.id) || 0;
    const targetIndex = incomingByNode.get(edge.target)?.indexOf(edge.id) || 0;

    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    // Directional handles: pick the side facing the other node.
    // This matches `getDynamicHandles()` used by `SimpleFloatingEdge`.
    let desiredSource: 'left' | 'right' | 'top' | 'bottom' = 'right';
    let desiredTarget: 'left' | 'right' | 'top' | 'bottom' = 'left';
    if (sourceNode && targetNode) {
      const sx = sourceNode.position?.x ?? 0;
      const sy = sourceNode.position?.y ?? 0;
      const tx = targetNode.position?.x ?? 0;
      const ty = targetNode.position?.y ?? 0;
      const sw = sourceNode.width ?? 180;
      const sh = sourceNode.height ?? 70;
      const tw = targetNode.width ?? 180;
      const th = targetNode.height ?? 70;

      const scx = sx + sw / 2;
      const scy = sy + sh / 2;
      const tcx = tx + tw / 2;
      const tcy = ty + th / 2;

      const dx = tcx - scx;
      const dy = tcy - scy;

      if (dy > 0) {
        desiredSource = 'bottom';
        desiredTarget = 'top';
      } else if (dy < 0) {
        desiredSource = 'top';
        desiredTarget = 'bottom';
      } else {
        if (dx >= 0) {
          desiredSource = 'right';
          desiredTarget = 'left';
        } else {
          desiredSource = 'left';
          desiredTarget = 'right';
        }
      }
    }

    // Our nodes expose handle IDs like `source-right` and `target-left`.
    let sourceHandle = (`source-${desiredSource}`) as unknown as ArchitectureEdge['sourceHandle'];
    let targetHandle = (`target-${desiredTarget}`) as unknown as ArchitectureEdge['targetHandle'];

    // If a port allocator exists, keep it only for fallback (older node types might not expose source-/target- handles).
    if (sourcePorts && (sourceHandle as string).startsWith('source-') === false) {
      const portIndex = Math.min(sourceIndex, sourcePorts.ports.source.length - 1);
      sourceHandle = (sourcePorts.ports.source[portIndex] || 'right') as unknown as ArchitectureEdge['sourceHandle'];
    }
    if (targetPorts && (targetHandle as string).startsWith('target-') === false) {
      const portIndex = Math.min(targetIndex, targetPorts.ports.target.length - 1);
      targetHandle = (targetPorts.ports.target[portIndex] || 'left') as unknown as ArchitectureEdge['targetHandle'];
    }

    return {
      ...edge,
      sourceHandle: sourceHandle as ArchitectureEdge['sourceHandle'],
      targetHandle: targetHandle as ArchitectureEdge['targetHandle'],
    };
  });
}

export function computeOptimalPortSide(
  sourceNode: ArchitectureNode,
  targetNode: ArchitectureNode
): { sourceSide: 'left' | 'right'; targetSide: 'left' | 'right' } {
  const sourceTier = (sourceNode.tier || sourceNode.layer) as TierType;
  const targetTier = (targetNode.tier || targetNode.layer) as TierType;

  const sourceIndex = TIER_ORDER.indexOf(sourceTier);
  const targetIndex = TIER_ORDER.indexOf(targetTier);

  if (targetIndex > sourceIndex) {
    return { sourceSide: 'right', targetSide: 'left' };
  } else if (targetIndex < sourceIndex) {
    return { sourceSide: 'left', targetSide: 'right' };
  }

  const sourceY = sourceNode.position?.y || 0;
  const targetY = targetNode.position?.y || 0;

  if (targetY > sourceY) {
    return { sourceSide: 'right', targetSide: 'left' };
  } else {
    return { sourceSide: 'right', targetSide: 'left' };
  }
}

export function createDistributedPorts(
  nodeId: string,
  side: 'left' | 'right',
  count: number
): Array<{ id: string; offset: number }> {
  if (count === 0) {
    return [{ id: `${nodeId}-port-${side}-default`, offset: 0.5 }];
  }

  if (count === 1) {
    return [{ id: `${nodeId}-port-${side}-0`, offset: 0.5 }];
  }

  if (count === 2) {
    return [
      { id: `${nodeId}-port-${side}-0`, offset: 0.3 },
      { id: `${nodeId}-port-${side}-1`, offset: 0.7 },
    ];
  }

  if (count === 3) {
    return [
      { id: `${nodeId}-port-${side}-0`, offset: 0.25 },
      { id: `${nodeId}-port-${side}-1`, offset: 0.5 },
      { id: `${nodeId}-port-${side}-2`, offset: 0.75 },
    ];
  }

  const ports: Array<{ id: string; offset: number }> = [];
  for (let i = 0; i < count; i++) {
    const offset = (i + 1) / (count + 1);
    ports.push({ id: `${nodeId}-port-${side}-${i}`, offset });
  }

  return ports;
}
