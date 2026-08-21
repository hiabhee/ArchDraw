import type { Node, Edge } from 'reactflow';
import { reactFlowToMermaid } from '@/lib/ai/pipeline/mermaid-pipeline/mermaidTranslator';
import { runMermaidPipeline } from './pipeline';
import { isDomainSuccess } from '@/lib/pipeline-core';
import { resolveShapeNodeDimensions } from '@/lib/utils/shapeNodeDimensions';
import { ensureDiagramHeading } from './diagramHeading';

export interface RelayoutCanvasResult {
  nodes: Node[];
  edges: Edge[];
  success: boolean;
  warnings: string[];
}

export type LayoutDirection = 'TD' | 'LR';

export interface RelayoutOptions {
  /** Used when the graph has no top heading yet (templates, manual diagrams). */
  title?: string;
}

/** Map toolbar / store preset ids to Mermaid graph direction. */
export function directionFromPresetId(presetId: string | null | undefined): LayoutDirection {
  return presetId === 'layered-tb' ? 'TD' : 'LR';
}

export function presetIdFromDirection(direction: LayoutDirection): 'layered-lr' | 'layered-tb' {
  return direction === 'TD' ? 'layered-tb' : 'layered-lr';
}

function isGroupNode(node: Node): boolean {
  return (
    node.type === 'groupNode' ||
    node.type === 'group' ||
    node.type === 'frameNode' ||
    (node.data as { isGroup?: boolean } | undefined)?.isGroup === true
  );
}

function dimensionsForNode(node: Node): { width?: number; height?: number } {
  if (node.type !== 'shapeNode') {
    return { width: node.width ?? undefined, height: node.height ?? undefined };
  }
  const data = node.data as Record<string, unknown>;
  const dims = resolveShapeNodeDimensions({
    label: String(data.label ?? ''),
    sublabel: (data.sublabel ?? data.subtitle) as string | undefined,
    shape: data.shape as string | undefined,
    serviceType: data.serviceType as string | undefined,
    cylinderAxis: data.cylinderAxis as 'vertical' | 'horizontal' | undefined,
    // Deliberately no nodeWidth/nodeHeight here: resolveShapeNodeDimensions
    // max()es stored vs fitted, so passing stored dims ratchets boxes upward
    // and they never shrink when a label shortens. Layout must use the fresh
    // fitted size — the same size dagre reserved space for.
    showIcon: data.showIcon as boolean | undefined,
  });
  return dims;
}

/**
 * Canonical canvas layout — same path as the toolbar LR/TB toggler.
 *
 * Round-trips React Flow → Mermaid → Parse → Validate → Build → Dagre layout →
 * Size → Validate, then restores original node types/data while applying the
 * pipeline's positions and container sizes.
 *
 * Use this for templates, AI generation, repo diagrams, and layout presets.
 * On failure, returns the input graph unchanged (`success: false`).
 */
export async function layoutDiagramViaMermaid(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = 'LR',
  options: RelayoutOptions = {},
): Promise<RelayoutCanvasResult> {
  if (nodes.length === 0) {
    return { nodes, edges, success: true, warnings: [] };
  }

  const nodesWithHeading = ensureDiagramHeading(nodes, options.title);

  try {
    const mermaid = reactFlowToMermaid(nodesWithHeading, edges, direction);
    const result = await runMermaidPipeline(mermaid);

    if (!isDomainSuccess(result)) {
      return {
        nodes,
        edges,
        success: false,
        warnings: result.warnings ?? [result.error?.message ?? 'Mermaid pipeline failed'],
      };
    }

    const originalNodeMap = new Map(nodesWithHeading.map((n) => [n.id, n]));

    const preservedNodes = result.data.nodes.map((newNode) => {
      const originalNode = originalNodeMap.get(newNode.id);
      if (!originalNode) return newNode as Node;

      const mergedData = {
        ...originalNode.data,
        shape: newNode.data?.shape || originalNode.data?.shape,
      };

      const group = isGroupNode(originalNode) || isGroupNode(newNode as Node);

      // Group nodes: prefer pipeline-computed dimensions which are derived
      // from the actual child bounding box. Using the original node's stale
      // dimensions causes children to overflow the group.
      let width: number | undefined;
      let height: number | undefined;
      if (group) {
        width = newNode.width ?? originalNode.width ?? undefined;
        height = newNode.height ?? originalNode.height ?? undefined;
      } else {
        // Non-group nodes: trust the pipeline-fresh dimensions first (dagre
        // spaced ranks using exactly these), then a fresh fit that ignores
        // stale stored nodeWidth/nodeHeight. Falling back to the stored size
        // here is what caused laid-out width ≠ assigned width and the
        // grow-only ratchet.
        const shapeDims = dimensionsForNode({
          ...originalNode,
          data: mergedData,
        } as Node);
        width = newNode.width ?? shapeDims.width ?? originalNode.width ?? undefined;
        height = newNode.height ?? shapeDims.height ?? originalNode.height ?? undefined;
      }

      return {
        ...newNode,
        type: originalNode.type,
        // Use the NEW parent relationships from the Mermaid pipeline, not the original ones.
        // The Mermaid round-trip correctly preserves subgraph/group structure.
        parentNode: newNode.parentNode,
        parentId: (newNode as { parentId?: string }).parentId,
        extent: newNode.extent || originalNode.extent,
        width,
        height,
        // Groups need the pipeline's -1 layering; non-group nodes keep their
        // original z-order instead of losing it to the rebuilt default.
        zIndex: group
          ? (newNode.zIndex ?? originalNode.zIndex)
          : (originalNode.zIndex ?? newNode.zIndex),
        style: group
          ? {
              ...(originalNode.style as Record<string, unknown> | undefined),
              ...(typeof width === 'number' ? { width } : {}),
              ...(typeof height === 'number' ? { height } : {}),
            }
          : originalNode.style,
        data: {
          ...mergedData,
          nodeWidth: width,
          nodeHeight: height,
        },
      } as Node;
    });

    // Keep any original nodes the pipeline dropped (e.g. freeform annotations)
    const laidOutIds = new Set(preservedNodes.map((n) => n.id));
    const orphans = nodesWithHeading.filter((n) => !laidOutIds.has(n.id));

    // Preserve original edge identity and user data through the round-trip.
    // The parser regenerates ids and rebuilds data from scratch, which would
    // otherwise discard custom waypoints, style, type, handles, animated, and
    // break undo/selection keyed on stable edge ids.
    const originalEdgeBuckets = new Map<string, Edge[]>();
    const edgeKey = (source: string, target: string, label: unknown) =>
      `${source}|${target}|${typeof label === 'string' ? label.trim() : ''}`;
    for (const edge of edges) {
      const key = edgeKey(edge.source, edge.target, edge.label);
      const bucket = originalEdgeBuckets.get(key);
      if (bucket) bucket.push(edge);
      else originalEdgeBuckets.set(key, [edge]);
    }

    const preservedEdges = (result.data.edges as Edge[]).map((newEdge) => {
      const bucket = originalEdgeBuckets.get(edgeKey(newEdge.source, newEdge.target, newEdge.label))
        ?? originalEdgeBuckets.get(`${newEdge.source}|${newEdge.target}|`);
      const original = bucket?.shift();
      if (!original) return newEdge;
      return {
        ...newEdge,
        id: original.id,
        sourceHandle: original.sourceHandle ?? newEdge.sourceHandle,
        targetHandle: original.targetHandle ?? newEdge.targetHandle,
        type: original.type ?? newEdge.type,
        style: original.style ?? newEdge.style,
        animated: original.animated ?? newEdge.animated,
        hidden: original.hidden ?? newEdge.hidden,
        markerStart: original.markerStart ?? newEdge.markerStart,
        markerEnd: original.markerEnd ?? newEdge.markerEnd,
        data: { ...newEdge.data, ...original.data },
      } as Edge;
    });

    return {
      nodes: orphans.length > 0 ? [...preservedNodes, ...orphans] : preservedNodes,
      edges: preservedEdges,
      success: true,
      warnings: result.data.warnings ?? [],
    };
  } catch (err) {
    return {
      nodes,
      edges,
      success: false,
      warnings: [err instanceof Error ? err.message : 'Relayout failed'],
    };
  }
}
