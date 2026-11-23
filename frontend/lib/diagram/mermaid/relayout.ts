import type { NodeIconMode } from '@/lib/diagram/nodes/nodeIconVisibility';
import type { Direction } from '@/lib/diagram/pipeline-shared/reactflow/types';
import type { Node, Edge } from 'reactflow';
import { reactFlowToMermaid } from '@/lib/ai/pipeline/mermaid-pipeline/mermaidTranslator';
import { geometryWarnings, runMermaidPipeline, summarizeGeometry, type GeometrySummary, type MermaidLayoutProfile } from './pipeline';
import { getCachedDiagramGeometryPlan } from '@/lib/diagram/geometry/diagramGeometry';
import { isDomainSuccess } from '@/lib/diagram/pipeline-core';
import { getEffectiveNodeDimensions, resolveShapeNodeDimensions } from '@/lib/diagram/nodes/shapeNodeDimensions';
import { ensureDiagramHeading } from './diagramHeading';
import type { DiagramRenderStyleId } from '@/lib/theme/renderStyles';
import {
  createSemanticEdgeKey,
  semanticEdgeKeyString,
  type EdgeLayoutSemantics,
} from './edgeFlowSemantics';

export interface RelayoutCanvasResult {
  nodes: Node[];
  edges: Edge[];
  success: boolean;
  warnings: string[];
  geometrySummary?: GeometrySummary;
}

/** The two canvas layout directions the toolbar toggles between. */
export type LayoutDirection = Extract<Direction, 'TD' | 'LR'>;

export interface RelayoutOptions {
  iconMode?: NodeIconMode;
  /** Used when the graph has no top heading yet (templates, manual diagrams). */
  title?: string;
  /** Applies an appearance-specific spacing profile without changing topology. */
  renderStyleId?: DiagramRenderStyleId;
  /** `auto`: compare applicable arrangements; `flow` (default): rank columns; `zones`: prefer a hub arrangement. */
  layoutStyle?: 'auto' | 'flow' | 'zones';
  /** Fold a long flow into rows when that fits the screen far better (live project maps). */
  foldLongFlows?: boolean;
  /** Lay out some groups the other way when that fits the screen clearly better (default on). */
  mixGroupDirections?: boolean;
  /** Spacing profile for live project maps (the same one the agent's publish uses). */
  layoutProfile?: MermaidLayoutProfile;
  /** Areas in data-flow order (the same one the agent's publish uses). */
  areaOrder?: 'flow';
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
  const cacheKey = JSON.stringify([direction, options.title ?? '', options.renderStyleId ?? '', options.layoutStyle ?? 'flow', options.foldLongFlows ?? false, options.mixGroupDirections ?? true, options.layoutProfile ?? '', options.areaOrder ?? '', options.iconMode ?? '']);
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
    const layoutProfile = options.layoutProfile
      ?? (options.renderStyleId === 'studio-minimal' || options.renderStyleId === 'studio-metallic' ? 'studio-minimal' : undefined);
    const originalNodeMap = new Map(nodesWithHeading.map((n) => [n.id, n]));

    const restoreNodes = (laidOut: Node[]): Node[] => {
      const preservedNodes = laidOut.map((layoutNode) => {
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
          shape: originalNode.data?.shape ?? newNode.data?.shape,
        };

        const group = isGroupNode(originalNode) || isGroupNode(newNode as Node);

        // Group nodes: prefer pipeline-computed dimensions which are derived
        // from the actual child bounding box. Using the original node's stale
        // dimensions causes children to overflow the group.
        // Prefer the sizes Dagre reserved. If they are missing, fit shapes
        // without their stored dimensions to avoid retaining an oversized box.
        const fallback = !group && (newNode.width === undefined || newNode.height === undefined)
          ? dimensionsForNode({ ...originalNode, data: mergedData })
          : undefined;
        const width = newNode.width ?? fallback?.width ?? originalNode.width ?? undefined;
        const height = newNode.height ?? fallback?.height ?? originalNode.height ?? undefined;

        return {
          ...originalNode,
          position: newNode.position,
          positionAbsolute: undefined,
          // Use the NEW parent relationships from the Mermaid pipeline, not the original ones.
          // The Mermaid round-trip correctly preserves subgraph/group structure.
          parentNode: newNode.parentNode,
          parentId: (newNode as { parentId?: string }).parentId,
          extent: originalNode.extent ?? newNode.extent,
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
      return orphans.length > 0 ? [...preservedNodes, ...orphans] : preservedNodes;
    };

    // Parsed edges supply inferred metadata and fallback handles. The original
    // array owns identity, topology, and authored properties even if parsing
    // normalizes or drops a connection.
    const restoredEdgeArrays = new WeakMap<Edge[], Edge[]>();
    const restoreEdges = (laidOut: Edge[]): Edge[] => {
      const cached = restoredEdgeArrays.get(laidOut);
      if (cached) return cached;
      const layoutEdgeBuckets = new Map<string, Edge[]>();
      const edgeKey = (edge: Edge) => semanticEdgeKeyString(createSemanticEdgeKey(edge, edge.source, edge.target, 0));
      for (const edge of laidOut) {
        const key = edgeKey(edge);
        const bucket = layoutEdgeBuckets.get(key);
        if (bucket) bucket.push(edge);
        else layoutEdgeBuckets.set(key, [edge]);
      }
      const restoredEdges = new Map<string, Edge>();
      for (const edge of orderedLayoutEdges) {
        const inferred = layoutEdgeBuckets.get(edgeKey(edge))?.shift();
        if (inferred) restoredEdges.set(edge.id, inferred);
      }
      const preservedEdges = edges.map(edge => {
        const inferred = restoredEdges.get(edge.id);
        return inferred ? {
          ...inferred,
          ...edge,
          data: { ...inferred.data, ...edge.data },
        } : edge;
      });
      restoredEdgeArrays.set(laidOut, preservedEdges);
      return preservedEdges;
    };

    // Dagre needs the renderer's icon-dependent card width before ranking.
    const studioNodeSizes = layoutProfile && options.iconMode
      ? new Map(layoutNodes
          .filter(node => !isGroupNode(node) && (node.type === 'shapeNode' || node.type === 'systemNode'))
          .map(node => [node.id, getEffectiveNodeDimensions(node, 'studio-minimal', options.iconMode)]))
      : undefined;

    const result = await runMermaidPipeline(mermaid, {
      layoutProfile,
      studioNodeSizes,
      prepareGeometry: (objects) => ({
        nodes: restoreNodes(objects.nodes),
        edges: restoreEdges(objects.edges),
      }),
      renderStyleId: options.renderStyleId,
      iconMode: options.iconMode,
      edgeSemantics,
      layoutStyle: options.layoutStyle,
      foldLongFlows: options.foldLongFlows,
      mixGroupDirections: options.mixGroupDirections,
      areaOrder: options.areaOrder,
    });

    if (!isDomainSuccess(result)) {
      return {
        nodes,
        edges,
        success: false,
        warnings: result.warnings ?? [result.error?.message ?? 'Mermaid pipeline failed'],
      };
    }

    const finalNodes = restoreNodes(result.data.nodes);
    const preservedEdges = restoreEdges(result.data.edges);
    const geometrySummary = summarizeGeometry(getCachedDiagramGeometryPlan(finalNodes, preservedEdges, {
      direction,
      renderStyleId: options.renderStyleId ?? (layoutProfile ? 'studio-minimal' : undefined),
      iconMode: options.iconMode,
      straightEdges: false,
    }));
    const output = {
      nodes: finalNodes,
      edges: preservedEdges,
      success: true,
      geometrySummary,
      warnings: geometryWarnings(result.data.warnings, geometrySummary),
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
