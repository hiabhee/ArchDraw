import type { Node, Edge } from 'reactflow';
import { reactFlowToMermaid } from '@/lib/ai/pipeline/mermaid-pipeline/mermaidTranslator';
import { runMermaidPipeline } from './pipeline';
import { isDomainSuccess } from '@/lib/pipeline-core';

export interface RelayoutCanvasResult {
  nodes: Node[];
  edges: Edge[];
  success: boolean;
  warnings: string[];
}

export type LayoutDirection = 'TD' | 'LR';

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
  direction: LayoutDirection = 'LR'
): Promise<RelayoutCanvasResult> {
  if (nodes.length === 0) {
    return { nodes, edges, success: true, warnings: [] };
  }

  try {
    const mermaid = reactFlowToMermaid(nodes, edges, direction);
    const result = await runMermaidPipeline(mermaid);

    if (!isDomainSuccess(result)) {
      return {
        nodes,
        edges,
        success: false,
        warnings: result.warnings ?? [result.error?.message ?? 'Mermaid pipeline failed'],
      };
    }

    const originalNodeMap = new Map(nodes.map((n) => [n.id, n]));

    const preservedNodes = result.data.nodes.map((newNode) => {
      const originalNode = originalNodeMap.get(newNode.id);
      if (!originalNode) return newNode as Node;

      const width = newNode.width || originalNode.width;
      const height = newNode.height || originalNode.height;
      const group = isGroupNode(originalNode) || isGroupNode(newNode as Node);

      return {
        ...newNode,
        type: originalNode.type,
        parentNode: originalNode.parentNode,
        parentId: (originalNode as { parentId?: string }).parentId,
        extent: originalNode.extent,
        width,
        height,
        style: group
          ? {
              ...(originalNode.style as Record<string, unknown> | undefined),
              ...(typeof width === 'number' ? { width } : {}),
              ...(typeof height === 'number' ? { height } : {}),
            }
          : originalNode.style,
        data: {
          ...originalNode.data,
          shape: newNode.data?.shape || originalNode.data?.shape,
          nodeWidth: newNode.data?.nodeWidth || originalNode.data?.nodeWidth,
          nodeHeight: newNode.data?.nodeHeight || originalNode.data?.nodeHeight,
        },
      } as Node;
    });

    // Keep any original nodes the pipeline dropped (e.g. freeform annotations)
    const laidOutIds = new Set(preservedNodes.map((n) => n.id));
    const orphans = nodes.filter((n) => !laidOutIds.has(n.id));

    return {
      nodes: orphans.length > 0 ? [...preservedNodes, ...orphans] : preservedNodes,
      edges: result.data.edges as Edge[],
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
