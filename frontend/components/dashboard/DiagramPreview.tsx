'use client';

import { useMemo } from 'react';
import type { Node, Edge } from 'reactflow';
import {
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  Position,
} from 'reactflow';
import {
  getNodeCenter,
} from '@/lib/utils/simpleFloatingEdge';
import { computeEdgeRoute } from '@/lib/utils/edgeRouteBuilder';
import { buildSmoothStepSvg } from '@/lib/utils/collisionFreeEdgePath';
import { EDGE_TYPE_CONFIGS, getEdgeConfig, type EdgeType } from '@/data/edgeTypes';

interface DiagramPreviewProps {
  nodes: Node[];
  edges: Edge[];
  width?: number;
  height?: number;
  simplified?: boolean;
}

const DEFAULT_NODE_WIDTH = 160;
const DEFAULT_NODE_HEIGHT = 80;
const NODE_RADIUS = 10;

function getNodeWidth(node: Node): number {
  return Number(node.data?.nodeWidth) || node.width || DEFAULT_NODE_WIDTH;
}

function getNodeHeight(node: Node): number {
  return Number(node.data?.nodeHeight) || node.height || DEFAULT_NODE_HEIGHT;
}

function getTierColor(layer?: string): string {
  const tier = (layer || 'compute').toLowerCase();
  const colorMap: Record<string, string> = {
    client: '#64748b',
    edge: '#3b82f6',
    gateway: '#3b82f6',
    compute: '#0d9488',
    service: '#0d9488',
    async: '#d97706',
    queue: '#d97706',
    data: '#3b82f6',
    database: '#3b82f6',
    observe: '#1E90FF',
    external: '#ec4899',
    devops: '#f97316',
  };
  return colorMap[tier] || colorMap.compute;
}

const PASTEL_TO_SATURATED: Record<string, string> = {
  '#eff6ff': '#3b82f6',
  '#f0fdf4': '#22c55e',
  '#fefce8': '#f59e0b',
  '#fdf2f8': '#ec4899',
  '#eef2ff': '#2563eb',
  '#fff7ed': '#f97316',
  '#faf5ff': '#a855f7',
  '#f0fdfa': '#14b8a6',
};

function normalizeGroupColor(c?: string): string | undefined {
  if (!c) return c;
  return PASTEL_TO_SATURATED[c.toLowerCase()] ?? c;
}

function getDeterministicColor(str: string): string {
  const colors = ['#2563eb', '#22c55e', '#ec4899', '#f97316', '#14b8a6', '#3b82f6', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getEdgeType(edge: Edge): EdgeType {
  return (edge.data?.connectionType || edge.data?.edgeType || 'sync') as EdgeType;
}

function getEdgeColor(edge: Edge): string {
  if (edge.data?.color) return edge.data.color;
  const config = getEdgeConfig(getEdgeType(edge));
  return config.color || EDGE_TYPE_CONFIGS.sync.color;
}

function getEdgeDashArray(edge: Edge): string | undefined {
  if (edge.style?.strokeDasharray) return String(edge.style.strokeDasharray);
  if (edge.data?.edgeVariant === 'dotted' || edge.data?.connectionType === 'dotted') return '2,4';
  if (edge.data?.edgeVariant === 'dashed') return '8,4';
  const config = getEdgeConfig(getEdgeType(edge));
  return config.dash || undefined;
}

export function DiagramPreview({ nodes, edges, width = 280, height = 160 }: DiagramPreviewProps) {
  const nodeCount = nodes?.length || 0;

  // Calculate bounding box INCLUDING full node dimensions
  const { scale, offsetX, offsetY } = useMemo(() => {
    if (nodeCount === 0) {
      return { minX: 0, minY: 0, maxX: 400, maxY: 300, diagramWidth: 400, diagramHeight: 300, scale: 1, offsetX: 0, offsetY: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Bounding box should include the ENTIRE node, not just position
    nodes.forEach((node) => {
      const x = node.position.x;
      const y = node.position.y;
      const w = getNodeWidth(node);
      const h = getNodeHeight(node);

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });

    // Match canvas fitView more closely without making first-row cards look padded.
    const paddingAdjustment = 28;
    minX -= paddingAdjustment;
    minY -= paddingAdjustment;
    maxX += paddingAdjustment;
    maxY += paddingAdjustment;

    const diagramWidth = maxX - minX;
    const diagramHeight = maxY - minY;

    // Calculate scale to fit in container
    const scaleX = width / diagramWidth;
    const scaleY = height / diagramHeight;
    const scale = Math.min(scaleX, scaleY);

    // Calculate offsets to center the diagram in the container
    const scaledWidth = diagramWidth * scale;
    const scaledHeight = diagramHeight * scale;
    const offsetX = (width - scaledWidth) / 2 - minX * scale;
    const offsetY = (height - scaledHeight) / 2 - minY * scale;

    return { minX, minY, maxX, maxY, diagramWidth, diagramHeight, scale, offsetX, offsetY };
  }, [nodes, width, height, nodeCount]);

  // Transform function: converts canvas coordinates to SVG viewBox coordinates (centered)
  const transform = (x: number, y: number) => {
    return {
      x: x * scale + offsetX,
      y: y * scale + offsetY,
    };
  };

  // Transform dimensions
  const transformSize = (w: number, h: number) => {
    return {
      width: w * scale,
      height: h * scale,
    };
  };

  const previewNodeInternals = useMemo(() => {
    return new Map(
      nodes.map((node) => [
        node.id,
        {
          ...node,
          width: getNodeWidth(node),
          height: getNodeHeight(node),
          positionAbsolute: node.position,
        } as Node,
      ])
    );
  }, [nodes]);

  // Generate edge path with the same side selection and handle offsets as SimpleFloatingEdge.
  const generateEdgePath = (edge: Edge, sourceNode: Node, targetNode: Node): string => {
    if (!sourceNode || !targetNode) return '';

    const nodesList = Array.from(previewNodeInternals.values());
    const route = computeEdgeRoute(edge, nodesList, edges);

    const transformPt = (pt: { x: number; y: number }) => transform(pt.x, pt.y);

    const tSource = transformPt(route.sourcePoint);
    const tTarget = transformPt(route.targetPoint);
    const normalizedPathType = String(edge.data?.pathType || getEdgeConfig(getEdgeType(edge)).pathType || 'Smoothstep').toLowerCase();

    if (normalizedPathType === 'straight') {
      const [path] = getStraightPath({
        sourceX: tSource.x,
        sourceY: tSource.y,
        targetX: tTarget.x,
        targetY: tTarget.y,
      });
      return path;
    }

    if (normalizedPathType === 'bezier') {
      const [path] = getBezierPath({
        sourceX: tSource.x,
        sourceY: tSource.y,
        targetX: tTarget.x,
        targetY: tTarget.y,
      });
      return path;
    }

    if (edge.source === edge.target) {
      const r = 40 * scale;
      return `M ${tSource.x},${tSource.y} C ${tSource.x},${tSource.y - r} ${tTarget.x + r},${tTarget.y} ${tTarget.x},${tTarget.y}`;
    }

    const transformedWaypoints = route.waypoints.map(transformPt);
    const isStep = edge.data?.pathType === 'step';
    const borderRadius = isStep ? 0 : 40 * scale;
    return buildSmoothStepSvg(transformedWaypoints, borderRadius);
  };

  if (nodeCount === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: '#FAFAFA' }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100">
          <div className="w-3 h-3 rounded-full bg-gray-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full" style={{ background: 'var(--surface-page)' }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id={`preview-grid-${width}-${height}`} width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.55" fill="var(--border-default)" opacity="0.65" />
          </pattern>
          {edges.map((edge, index) => {
            const color = getEdgeColor(edge);
            return (
              <marker
                key={`${edge.id || 'edge'}-${index}-marker`}
                id={`preview-arrowhead-${edge.id || index}`}
                markerWidth="4"
                markerHeight="4"
                refX="3.4"
                refY="2"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0 0 L 0 4 L 4 2 z" fill={color} />
              </marker>
            );
          })}
        </defs>
        <rect width={width} height={height} fill={`url(#preview-grid-${width}-${height})`} />

        {/* Render edges first (behind nodes) */}
        {edges.map((edge, index) => {
          const sourceNode = nodes.find((n) => n.id === edge.source);
          const targetNode = nodes.find((n) => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;

          const path = generateEdgePath(edge, sourceNode, targetNode);
          if (!path) return null;

          return (
            <path
              key={`${edge.id || 'edge'}-${index}`}
              d={path}
              fill="none"
              stroke={getEdgeColor(edge)}
              strokeWidth={1.5}
              strokeDasharray={getEdgeDashArray(edge)}
              markerEnd={`url(#preview-arrowhead-${edge.id || index})`}
              opacity={0.85}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* Render nodes */}
        {nodes.map((node) => {
          const { x, y } = transform(node.position.x, node.position.y);
          const { width: w, height: h } = transformSize(
            getNodeWidth(node),
            getNodeHeight(node)
          );

          // Skip if outside visible area
          if (x + w < -10 || x > width + 10 || y + h < -10 || y > height + 10) return null;

          const accentColor = node.data?.accentColor || node.data?.color || getTierColor(node.data?.layer as string | undefined);
          const isGroup = node.type === 'group' || node.data?.isGroup;

          if (isGroup) {
            const rawGroupColor = (node.data?.accentColor as string | undefined) || (node.data?.groupColor as string | undefined) || getDeterministicColor(node.id);
            const groupColor = normalizeGroupColor(rawGroupColor) ?? rawGroupColor;
            return (
              <g key={node.id}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={8 * scale}
                  fill={groupColor}
                  fillOpacity={0.12}
                  stroke={groupColor}
                  strokeWidth={2 * scale}
                  strokeDasharray="5,3"
                />
              </g>
            );
          }

          return (
            <g key={node.id}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={NODE_RADIUS * scale}
                fill="#efefe8"
                transform={`translate(${10 * scale} ${10 * scale})`}
                opacity={0.95}
              />
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={NODE_RADIUS * scale}
                fill="#e1e1da"
                transform={`translate(${5 * scale} ${5 * scale})`}
                opacity={0.95}
              />
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={NODE_RADIUS * scale}
                fill="#ffffff"
                stroke="#595959"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
              {w > 28 && h > 18 && (
                <>
                  <rect
                    x={x + 10 * scale}
                    y={y + 8 * scale}
                    width={24 * scale}
                    height={24 * scale}
                    rx={6 * scale}
                    fill={accentColor}
                    opacity={0.12}
                  />
                  <rect
                    x={x + 17 * scale}
                    y={y + 15 * scale}
                    width={10 * scale}
                    height={10 * scale}
                    rx={2.5 * scale}
                    fill={accentColor}
                  />
                </>
              )}
              {node.data?.label && w > 72 && h > 32 && (
                <text
                  x={x + 40 * scale}
                  y={y + 24 * scale}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fontSize={Math.max(4.5, 12 * scale)}
                  fontWeight="700"
                  fill="#595959"
                >
                  {String(node.data.label).length > 18
                    ? String(node.data.label).slice(0, 18) + '...'
                    : node.data.label}
                </text>
              )}
              {node.data?.subtitle && w > 96 && h > 52 && (
                <text
                  x={x + 10 * scale}
                  y={y + h - 12 * scale}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fontSize={Math.max(4, 10 * scale)}
                  fontWeight="500"
                  fill="#7a7a7a"
                >
                  {String(node.data.subtitle).length > 22
                    ? String(node.data.subtitle).slice(0, 22) + '...'
                    : node.data.subtitle}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
