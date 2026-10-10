export type FlowRole = 'main' | 'branch' | 'feedback' | 'supporting';

export interface ResolvedEdgeFlowAssignment {
  role: FlowRole;
  source: 'explicit' | 'inferred';
  confidence: number;
}

export interface ResolvedFlowSemantics {
  assignments: ReadonlyMap<string, ResolvedEdgeFlowAssignment>;
  entryNodeIds: readonly string[];
  outcomeNodeIds: readonly string[];
  mainPathEdgeIds: readonly string[];
  mainPathNodeIds: readonly string[];
}

export interface SemanticEdgeKey {
  sourceLayoutId: string;
  targetLayoutId: string;
  normalizedLabel: string;
  normalizedType: string;
  duplicateOrdinal: number;
}

export interface EdgeLayoutSemantics {
  importance?: string;
  importanceSource?: 'explicit' | 'inferred';
  flowRole?: FlowRole;
  flowRoleSource?: 'explicit' | 'inferred';
  flowRoleConfidence?: number;
}

export function normalizeSemanticLabel(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase() : '';
}

export function normalizeSemanticType(edge: FlowEdge): string {
  const data = dataOf(edge);
  const variant = String(data.edgeVariant ?? data.connectionType ?? data.edgeType ?? '').toLowerCase();
  if (edge.hidden || variant === 'invisible') return 'invisible';
  if (variant === 'bidirectional' || (edge.markerStart && edge.markerEnd)) return 'bidirectional';
  if (variant === 'thick') return 'thick';
  if (['dashed', 'dotted', 'async', 'stream', 'event', 'dep'].includes(variant) || data.syncAsync === 'async') return 'dotted';
  return 'solid';
}

export function semanticEdgeKeyString(key: SemanticEdgeKey): string {
  return JSON.stringify([
    key.sourceLayoutId,
    key.targetLayoutId,
    key.normalizedLabel,
    key.normalizedType,
    key.duplicateOrdinal,
  ]);
}

export function createSemanticEdgeKey(
  edge: FlowEdge,
  sourceLayoutId: string,
  targetLayoutId: string,
  duplicateOrdinal: number,
): SemanticEdgeKey {
  return {
    sourceLayoutId,
    targetLayoutId,
    normalizedLabel: normalizeSemanticLabel(edge.label ?? dataOf(edge).label),
    normalizedType: normalizeSemanticType(edge),
    duplicateOrdinal,
  };
}

interface FlowNode {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: unknown;
  data?: Record<string, unknown>;
  hidden?: boolean;
  markerStart?: unknown;
  markerEnd?: unknown;
}

const IMPORTANCE_WEIGHT: Record<string, number> = {
  primary: 5,
  secondary: 3,
  supporting: 1.5,
  diagnostic: 0.5,
  optional: 0.25,
};

const ENTRY_HINT = /actor|client|browser|frontend|front-end|user|ingress|gateway/i;
const OUTCOME_HINT = /response|result|output|sink|report/i;
const FEEDBACK_HINT = /return|response|reply|ack|callback|confirm/i;
const LABEL_EVIDENCE = /request|publish|consume|process|write|read|query|invoke|send|receive/i;

function dataOf(edge: FlowEdge): Record<string, unknown> {
  return edge.data ?? {};
}

function edgeWeight(edge: FlowEdge): number {
  const data = dataOf(edge);
  if (data.flowRole === 'main') return 5;
  if (data.flowRole === 'branch') return 3;
  if (data.flowRole === 'feedback') return 0.5;
  const importance = String(data.importance ?? 'secondary');
  return IMPORTANCE_WEIGHT[importance] ?? IMPORTANCE_WEIGHT.secondary;
}

function compareEdges(a: FlowEdge, b: FlowEdge): number {
  const weight = edgeWeight(b) - edgeWeight(a);
  if (weight) return weight;
  const evidence = Number(LABEL_EVIDENCE.test(String(b.label ?? dataOf(b).label ?? '')))
    - Number(LABEL_EVIDENCE.test(String(a.label ?? dataOf(a).label ?? '')));
  if (evidence) return evidence;
  return a.source.localeCompare(b.source)
    || a.target.localeCompare(b.target)
    || String(a.label ?? dataOf(a).label ?? '').localeCompare(String(b.label ?? dataOf(b).label ?? ''))
    || a.id.localeCompare(b.id);
}

function wouldCloseCycle(edge: FlowEdge, adjacency: Map<string, Set<string>>): boolean {
  const pending = [edge.target];
  const seen = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === edge.source) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...(adjacency.get(current) ?? []));
  }
  return false;
}

function normalizedRole(value: unknown): FlowRole | undefined {
  return value === 'main' || value === 'branch' || value === 'feedback' || value === 'supporting'
    ? value
    : undefined;
}

/** Resolve a stable semantic backbone without dropping any input relationship. */
export function resolveEdgeFlowSemantics(
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
): ResolvedFlowSemantics {
  const nodeIds = new Set(nodes.map(node => node.id));
  const validEdges = edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  const explicitAssignments = new Map<string, ResolvedEdgeFlowAssignment>();
  for (const edge of validEdges) {
    const data = dataOf(edge);
    const role = normalizedRole(data.flowRole);
    if (role && data.flowRoleSource === 'explicit') {
      explicitAssignments.set(edge.id, { role, source: 'explicit', confidence: 1 });
    }
  }

  const inDegree = new Map(nodes.map(node => [node.id, 0]));
  const outDegree = new Map(nodes.map(node => [node.id, 0]));
  for (const edge of validEdges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);
  }

  const hintedEntries = nodes.filter(node => ENTRY_HINT.test(`${node.type ?? ''} ${node.data?.serviceType ?? ''} ${node.data?.label ?? ''}`));
  const entries = (hintedEntries.length ? hintedEntries : nodes.filter(node => inDegree.get(node.id) === 0))
    .map(node => node.id).sort();
  const hintedOutcomes = nodes.filter(node => OUTCOME_HINT.test(`${node.type ?? ''} ${node.data?.serviceType ?? ''} ${node.data?.label ?? ''}`));
  const outcomes = (hintedOutcomes.length ? hintedOutcomes : nodes.filter(node => outDegree.get(node.id) === 0))
    .map(node => node.id).sort();

  const adjacency = new Map<string, Set<string>>();
  const ranked: FlowEdge[] = [];
  const feedbackIds = new Set<string>();
  for (const edge of [...validEdges].sort(compareEdges)) {
    const explicitRole = explicitAssignments.get(edge.id)?.role;
    if (explicitRole === 'feedback' || (explicitRole !== 'main' && FEEDBACK_HINT.test(String(edge.label ?? dataOf(edge).label ?? '')))) {
      feedbackIds.add(edge.id);
      continue;
    }
    if (wouldCloseCycle(edge, adjacency)) {
      feedbackIds.add(edge.id);
      continue;
    }
    const next = adjacency.get(edge.source) ?? new Set<string>();
    next.add(edge.target);
    adjacency.set(edge.source, next);
    ranked.push(edge);
  }

  const outgoing = new Map<string, FlowEdge[]>();
  for (const edge of ranked) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge);
    outgoing.set(edge.source, list);
  }
  for (const list of outgoing.values()) list.sort(compareEdges);

  const indegrees = new Map(nodes.map(node => [node.id, 0]));
  for (const edge of ranked) indegrees.set(edge.target, (indegrees.get(edge.target) ?? 0) + 1);
  const ready = nodes.map(node => node.id).filter(id => indegrees.get(id) === 0).sort();
  const topological: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    topological.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const degree = (indegrees.get(next) ?? 0) - 1;
      indegrees.set(next, degree);
      if (degree === 0) {
        ready.push(next);
        ready.sort();
      }
    }
  }

  type Path = { score: number; edgeIds: string[]; nodeIds: string[] };
  const pathOrder = (a: Path, b: Path) =>
    b.score - a.score
    || a.nodeIds.join('\u0000').localeCompare(b.nodeIds.join('\u0000'))
    || a.edgeIds.join('\u0000').localeCompare(b.edgeIds.join('\u0000'));
  const paths: Path[] = [];
  for (const entry of entries) {
    const bestAt = new Map<string, Path[]>([[entry, [{ score: 0, edgeIds: [], nodeIds: [entry] }]]]);
    for (const nodeId of topological) {
      const currentPaths = bestAt.get(nodeId) ?? [];
      for (const edge of outgoing.get(nodeId) ?? []) {
        const targetPaths = bestAt.get(edge.target) ?? [];
        targetPaths.push(...currentPaths.map(path => ({
          score: path.score + edgeWeight(edge),
          edgeIds: [...path.edgeIds, edge.id],
          nodeIds: [...path.nodeIds, edge.target],
        })));
        targetPaths.sort(pathOrder);
        bestAt.set(edge.target, targetPaths.filter((path, index, all) =>
          all.findIndex(candidate => candidate.edgeIds.join('\u0000') === path.edgeIds.join('\u0000')) === index,
        ).slice(0, 2));
      }
    }
    for (const outcome of outcomes) paths.push(...(bestAt.get(outcome) ?? []));
  }
  paths.sort(pathOrder);
  const best = paths[0];
  const second = paths.find(path => path.edgeIds.join('\u0000') !== best?.edgeIds.join('\u0000'));
  const rawConfidence = best
    ? Math.max(0, (best.score - (second?.score ?? 0)) / Math.max(Math.abs(best.score), 1))
    : 0;
  const confidence = second ? Math.min(1, rawConfidence) : Math.min(0.8, rawConfidence);
  const mainEdges = new Set(best?.edgeIds ?? []);
  const mainNodes = new Set(best?.nodeIds ?? []);

  const assignments = new Map<string, ResolvedEdgeFlowAssignment>(explicitAssignments);
  for (const edge of validEdges) {
    if (assignments.has(edge.id)) continue;
    let role: FlowRole;
    if (mainEdges.has(edge.id)) role = 'main';
    else if (feedbackIds.has(edge.id)) role = 'feedback';
    else if (mainNodes.has(edge.source) || mainNodes.has(edge.target)) role = 'branch';
    else role = 'supporting';
    assignments.set(edge.id, { role, source: 'inferred', confidence });
  }

  return {
    assignments,
    entryNodeIds: entries,
    outcomeNodeIds: outcomes,
    mainPathEdgeIds: best?.edgeIds ?? [],
    mainPathNodeIds: best?.nodeIds ?? [],
  };
}
