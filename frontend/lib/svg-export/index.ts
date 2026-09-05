import type { Node, Edge } from 'reactflow';
import type { NodeData } from '@/store/diagram/types';
import type { EdgeData } from '@/data/edgeTypes';
import { NODE_WIDTH, NODE_HEIGHT } from '@/lib/theme/stylingConstants';
import { computeEdgeRoute, type EdgeRouteDirection } from '@/lib/utils/edgeRouteBuilder';
import { buildSmoothStepSvg } from '@/lib/utils/collisionFreeEdgePath';
import { computeEdgeLabelLayout } from '@/lib/utils/edgeLabelLayout';
import type { DiagramRenderStyleId } from '@/lib/theme/renderStyles';
import { brutalShadowFilter } from '@/lib/theme/renderStyles/neubrutalism';
import { getEffectiveNodeDimensions } from '@/lib/utils/shapeNodeDimensions';
import {
  calculateBounds,
  nodeDepth,
  resolveAbsolutePosition,
} from './nodeLayout';
import {
  renderSystemNode,
  renderTextLabel,
  renderAnnotationNode,
  renderGroupNode,
  renderShapeNode,
} from './renderNodes';
import { renderEdge } from './renderEdges';
import type { SystemNodeRenderData, EdgeRenderData } from './types';

export function generatePureSVG(
  nodes: Node[],
  edges: Edge[],
  isDark: boolean = true,
  backgroundColor: string = '#0f172a',
  layoutDirection: EdgeRouteDirection = 'LR',
  renderStyleId: DiagramRenderStyleId = 'precision',
): string {
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
      const eff = getEffectiveNodeDimensions(node);
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

  const nodeElements: string[] = [];
  const edgeElements: string[] = [];

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
      nodeElements.push(renderGroupNode(nodeData, isDark, renderStyleId));
    } else if (node.type === 'shapeNode') {
      nodeElements.push(renderShapeNode(nodeData, isDark, renderStyleId));
    } else {
      nodeElements.push(renderSystemNode(nodeData, isDark, renderStyleId));
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

  const nodeInternals = new Map(preparedNodes.map((n) => [n.id, n]));
  const labelLayouts = computeEdgeLabelLayout(processedEdges, nodeInternals, layoutDirection, renderStyleId);

  for (const edge of processedEdges) {
    const sourceNode = preparedNodes.find((n) => n.id === edge.source);
    const targetNode = preparedNodes.find((n) => n.id === edge.target);

    if (!sourceNode || !targetNode) continue;

    const route = computeEdgeRoute(edge, preparedNodes, processedEdges, layoutDirection);

    const sourceX = route.sourcePoint.x - bounds.minX;
    const sourceY = route.sourcePoint.y - bounds.minY;
    const targetX = route.targetPoint.x - bounds.minX;
    const targetY = route.targetPoint.y - bounds.minY;
    const sourcePos = route.sourcePosition;
    const targetPos = route.targetPosition;
    const isFloating = edge.type === 'simpleFloating' || (!edge.sourceHandle && !edge.targetHandle);

    const translatedWaypoints = route.waypoints.map((pt) => ({
      x: pt.x - bounds.minX,
      y: pt.y - bounds.minY,
    }));

    const isBrutal = renderStyleId === 'neubrutalism';
    const isStep = edge.data?.pathType === 'step';
    const borderRadius = isStep ? 0 : isBrutal ? 10 : 24;

    let svgPath = '';
    if (edge.source === edge.target) {
      const r = 40;
      svgPath = `M ${sourceX},${sourceY} C ${sourceX},${sourceY - r} ${targetX + r},${targetY} ${targetX},${targetY}`;
    } else if (translatedWaypoints.length > 0) {
      svgPath = buildSmoothStepSvg(translatedWaypoints, borderRadius);
    }

    const labelAnchor = labelLayouts.get(edge.id);
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

    edgeElements.push(renderEdge(edgeData, isDark, renderStyleId));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" preserveAspectRatio="xMidYMid meet">
  ${renderStyleId === 'neubrutalism' ? brutalShadowFilter(isDark) : ''}
  ${backgroundColor === 'none' ? '' : `<rect x="0" y="0" width="${width}" height="${height}" fill="${backgroundColor}"/>`}
  <g id="edges">
${edgeElements.map((e) => '    ' + e.replace(/\n/g, '\n    ')).join('\n')}
  </g>
  <g id="nodes">
${nodeElements.map((n) => '    ' + n.replace(/\n/g, '\n    ')).join('\n')}
  </g>
</svg>`.trim();
}
