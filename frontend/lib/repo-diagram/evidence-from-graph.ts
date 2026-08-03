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

  // Map every source file → owning node id (first owner wins; multiple owners rare).
  const fileToNode = new Map<string, string>();
  for (const node of nodes) {
    for (const sf of node.sourceFiles) {
      if (!fileToNode.has(sf)) fileToNode.set(sf, node.id);
    }
  }

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
  const fileToNode = new Map<string, string>();
  for (const node of nodes) {
    for (const sf of node.sourceFiles) if (!fileToNode.has(sf)) fileToNode.set(sf, node.id);
  }
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