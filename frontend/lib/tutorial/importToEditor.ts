import type { Node, Edge } from 'reactflow';
import type { SanitizedEdge, SanitizedNode } from '@/store/tutorialStore';

/**
 * Convert tutorial canvas snapshots into React Flow nodes/edges suitable for
 * `diagramStore.importDiagram`.
 */
export function tutorialCanvasToEditorGraph(
  nodes: SanitizedNode[] | Node[],
  edges: SanitizedEdge[] | Edge[]
): { nodes: Node[]; edges: Edge[] } {
  const editorNodes: Node[] = (nodes as Node[]).map((n) => ({
    ...n,
    type: n.type || 'systemNode',
    data: {
      label: n.data?.label ?? '',
      componentId: n.data?.componentId ?? '',
      category: n.data?.category,
      color: n.data?.color,
      icon: n.data?.icon,
      ...n.data,
    },
  }));

  const editorEdges: Edge[] = (edges as Edge[]).map((e) => ({
    ...e,
    type: e.type || 'simpleFloating',
    animated: e.animated ?? false,
  }));

  return { nodes: editorNodes, edges: editorEdges };
}
