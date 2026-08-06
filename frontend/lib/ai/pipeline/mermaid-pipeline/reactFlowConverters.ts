import type { ReactFlowNode, ReactFlowEdge, LayerType, ServiceType } from '../../types';
import type { RFNode, RFEdge } from '@/lib/mermaid/types';

export function toReactFlowNode(n: RFNode): ReactFlowNode {
  const parentId = n.parentNode || (n.data?.parentId as string | undefined);
  return {
    id: n.id,
    type: n.type,
    position: n.position,
    parentId,
    data: {
      label: (n.data?.label as string) || n.id,
      icon: (n.data?.icon as string) || '',
      layer: (n.data?.layer as LayerType) || 'application',
      layerIndex: n.data?.layerIndex as number | undefined,
      isGroup: n.data?.isGroup as boolean | undefined,
      parentId,
      groupLabel: n.data?.groupLabel as string | undefined,
      groupColor: n.data?.groupColor as string | undefined,
      serviceType: n.data?.serviceType as ServiceType | undefined,
      tier: n.data?.tier as string | undefined,
    },
    extent: n.extent,
    width: n.width,
    height: n.height,
    measured: n.width && n.height ? { width: n.width, height: n.height } : undefined,
    style: n.style as ReactFlowNode['style'],
    zIndex: n.zIndex,
  };
}

export function toReactFlowEdge(e: RFEdge): ReactFlowEdge {
  const d = (e.data || {}) as Record<string, unknown>;
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: (e.sourceHandle as ReactFlowEdge['sourceHandle']) || null,
    targetHandle: (e.targetHandle as ReactFlowEdge['targetHandle']) || null,
    type: e.type || 'default',
    animated: e.animated || false,
    label: e.label || '',
    labelShowBg: (d.labelShowBg as boolean) || false,
    labelBgPadding: (d.labelBgPadding as [number, number]) || [8, 4],
    labelBgBorderRadius: (d.labelBgBorderRadius as number) || 4,
    labelBgStyle: (d.labelBgStyle as ReactFlowEdge['labelBgStyle']) || { fill: '#ffffff' },
    labelStyle: (d.labelStyle as ReactFlowEdge['labelStyle']) || { fontSize: 12, fontWeight: 400, fill: '#64748b' },
    style: (d.style as ReactFlowEdge['style']) || { stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: 'none' },
    markerEnd: (d.markerEnd as ReactFlowEdge['markerEnd']) || { type: 'arrowclosed', color: '#94a3b8' },
    data: {
      communicationType: (d.communicationType as ReactFlowEdge['data']['communicationType']) || 'sync',
      pathType: (d.pathType as ReactFlowEdge['data']['pathType']) || 'straight',
      label: e.label || '',
      edgeVariant: d.edgeVariant as ReactFlowEdge['data']['edgeVariant'],
      labelX: d.labelX as number | undefined,
      labelY: d.labelY as number | undefined,
      labelAngle: d.labelAngle as number | undefined,
      waypoints: d.waypoints as ReactFlowEdge['data']['waypoints'],
    },
  };
}

/** Strip parent references that point at missing nodes after materialize. */
export function toReactFlowNodeSafe(n: RFNode, validNodeIds: Set<string>): ReactFlowNode {
  const parentId = n.parentNode || (n.data?.parentId as string | undefined);
  const isValidParent = parentId && validNodeIds.has(parentId);
  const result = toReactFlowNode(n);
  if (!isValidParent) {
    result.parentId = undefined;
    result.extent = undefined;
  }
  return result;
}
