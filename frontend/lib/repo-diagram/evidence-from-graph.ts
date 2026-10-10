import type { ExtractedNode, RichEdge, FileEntry } from '@/lib/types/repo-diagram';
import type { ImportGraph } from './import-graph';
import { buildImportGraph } from './import-graph';
import { buildTsAliasConfig } from './import-resolvers';

export type { ImportGraph };

/** Build the import graph from a snapshot's selected files + fileTree. */
export function buildEvidenceGraph(files: FileEntry[], fileTree: string[]): ImportGraph {
  const tsAliasConfig = buildTsAliasConfig(files);
  return buildImportGraph(files, fileTree, tsAliasConfig);
}

/**
 * Derive evidence-backed RichEdges between architectural nodes by counting
 * import links between their sourceFiles. One edge per pair; weight retained
 * in `details.evidenceCount`.
 */
export function deriveEvidenceEdges(nodes: ExtractedNode[], graph: ImportGraph): RichEdge[] {
  const edges: RichEdge[] = [];
  const seen = new Set<string>();

  // Map every source file → its narrowest owning node.
  const fileToNode = buildFileOwnerMap(nodes);

  // Count A → B import links.
  const pairCount = new Map<string, number>();
  for (const [importer, imported] of graph.edges) {
    const fromId = fileToNode.get(importer);
    if (!fromId) continue;
    for (const target of imported) {
      const toId = fileToNode.get(target);
      if (!toId || toId === fromId) continue;
      const key = `${fromId}->${toId}`;
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    }
  }

  for (const [key, count] of pairCount) {
    if (count < 1) continue;
    const [from, to] = key.split('->');
    if (seen.has(`${from}->${to}`)) continue;
    seen.add(`${from}->${to}`);
    edges.push({
      from,
      to,
      type: 'import',
      label: count > 2 ? `imports (${count})` : 'imports',
      direction: 'sync',
      protocol: 'import',
      dataFlow: '',
      triggeredBy: 'code_import',
      description: `Derived from ${count} import link${count === 1 ? '' : 's'} in source code.`,
      confidence: 'high',
    } as RichEdge & { dataFlow: string });
  }

  return edges;
}

/**
 * For Phase 6 verifier + relationship evidence pack:
 * compute the top adjacency pairs (A → B with weight) for prompt injection.
 */
export function topAdjacencies(
  nodes: ExtractedNode[],
  graph: ImportGraph,
  limit = 30
): { from: string; to: string; weight: number; fromLabel: string; toLabel: string }[] {
  const fileToNode = buildFileOwnerMap(nodes);
  const labels = new Map(nodes.map((n) => [n.id, n.label]));

  const pairCount = new Map<string, number>();
  for (const [importer, imported] of graph.edges) {
    const fromId = fileToNode.get(importer);
    if (!fromId) continue;
    for (const target of imported) {
      const toId = fileToNode.get(target);
      if (!toId || toId === fromId) continue;
      const key = `${fromId}->${toId}`;
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    }
  }
  return Array.from(pairCount.entries())
    .map(([key, w]) => {
      const [from, to] = key.split('->');
      return { from, to, weight: w, fromLabel: labels.get(from) || from, toLabel: labels.get(to) || to };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}

/**
 * Set of evidence edge keys ("fromId->toId") in *predicted-id* space, for the
 * scorer to corroborate LLM edges that aren't in the golden set.
 */
export function evidenceEdgeKeySet(nodes: ExtractedNode[], graph: ImportGraph): Set<string> {
  const set = new Set<string>();
  for (const e of deriveEvidenceEdges(nodes, graph)) set.add(`${e.from}->${e.to}`);
  return set;
}

/**
 * Assign files to the most specific evidence-backed node. Root/subsystem nodes
 * often include the same files as directory or LLM nodes; first-owner mapping
 * makes every import look like a self-edge on the root and produces sparse
 * diagrams. Smaller source sets are the narrower ownership claim.
 */
function buildFileOwnerMap(nodes: ExtractedNode[]): Map<string, string> {
  const fileToNode = new Map<string, { id: string; width: number; priority: number }>();
  const typePriority: Record<string, number> = {
    API_ROUTE: 0, CONTROLLER: 1, SERVICE: 2, WORKER: 3, DATABASE: 4,
    CACHE: 5, QUEUE: 6, PAGE: 7, MIDDLEWARE: 8, CORE_MODULE: 9, SERVICE_GROUP: 10,
  };
  for (const node of nodes) {
    const width = node.sourceFiles.length;
    const priority = typePriority[node.type] ?? 20;
    for (const sourceFile of node.sourceFiles) {
      const existing = fileToNode.get(sourceFile);
      if (!existing || width < existing.width || (width === existing.width && priority < existing.priority)) {
        fileToNode.set(sourceFile, { id: node.id, width, priority });
      }
    }
  }
  return new Map(Array.from(fileToNode, ([file, owner]) => [file, owner.id]));
}
