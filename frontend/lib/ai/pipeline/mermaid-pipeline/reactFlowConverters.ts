import type { ReactFlowNode, ReactFlowEdge, LayerType, ServiceType } from '../../types';
import type { RFNode, RFEdge } from '@/lib/mermaid/types';

/**
 * Map Mermaid-pipeline RF nodes into the AI pipeline's React Flow shape.
 * Preserve buildReactFlow data (shape, color, category, typeId, …) — stripping
 * those fields leaves the Node Info sidebar on defaults and breaks silhouettes.
 */
export function toReactFlowNode(n: RFNode): ReactFlowNode {
  const parentId = n.parentNode || (n.data?.parentId as string | undefined);
  const raw = (n.data || {}) as Record<string, unknown>;
  return {
    id: n.id,
    type: n.type,
    position: n.position,
    parentId,
    // React Flow v11 still reads parentNode in some paths; keep both in sync.
    ...(parentId ? { parentNode: parentId } : {}),
    data: {
      ...raw,
      label: (typeof raw.label === 'string' && raw.label) || n.id,
      icon: (typeof raw.icon === 'string' && raw.icon) || '',
      layer: (raw.layer as LayerType) || 'application',
      layerIndex: raw.layerIndex as number | undefined,
      isGroup: raw.isGroup as boolean | undefined,
      parentId,
      groupLabel: raw.groupLabel as string | undefined,
      groupColor: raw.groupColor as string | undefined,
      serviceType: raw.serviceType as ServiceType | undefined,
      tier: raw.tier as string | undefined,
      // Explicit mirrors so Node Info / ShapeNode keep working even if callers
      // only read these keys (not a generic index signature).
      shape: raw.shape as string | undefined,
      color: raw.color as string | undefined,
      accentColor: raw.accentColor as string | undefined,
      category: raw.category as string | undefined,
      componentType: (raw.componentType as string | undefined) || (raw.typeId as string | undefined) || (raw.serviceType as string | undefined),
      typeId: raw.typeId as string | undefined,
      subtitle: raw.subtitle as string | undefined,
      sublabel: (raw.sublabel as string | undefined) || (raw.subtitle as string | undefined),
      technology: raw.technology as string | undefined,
      tech: (raw.tech as string | undefined) || (raw.technology as string | undefined),
      iconSource: raw.iconSource as string | undefined,
      nodeWidth: raw.nodeWidth as number | undefined,
      nodeHeight: raw.nodeHeight as number | undefined,
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
  const edgeVariant = d.edgeVariant as ReactFlowEdge['data']['edgeVariant'] | 'thick' | 'bidirectional' | 'invisible' | undefined;
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: (e.sourceHandle as ReactFlowEdge['sourceHandle']) || null,
    targetHandle: (e.targetHandle as ReactFlowEdge['targetHandle']) || null,
    type: e.type || 'simpleFloating',
    animated: e.animated || false,
    label: e.label || '',
    labelShowBg: (d.labelShowBg as boolean) || false,
    labelBgPadding: (d.labelBgPadding as [number, number]) || [8, 4],
    labelBgBorderRadius: (d.labelBgBorderRadius as number) || 4,
    labelBgStyle: (d.labelBgStyle as ReactFlowEdge['labelBgStyle']) || { fill: '#ffffff' },
    labelStyle: (d.labelStyle as ReactFlowEdge['labelStyle']) || { fontSize: 12, fontWeight: 400, fill: '#64748b' },
    style: (d.style as ReactFlowEdge['style']) || { stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: 'none' },
    markerEnd: (e.markerEnd as ReactFlowEdge['markerEnd']) || (d.markerEnd as ReactFlowEdge['markerEnd']) || { type: 'arrowclosed', color: '#94a3b8' },
    markerStart: e.markerStart as ReactFlowEdge['markerEnd'] | undefined,
    hidden: e.hidden as boolean | undefined,
    data: {
      ...d,
      communicationType:
        (d.communicationType as ReactFlowEdge['data']['communicationType']) ||
        (d.syncAsync === 'async' || d.connectionType === 'async' ? 'async' : 'sync'),
      pathType: (d.pathType as ReactFlowEdge['data']['pathType']) || 'straight',
      label: e.label || (d.label as string) || '',
      edgeVariant: edgeVariant as ReactFlowEdge['data']['edgeVariant'],
      labelX: d.labelX as number | undefined,
      labelY: d.labelY as number | undefined,
      labelAngle: d.labelAngle as number | undefined,
      waypoints: d.waypoints as ReactFlowEdge['data']['waypoints'],
      importance: d.importance as string | undefined,
      connectionType: d.connectionType as string | undefined,
      syncAsync: d.syncAsync as string | undefined,
      portType: d.portType as string | undefined,
      protocol: d.protocol as string | undefined,
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
    result.parentNode = undefined;
    result.extent = undefined;
    if (result.data) result.data.parentId = undefined;
  }
  return result;
}
