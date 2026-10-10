import type { Edge, Node } from 'reactflow';
import type { DiagramRenderStyleId } from '@/lib/theme/renderStyles';
import type { NodeIconMode } from './nodeIconVisibility';
import { computeEdgeRoute, createEdgeRoutingContext, type EdgeRouteDirection, type EdgeRouteHandleAnchors, type EdgeRouteResult } from './edgeRouteBuilder';
import { computeEdgeLabelLayout, type EdgeLabelAnchor } from './edgeLabelLayout';
import { optimizeEdgeRoutes } from './edgeRouteOptimizer';
import { validateRenderedPath, getRenderedPathInteraction, type RenderedEdgePath } from './edgePathGeometry';
import type { GeometryStatus, GeometryViolation, Rect } from './geometryTypes';
import type { Position } from 'reactflow';
import { resolveEdgeFlowSemantics } from '@/lib/mermaid/edgeFlowSemantics';

export interface DiagramGeometryOptions {
  direction: EdgeRouteDirection;
  renderStyleId?: DiagramRenderStyleId;
  iconMode?: NodeIconMode;
  handleAnchors?: ReadonlyMap<string, EdgeRouteHandleAnchors>;
  revision?: string | number;
}

export interface DiagramGeometryPlan {
  key: string;
  status: GeometryStatus;
  routes: ReadonlyMap<string, EdgeRouteResult>;
  paths: ReadonlyMap<string, RenderedEdgePath>;
  labels: ReadonlyMap<string, EdgeLabelAnchor>;
  sourceSides: ReadonlyMap<string, Position>;
  targetSides: ReadonlyMap<string, Position>;
  bounds: ReadonlyMap<string, Rect>;
  violations: readonly GeometryViolation[];
  quality: {
    hardViolations: number;
    crossings: number;
    weightedCrossings: number;
    unexplainedPrivateOverlapLength: number;
    criticalPathDisconnectCount: number;
    bendCount: number;
    totalPathLength: number;
    area: number;
  };
  provisional?: boolean;
}

/** Re-route only routes that touch a moved node or its old/new obstacle box. */
export function computeDiagramGeometryPreview(
  previous: DiagramGeometryPlan,
  nodes: Node[],
  edges: Edge[],
  options: DiagramGeometryOptions,
): DiagramGeometryPlan {
  const rects = getBounds(nodes);
  const moved = new Set<string>();
  const affectedRects: Rect[] = [];
  for (const [id, next] of rects) {
    const old = previous.bounds.get(id);
    if (!old || Math.abs(old.x - next.x) > 0.1 || Math.abs(old.y - next.y) > 0.1 || old.width !== next.width || old.height !== next.height) {
      moved.add(id);
      if (old) affectedRects.push(old);
      affectedRects.push(next);
    }
  }
  const intersects = (a: Rect, b: Rect) => a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
  const routes = new Map(previous.routes);
  const paths = new Map(previous.paths);
  const sourceSides = new Map(previous.sourceSides);
  const targetSides = new Map(previous.targetSides);
  const affected = new Set(edges.filter(edge => moved.has(edge.source) || moved.has(edge.target)).map(edge => edge.id));
  for (const edge of edges) {
    if (affected.has(edge.id)) continue;
    const pathBounds = previous.paths.get(edge.id)?.bounds;
    if (pathBounds && affectedRects.some(rect => intersects(pathBounds, rect))) affected.add(edge.id);
  }
  const context = createEdgeRoutingContext(nodes, edges, options.direction, options.renderStyleId, options.iconMode);
  for (const edge of edges) {
    if (!affected.has(edge.id)) continue;
    const route = computeEdgeRoute(edge, nodes, edges, options.direction, options.renderStyleId, options.handleAnchors?.get(edge.id), options.iconMode, { context });
    routes.set(edge.id, route);
    paths.set(edge.id, route.renderedPath);
    sourceSides.set(edge.id, route.sourcePosition);
    targetSides.set(edge.id, route.targetPosition);
  }
  const labelNodes = new Map(nodes.map(node => {
    const rect = rects.get(node.id)!;
    return [node.id, { ...node, position: { x: rect.x, y: rect.y }, positionAbsolute: { x: rect.x, y: rect.y }, parentNode: undefined, parentId: undefined } as Node];
  }));
  const labels = computeEdgeLabelLayout(edges, labelNodes, options.direction, options.renderStyleId, routes, options.iconMode);
  const totalPathLength = [...paths.values()].reduce((sum, path) => sum + path.length, 0);
  return {
    ...previous,
    key: `${previous.key}:preview:${[...rects].map(([id, rect]) => `${id},${rect.x},${rect.y}`).join(';')}`,
    status: 'degraded',
    routes,
    paths,
    labels,
    sourceSides,
    targetSides,
    bounds: new Map([...previous.bounds, ...rects]),
    // Full validation is deferred until pointer-up; stale diagnostics must not
    // be presented as current while a node is moving.
    violations: [],
    quality: { ...previous.quality, totalPathLength },
    provisional: true,
  };
}

function isGroup(node: Node): boolean {
  return node.type === 'groupNode' || node.type === 'group' || (node.data as { isGroup?: boolean } | undefined)?.isGroup === true;
}

function absolutePosition(node: Node, nodesById: ReadonlyMap<string, Node>): { x: number; y: number } {
  const position = (node as Node & { positionAbsolute?: { x: number; y: number } }).positionAbsolute;
  if (position) return position;
  let x = node.position.x, y = node.position.y;
  let parent = node.parentNode ?? (node as Node & { parentId?: string }).parentId;
  const seen = new Set([node.id]);
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    const parentNode = nodesById.get(parent);
    if (!parentNode) break;
    x += parentNode.position.x;
    y += parentNode.position.y;
    parent = parentNode.parentNode ?? (parentNode as Node & { parentId?: string }).parentId;
  }
  return { x, y };
}

function getBounds(nodes: readonly Node[]): Map<string, Rect> {
  const byId = new Map(nodes.map(node => [node.id, node]));
  return new Map(nodes.map(node => {
    const position = absolutePosition(node, byId);
    const width = node.width ?? (node.data as { nodeWidth?: number } | undefined)?.nodeWidth ?? 200;
    const height = node.height ?? (node.data as { nodeHeight?: number } | undefined)?.nodeHeight ?? 88;
    return [node.id, { x: position.x, y: position.y, width, height }];
  }));
}

function ancestors(node: Node, nodesById: ReadonlyMap<string, Node>): Set<string> {
  const result = new Set<string>();
  let parent = node.parentNode ?? (node as Node & { parentId?: string }).parentId;
  while (parent && !result.has(parent)) {
    result.add(parent);
    const parentNode = nodesById.get(parent);
    parent = parentNode?.parentNode ?? (parentNode as Node & { parentId?: string } | undefined)?.parentId;
  }
  return result;
}

function countBends(route: EdgeRouteResult): number {
  const points = route.waypoints;
  let bends = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    if (Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) > 0.5) bends++;
  }
  return bends;
}

export function geometrySnapshotKey(nodes: Node[], edges: Edge[], options: DiagramGeometryOptions, bounds: ReadonlyMap<string, Rect> = getBounds(nodes)): string {
  return JSON.stringify([
    options.revision ?? 0,
    options.direction,
    options.renderStyleId ?? '',
    options.iconMode ?? '',
    nodes.map(node => [node.id, node.type, node.parentNode, (node as Node & { parentId?: string }).parentId, bounds.get(node.id), node.data]),
    edges.map(edge => [edge.id, edge.source, edge.target, edge.sourceHandle, edge.targetHandle, edge.label, edge.data, edge.style]),
    [...(options.handleAnchors ?? new Map()).entries()],
  ]);
}

export function computeDiagramGeometryPlan(
  nodes: Node[],
  edges: Edge[],
  options: DiagramGeometryOptions,
): DiagramGeometryPlan {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const bounds = getBounds(nodes);
  // Label placement works in canvas coordinates. Normalize parent-relative
  // nodes once so grouped diagrams share the same absolute geometry as routes.
  const nodeInternals = new Map(nodes.map(node => {
    const rect = bounds.get(node.id)!;
    return [node.id, {
      ...node,
      position: { x: rect.x, y: rect.y },
      positionAbsolute: { x: rect.x, y: rect.y },
      parentNode: undefined,
      parentId: undefined,
    } as Node];
  }));
  const routes = new Map<string, EdgeRouteResult>();
  const paths = new Map<string, RenderedEdgePath>();
  const sourceSides = new Map<string, Position>();
  const targetSides = new Map<string, Position>();
  const violations: GeometryViolation[] = [];
  const routeOptimization = optimizeEdgeRoutes({
    nodes, edges, direction: options.direction, renderStyleId: options.renderStyleId,
    iconMode: options.iconMode, handleAnchors: options.handleAnchors,
  });
  const optimizedRoutes = routeOptimization.routes;

  const leafNodes = nodes.filter(node => !isGroup(node));
  for (let i = 0; i < leafNodes.length; i++) for (let j = i + 1; j < leafNodes.length; j++) {
    const a = bounds.get(leafNodes[i].id), b = bounds.get(leafNodes[j].id);
    if (a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) {
      violations.push({ severity: 'hard', code: 'NODE_COLLISION', nodeId: leafNodes[i].id, otherNodeId: leafNodes[j].id });
    }
  }

  for (const edge of edges) {
    const route = optimizedRoutes.get(edge.id) ?? computeEdgeRoute(
      edge, nodes, edges, options.direction, options.renderStyleId,
      options.handleAnchors?.get(edge.id), options.iconMode,
    );
    routes.set(edge.id, route);
    paths.set(edge.id, route.renderedPath);
    sourceSides.set(edge.id, route.sourcePosition);
    targetSides.set(edge.id, route.targetPosition);
    for (const violation of route.violations) {
      if (violation.code === 'OBSTACLE_INTERSECTION') {
        violations.push({ severity: 'hard', code: 'OBSTACLE_INTERSECTION', edgeId: edge.id, obstacleId: violation.obstacleId });
      } else if (violation.code === 'TERMINAL_INTERSECTION') {
        violations.push({ severity: 'hard', code: 'TERMINAL_INTERSECTION', edgeId: edge.id, nodeId: violation.nodeId });
      }
    }
    const sourceNode = nodeById.get(edge.source), targetNode = nodeById.get(edge.target);
    const passable = new Set<string>([
      ...(sourceNode ? ancestors(sourceNode, nodeById) : []),
      ...(targetNode ? ancestors(targetNode, nodeById) : []),
    ]);
    const obstacles = nodes
      .filter(node => node.id !== edge.source && node.id !== edge.target && (!isGroup(node) || !passable.has(node.id)))
      .flatMap(node => {
        const rect = bounds.get(node.id);
        return rect ? [{ id: node.id, rect }] : [];
      });
    const renderedRouteViolations: EdgeRouteResult['violations'] = [];
    for (const violation of validateRenderedPath(route.renderedPath, obstacles, 3)) {
      if (violation.code === 'PATH_OBSTACLE_INTERSECTION'
        && !violations.some(item => item.code === 'OBSTACLE_INTERSECTION' && item.edgeId === edge.id && item.obstacleId === violation.obstacleId)) {
        violations.push({ severity: 'hard', code: 'OBSTACLE_INTERSECTION', edgeId: edge.id, obstacleId: violation.obstacleId });
      }
      if (violation.code === 'PATH_OBSTACLE_INTERSECTION') {
        renderedRouteViolations.push({ code: 'OBSTACLE_INTERSECTION', obstacleId: violation.obstacleId });
      }
    }
    if (renderedRouteViolations.length) {
      const routeViolations = [...route.violations];
      const existingObstacleIds = new Set(routeViolations.flatMap(item => item.code === 'OBSTACLE_INTERSECTION' ? [(item as { obstacleId: string }).obstacleId] : []));
      for (const violation of renderedRouteViolations) {
        const obstacleId = (violation as { obstacleId: string }).obstacleId;
        if (!existingObstacleIds.has(obstacleId)) {
          routeViolations.push(violation);
          existingObstacleIds.add(obstacleId);
        }
      }
      routes.set(edge.id, { ...route, status: 'invalid', violations: routeViolations });
    }
  }

  let crossings = 0;
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const a = edges[i], b = edges[j];
    if ([a.source, a.target].some(id => id === b.source || id === b.target)) continue;
    const pathA = paths.get(a.id), pathB = paths.get(b.id);
    if (pathA && pathB && getRenderedPathInteraction(pathA, pathB).crossing) {
      crossings++;
      violations.push({ severity: 'soft', code: 'EDGE_CROSSING', edgeId: a.id, otherEdgeId: b.id });
    }
  }
  for (const diagnostic of routeOptimization.diagnostics) {
    if (diagnostic.kind === 'private-overlap') {
      violations.push({ severity: 'soft', code: 'PRIVATE_ROUTE_OVERLAP', edgeId: diagnostic.edgeId, otherEdgeId: diagnostic.otherEdgeId, length: diagnostic.amount ?? 0 });
    }
  }

  const labels = computeEdgeLabelLayout(edges, nodeInternals, options.direction, options.renderStyleId, routes, options.iconMode);
  for (const [edgeId, anchor] of labels) {
    const edge = edges.find(candidate => candidate.id === edgeId);
    if (!edge) continue;
    const raw = edge.label ?? (edge.data as { label?: unknown; responseLabel?: unknown } | undefined)?.label;
    const response = (edge.data as { responseLabel?: unknown } | undefined)?.responseLabel;
    const label = [raw, response].filter(value => typeof value === 'string' && value.trim()).join(' / ');
    if (!label.trim()) continue;
    const width = Math.min(260, Math.max(48, label.length * 8 + 24)), height = 24;
    const rect = { x: anchor.x - width / 2, y: anchor.y - height / 2, width, height };
    const obstruction = leafNodes.find(node => {
      if (node.id === edge.source || node.id === edge.target) return false;
      const box = bounds.get(node.id);
      return box && rect.x < box.x + box.width && rect.x + rect.width > box.x && rect.y < box.y + box.height && rect.y + rect.height > box.y;
    });
    if (obstruction) violations.push({ severity: 'hard', code: 'LABEL_COLLISION', edgeId, withId: obstruction.id });
    const titleObstruction = nodes.find(node => {
      if (!isGroup(node)) return false;
      const box = bounds.get(node.id);
      if (!box) return false;
      const titleStrip = { x: box.x, y: box.y, width: box.width, height: Math.min(40, box.height) };
      return rect.x < titleStrip.x + titleStrip.width && rect.x + rect.width > titleStrip.x
        && rect.y < titleStrip.y + titleStrip.height && rect.y + rect.height > titleStrip.y;
    });
    if (titleObstruction) violations.push({ severity: 'hard', code: 'LABEL_COLLISION', edgeId, withId: titleObstruction.id });
  }
  const hardViolations = violations.filter(violation => violation.severity === 'hard').length;
  const hasFailedRoute = [...routes.values()].some(route => route.status === 'failed');
  const hasSoftIssues = violations.some(violation => violation.severity === 'soft');
  const status: GeometryStatus = hasFailedRoute ? 'failed' : hardViolations ? 'invalid' : hasSoftIssues ? 'degraded' : 'ok';
  const rects = [...bounds.values()];
  const area = rects.length
    ? (Math.max(...rects.map(rect => rect.x + rect.width)) - Math.min(...rects.map(rect => rect.x)) || 0)
      * (Math.max(...rects.map(rect => rect.y + rect.height)) - Math.min(...rects.map(rect => rect.y)) || 0)
    : 0;
  const flow = resolveEdgeFlowSemantics(nodes, edges);
  const criticalPathDisconnectCount = flow.mainPathEdgeIds.filter(edgeId => {
    const route = routes.get(edgeId);
    return !route || route.status !== 'ok';
  }).length;
  const weightedCrossings = violations.filter((violation): violation is Extract<GeometryViolation, { code: 'EDGE_CROSSING' }> => violation.code === 'EDGE_CROSSING')
    .reduce((sum, violation) => {
      const role = flow.assignments.get(violation.edgeId)?.role;
      return sum + (role === 'main' ? 10 : role === 'branch' ? 4 : role === 'feedback' ? 2 : 1);
    }, 0);
  const unexplainedPrivateOverlapLength = violations.reduce((sum, violation) => sum + (violation.code === 'PRIVATE_ROUTE_OVERLAP' ? violation.length : 0), 0);
  const quality = {
    hardViolations,
    crossings,
    weightedCrossings,
    unexplainedPrivateOverlapLength,
    criticalPathDisconnectCount,
    bendCount: [...routes.values()].reduce((sum, route) => sum + countBends(route), 0),
    totalPathLength: [...paths.values()].reduce((sum, path) => sum + path.length, 0),
    area,
  };
  const key = geometrySnapshotKey(nodes, edges, options, bounds);
  return { key, status, routes, paths, labels, sourceSides, targetSides, bounds, violations, quality };
}

const settledPlans = new Map<string, DiagramGeometryPlan>();
export function getCachedDiagramGeometryPlan(nodes: Node[], edges: Edge[], options: DiagramGeometryOptions): DiagramGeometryPlan {
  const key = geometrySnapshotKey(nodes, edges, options);
  const cached = settledPlans.get(key);
  if (cached) {
    settledPlans.delete(key);
    settledPlans.set(key, cached);
    return cached;
  }
  const plan = computeDiagramGeometryPlan(nodes, edges, options);
  settledPlans.set(key, plan);
  if (settledPlans.size > 8) settledPlans.delete(settledPlans.keys().next().value!);
  return plan;
}
