import type { Edge, Node } from 'reactflow';
import { resolveEdgeFlowSemantics, type ResolvedFlowSemantics } from '@/lib/mermaid/edgeFlowSemantics';

export type DiagramPresentationMode = 'overview' | 'details';

export interface DiagramPresentation {
  visibleNodeIds: ReadonlySet<string>;
  visibleEdgeIds: ReadonlySet<string>;
  hiddenEdgeIds: ReadonlySet<string>;
}

function isReachable(source: string, target: string, edges: readonly Edge[]): boolean {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge.target);
    outgoing.set(edge.source, list);
  }
  const pending = [source], visited = new Set<string>();
  while (pending.length) {
    const node = pending.pop()!;
    if (node === target) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    pending.push(...(outgoing.get(node) ?? []));
  }
  return false;
}

function preservesReachability(
  entries: readonly string[],
  outcomes: readonly string[],
  edges: readonly Edge[],
): boolean {
  const requiredPairs = entries.flatMap(entry => outcomes
    .filter(outcome => isReachable(entry, outcome, edges))
    .map(outcome => [entry, outcome] as const));
  if (!requiredPairs.length) return false;
  return requiredPairs.every(([entry, outcome]) => isReachable(entry, outcome, edges));
}

/**
 * A conservative view projection. It only omits inferred support edges when
 * semantic confidence is high and every currently reachable entry/outcome
 * pair remains connected. The source graph is never mutated.
 */
export function createDiagramPresentation(
  nodes: readonly Node[],
  edges: readonly Edge[],
  semantics: ResolvedFlowSemantics,
  mode: DiagramPresentationMode,
): DiagramPresentation {
  const visibleNodeIds = new Set(nodes.map(node => node.id));
  const visibleEdgeIds = new Set(edges.map(edge => edge.id));
  const hiddenEdgeIds = new Set<string>();
  if (mode !== 'overview' || nodes.length === 0 || semantics.entryNodeIds.length === 0 || semantics.outcomeNodeIds.length === 0) {
    return { visibleNodeIds, visibleEdgeIds, hiddenEdgeIds };
  }

  const initialEdges = [...edges];
  if (!preservesReachability(semantics.entryNodeIds, semantics.outcomeNodeIds, initialEdges)) {
    return { visibleNodeIds, visibleEdgeIds, hiddenEdgeIds };
  }

  const candidates = edges.filter(edge => {
    const assignment = semantics.assignments.get(edge.id);
    const data = edge.data as Record<string, unknown> | undefined;
    if (!assignment || assignment.source !== 'inferred' || assignment.role !== 'supporting') return false;
    if (data?.flowRoleSource === 'explicit' || data?.importanceSource === 'explicit') return false;
    return true;
  });
  // Any low-confidence supporting relationship makes the graph ambiguous;
  // leave the entire graph visible instead of hiding only the convenient bits.
  if (candidates.some(edge => (semantics.assignments.get(edge.id)?.confidence ?? 0) < 0.85)) {
    return { visibleNodeIds, visibleEdgeIds, hiddenEdgeIds };
  }

  let kept = [...edges];
  for (const edge of [...candidates].sort((a, b) => a.id.localeCompare(b.id))) {
    const next = kept.filter(candidate => candidate.id !== edge.id);
    if (preservesReachability(semantics.entryNodeIds, semantics.outcomeNodeIds, next)) {
      kept = next;
      hiddenEdgeIds.add(edge.id);
      visibleEdgeIds.delete(edge.id);
    }
  }
  return { visibleNodeIds, visibleEdgeIds, hiddenEdgeIds };
}

export function resolveDiagramPresentation(
  nodes: readonly Node[],
  edges: readonly Edge[],
  mode: DiagramPresentationMode,
): DiagramPresentation {
  return createDiagramPresentation(nodes, edges, resolveEdgeFlowSemantics(nodes, edges), mode);
}
