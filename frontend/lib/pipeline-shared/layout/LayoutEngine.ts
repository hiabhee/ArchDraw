export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

import {
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  SUBGRAPH_PADDING_X,
  SUBGRAPH_PADDING_TOP,
  SUBGRAPH_PADDING_BOTTOM,
} from './layoutConstants';

export { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT };

export interface LayoutNode {
  id: string;
  label?: string;
  serviceType?: string;
  width: number;
  height: number;
  parentId?: string;
  isGroup?: boolean;
  direction?: LayoutDirection;
}

export type LayoutEdgeImportance = 'primary' | 'secondary' | 'supporting' | 'diagnostic' | 'optional';
export type LayoutFlowRole = 'main' | 'branch' | 'feedback' | 'supporting';

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  /** Optional label — the engine reserves rank space for its pill. */
  label?: string;
  /** Existing relationship semantics from the Mermaid / React Flow pipeline. */
  importance?: LayoutEdgeImportance;
  flowRole?: LayoutFlowRole;
  importanceSource?: 'explicit' | 'inferred';
  flowRoleSource?: 'explicit' | 'inferred';
  flowRoleConfidence?: number;
  connectionType?: string;
  sourceServiceType?: string;
  targetServiceType?: string;
}

export interface AggregatedLayoutEdge extends LayoutEdge {
  width: number;
  height: number;
  weight: number;
}

export interface LayoutOptions {
  nodeSep?: number;
  rankSep?: number;
  marginX?: number;
  marginY?: number;
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
}

export interface LayoutParams {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  direction: LayoutDirection;
  options?: LayoutOptions;
}

export interface PositionedNode extends LayoutNode {
  x: number;
  y: number;
}

export interface PositionedEdge extends LayoutEdge {
  points?: Array<{ x: number; y: number }>;
}

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  warnings: string[];
}

export interface LayoutEngine {
  readonly name: string;
  layout(params: LayoutParams): Promise<LayoutResult>;
  isAvailable(): boolean;
}

/**
 * Canonical compound-graph spacing — flow-first, generous air.
 * Tuned for fixed-grid nodes (160/200/240×100) with balanced separation so
 * ranks read as distinct columns/rows and edges have room to route without
 * crossing. History: tight (50/60,120,32) packed nodes and hid label space;
 * generous (150/180,240,80) sprawled small diagrams. This middle ground keeps
 * 2-node demos compact while giving 10-15 node architectures clear flow,
 * still centering mirrored sub-trees (e.g. Leader → 2 Followers).
 */
export function defaultCompoundLayoutOptions(
  direction: LayoutDirection,
  density?: { edgeCount?: number; nodeCount?: number },
): LayoutOptions {
  const isVertical = direction === 'TB' || direction === 'BT';
  const base: LayoutOptions = {
    nodeSep: isVertical ? 90 : 110,
    rankSep: 170,
    marginX: 48,
    marginY: 48,
    // Group padding must match the subgraph sizer exactly (layoutConstants) so
    // the container dagre reserves is the container that gets drawn.
    paddingLeft: SUBGRAPH_PADDING_X,
    paddingRight: SUBGRAPH_PADDING_X,
    paddingTop: SUBGRAPH_PADDING_TOP,
    paddingBottom: SUBGRAPH_PADDING_BOTTOM,
  };

  // Adaptive density bump — adds air for crowded graphs (e.g. >10 edges) where
  // flat 170/110 would still feel tangled. Keeps base values stable for sparse
  // diagrams (tests, landing demo) but expands for URL-shortener / video-stream
  // style dense graphs. Capped to avoid sprawling extreme inputs.
  const edgeCount = density?.edgeCount ?? 0;
  const nodeCount = density?.nodeCount ?? 0;
  // Density trigger: either many edges or high edge-to-node ratio (>1.6 signals web)
  const densityScore = Math.max(edgeCount, Math.round((edgeCount / Math.max(1, nodeCount)) * 10));
  const effectiveCount = edgeCount > 10 || densityScore > 16 ? edgeCount : 0;
  if (effectiveCount > 10) {
    const extraEdges = effectiveCount - 10;
    const nodeExtra = Math.min(30, extraEdges * 6);
    const rankExtra = Math.min(60, extraEdges * 10);
    base.nodeSep = (base.nodeSep ?? 0) + nodeExtra;
    base.rankSep = (base.rankSep ?? 0) + rankExtra;
  } else if (edgeCount > 6) {
    // Mild bump for moderate density (7-10 edges) – keeps legacy behavior but softer
    const extraEdges = edgeCount - 6;
    const nodeExtra = Math.min(20, extraEdges * 5);
    const rankExtra = Math.min(30, extraEdges * 7);
    base.nodeSep = (base.nodeSep ?? 0) + nodeExtra;
    base.rankSep = (base.rankSep ?? 0) + rankExtra;
  }

  return base;
}

/**
 * Rough edge-label pill size so dagre reserves rank space for it. Mirrors the
 * counter-scaled label sizing in `lib/utils/edgeLabelLayout.ts` (worst-case 1.5x
 * CSS size) without importing canvas-only modules into the engine.
 * Updated for larger readable labels (precision 10.5px / brutal 11px).
 *
 * Lives here (not in a single engine) so the flat compound path AND the
 * two-phase compound path reserve label space identically — otherwise grouped
 * diagrams, which take the two-phase path, would pack ranks as if labels had
 * zero size and drop labels onto nodes.
 */
export function estimateEdgeLabelSize(label: string | undefined): { width: number; height: number } {
  if (!label) return { width: 0, height: 0 };
  // Reserve for the larger brutal pill (worst case): 6.2px per char + 16 padding, 15px height, 1.5x counter-scale
  const cssWidth = Math.max(38, label.length * 6.2 + 16);
  return { width: cssWidth * 1.5, height: 15 * 1.5 };
}

const IMPORTANCE_WEIGHT: Record<LayoutEdgeImportance, number> = {
  primary: 5,
  secondary: 3,
  supporting: 1.5,
  diagnostic: 0.5,
  optional: 0.25,
};

const CORE_SERVICE_TYPES = new Set([
  'actor', 'client', 'mobile', 'load-balancer', 'gateway', 'api-gateway',
  'service', 'function', 'container', 'compute', 'application', 'api',
]);
const INFRASTRUCTURE_SERVICE_TYPES = new Set([
  'database', 'cache', 'queue', 'broker', 'message-broker', 'event-bus', 'storage',
  'external-service', 'observability', 'monitoring',
]);
const RETURN_EDGE_LABEL = /\b(return(?:s|ed)?|response|responds|reply|ack(?:nowledg(?:e|ment))?|callback|sends back|confirms)\b/i;

export function isCoreServiceType(serviceType?: string): boolean {
  return CORE_SERVICE_TYPES.has(serviceType?.toLowerCase() ?? '');
}

export function isInfrastructureServiceType(serviceType?: string): boolean {
  return INFRASTRUCTURE_SERVICE_TYPES.has(serviceType?.toLowerCase() ?? '');
}

/**
 * Layout priority is deliberately separate from visual styling. It controls
 * which relationships establish ranks when a graph contains feedback loops,
 * and how strongly a candidate layout is judged on crossings.
 */
export function getLayoutEdgeWeight(edge: LayoutEdge): number {
  // A primary relationship is semantic backbone intent. Infrastructure and
  // async metadata describe transport, not a reason to demote that intent.
  if (edge.importance === 'primary') return IMPORTANCE_WEIGHT.primary;
  if (edge.flowRole === 'main') return IMPORTANCE_WEIGHT.primary;
  if (edge.flowRole === 'branch') return IMPORTANCE_WEIGHT.secondary;
  if (edge.flowRole === 'feedback') return IMPORTANCE_WEIGHT.diagnostic;
  if (RETURN_EDGE_LABEL.test(edge.label ?? '')) return IMPORTANCE_WEIGHT.diagnostic;

  let weight = IMPORTANCE_WEIGHT[edge.importance ?? 'secondary'] ?? IMPORTANCE_WEIGHT.secondary;
  const sourceType = edge.sourceServiceType?.toLowerCase();
  const targetType = edge.targetServiceType?.toLowerCase();

  // Service-to-service calls usually form the readable request path. The
  // generation classifier labels many of these as generic secondary links.
  if (
    sourceType && targetType &&
    isCoreServiceType(sourceType) && isCoreServiceType(targetType) &&
    edge.importance !== 'diagnostic' && edge.importance !== 'optional'
  ) {
    weight = Math.max(weight, 4.5);
  }

  // Infrastructure and asynchronous links should remain visible, but should
  // not pull the business-flow nodes into extra ranks or long detours.
  if (
    isInfrastructureServiceType(sourceType) ||
    isInfrastructureServiceType(targetType) ||
    ['async', 'event', 'stream', 'publish', 'consume'].includes(edge.connectionType?.toLowerCase() ?? '')
  ) {
    weight = Math.min(weight, 1.5);
  }

  return weight;
}

/** Combine parallel relationships into one Dagre constraint while reserving room for every label. */
export function aggregateLayoutEdges(edges: LayoutEdge[]): AggregatedLayoutEdge[] {
  const pairs = new Map<string, AggregatedLayoutEdge>();
  for (const edge of edges) {
    if (!edge.source || !edge.target || edge.source === edge.target) continue;
    const key = `${edge.source}\u0000${edge.target}`;
    const labelSize = estimateEdgeLabelSize(edge.label);
    const weight = getLayoutEdgeWeight(edge);
    const previous = pairs.get(key);
    if (previous) {
      previous.width += labelSize.width + (previous.width > 0 && labelSize.width > 0 ? 12 : 0);
      previous.height = Math.max(previous.height, labelSize.height);
      previous.weight = Math.max(previous.weight, weight);
    } else {
      pairs.set(key, { ...edge, width: labelSize.width, height: labelSize.height, weight });
    }
  }
  return [...pairs.values()];
}

/**
 * Keep every relationship in the returned diagram, but use a priority ordered
 * acyclic subset for Dagre ranks. Feedback and low-priority links that would
 * close a cycle still render; they simply cannot distort the main flow.
 */
export function selectAcyclicLayoutEdges(
  edges: AggregatedLayoutEdge[],
  _direction?: LayoutDirection,
  _nodeOrder: string[] = [],
): AggregatedLayoutEdge[] {
  const ordered = [...edges].sort((a, b) => {
    const weightDelta = b.weight - a.weight;
    if (weightDelta !== 0) return weightDelta;
    return a.source.localeCompare(b.source) || a.target.localeCompare(b.target) || a.id.localeCompare(b.id);
  });
  const outgoing = new Map<string, Set<string>>();
  const selected: AggregatedLayoutEdge[] = [];

  const reaches = (start: string, goal: string): boolean => {
    const pending = [start];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (current === goal) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const next of outgoing.get(current) ?? []) pending.push(next);
    }
    return false;
  };

  for (const edge of ordered) {
    if (reaches(edge.target, edge.source)) continue;
    const targets = outgoing.get(edge.source) ?? new Set<string>();
    targets.add(edge.target);
    outgoing.set(edge.source, targets);
    selected.push(edge);
  }

  return selected;
}
