/**
 * Shared helper for importing repo diagram NDJSON into the canvas.
 * Used by both RepoDiagramGenerator and Editor (FloatingAIBar path).
 * Applies dagre layout for consistent structure with the normal AI pipeline.
 */

import { parseRepoNdjsonToReactFlow } from '@/lib/utils/parseRepoNdjson';
import { getLayoutedElements } from '@/lib/layoutUtils';
import { classifyNode, SERVICE_TYPE_META, CATEGORY_COLORS, getDeterministicColor } from '@/lib/mermaid/planTranslator';
import { classifyEdge } from '@/lib/mermaid/edgeClassifier';
import { calculateNodeDimensions } from '@/lib/utils/nodeSizing';
import type { Node, Edge } from 'reactflow';

export interface ImportRepoDiagramResult {
  nodes: Node[];
  edges: Edge[];
  nodeCount: number;
  edgeCount: number;
}

/**
 * Enrich repo diagram nodes with the same shape/color/classification data
 * that buildReactFlowObjects applies to normal AI diagrams. This ensures
 * the first render matches what the layout toggle round-trip produces.
 */
function enrichRepoNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    if (node.data?.isGroup) {
      // Group nodes: ensure category, typeId, color
      return {
        ...node,
        data: {
          ...node.data,
          category: 'group',
          typeId: 'group',
          color: node.data.groupColor || getDeterministicColor(node.id),
        },
      } as Node;
    }

    const label = String(node.data?.label ?? '');
    const subtitle = String(node.data?.subtitle ?? '');
    const parentGroupName = node.parentId
      ? nodes.find((n) => n.id === node.parentId)?.data?.groupLabel
      : undefined;

    const { shape, serviceType } = classifyNode(label, parentGroupName);
    const meta = SERVICE_TYPE_META[serviceType] || SERVICE_TYPE_META['service'];
    const categoryColor = CATEGORY_COLORS[meta.category] || '#6366f1';
    const finalShape = shape === 'rounded' ? 'rounded-rectangle' : shape;

    const { width, height } = calculateNodeDimensions(label, subtitle);

    return {
      ...node,
      type: 'shapeNode',
      width,
      height,
      data: {
        ...node.data,
        shape: finalShape,
        serviceType,
        typeId: meta.typeId,
        color: categoryColor,
        category: meta.category,
        icon: meta.icon,
        nodeWidth: width,
        nodeHeight: height,
      },
    } as Node;
  });
}

/**
 * Enrich repo diagram edges using the edgeClassifier and strip hardcoded styling properties
 * so they align with the theme-aware and semantics-based aesthetics of prompt-based diagrams.
 */
function enrichRepoEdges(edges: Edge[], enrichedNodes: Node[]): Edge[] {
  return edges.map((edge) => {
    const srcNode = enrichedNodes.find((n) => n.id === edge.source);
    const tgtNode = enrichedNodes.find((n) => n.id === edge.target);
    const label = edge.label || '';
    const arrowType = edge.data?.connectionType === 'async' ? 'dotted' : 'arrow';

    const semantics = srcNode && tgtNode
      ? classifyEdge(srcNode as any, tgtNode as any, label as string, arrowType)
      : { importance: 'secondary' as const, syncAsync: 'sync' as const, protocol: 'HTTP' };

    return {
      ...edge,
      style: undefined, // Strip hardcoded styling (color, width, dash) to enable theme & importance-based aesthetics
      data: {
        ...edge.data,
        importance: semantics.importance,
        syncAsync: semantics.syncAsync,
        portType: semantics.portType,
        protocol: semantics.protocol,
      },
    };
  });
}

/**
 * Parse NDJSON, enrich nodes with classification data, strip manual grid
 * positions, and re-layout with dagre so repo diagrams have the same
 * structure and appearance as normal AI-generated diagrams.
 * Returns null if no architectural components could be parsed.
 */
export function parseAndValidateRepoDiagram(
  ndjson: string,
  direction: 'LR' | 'TB' = 'TB'
): ImportRepoDiagramResult | null {
  const { nodes: rfNodes, edges: rfEdges } = parseRepoNdjsonToReactFlow(ndjson);

  if (rfNodes.length === 0) {
    return null;
  }

  // 1. Enrich nodes with shape/color/classification (same as buildReactFlowObjects)
  const enrichedNodes = enrichRepoNodes(rfNodes);

  // 2. Enrich edges with semantic classification and strip static styling
  const enrichedEdges = enrichRepoEdges(rfEdges, enrichedNodes);

  // Zero out positions so getLayoutedElements runs dagre (it skips if any
  // node already has authored positions). We preserve group structures
  // (parentId, isGroup) for dagre's compound graph support.
  const zeroedNodes = enrichedNodes.map((n) => ({
    ...n,
    position: { x: 0, y: 0 } as { x: number; y: number },
  }));

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
    zeroedNodes,
    enrichedEdges,
    direction,
    { ranksep: 260, nodesep: 150 }
  );

  return {
    nodes: layoutedNodes,
    edges: layoutedEdges,
    nodeCount: rfNodes.length,
    edgeCount: layoutedEdges.length,
  };
}
