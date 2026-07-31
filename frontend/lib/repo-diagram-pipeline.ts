import { ingestRepo } from './github-ingestion';
import { buildStaticDetectionReport, formatDetectionReport } from './repo-diagram/static-detector';
import { classifyRepository } from './agents/repo-classifier';
import { extractComponents } from './agents/repo-component-extractor';
import { analyzeRelationships } from './agents/repo-relationship-analyst';

import { compileToDiagram } from './agents/repo-schema-compiler';
import { inferRelationshipsHeuristic } from './agents/repo-heuristic-extractor';
import { verifyGraph, buildEvidenceEdgeSet } from './agents/repo-verifier';
import { getRepoDiagram, setRepoDiagram } from '@/lib/ai/services/diagramCache';
import { getRepoDiagramFromRedis, setRepoDiagramInRedis } from '@/lib/ai/services/repoDiagramRedisCache';
import { detectSubsystems, summarizeSubsystem } from './repo-diagram/subsystem-detector';
import { extractStaticSignals } from './repo-diagram/static-analyzer';
import { buildEvidenceGraph, deriveEvidenceEdges, topAdjacencies } from './repo-diagram/evidence-from-graph';
import type { ImportGraph } from './repo-diagram/import-graph';
import logger from '@/lib/logger';
import { buildSubsystemGraph, intermediateToArchitecture } from './repo-diagram/intermediate-graphs';
import {
  collectGroundedNodeIds,
  deduplicateNodes,
  expandBaselineFromSignals,
  pruneNoisyEdges,
} from './repo-diagram/graph-quality';
import type { ExtractedNode, RichEdge, PipelineResult, RepoSnapshot, RepoProfile, Subsystem, StaticSignal, DependencyIntelligence, Workflow, FileEntry, DegradedFlags } from './types/repo-diagram';

export type PipelineStage =
  | 'ingesting'
  | 'detecting_subsystems'
  | 'extracting_signals'
  | 'classifying'
  | 'extracting_components'
  | 'analyzing_relationships'
  | 'compiling'
  | 'done';

export type PipelineProgressEvent = {
  stage: PipelineStage;
  message: string;
  progress: number; // 0-100
};

function normalizeId(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64) || 'node';
}

function sanitizeRepoGraph(
  nodes: ExtractedNode[],
  edges: RichEdge[],
  groundedIds?: Set<string>,
  detailLevel?: 1 | 2 | 3
): { nodes: ExtractedNode[]; edges: RichEdge[]; truncatedNodes: string[] } {
  // Phase 7.2 — Scale caps by detailLevel. Significantly increased for comprehensive diagrams.
  const MAX_NODES = { 1: 50, 2: 80, 3: 150 }[(detailLevel ?? 2) as 1 | 2 | 3] ?? 80;
  const MAX_EDGES = { 1: 80, 2: 120, 3: 250 }[(detailLevel ?? 2) as 1 | 2 | 3] ?? 120;

  const idMap = new Map<string, string>();
  const normalizedNodes = nodes.map((n) => {
    const normalized = normalizeId(n.id);
    idMap.set(n.id, normalized);
    return { ...n, id: normalized };
  });

  const normalizedEdges = edges.map((e) => ({
    ...e,
    from: idMap.get(e.from) || normalizeId(e.from),
    to: idMap.get(e.to) || normalizeId(e.to),
  }));

  const nodeById = new Map(normalizedNodes.map((n) => [n.id, n]));

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

  const importantTypes = new Set(['SERVICE', 'API_ROUTE', 'PAGE', 'WORKER', 'AUTH', 'MIDDLEWARE', 'INFRASTRUCTURE', 'DATABASE', 'EXTERNAL_SERVICE', 'CACHE', 'QUEUE', 'CONTROLLER', 'API_GATEWAY', 'CDN', 'STATE_MANAGEMENT', 'DOCUMENTATION_SECTION', 'PLUGIN_SYSTEM', 'UI_COMPONENT']);
  let keptNodes = normalizedNodes.filter((n) =>
    connected.has(n.id) ||
    importantTypes.has(n.type) ||
    (groundedIds?.has(n.id) ?? false) ||
    n.sourceFiles.length > 0
  );
  if (keptNodes.length === 0) {
    keptNodes = normalizedNodes.slice(0, Math.min(normalizedNodes.length, 2));
  }

  const typePriority: Record<string, number> = {
    SERVICE: 0, API_ROUTE: 1, PAGE: 2, WORKER: 3, AUTH: 4,
    MIDDLEWARE: 5, DATABASE: 6, CACHE: 7, QUEUE: 8, STORAGE: 9,
    EXTERNAL_SERVICE: 10, INFRASTRUCTURE: 11, CORE_MODULE: 12,
  };

  const scored = keptNodes
    .map((node, index) => ({
      node,
      index,
      degree: validEdges.filter((e) => e.from === node.id || e.to === node.id).length,
      evidenceScore: node.sourceFiles.length + (groundedIds?.has(node.id) ? 5 : 0),
    }));

  // Phase 7.2 — rank by evidence score first, degree second, type-priority as tiebreak
  scored.sort((a, b) => {
    if (b.evidenceScore !== a.evidenceScore) return b.evidenceScore - a.evidenceScore;
    if (b.degree !== a.degree) return b.degree - a.degree;
    const priorityDelta = (typePriority[a.node.type] ?? 99) - (typePriority[b.node.type] ?? 99);
    if (priorityDelta !== 0) return priorityDelta;
    return a.index - b.index;
  });

  const allNodeIds = new Set(scored.map((s) => s.node.id));
  let selected = scored.slice(0, MAX_NODES);
  const selectedIds = new Set(selected.map((s) => s.node.id));

  // Never drop a node that connects to ≥ 2 kept nodes (import-graph adjacency proxy)
  for (const s of scored.slice(MAX_NODES)) {
    const connectionsToKept = validEdges.filter(
      (e) => (e.from === s.node.id && selectedIds.has(e.to)) || (e.to === s.node.id && selectedIds.has(e.from))
    ).length;
    if (connectionsToKept >= 2) {
      selected.push(s);
      selectedIds.add(s.node.id);
    }
  }

  const truncatedNodes = scored
    .filter((s) => !selectedIds.has(s.node.id))
    .map((s) => s.node.label);

  keptNodes = selected.map((s) => s.node);
  const keptNodeIds = new Set(keptNodes.map((n) => n.id));
  const keptEdges = validEdges
    .filter((e) => keptNodeIds.has(e.from) && keptNodeIds.has(e.to))
    .slice(0, MAX_EDGES);

  return { nodes: keptNodes, edges: keptEdges, truncatedNodes };
}

function buildDeterministicBaseline(
  snapshot: RepoSnapshot,
  subsystems: Subsystem[],
  signals: StaticSignal[],
  importGraph?: ImportGraph
): { nodes: ExtractedNode[]; edges: RichEdge[]; workflows: Workflow[] } {
  let graph = buildSubsystemGraph(subsystems, snapshot.selectedFiles, signals);
  let { nodes, edges } = intermediateToArchitecture(graph, subsystems);

  nodes = expandBaselineFromSignals(nodes, signals);

  if (subsystems.length === 1 && nodes.length <= 2) {
    const dirNodes = nodesFromTopLevelDirs(snapshot, signals);
    if (dirNodes.length > 0) nodes = dirNodes;
  }

  edges = demoteGuessedEdges(edges, nodes, importGraph);

  const evidenceEdges = importGraph ? deriveEvidenceEdges(nodes, importGraph) : [];
  const mergedEdges = unionEdges([...edges, ...evidenceEdges]);

  // FIX #1: Don't sanitize here — let the caller handle truncation once at the end
  // to avoid discarding baseline nodes before they get merged with LLM results.
  return { nodes, edges: mergedEdges, workflows: [] };
}

/**
 * Phase 4.4 — inter-subsystem `http_call` edges added by buildSubsystemGraph are
 * plausibility-based, not evidence. Demote them to 'low' unless corroborated by
 * import-graph evidence. Direct evidence edges (ext_*, db_query, publishes from
 * signals) keep 'high'.
 */
function demoteGuessedEdges(edges: RichEdge[], nodes: ExtractedNode[], importGraph?: ImportGraph): RichEdge[] {
  const evidenceEdgeSet = buildEvidenceEdgeSet(nodes, importGraph);
  return edges.map((e) => {
    if (e.type === 'http_call' && e.label === 'calls') {
      if (evidenceEdgeSet.has(`${e.from}->${e.to}`)) {
        return e;
      }
      return { ...e, confidence: 'low', label: 'calls (assumed)' };
    }
    return e;
  });
}


/**
 * Phase 4.2 — for non-monorepo repos with a single (root) subsystem, build baseline
 * nodes from meaningful source directories instead of collapsing to one node.
 *
 * Container dirs (src/, app/) don't make good nodes — we bucket by the *next*
 * segment. Direct source-root dirs (routes/, services/, models/, …) at any depth
 * bucket by themselves.
 */
function nodesFromTopLevelDirs(snapshot: RepoSnapshot, _signals: StaticSignal[]): ExtractedNode[] {
  const CONTAINERS = new Set(['src', 'app']);
  const SOURCE_DIRS = new Set(['lib', 'routes', 'routers', 'services', 'models', 'controllers', 'api', 'pages', 'components', 'modules', 'handlers', 'views', 'middleware', 'prisma', 'db', 'database', 'tests', 'test', 'commands', 'jobs', 'workers', 'config']);
  const groups = new Map<string, string[]>();
  for (const p of snapshot.fileTree) {
    const parts = p.split('/');
    if (parts.length < 2) continue;
    let bucket: string | null = null;

    const ci = (s: string) => s.toLowerCase();
    // Rule A: path starts with a container (src/, app/) → bucket = next segment if present.
    if (CONTAINERS.has(ci(parts[0])) && parts[1]) {
      bucket = parts[1];
    }
    // Rule B: first segment is itself a meaningful source directory (routes/, services/, etc.) → bucket by it.
    if (!bucket && SOURCE_DIRS.has(ci(parts[0]))) {
      bucket = parts[0];
    }
    // Rule C: any deeper segment that's a SOURCE_DIR wins (e.g. `/services/...` anywhere under src/).
    if (!bucket) {
      for (let i = 1; i < parts.length; i++) {
        if (SOURCE_DIRS.has(ci(parts[i]))) { bucket = parts[i]; break; }
      }
    }
    if (!bucket) continue;
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(p);
  }
  const nodes: ExtractedNode[] = [];
  for (const [dir, files] of groups) {
    if (files.length < 3) continue;
    nodes.push({
      id: dir.toLowerCase(),
      label: `${dir.charAt(0).toUpperCase()}${dir.slice(1)}`,
      type: inferNodeTypeFromDir(dir),
      description: `${dir}/ — ${files.length} files (source directory).`,
      sourceFiles: files.slice(0, 5),
      confidence: 'medium',
    });
  }
  return nodes;
}

function inferNodeTypeFromDir(dir: string): ExtractedNode['type'] {
  const d = dir.toLowerCase();
  if (['pages', 'app', 'components', 'views'].includes(d)) return 'PAGE';
  if (['routes', 'routers', 'controllers', 'api', 'handlers'].includes(d)) return 'API_ROUTE';
  if (['models', 'prisma', 'db', 'database'].includes(d)) return 'DATABASE';
  if (['workers', 'jobs'].includes(d)) return 'WORKER';
  if (['middleware', 'auth'].includes(d)) return 'MIDDLEWARE';
  if (['services'].includes(d)) return 'SERVICE';
  if (['tests', 'test'].includes(d)) return 'CORE_MODULE';
  return 'CORE_MODULE';
}

/** Union edges by (from,to,type) keeping the higher confidence per type. */
function unionEdges(edges: RichEdge[]): RichEdge[] {
  const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const byPair = new Map<string, RichEdge>();
  for (const e of edges) {
    const key = `${e.from}->${e.to}->${e.type}`;
    const existing = byPair.get(key);
    if (!existing || rank[e.confidence] > rank[existing.confidence]) byPair.set(key, e);
  }
  return Array.from(byPair.values());
}

function buildSummariesForLLM(subsystems: Subsystem[], signals: StaticSignal[]): string[] {
  return subsystems.map((sub) => {
    const subSignals = signals.filter((s) =>
      sub.path === '/' ? !subsystems.some((other) => other.path !== '/' && s.source.startsWith(other.path)) : s.source.startsWith(sub.path)
    );
    return summarizeSubsystem(sub, subSignals.map((s) => ({
      type: s.type,
      label: s.label,
      source: s.source,
      category: s.details.category as string | undefined,
      confidence: s.confidence,
    })));
  });
}

function confidenceRankForMerge(c: string | undefined): number {
  if (c === 'high') return 3;
  if (c === 'medium') return 2;
  return 1;
}

function normalizeLabelKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\b(api|service|database|db|cache|worker|module)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function mergeLlmIntoBaseline(
  baseline: ExtractedNode[],
  llmNodes: ExtractedNode[]
): ExtractedNode[] {
  if (llmNodes.length === 0) return baseline;

  const merged = new Map<string, ExtractedNode>();
  const normId = (id: string) => normalizeId(id);

  for (const llm of llmNodes) {
    const id = normId(llm.id);
    const isGenericExternalDesc = llm.type === 'EXTERNAL_SERVICE' &&
      /^(external\s+service\s+integration|external\s+service)$/i.test(llm.description?.trim() || '');
    if (isGenericExternalDesc) continue;
    if (merged.has(id)) {
      const existing = merged.get(id)!;
      const mergedLabel = `${existing.label}/${llm.label}`;
      logger.warn(`[mergeLlmIntoBaseline] normalizeId collision: "${existing.id}" from "${existing.label}" and "${llm.label}" — skipping duplicate`);
      existing.sourceFiles = [...new Set([...existing.sourceFiles, ...llm.sourceFiles])];
      if (confidenceRankForMerge(llm.confidence) > confidenceRankForMerge(existing.confidence)) {
        existing.label = llm.label;
        existing.description = llm.description;
      }
      continue;
    }
    merged.set(id, { ...llm, id });
  }

  const llmSourceFiles = new Set(llmNodes.flatMap((n) => n.sourceFiles));
  const llmNormLabels = new Map(llmNodes.map((n) => [normalizeLabelKey(n.label), n]));

  for (const base of baseline) {
    const baseId = normId(base.id);
    const existing = merged.get(baseId);
    if (existing) {
      // Exact id match: union sourceFiles, keep higher-confidence label/type
      existing.sourceFiles = [...new Set([...existing.sourceFiles, ...base.sourceFiles])];
      if (confidenceRankForMerge(base.confidence) > confidenceRankForMerge(existing.confidence)) {
        existing.label = base.label;
        existing.description = base.description;
      }
      continue;
    }

    // Phase 7.1 — on overlap (source-file or normalized-label): MERGE instead of drop.
    // Union sourceFiles, keep the higher-confidence label/description, prefer LLM type if its confidence ≥ baseline.
    const baseNormKey = normalizeLabelKey(base.label);
    const overlapsSource = base.sourceFiles.some((sf) => llmSourceFiles.has(sf));
    const overlapsLabel = baseNormKey && llmNormLabels.has(baseNormKey);

    if (overlapsSource || overlapsLabel) {
      const llmNode = overlapsLabel
        ? llmNormLabels.get(baseNormKey)
        : [...merged.values()].find((n) => n.sourceFiles.some((sf) => base.sourceFiles.includes(sf)));
      if (llmNode) {
        const llmId = normId(llmNode.id);
        const mergedNode = { ...llmNode, id: llmId };
        mergedNode.sourceFiles = [...new Set([...mergedNode.sourceFiles, ...base.sourceFiles])];
        // Keep higher-confidence label/description
        if (confidenceRankForMerge(base.confidence) > confidenceRankForMerge(llmNode.confidence)) {
          mergedNode.label = base.label;
          mergedNode.description = base.description;
        }
        // Prefer LLM type if its confidence ≥ baseline
        if (confidenceRankForMerge(llmNode.confidence) >= confidenceRankForMerge(base.confidence)) {
          mergedNode.type = llmNode.type;
        }
        merged.set(llmId, mergedNode);
      }
      continue;
    }

    merged.set(baseId, { ...base, id: baseId });
  }

  return Array.from(merged.values());
}

function buildDependencyIntelligence(signals: StaticSignal[]): DependencyIntelligence[] {
  const depSignals = signals.filter((s) => s.type === 'dependency');
  const seen = new Set<string>();
  const deps: DependencyIntelligence[] = [];

  for (const s of depSignals) {
    const category = (s.details.category as string) || 'unknown';
    if (seen.has(s.label)) continue;
    seen.add(s.label);
    deps.push({
      name: s.label,
      category,
      purpose: `${s.label} — ${category}`,
      usedIn: [s.source],
      usagePattern: 'declared',
      architecturalRole: category === 'database' ? 'data_persistence'
        : category === 'queue' ? 'async_messaging'
        : category === 'auth' ? 'authentication'
        : category === 'payments' ? 'payments'
        : category === 'email' ? 'notification'
        : category === 'ai_ml' ? 'ai_ml'
        : 'supporting_infrastructure',
      externalEndpoint: null,
      isOnCriticalPath: ['database', 'queue', 'auth'].includes(category),
    });
  }

  return deps;
}

export async function generateRepoArchitectureDiagram(
  repoUrl: string,
  detailLevel?: 1 | 2 | 3,
  signal?: AbortSignal,
  userGithubToken?: string,
  onProgress?: (event: PipelineProgressEvent) => void
): Promise<PipelineResult> {
  logger.info('[Pipeline] Step 1: Ingesting repo...');
  onProgress?.({ stage: 'ingesting', message: 'Fetching repository...', progress: 5 });
  // Phase 2: Increased file-count budgets per detail level for better context
  const FILE_BUDGETS: Record<number, number> = { 1: 500, 2: 1000, 3: 2000 };
  const ingestOpts = { fileBudget: FILE_BUDGETS[detailLevel ?? 2] ?? 1000, contentBudgetKB: 10000 };
  const snapshot: RepoSnapshot = await ingestRepo(repoUrl, ingestOpts, signal, userGithubToken);

  if (signal?.aborted) throw new Error('Request aborted');

  if (snapshot.headSha) {
    let cached = getRepoDiagram(repoUrl, snapshot.headSha); // L1: in-memory
    if (!cached) {
      cached = await getRepoDiagramFromRedis(repoUrl, snapshot.headSha); // L2: Redis
      if (cached) {
        setRepoDiagram(repoUrl, snapshot.headSha, cached); // warm L1
        logger.info(`[Pipeline] Redis cache hit for ${repoUrl}`);
      }
    }
    if (cached) {
      logger.info(`[Pipeline] Cache hit for ${repoUrl} @ ${snapshot.headSha.slice(0, 7)}`);
      return cached;
    }
    logger.info(`[Pipeline] Cache miss for ${repoUrl} @ ${snapshot.headSha.slice(0, 7)}`);
  }

  logger.info('[Pipeline] Step 2: Detecting subsystems...');
  const subsystems = detectSubsystems(snapshot);
  logger.info(`  Found ${subsystems.length} subsystems`);
  onProgress?.({ stage: 'detecting_subsystems', message: `Found ${subsystems.length} subsystems`, progress: 20 });

  logger.info('[Pipeline] Step 3: Extracting static signals...');
  const signals = extractStaticSignals(snapshot.selectedFiles, subsystems);
  logger.info(`  Extracted ${signals.length} signals (${new Set(signals.map((s) => s.type)).size} types)`);
  onProgress?.({ stage: 'extracting_signals', message: `${signals.length} architectural signals`, progress: 35 });

  // Phase 3: evidence-based import graph — feeds baseline edges + Phase 6 verifier + relationship evidence pack.
  const importGraph: ImportGraph = buildEvidenceGraph(snapshot.selectedFiles, snapshot.fileTree);
  logger.info(`  Import graph: ${importGraph.edges.size} importer files, ${importGraph.external.size} external refs`);

  const baseline = buildDeterministicBaseline(snapshot, subsystems, signals, importGraph);
  let workingNodes = baseline.nodes;
  let edges = baseline.edges;
  let workflows = baseline.workflows;
  let repoProfile: RepoProfile | null = null;
  const dependencyMapDeps = buildDependencyIntelligence(signals);
  let classifyFailed = false;
  let llmEdgeFailed = false;
  let heuristicComponentFallback = false;

  const summaries = buildSummariesForLLM(subsystems, signals);

  function buildReviewNotes(
    finalNodes: ExtractedNode[],
    finalEdges: RichEdge[],
    usedLlm: boolean,
    classifyFailed: boolean,
    edgeFailed: boolean,
    heuristicFallback: boolean
  ): string {
    const notes: string[] = [];

    if (!usedLlm) {
      notes.push('LLM refinement was skipped because the repository snapshot contained very little source code. The diagram is based on static file-tree analysis only.');
    } else {
      if (classifyFailed) {
        notes.push('Architecture classification fell back to heuristics — the diagram type and pattern may be inaccurate.');
      }
      if (edgeFailed) {
        notes.push('Relationship analysis used heuristic inference — some connections may not reflect real data flows.');
      }
      if (heuristicFallback) {
        notes.push('Component extraction fell back to heuristic file-tree analysis. Some components may be missing or incorrectly named.');
      }
    }

    if (snapshot.treeTruncated) {
      notes.push('The repository file tree was truncated by GitHub (>100k entries). Some subsystems may be missing.');
    }

    if (snapshot.failedPaths && snapshot.failedPaths.length > 0) {
      notes.push(`${snapshot.failedPaths.length} selected file${snapshot.failedPaths.length === 1 ? '' : 's'} could not be fetched from GitHub and may be missing from the diagram: ${snapshot.failedPaths.slice(0, 5).join(', ')}${snapshot.failedPaths.length > 5 ? '…' : ''}.`);
    }

    if (finalNodes.length < 4) {
      notes.push(`Only ${finalNodes.length} architectural component${finalNodes.length === 1 ? '' : 's'} were detected. The repo may be too small, private, or its structure non-standard.`);
    }

    if (finalEdges.length === 0 && finalNodes.length > 1) {
      notes.push('No relationships could be inferred between components. Try adding a GITHUB_TOKEN for higher API quota and better file coverage.');
    }

    const lowConfidenceRatio =
      finalNodes.filter((n) => n.confidence === 'low').length / Math.max(finalNodes.length, 1);
    if (lowConfidenceRatio > 0.5) {
      notes.push('More than half the detected components are low-confidence. Review the diagram before sharing.');
    }

    if (!process.env.GITHUB_TOKEN) {
      notes.push('No GITHUB_TOKEN detected — operating at 60 req/hr GitHub rate limit. Set GITHUB_TOKEN in .env.local for 5,000 req/hr and better file coverage.');
    }

    return notes.join(' ');
  }

  const hasAnySourceFiles = snapshot.phase2Files.length >= 1 || snapshot.selectedFiles.length >= 4;
  const hasAnySignals = signals.length >= 3;
  const useLlm = detailLevel !== 1 && (hasAnySourceFiles || hasAnySignals);

  if (!useLlm) {
    logger.info(`[Pipeline] Skipping LLM — ${detailLevel === 1 ? 'detailLevel=1 (static-only)' : `repo appears empty (files=${snapshot.selectedFiles.length}, signals=${signals.length})`}`);
  }

  let truncatedNodes: string[] = [];
  let preVerifierHighEdgeCount = 0;

  if (useLlm) {
    // Step 4: Build static detection report (deterministic, no LLM)
    logger.info('[Pipeline] Step 4: Building static detection report...');
    const detectionReport = buildStaticDetectionReport(snapshot, subsystems, signals);
    const detectionReportText = formatDetectionReport(detectionReport);
    logger.info(`  Detection report: ${detectionReportText.split('\n').length} lines`);

    if (signal?.aborted) throw new Error('Request aborted');

    // Step 5: Architecture classification (tiny LLM call)
    logger.log('[Pipeline] Step 5: Classifying architecture (LLM)...');
    try {
      repoProfile = await classifyRepository(snapshot, detectionReportText, summaries);
      classifyFailed = repoProfile.confidence === 'low';
      logger.log(`  Type: ${repoProfile.repoType}, pattern: ${repoProfile.architecturePattern}, domain: ${repoProfile.applicationDomain || 'N/A'}`);
      onProgress?.({ stage: 'classifying', message: `${repoProfile.repoType} · ${repoProfile.architecturePattern}`, progress: 50 });
    } catch (err) {
      logger.warn('[Pipeline] Classification failed, using fallback:', err);
      const { buildFallbackRepoProfile } = await import('./agents/repo-deep-classifier');
      repoProfile = buildFallbackRepoProfile(snapshot);
      classifyFailed = true;
    }

    if (signal?.aborted) throw new Error('Request aborted');

    // Phase 6.1 — Pass 2 targeted fetch: read extractionStrategy.keyDirectories + entryPoints;
    // add files not already selected, detailLevel-scaled (in-memory slice after Phase 2 → 0 API calls).
    if (repoProfile) {
      const pass2 = gatherPass2Files(snapshot, repoProfile, (detailLevel ?? 2) === 3 ? 40 : 25);
      if (pass2.length > 0) {
        logger.info(`[Pipeline] Pass 2: +${pass2.length} files`);
        snapshot.selectedFiles = [...snapshot.selectedFiles, ...pass2];
        snapshot.phase2Files = [...snapshot.phase2Files, ...pass2];
      }
    }

    // Step 6: Component extraction (small LLM call, uses static report + classification)
    logger.log('[Pipeline] Step 6: Extracting components (LLM)...');
    try {
      const llmNodes = await extractComponents(snapshot, repoProfile, detectionReportText, summaries);
      if (llmNodes.length > 0) {
        workingNodes = mergeLlmIntoBaseline(baseline.nodes, llmNodes);
        logger.log(`  Baseline: ${baseline.nodes.length}, LLM: ${llmNodes.length}, Merged: ${workingNodes.length}`);
      } else {
        logger.log('  No LLM nodes returned, keeping baseline');
      }
      onProgress?.({ stage: 'extracting_components', message: `${workingNodes.length} components`, progress: 65 });
    } catch (err) {
      logger.warn('[Pipeline] Component extraction failed, using heuristic fallback:', err);
      heuristicComponentFallback = true;
      const heuristicNodes = (await import('./agents/repo-heuristic-extractor')).extractComponentsHeuristic(snapshot, repoProfile);
      if (heuristicNodes.length > 0) {
        workingNodes = mergeLlmIntoBaseline(baseline.nodes, heuristicNodes);
      }
    }

    if (signal?.aborted) throw new Error('Request aborted');

    // Step 7: Workflow-first relationship analysis (LLM)
    logger.log('[Pipeline] Step 7: Analyzing relationships + workflows (LLM)...');
    try {
      const relOutput = await analyzeRelationships(
        snapshot, workingNodes, repoProfile ?? undefined,
        { dependencies: dependencyMapDeps }, summaries, detectionReportText,
        { importGraph, signals },
      );
      if (relOutput.edges.length > 0) {
        edges = relOutput.edges;
      }
      if (relOutput.workflows.length > 0) workflows = relOutput.workflows;
      logger.log(`  Got ${edges.length} edges, ${workflows.length} workflows`);
      onProgress?.({ stage: 'analyzing_relationships', message: `${edges.length} relationships`, progress: 80 });
    } catch {
      logger.warn('[Pipeline] LLM relationship analysis failed');
      llmEdgeFailed = true;
    }

    // Phase 6.4 — deterministic verifier (no LLM). Drop hallucinated sourceFiles,
    // drop orphaned low-confidence nodes, cap ungrounded edges to 'low'.
    preVerifierHighEdgeCount = edges.filter((e) => e.confidence === 'high').length;
    const verified = verifyGraph({
      nodes: workingNodes,
      edges,
      signals,
      fileTree: snapshot.fileTree,
      importGraph,
    });
    if (verified.stats.droppedNodes > 0 || verified.stats.droppedSourceFiles > 0) {
      logger.info(`[Pipeline] Verifier: dropped ${verified.stats.droppedNodes} orphan node(s), cleaned ${verified.stats.droppedSourceFiles} phantom sourceFile(s)`);
    }
    if (verified.stats.edgesCappedToLow > 0 || verified.stats.edgesCorroborated > 0) {
      logger.info(`[Pipeline] Verifier: capped ${verified.stats.edgesCappedToLow} ungrounded edge(s) to low; corroborated ${verified.stats.edgesCorroborated}`);
    }
    workingNodes = verified.nodes;
    edges = verified.edges;

    // Phase 7.3 — always union heuristic edges with LLM + evidence edges
    const heuristic = inferRelationshipsHeuristic(workingNodes);
    if (heuristic.edges.length > 0) {
      const edgeKey = (e: RichEdge) => `${normalizeId(e.from)}->${normalizeId(e.to)}->${e.type}`;
      const existingKeys = new Set(edges.map(edgeKey));
      for (const he of heuristic.edges) {
        if (!existingKeys.has(edgeKey(he))) {
          edges.push({ ...he, confidence: 'low' as const });
        }
      }
      if (heuristic.workflows.length > 0) workflows = heuristic.workflows;
    }
    const deduped = deduplicateNodes(workingNodes, edges);
    workingNodes = deduped.nodes;
    edges = pruneNoisyEdges(deduped.nodes, deduped.edges);
  } else {
    const deduped = deduplicateNodes(workingNodes, edges);
    workingNodes = deduped.nodes;
    edges = pruneNoisyEdges(deduped.nodes, deduped.edges);
  }

  const finalGrounded = collectGroundedNodeIds(workingNodes, signals);
  const finalSanitized = sanitizeRepoGraph(workingNodes, edges, finalGrounded, detailLevel);
  workingNodes = finalSanitized.nodes;
  edges = finalSanitized.edges;
  truncatedNodes = finalSanitized.truncatedNodes ?? [];

  logger.log(`[Pipeline] Step 8: Generating diagram (${workingNodes.length} nodes, ${edges.length} edges, ${workflows.length} workflows)`);
  onProgress?.({ stage: 'compiling', message: 'Building diagram...', progress: 95 });
  const ndjson = compileToDiagram(workingNodes, edges, workflows);

  // Phase 7.4 — populate degraded flags
  const degraded: DegradedFlags = {
    classify: classifyFailed,
    extract: heuristicComponentFallback,
    edges: llmEdgeFailed,
    ingestion: (snapshot.failedPaths?.length ?? 0) > 0,
    anything: classifyFailed || heuristicComponentFallback || llmEdgeFailed || (snapshot.failedPaths?.length ?? 0) > 0,
  };

  // Phase 8 — coverage-computed pipeline confidence replaces averaged self-reports.
  // Use pre-verifier high edge count (with verified corroborated count) to avoid
  // inflation from verifier promotions, while still crediting verified evidence.
  const groundedNodeRatio = workingNodes.filter((n) => n.sourceFiles.length > 0 || (collectGroundedNodeIds(workingNodes, signals).has(n.id))).length / Math.max(workingNodes.length, 1);
  const evidencedEdgeRatio = (useLlm ? preVerifierHighEdgeCount : edges.filter((e) => e.confidence === 'high').length) / Math.max(edges.length, 1);
  const pipelineConfidence: 'high' | 'medium' | 'low' =
    groundedNodeRatio >= 0.85 && evidencedEdgeRatio >= 0.70 && !degraded.anything
      ? 'high'
      : groundedNodeRatio < 0.50 || degraded.ingestion
        ? 'low'
        : 'medium';
  logger.log(`[Pipeline] Confidence: ${pipelineConfidence}  (groundedNodes=${(groundedNodeRatio * 100).toFixed(0)}%, evidencedEdges=${(evidencedEdgeRatio * 100).toFixed(0)}%)`);

  const reviewNotes = buildReviewNotes(workingNodes, edges, useLlm, classifyFailed, llmEdgeFailed, heuristicComponentFallback);

  const result: PipelineResult = {
    ndjson,
    nodeCount: workingNodes.length,
    edgeCount: edges.length,
    workflowCount: workflows.length,
    workflows,
    repoProfile: repoProfile || {
      repoType: 'unknown',
      architecturePattern: 'unknown',
      primaryStack: { framework: null, language: snapshot.surfaceClassification.primaryLanguage, runtime: '' },
      applicationDomain: '',
      coreCapabilities: [],
      primaryUserFlows: [],
      confidence: 'low',
      reasoning: 'Deterministic baseline',
      extractionStrategy: { keyDirectories: [], entryPoints: [], moduleStructure: '', focusAreas: [] },
    },
    dependencyMap: dependencyMapDeps,
    reviewNotes,
    confidence: pipelineConfidence,
    repoMeta: snapshot.repoMeta,
    nodes: workingNodes,
    edges: edges,
    degraded,
    diagnostics: {
      groundedNodeRatio,
      evidencedEdgeRatio,
      truncatedNodes,
      failedPaths: snapshot.failedPaths ?? [],
    },
  };

  // Phase 7.5 — cache quality gate: only cache when no degraded flags and confidence not low and no failed paths
  if (snapshot.headSha && !degraded.anything && pipelineConfidence !== 'low' && (snapshot.failedPaths?.length ?? 0) === 0) {
    setRepoDiagram(repoUrl, snapshot.headSha, result); // L1
    await setRepoDiagramInRedis(repoUrl, snapshot.headSha, result); // L2
    logger.log(`[Pipeline] Cached result for ${repoUrl} @ ${snapshot.headSha.slice(0, 7)}`);
  }

  onProgress?.({ stage: 'done', message: 'Complete', progress: 100 });
  return result;
}

/**
 * Phase 6.1 — Pass 2 targeted fetch.
 *
 * Read extractionStrategy.keyDirectories + entryPoints; find files in the fileTree
 * under those paths NOT already selected; add up to `cap` more files.
 *
 * This operates entirely on the in-memory archive map (Phase 2) → 0 extra API calls
 * on the archive path. Falls back to no-op if the file isn't in the archive (the
 * Contents-API fallback path will return undefined for `archiveMap.get`).
 */
function gatherPass2Files(snapshot: RepoSnapshot, profile: RepoProfile, cap: number): FileEntry[] {
  const selected = new Set(snapshot.selectedFiles.map((f) => f.path));
  const candidates: string[] = [];
  const dirs = profile.extractionStrategy.keyDirectories ?? [];
  const entries = profile.extractionStrategy.entryPoints ?? [];
  const allPaths = [...dirs, ...entries];
  if (allPaths.length === 0) return [];

  for (const path of snapshot.fileTree) {
    if (candidates.length >= cap) break;
    if (selected.has(path)) continue;
    if (allPaths.some((p) => path.startsWith(p) || path === p)) {
      if (/(__tests__|\.test\.|\.spec\.)/.test(path)) continue;
      candidates.push(path);
    }
  }
  const out: FileEntry[] = [];
  // Phase 2/6: archive map available → zero-API-call pass; else skip (Phase 2 fallback).
  const map = snapshot.archiveMap;
  if (!map) {
    if (candidates.length > 0) {
      logger.warn(`[gatherPass2Files] archiveMap unavailable (Contents-API fallback) — Pass 2 no-op; ${candidates.length} candidate file(s) would have been fetched`);
    }
    return out;
  }
  for (const p of candidates) {
    const content = map.get(p);
    if (content != null) out.push({ path: p, content });
  }
  return out;
}
