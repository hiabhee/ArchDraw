import type { Edge } from 'reactflow';

const DEFAULT_LABELS = new Set(['connection']);

function edgeLabel(edge: Edge): string {
  return String((edge.data as { label?: string } | undefined)?.label || edge.label || '');
}

function pairKey(source: string, target: string): string {
  return [source, target].sort().join('\u0001');
}

/**
 * Collapses parallel edges between the same two nodes into a single edge.
 * Labels from every edge are combined ("label A / label B"), and the merged
 * edge is treated as async if any member was async. Self-loops are never
 * merged. The first edge in the array is kept as the visual representative.
 */
export function mergeParallelEdges(edges: Edge[]): Edge[] {
  const groups = new Map<string, Edge[]>();
  const singles: Edge[] = [];

  for (const edge of edges) {
    if (!edge.source || !edge.target || edge.source === edge.target) {
      singles.push(edge);
      continue;
    }
    const key = pairKey(edge.source, edge.target);
    const list = groups.get(key);
    if (list) list.push(edge);
    else groups.set(key, [edge]);
  }

  const result: Edge[] = [...singles];

  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    const rep = group[0];
    const rest = group.slice(1);

    const uniqueLabels: string[] = [];
    for (const edge of group) {
      const label = edgeLabel(edge).trim();
      const isDefault = !label || DEFAULT_LABELS.has(label.toLowerCase());
      if (!isDefault && !uniqueLabels.includes(label)) {
        uniqueLabels.push(label);
      }
    }
    const combinedLabel = uniqueLabels.length > 0 ? uniqueLabels.join(' / ') : rep.label;

    const anyAsync = group.some(
      (e) => (e.data as { connectionType?: string } | undefined)?.connectionType === 'async'
    );
    const baseType = (rep.data as { connectionType?: string } | undefined)?.connectionType;
    const connectionType = anyAsync ? 'async' : baseType || 'sync';

    result.push({
      ...rep,
      label: combinedLabel,
      data: {
        ...(rep.data || {}),
        label: combinedLabel,
        connectionType,
        edgeVariant: anyAsync ? 'dashed' : (rep.data as { edgeVariant?: string } | undefined)?.edgeVariant,
        isMerged: true,
        mergedEdgeIds: [rep.id, ...rest.map((e) => e.id)],
      },
    });
  }

  return result;
}
