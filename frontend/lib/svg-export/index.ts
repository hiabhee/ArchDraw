import type { Node, Edge } from 'reactflow';
import type { NodeData } from '@/store/diagram/types';
import type { EdgeData } from '@/data/edgeTypes';

import { type EdgeRouteDirection } from '@/lib/utils/edgeRouteBuilder';
import { buildEdgePathGeometry } from '@/lib/utils/edgePathGeometry';
import { getCachedDiagramGeometryPlan } from '@/lib/utils/diagramGeometry';
import { resolveCanvasTokens, type DiagramRenderStyleId } from '@/lib/theme/renderStyles';
import type { DiagramThemeId } from '@/lib/theme/stylingConstants';
import type { NodeIconMode } from '@/lib/utils/nodeIconVisibility';
import { brutalShadowFilter } from '@/lib/theme/renderStyles/neubrutalism';
import { metallicSurfaceGradientSvgDefs } from '@/lib/theme/renderStyles/studioMetallic';
import { getEffectiveNodeDimensions } from '@/lib/utils/shapeNodeDimensions';
import { calculateBounds, nodeDepth, resolveAbsolutePosition } from './nodeLayout';
import { renderSystemNode, renderTextLabel, renderAnnotationNode, renderGroupNode, renderShapeNode } from './renderNodes';
import { renderEdge } from './renderEdges';
import type { SystemNodeRenderData, EdgeRenderData } from './types';
import { escapeXml } from './svgPrimitives';

export interface SvgCanvasBackground {
  variant: 'dots' | 'lines';
  gap: number;
  size: number;
  patternColor: string | null;
  showGrid: boolean;
}

export function generatePureSVG(
  nodes: Node[],
  edges: Edge[],
  isDark: boolean = true,
  backgroundColor: string = '#0f172a',
  layoutDirection: EdgeRouteDirection = 'LR',
  renderStyleId: DiagramRenderStyleId = 'precision',
  colorThemeId: DiagramThemeId | string | null = 'default',
  iconMode: NodeIconMode = 'all',
  canvasBackground?: SvgCanvasBackground,
): string {
  const aesthetics = resolveCanvasTokens({ renderStyleId, colorThemeId, isDark });
  const rawNodeMap = new Map(nodes.map((n) => [n.id, n]));

  const preparedNodes = nodes.map((node) => {
    const isGroup = node.type === 'groupNode' || node.type === 'group' || (node.data as { isGroup?: boolean })?.isGroup === true;
    const isText = node.type === 'textLabelNode' || node.type === 'annotationNode';

    let w: number;
    let h: number;

    if (isText) {
      const measuredWidth = (node as Node & { measured?: { width?: number } }).measured?.width;
      const measuredHeight = (node as Node & { measured?: { height?: number } }).measured?.height;
      w = node.width ?? (node.data as { nodeWidth?: number })?.nodeWidth ?? measuredWidth ?? (node.type === 'textLabelNode' ? 120 : 200);
      h = node.height ?? (node.data as { nodeHeight?: number })?.nodeHeight ?? measuredHeight ?? (node.type === 'textLabelNode' ? 40 : 120);
    } else if (isGroup) {
      w = node.width ?? (node.data as { nodeWidth?: number })?.nodeWidth ?? 300;
      h = node.height ?? (node.data as { nodeHeight?: number })?.nodeHeight ?? 200;
    } else {
      // Use the same effective dimensions as canvas (uniform 100px height) so export matches what user sees
      const eff = getEffectiveNodeDimensions(node, renderStyleId, iconMode);
      w = eff.width;
      h = eff.height;
    }

    const abs = resolveAbsolutePosition(node, rawNodeMap);

    return {
      ...node,
      width: w,
      height: h,
      position: abs,
      // Clear parent so computeEdgeRoute's getAbsolutePosition doesn't double-add the group's offset (canvas uses relative positions, export now uses absolute)
      parentNode: undefined,
      parentId: undefined,
    };
  });

  const nodeMap = new Map(preparedNodes.map((n) => [n.id, n]));
  const sortedNodes = [...preparedNodes].sort(
    (a, b) => nodeDepth(a, nodeMap) - nodeDepth(b, nodeMap),
  );

  const bounds = calculateBounds(preparedNodes);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  const gridGap = Math.max(1, canvasBackground?.gap ?? 24);
  const gridPhaseX = ((-bounds.minX % gridGap) + gridGap) % gridGap;
  const gridPhaseY = ((-bounds.minY % gridGap) + gridGap) % gridGap;
  const gridColor = canvasBackground?.patternColor ?? aesthetics.cssVars['--arch-canvas-grid'] ?? (isDark ? '#94a3b8' : '#e2e8f0');
  const safeGridColor = escapeXml(gridColor);
  const backgroundPattern = canvasBackground?.showGrid
    ? canvasBackground.variant === 'dots'
      ? `<defs><pattern id="archdraw-background-pattern" x="${gridPhaseX}" y="${gridPhaseY}" width="${gridGap}" height="${gridGap}" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="${Math.max(0.5, canvasBackground.size)}" fill="${safeGridColor}" /></pattern></defs><rect x="0" y="0" width="${width}" height="${height}" fill="url(#archdraw-background-pattern)" opacity="${isDark ? 0.35 : 0.5}" />`
      : `<defs><pattern id="archdraw-background-pattern" x="${gridPhaseX}" y="${gridPhaseY}" width="${gridGap}" height="${gridGap}" patternUnits="userSpaceOnUse"><path d="M ${gridGap} 0 H 0 V ${gridGap}" fill="none" stroke="${safeGridColor}" stroke-width="1" /></pattern></defs><rect x="0" y="0" width="${width}" height="${height}" fill="url(#archdraw-background-pattern)" opacity="${isDark ? 0.25 : 1}" />`
    : '';

  const nodeElements: string[] = [];
  const edgeElements: string[] = [];
  const metallicSurfaceDefs = aesthetics.render.nodeMaterial === 'metallic'
    ? metallicSurfaceGradientSvgDefs(isDark)
    : '';

  for (const node of sortedNodes) {
    const nodeData: SystemNodeRenderData = {
      id: node.id,
      type: node.type || 'systemNode',
      x: node.position.x - bounds.minX,
      y: node.position.y - bounds.minY,
      width: node.width!,
      height: node.height!,
      data: node.data as NodeData,
      selected: node.selected,
    };

    if (node.type === 'textLabelNode') {
      nodeElements.push(renderTextLabel(nodeData, isDark));
    } else if (node.type === 'annotationNode') {
      nodeElements.push(renderAnnotationNode(nodeData, isDark));
    } else if (node.type === 'groupNode' || node.type === 'group') {
      nodeElements.push(renderGroupNode(nodeData, isDark, renderStyleId, aesthetics));
    } else if (node.type === 'shapeNode') {
      nodeElements.push(renderShapeNode(nodeData, isDark, renderStyleId, aesthetics, iconMode));
    } else {
      nodeElements.push(renderSystemNode(nodeData, isDark, renderStyleId, aesthetics, iconMode));
    }
  }

  const processedEdges: Edge[] = [];
  const processedEdgeIds = new Set<string>();

  for (const edge of edges) {
    if (processedEdgeIds.has(edge.id)) continue;

    const source = edge.source;
    const target = edge.target;

    const forward = edges.filter((e) => e.source === source && e.target === target);
    const reverse = edges.filter((e) => e.source === target && e.target === source);
    const isBidirectional = forward.length > 0 && reverse.length > 0;

    if (isBidirectional) {
      const group = [...forward, ...reverse].sort((a, b) => a.id.localeCompare(b.id));
      const leader = group[0];

      for (const e of group) {
        processedEdgeIds.add(e.id);
      }

      const combinedLabel = group
        .map((e) => e.data?.label?.trim())
        .filter(Boolean)
        .join(' / ');

      processedEdges.push({
        ...leader,
        data: {
          ...leader.data,
          label: combinedLabel || undefined,
          isBidirectional: true,
        },
      });
    } else {
      processedEdgeIds.add(edge.id);
      processedEdges.push(edge);
    }
  }

  // Routing must use nodes with parent relationships intact so passable groups
  // (ancestors of source/target) are correctly identified. preparedNodes has
  // parents cleared and absolute positions - using it makes every group look
  // like an obstacle, causing the export to route around Compute Tier etc.
  // Build routingNodes that keep parents but have correct effective dimensions.
  const routingNodes: Node[] = nodes.map((node) => {
    const isGroup = node.type === 'groupNode' || node.type === 'group' || (node.data as { isGroup?: boolean })?.isGroup === true;
    const isText = node.type === 'textLabelNode' || node.type === 'annotationNode';
    let w: number | undefined;
    let h: number | undefined;
    if (!isText && !isGroup) {
      const eff = getEffectiveNodeDimensions(node, renderStyleId, iconMode);
      w = eff.width;
      h = eff.height;
    } else {
      w = node.width ?? (node.data as { nodeWidth?: number })?.nodeWidth ?? undefined;
      h = node.height ?? (node.data as { nodeHeight?: number })?.nodeHeight ?? undefined;
    }
    return {
      ...node,
      ...(w !== undefined ? { width: w } : {}),
      ...(h !== undefined ? { height: h } : {}),
    } as Node;
  });

  const geometry = getCachedDiagramGeometryPlan(routingNodes, processedEdges, {
    direction: layoutDirection,
    renderStyleId,
    iconMode,
    revision: 'svg-export',
  });

  for (const edge of processedEdges) {
    const sourceNode = routingNodes.find((n) => n.id === edge.source);
    const targetNode = routingNodes.find((n) => n.id === edge.target);

    if (!sourceNode || !targetNode) continue;

    const route = geometry.routes.get(edge.id);
    if (!route) continue;

    const sourceX = route.sourcePoint.x - bounds.minX;
    const sourceY = route.sourcePoint.y - bounds.minY;
    const targetX = route.targetPoint.x - bounds.minX;
    const targetY = route.targetPoint.y - bounds.minY;
    const sourcePos = route.sourcePosition;
    const targetPos = route.targetPosition;
    const isFloating = edge.type === 'simpleFloating' || (!edge.sourceHandle && !edge.targetHandle);

    const shifted = (point: { x: number; y: number }) => ({ x: point.x - bounds.minX, y: point.y - bounds.minY });
    const shiftedInput = route.path.kind === 'orthogonal'
      ? { ...route.path, waypoints: route.path.waypoints.map(shifted) }
      : { kind: 'cubic' as const, start: shifted(route.path.start), control1: shifted(route.path.control1), control2: shifted(route.path.control2), end: shifted(route.path.end) };
    const svgPath = buildEdgePathGeometry(shiftedInput).d;

    const labelAnchor = geometry.labels.get(edge.id);
    const labelX = labelAnchor ? labelAnchor.x - bounds.minX : undefined;
    const labelY = labelAnchor ? labelAnchor.y - bounds.minY : undefined;

    const edgeData: EdgeRenderData = {
      id: edge.id,
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition: sourcePos,
      targetPosition: targetPos,
      data: edge.data as EdgeData | undefined,
      style: edge.style,
      selected: edge.selected,
      isFloating,
      svgPath: svgPath || undefined,
      labelX,
      labelY,
    };

    edgeElements.push(renderEdge(edgeData, isDark, renderStyleId, aesthetics));
  }

  const geometryMetadata = escapeXml(JSON.stringify({
    status: geometry.status,
    violations: geometry.violations,
    routeStatuses: [...geometry.routes].map(([edgeId, route]) => ({ edgeId, status: route.status, violations: route.violations })),
  }));

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" data-geometry-status="${geometry.status}">
  <metadata id="archdraw-geometry">${geometryMetadata}</metadata>
  ${renderStyleId === 'neubrutalism' ? brutalShadowFilter(isDark) : ''}
  ${metallicSurfaceDefs}
  ${backgroundColor === 'none' ? '' : `<rect x="0" y="0" width="${width}" height="${height}" fill="${backgroundColor}"/>`}
  ${backgroundPattern}
  <g id="edges">
${edgeElements.map((e) => '    ' + e.replace(/\n/g, '\n    ')).join('\n')}
  </g>
  <g id="nodes">
${nodeElements.map((n) => '    ' + n.replace(/\n/g, '\n    ')).join('\n')}
  </g>
</svg>`.trim();
}
