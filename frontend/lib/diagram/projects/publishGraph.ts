import type { Edge, Node } from 'reactflow';
import { mergePreservingLayout } from '@/lib/diagram/mermaid/mergePreservingLayout';
import { diffStructure, type StructureChange } from './structureDiff';

/**
 * Turn an agent publish into the graph stored on a project canvas.
 * By default the fresh layout is merged into the existing canvas so the
 * user's positions survive and only new components are placed; `relayout`
 * (or an empty canvas) takes the fresh layout wholesale. Existing node data —
 * including `codePaths` — carries over by id unless `componentPaths` overrides it.
 */
export interface PublishGraphInput {
  existingNodes: Node[];
  laidOut: { nodes: Node[]; edges: Edge[] };
  componentPaths?: Record<string, string[]>;
  relayout?: boolean;
  now: number;
}

export interface PublishGraphResult {
  nodes: Node[];
  edges: Edge[];
  change: StructureChange;
  mode: 'merge' | 'relayout';
  unknownPathIds: string[];
}

/** Merge bookkeeping that must not be persisted on canvas nodes. */
function stripMergeFields(node: Record<string, unknown>): Node {
  const { absX: _absX, absY: _absY, isGroup: _isGroup, ...rest } = node;
  return rest as unknown as Node;
}

export function publishGraph(input: PublishGraphInput): PublishGraphResult {
  const merge = !input.relayout && input.existingNodes.length > 0;
  const base = merge
    ? mergePreservingLayout(input.existingNodes, input.laidOut, { avoidOverlap: true })
    : { nodes: input.laidOut.nodes, edges: input.laidOut.edges };

  const existingById = new Map(input.existingNodes.map((n) => [n.id, n]));
  const paths = input.componentPaths ?? {};
  const nodes = (base.nodes as unknown as Array<Record<string, unknown> & { id: string; data?: Record<string, unknown> }>).map(
    (raw) => {
      const node = stripMergeFields(raw);
      const previous = existingById.get(node.id)?.data as { codePaths?: string[] } | undefined;
      const codePaths = paths[node.id] ?? (merge ? undefined : previous?.codePaths);
      if (!codePaths) return node;
      return { ...node, data: { ...(node.data ?? {}), codePaths: Array.from(new Set(codePaths)) } } as Node;
    },
  );

  const ids = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    edges: base.edges,
    change: diffStructure(input.existingNodes, nodes, input.now),
    mode: merge ? 'merge' : 'relayout',
    unknownPathIds: Object.keys(paths).filter((id) => !ids.has(id)),
  };
}
