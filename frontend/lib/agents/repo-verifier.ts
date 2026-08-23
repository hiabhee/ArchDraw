import type { ExtractedNode, RichEdge, StaticSignal } from '@/lib/types/repo-diagram';
import type { ImportGraph } from '@/lib/repo-diagram/import-graph';

export type VerifierInput = {
  nodes: ExtractedNode[];
  edges: RichEdge[];
  signals: StaticSignal[];
  fileTree: string[];
  importGraph?: ImportGraph;
};

export type VerifierStats = {
  droppedSourceFiles: number;
  droppedNodes: number;
  edgesCorroborated: number;
  edgesCappedToLow: number;
  edgesDropped: number;
};

export type VerifierResult = {
  nodes: ExtractedNode[];
  edges: RichEdge[];
  stats: VerifierStats;
};

/**
 * Phase 6.4 — Deterministic verifier (NO LLM).
 *
 * Node checks:
 *  - Drop `sourceFiles` entries that don't exist in `fileTree` (LLM hallucination).
 *  - Drop a node entirely when, after source-file cleanup, it has zero sourceFiles
 *    AND zero supporting signals AND confidence 'low'.
 *
 * Edge checks per edge:
 *  - import-graph or compose_dependency evidence → confidence 'high', keep.
 *  - signal co-occurrence (e.g. route file imports an sdk) → keep as-is.
 *  - no evidence, medium+ confidence → cap at 'low' (import graph has blind
 *    spots like dynamic imports / HTTP calls between services / Rails conventions,
 *    so medium guesses may still be real).
 *  - no evidence AND already 'low' → pure speculation with zero support; delete.
 *    Exception: edges explicitly labelled "(assumed)" are the baseline's
 *    deliberate single-pair guess and survive demotion.
 *
 * Returns stats for logging + eval diagnostics.
 */
export function verifyGraph(input: VerifierInput): VerifierResult {
  const { nodes, edges, signals, fileTree, importGraph } = input;

  const fileSet = new Set(fileTree);
  const signalSources = new Set(signals.map((s) => s.source).filter((s): s is string => !!s));

  // Build the import-graph edge set in *predicted-id* space using node sourceFiles.
  const evidenceEdgeSet = buildEvidenceEdgeSet(nodes, importGraph);
  // Compose_dependency edges use label→label (details.from→details.to) — map to node ids
  // by matching labels (case-insensitive slugified).
  const composeEdgeSet = buildComposeEdgeSet(nodes, signals);
  // SDK usage evidence: nodes whose source files contain SDK calls are connected to the SDK node.
  const sdkEdgeSet = buildSdkEdgeSet(nodes, signals);

  let droppedSourceFiles = 0;
  let droppedNodes = 0;

  // ── Node cleanup ──
  const verifiedNodes: ExtractedNode[] = [];
  for (const node of nodes) {
    const realSourceFiles = node.sourceFiles.filter((sf) => fileSet.has(sf));
    droppedSourceFiles += node.sourceFiles.length - realSourceFiles.length;

    // Signal support: any signal whose source file intersected the node OR label matches a signal label.
    const hasSignalSupport = signals.some((s) => {
      if (realSourceFiles.some((sf) => s.source === sf)) return true;
      // We don't over-claim on label-only support.
      return false;
    });

    const grounded = realSourceFiles.length > 0;
    const isolated = !grounded && !hasSignalSupport;
    if (isolated && node.confidence === 'low') {
      droppedNodes++;
      continue;
    }
    verifiedNodes.push({ ...node, sourceFiles: realSourceFiles });
  }
  const verifiedNodeIds = new Set(verifiedNodes.map((n) => n.id));

  // ── Edge cleanup ──
  const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const verifiedEdges: RichEdge[] = [];
  let edgesCorroborated = 0;
  let edgesCappedToLow = 0;
  let edgesDropped = 0;

  for (const edge of edges) {
    // Filter edges whose endpoints were dropped by the node cleanup.
    if (!verifiedNodeIds.has(edge.from) || !verifiedNodeIds.has(edge.to)) continue;

    const key = `${edge.from}->${edge.to}`;
    const hasImportEvidence = evidenceEdgeSet.has(key);
    const hasComposeEvidence = composeEdgeSet.has(key);

    const hasSdkEvidence = sdkEdgeSet.has(key);

    if (hasImportEvidence || hasComposeEvidence || hasSdkEvidence) {
      if (rank[edge.confidence] < rank.high) {
        edgesCorroborated++;
        verifiedEdges.push({ ...edge, confidence: 'high' });
      } else {
        verifiedEdges.push(edge);
      }
      continue;
    }

    // Signal co-occurrence: endpoints both reference files that appear in importGraph at file-level.
    // (Already covered by buildEvidenceEdgeSet when node-sourcefile aggregation is meaningful.)

    // No evidence — medium+ guesses may still be real (import graph blind spots),
    // so demote to 'low'. Already-low edges are pure speculation: delete them,
    // except the baseline's deliberate "(assumed)" single-pair guess.
    if (rank[edge.confidence] > rank.low) {
      edgesCappedToLow++;
      verifiedEdges.push({ ...edge, confidence: 'low' });
    } else if (/\(assumed\)/i.test(edge.label || '')) {
      verifiedEdges.push(edge);
    } else {
      edgesDropped++;
    }
  }

  return {
    nodes: verifiedNodes,
    edges: verifiedEdges,
    stats: { droppedSourceFiles, droppedNodes, edgesCorroborated, edgesCappedToLow, edgesDropped },
  };
}

/** Build the set of node-id→node-id pairs that have import-graph evidence. */
export function buildEvidenceEdgeSet(nodes: ExtractedNode[], importGraph?: ImportGraph): Set<string> {
  const set = new Set<string>();
  if (!importGraph) return set;
  const fileToNode = new Map<string, string>();
  for (const node of nodes) for (const sf of node.sourceFiles) if (!fileToNode.has(sf)) fileToNode.set(sf, node.id);
  for (const [importer, imported] of importGraph.edges) {
    const fromId = fileToNode.get(importer);
    if (!fromId) continue;
    for (const target of imported) {
      const toId = fileToNode.get(target);
      if (!toId || toId === fromId) continue;
      set.add(`${fromId}->${toId}`);
    }
  }
  return set;
}

/** Map compose_dependency signals ({from,to} in details) to predicted-id pairs via label slugs. */
function buildComposeEdgeSet(nodes: ExtractedNode[], signals: StaticSignal[]): Set<string> {
  const set = new Set<string>();
  const labelToId = new Map<string, string>();
  for (const node of nodes) {
    labelToId.set(slug(node.label), node.id);
    labelToId.set(slug(node.id), node.id);
  }
  for (const s of signals) {
    if (s.type !== 'compose_dependency') continue;
    const from = (s.details as { from?: string }).from;
    const to = (s.details as { to?: string }).to;
    if (!from || !to) continue;
    const fromId = labelToId.get(slug(from));
    const toId = labelToId.get(slug(to)) || labelToId.get(slug(s.label));
    if (fromId && toId) set.add(`${fromId}->${toId}`);
  }
  return set;
}

/**
 * Build edge evidence from SDK usage signals.
 * If a node uses an SDK (e.g., Stripe, OpenAI), connect it to the corresponding
 * EXTERNAL_SERVICE node whose label/reference matches the SDK name.
 */
function buildSdkEdgeSet(nodes: ExtractedNode[], signals: StaticSignal[]): Set<string> {
  const set = new Set<string>();
  const sdkBySource = new Map<string, string[]>();
  for (const s of signals) {
    if (s.type !== 'sdk_usage') continue;
    const arr = sdkBySource.get(s.source) || [];
    arr.push(s.label);
    sdkBySource.set(s.source, arr);
  }
  const externalNodes = nodes.filter((n) => n.type === 'EXTERNAL_SERVICE');
  if (externalNodes.length === 0 || sdkBySource.size === 0) return set;

  const slugLabel = (n: ExtractedNode) => slug(n.label);

  for (const node of nodes) {
    for (const sf of node.sourceFiles) {
      const sdks = sdkBySource.get(sf);
      if (!sdks) continue;
      for (const sdk of sdks) {
        const sdkSlug = slug(sdk);
        for (const ext of externalNodes) {
          if (slugLabel(ext).includes(sdkSlug) || sdkSlug.includes(slugLabel(ext))) {
            set.add(`${node.id}->${ext.id}`);
          }
        }
      }
    }
  }
  return set;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}