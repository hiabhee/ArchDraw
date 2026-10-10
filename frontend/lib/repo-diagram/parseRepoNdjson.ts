import { MarkerType, type Edge, type Node } from 'reactflow';

export interface ParsedRepoNdjson {
  nodes: Node[];
  edges: Edge[];
  workflows: { name: string; description: string; steps: string[] }[];
}

/**
 * Parse repo-diagram NDJSON into React Flow nodes/edges.
 * Supports group nodes (parentId), workflow annotation lines, and rich edges.
 */
export function parseRepoNdjsonToReactFlow(ndjson: string): ParsedRepoNdjson {
  const rawNodes: Record<string, unknown>[] = [];
  const rawEdges: Record<string, unknown>[] = [];
  const workflows: { name: string; description: string; steps: string[] }[] = [];

  const lines = ndjson.split('\n').filter((line) => line.trim());
  for (const line of lines) {
    if (line.startsWith('```') || line.startsWith('//')) continue;
    try {
      const obj = JSON.parse(line.trim()) as Record<string, unknown>;
      if (obj.type === 'workflow') {
        workflows.push({
          name: String(obj.name ?? 'Workflow'),
          description: String(obj.description ?? ''),
          steps: Array.isArray(obj.steps) ? obj.steps.map(String) : [],
        });
        continue;
      }
      if (obj.path && Array.isArray(obj.path)) {
        rawEdges.push(obj);
      } else if (obj.id && obj.label) {
        rawNodes.push(obj);
      }
    } catch {
      // ignore malformed lines
    }
  }

  const sortedRawNodes = [...rawNodes].sort((a, b) => {
    if (a.isGroup && !b.isGroup) return -1;
    if (!a.isGroup && b.isGroup) return 1;
    return 0;
  });

  const nodes: Node[] = sortedRawNodes.map((node) => {
    const isGroup = node.isGroup === true;
    const type = isGroup ? 'groupNode' : 'systemNode';
    const subtitle = typeof node.subtitle === 'string' ? node.subtitle : '';
    const nodeWidth = typeof node.width === 'number' ? node.width : isGroup ? 400 : 180;
    const nodeHeight =
      typeof node.height === 'number' ? node.height : isGroup ? 300 : subtitle ? 100 : 80;
    const parentId = typeof node.parentId === 'string' ? node.parentId : undefined;

    return {
      id: String(node.id),
      type,
      position: {
        x: typeof node.x === 'number' ? node.x : 0,
        y: typeof node.y === 'number' ? node.y : 0,
      },
      ...(parentId
        ? { parentId, parentNode: parentId, extent: 'parent' as const }
        : {}),
      ...(isGroup ? { style: { width: nodeWidth, height: nodeHeight } } : {}),
      data: {
        label: String(node.label),
        subtitle,
        layer: typeof node.layer === 'string' ? node.layer : 'application',
        icon: typeof node.icon === 'string' ? node.icon : 'box',
        serviceType: typeof node.serviceType === 'string' ? node.serviceType : 'generic',
        isGroup,
        groupLabel: typeof node.groupLabel === 'string' ? node.groupLabel : String(node.label),
        groupColor: typeof node.groupColor === 'string' ? node.groupColor : undefined,
        nodeWidth,
        nodeHeight,
      },
      width: nodeWidth,
      height: nodeHeight,
      zIndex: isGroup ? 0 : 1000,
    } as Node;
  });

  const edges: Edge[] = rawEdges.map((edge, idx) => {
    const path = edge.path as string[];
    const isAsync = edge.async === true;
    const connectionType = isAsync ? 'async' : 'sync';
    const label = typeof edge.label === 'string' ? edge.label : '';

    return {
      id: typeof edge.id === 'string' ? edge.id : `edge-${idx}-${Date.now()}`,
      source: path[0],
      target: path[1],
      type: 'simpleFloating',
      animated: isAsync,
      label,
      labelShowBg: true,
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      labelBgStyle: { fill: '#1e293b' },
      labelStyle: { fontSize: 10, fill: '#f8fafc' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#64748b',
        width: 20,
        height: 20,
      },
      style: {
        stroke: '#64748b',
        strokeWidth: 2,
      },
      data: {
        connectionType,
        pathType: 'Smoothstep',
        label,
      },
    } as Edge;
  });

  return { nodes, edges, workflows };
}
