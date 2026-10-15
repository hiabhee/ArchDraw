import type { Edge, Node } from 'reactflow';
import type { EdgeRouteDirection, EdgeRouteHandleAnchors, EdgeRouteResult } from './edgeRouteBuilder';
import { computeEdgeRoute, createEdgeRoutingContext } from './edgeRouteBuilder';
import { getRenderedPathInteraction, type RenderedEdgePath } from './edgePathGeometry';
import type { NodeIconMode } from '../nodes/nodeIconVisibility';
import { resolveEdgeFlowSemantics, type ResolvedEdgeFlowAssignment } from '@/lib/diagram/mermaid/edgeFlowSemantics';

const RIP_UP_PASSES = 2;
const LANE_CANDIDATE_DELTAS = [0, -28, 28] as const;
const FEEDBACK_CORRIDOR_DELTAS = [-144, 144] as const;
const CROSSING_COST = 320;
const SHARED_PRIVATE_COST_PER_10PX = 8;
const BEND_COST = 32;

export interface RouteOptimizationInput {
  nodes: readonly Node[];
  edges: readonly Edge[];
  direction: EdgeRouteDirection;
  renderStyleId?: string;
  iconMode?: NodeIconMode;
  handleAnchors?: ReadonlyMap<string, EdgeRouteHandleAnchors>;
  searchBudget?: { perRouteStates?: number; totalStates?: number; ripUpPasses?: number; maxCandidateRoutes?: number };
}

export interface RouteOptimizationResult {
  routes: ReadonlyMap<string, EdgeRouteResult>;
  diagnostics: readonly { edgeId: string; otherEdgeId: string; kind: 'crossing' | 'private-overlap'; amount?: number }[];
  stats: { candidateRoutes: number; ripUpPasses: number; expandedStates: number };
}

export function getEdgeRoutePriority(edge: Edge, semantics?: ResolvedEdgeFlowAssignment): number {
  const data = edge.data as Record<string, unknown> | undefined;
  if (Array.isArray(data?.customWaypoints) && data.customWaypoints.length > 0) return 100;
  const role = semantics?.role ?? data?.flowRole;
  if (data?.importance === 'primary' || role === 'main') return 5;
  if (role === 'branch' || data?.importance === 'secondary') return 3;
  if (role === 'feedback' || data?.importance === 'diagnostic' || data?.importance === 'optional') return 1;
  return 2;
}

function edgeKey(edge: Edge): string {
  const data = edge.data as Record<string, unknown> | undefined;
  return [edge.source, edge.target, String(edge.label ?? data?.label ?? '').trim().toLowerCase(), edge.id].join('\u0000');
}

const properCross = (a: RenderedEdgePath, b: RenderedEdgePath) => getRenderedPathInteraction(a, b).crossing;

type Pt = { x: number; y: number };

/** Length two axis-aligned legs share when both end at `end` and run the same way into it. */
function sharedLeg(endA: Pt, prevA: Pt, endB: Pt, prevB: Pt): number {
  if (Math.hypot(endA.x - endB.x, endA.y - endB.y) > 1) return 0;
  const horizontal = Math.abs(prevA.y - endA.y) < 0.5 && Math.abs(prevB.y - endB.y) < 0.5
    && Math.sign(endA.x - prevA.x) === Math.sign(endB.x - prevB.x);
  const vertical = Math.abs(prevA.x - endA.x) < 0.5 && Math.abs(prevB.x - endB.x) < 0.5
    && Math.sign(endA.y - prevA.y) === Math.sign(endB.y - prevB.y);
  if (!horizontal && !vertical) return 0;
  return Math.min(Math.hypot(endA.x - prevA.x, endA.y - prevA.y), Math.hypot(endB.x - prevB.x, endB.y - prevB.y));
}

/**
 * Edges into the same point may share their last leg (a fan-in trunk ending in
 * one arrow), and edges out of the same point their first leg. That is a merge,
 * not an overlap: without this, one of two mirrored edges is pushed into a side
 * lane and the pair loses its symmetry.
 */
function sharedTerminalLegs(a: EdgeRouteResult, b: EdgeRouteResult): number {
  const wa = a.waypoints, wb = b.waypoints;
  if (wa.length < 2 || wb.length < 2) return 0;
  // Same start and same end (parallel edges between one pair): they must stay apart.
  const same = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y) <= 1;
  if (same(wa[0], wb[0]) && same(wa[wa.length - 1], wb[wb.length - 1])) return 0;
  return sharedLeg(wa[wa.length - 1], wa[wa.length - 2], wb[wb.length - 1], wb[wb.length - 2])
    + sharedLeg(wa[0], wa[1], wb[0], wb[1]);
}

/** Parallel segments closer than this run on top of each other. */
const COLLINEAR_GAP = 3;

/**
 * Exact length two orthogonal routes run on top of each other, from their
 * waypoints. The rendered-path check samples only a few points per path, so a
 * long shared vertical run (several edges on one bus) can fall between samples.
 */
function collinearOverlap(a: EdgeRouteResult, b: EdgeRouteResult): number {
  let total = 0;
  const wa = a.waypoints, wb = b.waypoints;
  for (let i = 1; i < wa.length; i++) for (let j = 1; j < wb.length; j++) {
    const p = wa[i - 1], q = wa[i], r = wb[j - 1], t = wb[j];
    if (Math.abs(p.y - q.y) < 0.5 && Math.abs(r.y - t.y) < 0.5 && Math.abs(p.y - r.y) <= COLLINEAR_GAP) {
      total += Math.max(0, Math.min(Math.max(p.x, q.x), Math.max(r.x, t.x)) - Math.max(Math.min(p.x, q.x), Math.min(r.x, t.x)));
    } else if (Math.abs(p.x - q.x) < 0.5 && Math.abs(r.x - t.x) < 0.5 && Math.abs(p.x - r.x) <= COLLINEAR_GAP) {
      total += Math.max(0, Math.min(Math.max(p.y, q.y), Math.max(r.y, t.y)) - Math.max(Math.min(p.y, q.y), Math.min(r.y, t.y)));
    }
  }
  return total;
}

/** Overlap between two routes that is not an intentional shared terminal leg. */
function privateOverlapLength(a: EdgeRouteResult, b: EdgeRouteResult): number {
  const overlap = Math.max(getRenderedPathInteraction(a.renderedPath, b.renderedPath).privateOverlap, collinearOverlap(a, b));
  return overlap > 0 ? Math.max(0, overlap - sharedTerminalLegs(a, b)) : 0;
}

function boundsMayInteract(a: RenderedEdgePath, b: RenderedEdgePath): boolean {
  const gap = 4;
  return a.bounds.x <= b.bounds.x + b.bounds.width + gap
    && a.bounds.x + a.bounds.width + gap >= b.bounds.x
    && a.bounds.y <= b.bounds.y + b.bounds.height + gap
    && a.bounds.y + a.bounds.height + gap >= b.bounds.y;
}

function conflictsWithRoutes(
  edge: Edge,
  route: EdgeRouteResult,
  fixed: ReadonlyMap<string, EdgeRouteResult>,
  edgeById: ReadonlyMap<string, Edge>,
): boolean {
  if (route.status !== 'ok') return true;
  for (const [id, otherRoute] of fixed) {
    if (!boundsMayInteract(route.renderedPath, otherRoute.renderedPath)) continue;
    const other = edgeById.get(id);
    if (!other) continue;
    const sharesNode = [edge.source, edge.target].some(nodeId => nodeId === other.source || nodeId === other.target);
    if (!sharesNode && properCross(route.renderedPath, otherRoute.renderedPath)) return true;
    if (privateOverlapLength(route, otherRoute) > 10) return true;
  }
  return false;
}

function bendCount(route: EdgeRouteResult): number {
  let count = 0;
  for (let i = 1; i < route.waypoints.length - 1; i++) {
    const a = route.waypoints[i - 1], b = route.waypoints[i], c = route.waypoints[i + 1];
    if (Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) > 0.5) count++;
  }
  return count;
}

function globalCost(edges: readonly Edge[], routes: ReadonlyMap<string, EdgeRouteResult>): number {
  let cost = 0;
  for (const edge of edges) {
    const route = routes.get(edge.id);
    if (!route) { cost += 1_000_000; continue; }
    if (route.status !== 'ok') cost += 1_000_000 + route.violations.length * 100_000;
    cost += route.renderedPath.length + bendCount(route) * BEND_COST;
  }
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const left = edges[i], right = edges[j];
    const ra = routes.get(left.id), rb = routes.get(right.id);
    if (!ra || !rb) continue;
    const a = ra.renderedPath, b = rb.renderedPath;
    if (!boundsMayInteract(a, b)) continue;
    const sharesNode = [left.source, left.target].some(id => id === right.source || id === right.target);
    if (!sharesNode && properCross(a, b)) cost += CROSSING_COST;
    const overlap = privateOverlapLength(ra, rb);
    cost += Math.ceil(overlap / 10) * SHARED_PRIVATE_COST_PER_10PX;
  }
  return cost;
}

function hasRouteConflicts(edges: readonly Edge[], routes: ReadonlyMap<string, EdgeRouteResult>): boolean {
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i], route = routes.get(edge.id);
    if (!route || route.status !== 'ok') return true;
    for (let j = i + 1; j < edges.length; j++) {
      const otherEdge = edges[j], otherRoute = routes.get(otherEdge.id);
      if (!otherRoute || !boundsMayInteract(route.renderedPath, otherRoute.renderedPath)) continue;
      const sharesNode = [edge.source, edge.target].some(id => id === otherEdge.source || id === otherEdge.target);
      if (!sharesNode && properCross(route.renderedPath, otherRoute.renderedPath)) return true;
      if (privateOverlapLength(route, otherRoute) > 10) return true;
    }
  }
  return false;
}

function incrementalCost(edge: Edge, route: EdgeRouteResult, fixed: ReadonlyMap<string, EdgeRouteResult>, edgeById: ReadonlyMap<string, Edge>): number {
  let cost = route.status === 'ok' ? 0 : 1_000_000 + route.violations.length * 100_000;
  cost += route.renderedPath.length + bendCount(route) * BEND_COST;
  for (const [id, otherRoute] of fixed) {
    const other = edgeById.get(id);
    if (!other) continue;
    if (!boundsMayInteract(route.renderedPath, otherRoute.renderedPath)) continue;
    const sharesNode = [edge.source, edge.target].some(nodeId => nodeId === other.source || nodeId === other.target);
    if (!sharesNode && properCross(route.renderedPath, otherRoute.renderedPath)) cost += CROSSING_COST;
    cost += Math.ceil(privateOverlapLength(route, otherRoute) / 10) * SHARED_PRIVATE_COST_PER_10PX;
  }
  return cost;
}

export function optimizeEdgeRoutes(input: RouteOptimizationInput): RouteOptimizationResult {
  const semantics = resolveEdgeFlowSemantics(input.nodes, input.edges);
  const edgePriority = (edge: Edge) => getEdgeRoutePriority(edge, semantics.assignments.get(edge.id));
  const edges = [...input.edges].sort((a, b) => edgePriority(b) - edgePriority(a) || edgeKey(a).localeCompare(edgeKey(b)));
  const routes = new Map<string, EdgeRouteResult>();
  const context = createEdgeRoutingContext(input.nodes as Node[], input.edges as Edge[], input.direction, input.renderStyleId, input.iconMode);
  const endpointGroups = new Map<string, Edge[]>();
  for (const edge of edges) {
    const key = JSON.stringify([edge.source, edge.target]);
    const group = endpointGroups.get(key) ?? [];
    group.push(edge); endpointGroups.set(key, group);
  }
  const laneById = new Map<string, number>();
  for (const group of endpointGroups.values()) {
    group.sort((a, b) => a.id.localeCompare(b.id));
    group.forEach((edge, i) => laneById.set(edge.id, (i - (group.length - 1) / 2) * 28));
  }
  const orderById = new Map(edges.map((edge, i) => [edge.id, i]));
  // Reserve one base route for every edge; optional lanes and repairs have a
  // separate bounded pool so a dense graph can never starve its last edges.
  let extraCandidates = Math.max(0, (input.searchBudget?.maxCandidateRoutes ?? edges.length * 4) - edges.length);
  const edgeById = new Map(input.edges.map(edge => [edge.id, edge]));
  let candidateRoutes = 0;
  let expandedStates = 0;
  const perRouteBudget = input.searchBudget?.perRouteStates ?? 12_000;
  const totalStateBudget = input.searchBudget?.totalStates ?? 400_000;
  const ripUpBudget = input.searchBudget?.ripUpPasses ?? RIP_UP_PASSES;

  const routeAt = (edge: Edge, laneOffset: number) => {
    candidateRoutes++;
    const remainingBudget = Math.max(0, totalStateBudget - expandedStates);
    const route = computeEdgeRoute(
      edge,
      input.nodes as Node[],
      input.edges as Edge[],
      input.direction,
      input.renderStyleId,
      input.handleAnchors?.get(edge.id),
      input.iconMode,
      {
        laneOffset,
        context,
        searchBudget: { maxExpandedStates: Math.min(perRouteBudget, remainingBudget) },
      },
    );
    expandedStates += route.expandedStates ?? 0;
    return route;
  };

  const bestCandidate = (edge: Edge, fixed: ReadonlyMap<string, EdgeRouteResult>, repair = false) => {
    const base = laneById.get(edge.id) ?? 0;
    const stableOrder = orderById.get(edge.id) ?? 0;
    const feedback = (edge.data as Record<string, unknown> | undefined)?.flowRole === 'feedback';
    const laneDeltas = feedback ? [...LANE_CANDIDATE_DELTAS, ...FEEDBACK_CORRIDOR_DELTAS] : LANE_CANDIDATE_DELTAS;
    const candidates = [...new Set(laneDeltas.map(delta => base + delta))]
      .sort((a, b) => Math.abs(a) - Math.abs(b) || (stableOrder % 2 ? b - a : a - b));
    if (repair && extraCandidates <= 0) return { route: routes.get(edge.id)!, offset: base };
    if (repair) extraCandidates--;
    let winner = routeAt(edge, candidates[0]);
    let winnerOffset = candidates[0];
    let winnerCost = incrementalCost(edge, winner, fixed, edgeById);
    if (!conflictsWithRoutes(edge, winner, fixed, edgeById)) return { route: winner, offset: winnerOffset };
    for (const offset of candidates.slice(1)) {
      if (extraCandidates <= 0) break;
      extraCandidates--;
      const candidate = routeAt(edge, offset);
      const score = incrementalCost(edge, candidate, fixed, edgeById);
      if (score < winnerCost) { winner = candidate; winnerOffset = offset; winnerCost = score; }
      // Stop once a deterministic lane clears every routed path. Additional
      // alternatives cannot improve validity and multiply work on dense graphs.
      if (!conflictsWithRoutes(edge, candidate, fixed, edgeById)) {
        return { route: candidate, offset };
      }
    }
    return { route: winner, offset: winnerOffset };
  };

  for (const edge of edges) {
    if (Array.isArray(edge.data?.customWaypoints) && edge.data.customWaypoints.length > 0) {
      routes.set(edge.id, routeAt(edge, 0));
      continue;
    }
    const selected = bestCandidate(edge, routes);
    routes.set(edge.id, selected.route);
  }

  let ripUpPasses = 0;
  for (let pass = 0; pass < ripUpBudget; pass++) {
    if (!hasRouteConflicts(input.edges, routes)) break;
    const before = globalCost(input.edges, routes);
    const priorRoutes = new Map(routes);
    let changed = false;
    for (const edge of [...edges].reverse()) {
      if (Array.isArray(edge.data?.customWaypoints) && edge.data.customWaypoints.length > 0) continue;
      const current = routes.get(edge.id)!;
      const otherRoutes = new Map(routes);
      otherRoutes.delete(edge.id);
      if (!conflictsWithRoutes(edge, current, otherRoutes, edgeById)) continue;
      const fixed = new Map(routes);
      fixed.delete(edge.id);
      const selected = bestCandidate(edge, fixed, true);
      const prior = routes.get(edge.id);
      routes.set(edge.id, selected.route);
      if (selected.route.svgPath !== prior?.svgPath) changed = true;
    }
    ripUpPasses++;
    if (!changed || globalCost(input.edges, routes) >= before) {
      routes.clear();
      for (const [id, route] of priorRoutes) routes.set(id, route);
      break;
    }
  }

  const diagnostics: RouteOptimizationResult['diagnostics'][number][] = [];
  for (let i = 0; i < input.edges.length; i++) for (let j = i + 1; j < input.edges.length; j++) {
    const a = input.edges[i], b = input.edges[j];
    const routeA = routes.get(a.id), routeB = routes.get(b.id);
    if (!routeA || !routeB) continue;
    const pathA = routeA.renderedPath, pathB = routeB.renderedPath;
    if (!boundsMayInteract(pathA, pathB)) continue;
    const sharesNode = [a.source, a.target].some(id => id === b.source || id === b.target);
    if (!sharesNode && properCross(pathA, pathB)) diagnostics.push({ edgeId: a.id, otherEdgeId: b.id, kind: 'crossing' });
    const overlap = privateOverlapLength(routeA, routeB);
    if (overlap > 10) diagnostics.push({ edgeId: a.id, otherEdgeId: b.id, kind: 'private-overlap', amount: overlap });
  }
  return { routes, diagnostics, stats: { candidateRoutes, ripUpPasses, expandedStates } };
}
