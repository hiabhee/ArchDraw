import type { Direction } from '@/lib/pipeline-shared/reactflow/types';
import type { Node, Edge } from 'reactflow';
import { reactFlowToMermaid } from '@/lib/ai/pipeline/mermaid-pipeline/mermaidTranslator';
import { runMermaidPipeline } from './pipeline';
import { isDomainSuccess } from '@/lib/pipeline-core';
import { resolveShapeNodeDimensions } from '@/lib/utils/shapeNodeDimensions';
import { ensureDiagramHeading } from './diagramHeading';
import type { DiagramRenderStyleId } from '@/lib/theme/renderStyles';
import {
  createSemanticEdgeKey,
  normalizeSemanticType,
  semanticEdgeKeyString,
  type EdgeLayoutSemantics,
} from './edgeFlowSemantics';

export interface RelayoutCanvasResult {
  nodes: Node[];
  edges: Edge[];
  success: boolean;
  warnings: string[];
}

/** The two canvas layout directions the toolbar toggles between. */
export type LayoutDirection = Extract<Direction, 'TD' | 'LR'>;

export interface RelayoutOptions {
  /** Used when the graph has no top heading yet (templates, manual diagrams). */
  title?: string;
  /** Applies an appearance-specific spacing profile without changing topology. */
  renderStyleId?: DiagramRenderStyleId;
}

// Templates and editor entry points often request layout more than once for
// the same immutable module-level graph. Keep a small identity cache so those
// repeated requests share the completed canonical layout pass.
const relayoutCache = new WeakMap<Node[], WeakMap<Edge[], Map<string, RelayoutCanvasResult>>>();

/** Map toolbar / store preset ids to Mermaid graph direction. */
export function directionFromPresetId(presetId: string | null | undefined): LayoutDirection {
  return presetId === 'layered-tb' ? 'TD' : 'LR';
}

export function presetIdFromDirection(direction: LayoutDirection): 'layered-lr' | 'layered-tb' {
  return direction === 'TD' ? 'layered-tb' : 'layered-lr';
}

export function encodeTemporaryLayoutId(id: string): string {
  const bytes = new TextEncoder().encode(id);
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  // A single `0` sentinel represents the empty string; nonempty UTF-8 hex is
  // always at least two characters, so the encoding remains collision-free.
  return `layout_${hex || '0'}`;
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

  let byEdges = relayoutCache.get(nodes);
  if (!byEdges) { byEdges = new WeakMap(); relayoutCache.set(nodes, byEdges); }
  let byOptions = byEdges.get(edges);
  if (!byOptions) { byOptions = new Map(); byEdges.set(edges, byOptions); }
  const cacheKey = JSON.stringify([direction, options.title ?? '', options.renderStyleId ?? '']);
  const cachedLayout = byOptions.get(cacheKey);
  if (cachedLayout) return cachedLayout;

  const nodesWithHeading = ensureDiagramHeading(nodes, options.title);

  try {
    // Mermaid ids are more restrictive than React Flow ids. Use a reversible,
    // collision-free set for this layout pass ("api.prod" and "api_prod" must
    // never become the same vertex).
    const toLayoutId = new Map(nodesWithHeading.map((node) => [node.id, encodeTemporaryLayoutId(node.id)]));
    const fromLayoutId = new Map([...toLayoutId].map(([original, layout]) => [layout, original]));
    const mapId = (id: string | undefined) => id ? (toLayoutId.get(id) ?? id) : undefined;
    const restoreId = (id: string | undefined) => id ? (fromLayoutId.get(id) ?? id) : undefined;
    const layoutNodes = nodesWithHeading.map((node) => ({
      ...node,
      id: toLayoutId.get(node.id)!,
      parentNode: mapId(node.parentNode),
      parentId: mapId((node as Node & { parentId?: string }).parentId),
      data: {
        ...node.data,
        parentId: mapId((node.data as { parentId?: string } | undefined)?.parentId),
        anchorTarget: mapId((node.data as { anchorTarget?: string } | undefined)?.anchorTarget),
      },
    })) as Node[];
    const layoutEdges = edges.map((edge) => ({
      ...edge,
      source: mapId(edge.source)!,
      target: mapId(edge.target)!,
    }));
    // Mermaid has no syntax for arbitrary React Flow edge metadata. Carry it
    // in a typed sidecar, keyed by endpoint/label/type and stable duplicate
    // ordinal, and serialize duplicate groups in stable edge-ID order.
    const orderedLayoutEdges = [...layoutEdges].sort((a, b) => a.id.localeCompare(b.id));
    const edgeSemantics = new Map<string, EdgeLayoutSemantics>();
    const duplicateOrdinals = new Map<string, number>();
    for (const edge of orderedLayoutEdges) {
      const key = createSemanticEdgeKey(edge, edge.source, edge.target, 0);
      const base = JSON.stringify([key.sourceLayoutId, key.targetLayoutId, key.normalizedLabel, key.normalizedType]);
      const duplicateOrdinal = duplicateOrdinals.get(base) ?? 0;
      duplicateOrdinals.set(base, duplicateOrdinal + 1);
      const data = edge.data as Record<string, unknown> | undefined;
      edgeSemantics.set(semanticEdgeKeyString({ ...key, duplicateOrdinal }), {
        importance: typeof data?.importance === 'string' ? data.importance : undefined,
        importanceSource: (data?.importanceSource as 'explicit' | 'inferred' | undefined) ?? 'inferred',
        flowRole: data?.flowRole as EdgeLayoutSemantics['flowRole'],
        flowRoleSource: (data?.flowRoleSource as 'explicit' | 'inferred' | undefined) ?? 'inferred',
        flowRoleConfidence: typeof data?.flowRoleConfidence === 'number' ? data.flowRoleConfidence : undefined,
      });
    }
    const mermaid = reactFlowToMermaid(layoutNodes, orderedLayoutEdges, direction);
    const result = await runMermaidPipeline(mermaid, {
      layoutProfile: options.renderStyleId === 'studio-minimal' || options.renderStyleId === 'studio-metallic' ? 'studio-minimal' : undefined,
      edgeSemantics,
    });

    if (!isDomainSuccess(result)) {
      return {
        nodes,
        edges,
        success: false,
        warnings: result.warnings ?? [result.error?.message ?? 'Mermaid pipeline failed'],
      };
    }

    const originalNodeMap = new Map(nodesWithHeading.map((n) => [n.id, n]));

    const preservedNodes = result.data.nodes.map((layoutNode) => {
      const newNode = {
        ...layoutNode,
        id: restoreId(layoutNode.id)!,
        parentNode: restoreId(layoutNode.parentNode),
        parentId: restoreId((layoutNode as { parentId?: string }).parentId),
      };
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
    const edgeKey = (edge: Edge, source = edge.source, target = edge.target) =>
      `${source}|${target}|${typeof (edge.label ?? edge.data?.label) === 'string' ? String(edge.label ?? edge.data?.label).trim().toLowerCase() : ''}|${normalizeSemanticType(edge)}`;
    for (const edge of edges) {
      const key = edgeKey(edge);
      const bucket = originalEdgeBuckets.get(key);
      if (bucket) bucket.push(edge);
      else originalEdgeBuckets.set(key, [edge]);
    }
    for (const bucket of originalEdgeBuckets.values()) bucket.sort((a, b) => a.id.localeCompare(b.id));

    // Preserve original edge identity, but ensure no edges are silently dropped.
    // If the pipeline produces fewer edges than input (e.g. due to duplicate labels or parse loss),
    // keep the original edges count and warn — dropping edges on layout toggle is a critical bug.
    const expectedEdgeCount = edges.length;
    const pipelineEdgeCount = (result.data.edges as Edge[]).length;
    if (pipelineEdgeCount < expectedEdgeCount) {
      console.warn(`[Relayout] Edge loss detected: pipeline produced ${pipelineEdgeCount} edges but input had ${expectedEdgeCount}. Keeping original edges for missing ones.`);
    }

    const preservedEdges = (result.data.edges as Edge[]).map((layoutEdge) => {
      const newEdge = {
        ...layoutEdge,
        source: restoreId(layoutEdge.source)!,
        target: restoreId(layoutEdge.target)!,
      };
      const bucket = originalEdgeBuckets.get(edgeKey(newEdge))
        ?? [...originalEdgeBuckets.entries()].find(([key]) => key.startsWith(`${newEdge.source}|${newEdge.target}|`))?.[1];
      // Also try matching via data.label if label is empty
      const fallbackBucket = !bucket ? [...originalEdgeBuckets.entries()].find(([key]) => key.startsWith(`${newEdge.source}|${newEdge.target}|`))?.[1] : undefined;
      const targetBucket = bucket ?? fallbackBucket;
      const original = targetBucket?.shift();
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

    // If pipeline dropped edges, append the unmatched originals so nothing disappears on toggle.
    if (preservedEdges.length < expectedEdgeCount) {
      const remaining: Edge[] = [];
      for (const bucket of originalEdgeBuckets.values()) {
        remaining.push(...bucket);
      }
      if (remaining.length > 0) {
        console.warn(`[Relayout] Restoring ${remaining.length} dropped edges`);
        preservedEdges.push(...remaining.map((edge) => ({
          ...edge,
          data: { ...edge.data },
        })));
      }
    }

    const originalEdgeOrder = new Map(edges.map((edge, index) => [edge.id, index]));
    preservedEdges.sort((a, b) => (originalEdgeOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER)
      - (originalEdgeOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER));

    const output = {
      nodes: orphans.length > 0 ? [...preservedNodes, ...orphans] : preservedNodes,
      edges: preservedEdges,
      success: true,
      warnings: result.data.warnings ?? [],
    };
    if (byOptions.size >= 8) byOptions.delete(byOptions.keys().next().value!);
    byOptions.set(cacheKey, output);
    return output;
  } catch (err) {
    return {
      nodes,
      edges,
      success: false,
      warnings: [err instanceof Error ? err.message : 'Relayout failed'],
    };
  }
}
