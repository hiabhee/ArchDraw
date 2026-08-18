import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import {
  collectGroundedNodeIds, isImportantOrphan,
} from '@/lib/repo-diagram/graph-quality';
import { compileToDiagram } from '@/lib/agents/repo-schema-compiler';
import type { RepoSnapshot, Subsystem, StaticSignal, ExtractedNode, RichEdge, Workflow, RepoProfile, DependencyIntelligence, DegradedFlags } from '@/lib/types/repo-diagram';
import type { PipelineResult as RepoPipelineResult } from '@/lib/types/repo-diagram';
import type { ImportGraph } from '@/lib/repo-diagram/import-graph';
import type { CacheWriteShared } from './shared-keys';
import { REPO_SHARED } from './shared-keys';
import { setSharedTyped } from '@/lib/pipeline-core';
import { normalizeId } from './internal-helpers';
import { detailLevelFromContext } from './context-utils';

export interface FinalizationInput {
  snapshot: RepoSnapshot;
  subsystems: Subsystem[];
  signals: StaticSignal[];
  importGraph: ImportGraph;
  workingNodes: ExtractedNode[];
  edges: RichEdge[];
  workflows: Workflow[];
  repoProfile: RepoProfile | null;
  useLlm: boolean;
  degraded: DegradedFlags;
  dependencyMapDeps: DependencyIntelligence[];
  preVerifierHighEdgeCount: number;
  detailLevel?: 1 | 2 | 3;
  repoUrl?: string;
}

function sanitizeRepoGraph(
  nodes: ExtractedNode[],
  edges: RichEdge[],
  groundedIds?: Set<string>,
  detailLevel?: 1 | 2 | 3
): { nodes: ExtractedNode[]; edges: RichEdge[]; truncatedNodes: string[] } {
  const MAX_NODES = { 1: 50, 2: 80, 3: 150 }[(detailLevel ?? 2) as 1 | 2 | 3] ?? 80;
  const MAX_EDGES = { 1: 80, 2: 120, 3: 250 }[(detailLevel ?? 2) as 1 | 2 | 3] ?? 120;

  const idMap = new Map<string, string>();
  const normalizedNodes = nodes.map(n => {
    const normalized = normalizeId(n.id);
    idMap.set(n.id, normalized);
    return { ...n, id: normalized };
  });

  const normalizedEdges = edges.map(e => ({
    ...e,
    from: idMap.get(e.from) || normalizeId(e.from),
    to: idMap.get(e.to) || normalizeId(e.to),
  }));

  const nodeById = new Map(normalizedNodes.map(n => [n.id, n]));

  const dedup = new Set<string>();
  const validEdges: RichEdge[] = [];
  for (const edge of normalizedEdges) {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) continue;
    if (edge.from === edge.to) continue;
    const key = `${edge.from}->${edge.to}->${edge.type}->${edge.label}`;
    if (dedup.has(key)) continue;
    dedup.add(key);
    validEdges.push(edge);
  }

  const connected = new Set<string>();
  for (const edge of validEdges) {
    connected.add(edge.from);
    connected.add(edge.to);
  }

  const importantTypes = new Set([
    'SERVICE', 'API_ROUTE', 'PAGE', 'WORKER', 'AUTH', 'MIDDLEWARE',
    'INFRASTRUCTURE', 'DATABASE', 'EXTERNAL_SERVICE', 'CACHE', 'QUEUE',
    'CONTROLLER', 'API_GATEWAY', 'CDN', 'STATE_MANAGEMENT',
    'DOCUMENTATION_SECTION', 'PLUGIN_SYSTEM', 'UI_COMPONENT',
  ]);

  // Connected nodes stay; orphans are kept only when they are clearly meaningful
  // (high LLM confidence, ≥2 source files, grounded core infra, or sparse graph).
  let keptNodes = normalizedNodes.filter(n =>
    connected.has(n.id) ||
    isImportantOrphan(n, connected.size)
  );
  // Sparse-graph safety: when almost nothing is connected, edge detection largely
  // failed, so don't strip the diagram down to the few connected nodes.
  if (connected.size < 3) {
    keptNodes = normalizedNodes.filter(n =>
      connected.has(n.id) ||
      importantTypes.has(n.type) ||
      n.sourceFiles.length > 0 ||
      n.confidence === 'high'
    );
  }
  if (keptNodes.length === 0) {
    keptNodes = normalizedNodes.slice(0, Math.min(normalizedNodes.length, 2));
  }

  const typePriority: Record<string, number> = {
    SERVICE: 0, API_ROUTE: 1, PAGE: 2, WORKER: 3, AUTH: 4,
    MIDDLEWARE: 5, DATABASE: 6, CACHE: 7, QUEUE: 8, STORAGE: 9,
    EXTERNAL_SERVICE: 10, INFRASTRUCTURE: 11, CORE_MODULE: 12,
  };

  const scored = keptNodes.map((node, index) => ({
    node,
    index,
    degree: validEdges.filter(e => e.from === node.id || e.to === node.id).length,
    evidenceScore: node.sourceFiles.length + (groundedIds?.has(node.id) ? 5 : 0),
  }));

  scored.sort((a, b) => {
    if (b.evidenceScore !== a.evidenceScore) return b.evidenceScore - a.evidenceScore;
    if (b.degree !== a.degree) return b.degree - a.degree;
    const priorityDelta = (typePriority[a.node.type] ?? 99) - (typePriority[b.node.type] ?? 99);
    if (priorityDelta !== 0) return priorityDelta;
    return a.index - b.index;
  });

  const selected = scored.slice(0, MAX_NODES);
  const selectedIds = new Set(selected.map(s => s.node.id));

  for (const s of scored.slice(MAX_NODES)) {
    const connectionsToKept = validEdges.filter(
      e => (e.from === s.node.id && selectedIds.has(e.to)) || (e.to === s.node.id && selectedIds.has(e.from))
    ).length;
    if (connectionsToKept >= 2) {
      selected.push(s);
      selectedIds.add(s.node.id);
    }
  }

  const truncatedNodes = scored.filter(s => !selectedIds.has(s.node.id)).map(s => s.node.label);
  keptNodes = selected.map(s => s.node);
  const keptNodeIds = new Set(keptNodes.map(n => n.id));
  const keptEdges = validEdges
    .filter(e => keptNodeIds.has(e.from) && keptNodeIds.has(e.to))
    .slice(0, MAX_EDGES);

  return { nodes: keptNodes, edges: keptEdges, truncatedNodes };
}

function buildReviewNotes(
  finalNodes: ExtractedNode[],
  finalEdges: RichEdge[],
  usedLlm: boolean,
  classifyFailed: boolean,
  edgeFailed: boolean,
  heuristicFallback: boolean,
  snapshot: RepoSnapshot
): string {
  const notes: string[] = [];

  if (!usedLlm) {
    notes.push('LLM refinement was skipped because the repository snapshot contained very little source code. The diagram is based on static file-tree analysis only.');
  } else {
    if (classifyFailed) notes.push('Architecture classification fell back to heuristics — the diagram type and pattern may be inaccurate.');
    if (edgeFailed) notes.push('Relationship analysis used heuristic inference — some connections may not reflect real data flows.');
    if (heuristicFallback) notes.push('Component extraction fell back to heuristic file-tree analysis. Some components may be missing or incorrectly named.');
  }

  if (snapshot.treeTruncated) notes.push('The repository file tree was truncated by GitHub (>100k entries). Some subsystems may be missing.');
  if (snapshot.failedPaths && snapshot.failedPaths.length > 0) {
    notes.push(`${snapshot.failedPaths.length} selected file${snapshot.failedPaths.length === 1 ? '' : 's'} could not be fetched from GitHub and may be missing from the diagram: ${snapshot.failedPaths.slice(0, 5).join(', ')}${snapshot.failedPaths.length > 5 ? '…' : ''}.`);
  }
  if (finalNodes.length < 4) {
    notes.push(`Only ${finalNodes.length} architectural component${finalNodes.length === 1 ? '' : 's'} were detected. The repo may be too small, private, or its structure non-standard.`);
  }
  if (finalEdges.length === 0 && finalNodes.length > 1) {
    notes.push('No relationships could be inferred between components. Try adding a GITHUB_TOKEN for higher API quota and better file coverage.');
  }

  const lowConfidenceRatio = finalNodes.filter(n => n.confidence === 'low').length / Math.max(finalNodes.length, 1);
  if (lowConfidenceRatio > 0.5) notes.push('More than half the detected components are low-confidence. Review the diagram before sharing.');

  if (!process.env.GITHUB_TOKEN) {
    notes.push('No GITHUB_TOKEN detected — operating at 60 req/hr GitHub rate limit. Set GITHUB_TOKEN in .env.local for 5,000 req/hr and better file coverage.');
  }

  return notes.join(' ');
}

export type FinalizationOutput = RepoPipelineResult;

export class FinalizationStage extends BaseStage<FinalizationInput, RepoPipelineResult> {
  constructor() {
    super('finalization', { description: 'Sanitize and compile the final diagram', weight: 2 });
  }

  async execute(input: FinalizationInput, context: PipelineContext): Promise<StageResult<RepoPipelineResult>> {
    const {
      snapshot, signals, workingNodes, edges, workflows, repoProfile,
      useLlm, degraded, dependencyMapDeps, preVerifierHighEdgeCount,
    } = input;
    const detailLevel = detailLevelFromContext(context, input.detailLevel);

    const finalGrounded = collectGroundedNodeIds(workingNodes, signals);
    const finalSanitized = sanitizeRepoGraph(workingNodes, edges, finalGrounded, detailLevel);
    const finalNodes = finalSanitized.nodes;
    const finalEdges = finalSanitized.edges;
    const truncatedNodes = finalSanitized.truncatedNodes ?? [];

    context.onProgress?.('compiling', 95, 'Building diagram...');
    const ndjson = compileToDiagram(finalNodes, finalEdges, workflows);

    const groundedNodeRatio = finalNodes.filter(n =>
      n.sourceFiles.length > 0 || collectGroundedNodeIds(finalNodes, signals).has(n.id)
    ).length / Math.max(finalNodes.length, 1);
    const evidencedEdgeRatio = (useLlm ? preVerifierHighEdgeCount : edges.filter(e => e.confidence === 'high').length) / Math.max(edges.length, 1);
    const pipelineConfidence: 'high' | 'medium' | 'low' =
      groundedNodeRatio >= 0.85 && evidencedEdgeRatio >= 0.70 && !degraded.anything
        ? 'high'
        : groundedNodeRatio < 0.50 || degraded.ingestion
          ? 'low'
          : 'medium';

    const reviewNotes = buildReviewNotes(
      finalNodes, finalEdges, useLlm,
      degraded.classify, degraded.edges, degraded.extract, snapshot
    );

    const result: RepoPipelineResult = {
      ndjson,
      nodeCount: finalNodes.length,
      edgeCount: finalEdges.length,
      workflowCount: workflows.length,
      workflows,
      repoProfile: repoProfile || {
        repoType: 'unknown' as const,
        architecturePattern: 'unknown' as const,
        primaryStack: { framework: null, language: snapshot.surfaceClassification.primaryLanguage, runtime: '' },
        applicationDomain: '',
        coreCapabilities: [],
        primaryUserFlows: [],
        confidence: 'low' as const,
        reasoning: 'Deterministic baseline',
        extractionStrategy: { keyDirectories: [], entryPoints: [], moduleStructure: '', focusAreas: [] },
      },
      dependencyMap: dependencyMapDeps,
      reviewNotes,
      confidence: pipelineConfidence,
      repoMeta: snapshot.repoMeta,
      nodes: finalNodes,
      edges: finalEdges,
      degraded,
      diagnostics: {
        groundedNodeRatio,
        evidencedEdgeRatio,
        truncatedNodes,
        failedPaths: snapshot.failedPaths ?? [],
      },
    };

    const cacheWrite: CacheWriteShared = {
      headSha: snapshot.headSha,
      shouldCache:
        Boolean(snapshot.headSha) &&
        !degraded.anything &&
        pipelineConfidence !== 'low' &&
        (snapshot.failedPaths?.length ?? 0) === 0,
    };
    setSharedTyped(context, REPO_SHARED.cacheWrite, cacheWrite);

    context.onProgress?.('done', 100, 'Complete');
    return successResult(result);
  }
}
