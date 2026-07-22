import { ingestRepo } from './github-ingestion';
import { buildStaticDetectionReport, formatDetectionReport } from './repo-diagram/static-detector';
import { classifyRepository } from './agents/repo-classifier';
import { extractComponents } from './agents/repo-component-extractor';
import { analyzeRelationships } from './agents/repo-relationship-analyst';

import { compileToDiagram } from './agents/repo-schema-compiler';
import { inferRelationshipsHeuristic } from './agents/repo-heuristic-extractor';
import { getRepoDiagram, setRepoDiagram } from '@/lib/ai/services/diagramCache';
import { detectSubsystems, summarizeSubsystem } from './repo-diagram/subsystem-detector';
import { extractStaticSignals } from './repo-diagram/static-analyzer';
import logger from '@/lib/logger';
import { buildSubsystemGraph, intermediateToArchitecture } from './repo-diagram/intermediate-graphs';
import {
  collectGroundedNodeIds,
  deduplicateNodes,
  pruneNoisyEdges,
} from './repo-diagram/graph-quality';
import type { ExtractedNode, RichEdge, PipelineResult, RepoSnapshot, RepoProfile, Subsystem, StaticSignal, DependencyIntelligence, Workflow } from './types/repo-diagram';

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
  groundedIds?: Set<string>
): { nodes: ExtractedNode[]; edges: RichEdge[] } {
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

  const importantTypes = new Set(['SERVICE', 'API_ROUTE', 'PAGE', 'WORKER', 'AUTH', 'MIDDLEWARE', 'INFRASTRUCTURE', 'DATABASE', 'EXTERNAL_SERVICE', 'CACHE', 'QUEUE']);
  let keptNodes = normalizedNodes.filter((n) =>
    connected.has(n.id) ||
    importantTypes.has(n.type) ||
    (groundedIds?.has(n.id) ?? false) ||
    n.sourceFiles.length > 0
  );
  if (keptNodes.length === 0) {
    keptNodes = normalizedNodes.slice(0, Math.min(normalizedNodes.length, 2));
  }

  const MAX_NODES = 40;
  const MAX_EDGES = 60;
  const typePriority: Record<string, number> = {
    SERVICE: 0,
    API_ROUTE: 1,
    PAGE: 2,
    WORKER: 3,
    AUTH: 4,
    MIDDLEWARE: 5,
    DATABASE: 6,
    CACHE: 7,
    QUEUE: 8,
    STORAGE: 9,
    EXTERNAL_SERVICE: 10,
    INFRASTRUCTURE: 11,
    CORE_MODULE: 12,
  };

  keptNodes = keptNodes
    .map((node, index) => ({ node, index, degree: validEdges.filter((e) => e.from === node.id || e.to === node.id).length }))
    .sort((a, b) => {
      const priorityDelta = (typePriority[a.node.type] ?? 99) - (typePriority[b.node.type] ?? 99);
      if (priorityDelta !== 0) return priorityDelta;
      if (b.degree !== a.degree) return b.degree - a.degree;
      return a.index - b.index;
    })
    .slice(0, MAX_NODES)
    .map((item) => item.node);

  const keptNodeIds = new Set(keptNodes.map((n) => n.id));
  const keptEdges = validEdges
    .filter((e) => keptNodeIds.has(e.from) && keptNodeIds.has(e.to))
    .slice(0, MAX_EDGES);

  return {
    nodes: keptNodes,
    edges: keptEdges,
  };
}

function buildDeterministicBaseline(
  snapshot: RepoSnapshot,
  subsystems: Subsystem[],
  signals: StaticSignal[]
): { nodes: ExtractedNode[]; edges: RichEdge[]; workflows: Workflow[] } {
  const graph = buildSubsystemGraph(subsystems, snapshot.selectedFiles, signals);
  const { nodes, edges } = intermediateToArchitecture(graph, subsystems);
  const grounded = collectGroundedNodeIds(nodes, signals);
  const sanitized = sanitizeRepoGraph(nodes, edges, grounded);
  return { nodes: sanitized.nodes, edges: sanitized.edges, workflows: [] };
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

function mergeLlmIntoBaseline(
  baseline: ExtractedNode[],
  llmNodes: ExtractedNode[]
): ExtractedNode[] {
  if (llmNodes.length === 0) return baseline;

  const merged = new Map<string, ExtractedNode>();

  for (const llm of llmNodes) {
    const id = normalizeId(llm.id);
    const isGenericExternalDesc = llm.type === 'EXTERNAL_SERVICE' &&
      /^(external\s+service\s+integration|external\s+service)$/i.test(llm.description?.trim() || '');
    if (isGenericExternalDesc) continue;
    merged.set(id, { ...llm, id });
  }

  const llmSourceFiles = new Set(llmNodes.flatMap((n) => n.sourceFiles));
  const llmLabels = new Set(llmNodes.map((n) => n.label.toLowerCase().trim()));

  for (const base of baseline) {
    const baseId = normalizeId(base.id);
    if (merged.has(baseId)) {
      const existing = merged.get(baseId)!;
      existing.sourceFiles = [...new Set([...existing.sourceFiles, ...base.sourceFiles])];
      continue;
    }

    const overlapsSource = base.sourceFiles.some((sf) => llmSourceFiles.has(sf));
    const overlapsLabel = llmLabels.has(base.label.toLowerCase().trim());
    if (overlapsSource || overlapsLabel) continue;

    merged.set(baseId, { ...base, id: baseId });
  }

  return Array.from(merged.values());
}

function buildDependencyIntelligence(signals: StaticSignal[]): DependencyIntelligence[] {
  const depSignals = signals.filter((s) => s.type === 'dependency');
  const seen = new Set<string>();
  const deps: DependencyIntelligence[] = [];

  const nonArchitecturalCategories = new Set(['ui_framework', 'state_management', 'http_client', 'monitoring']);

  for (const s of depSignals) {
    const category = (s.details.category as string) || 'unknown';
    if (nonArchitecturalCategories.has(category)) continue;
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

export async function generateRepoArchitectureDiagram(repoUrl: string, detailLevel?: 1 | 2 | 3, signal?: AbortSignal): Promise<PipelineResult> {
  logger.info('[Pipeline] Step 1: Ingesting repo...');
  const snapshot: RepoSnapshot = await ingestRepo(repoUrl);

  if (signal?.aborted) throw new Error('Request aborted');

  if (snapshot.headSha) {
    const cached = getRepoDiagram(repoUrl, snapshot.headSha);
    if (cached) {
      logger.info(`[Pipeline] Cache hit for ${repoUrl} @ ${snapshot.headSha.slice(0, 7)}`);
      return cached;
    }
    logger.info(`[Pipeline] Cache miss for ${repoUrl} @ ${snapshot.headSha.slice(0, 7)}`);
  }

  logger.info('[Pipeline] Step 2: Detecting subsystems...');
  const subsystems = detectSubsystems(snapshot);
  logger.info(`  Found ${subsystems.length} subsystems`);

  logger.info('[Pipeline] Step 3: Extracting static signals...');
  const signals = extractStaticSignals(snapshot.selectedFiles, subsystems);
  logger.info(`  Extracted ${signals.length} signals (${new Set(signals.map((s) => s.type)).size} types)`);

  const baseline = buildDeterministicBaseline(snapshot, subsystems, signals);
  let workingNodes = baseline.nodes;
  let edges = baseline.edges;
  let workflows = baseline.workflows;
  let repoProfile: RepoProfile | null = null;
  const dependencyMapDeps = buildDependencyIntelligence(signals);
  let classifyFailed = false;
  let llmEdgeFailed = false;

  const summaries = buildSummariesForLLM(subsystems, signals);

  function buildReviewNotes(
    finalNodes: ExtractedNode[],
    finalEdges: RichEdge[],
    usedLlm: boolean,
    classifyFailed: boolean,
    edgeFailed: boolean
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
    }

    if (snapshot.treeTruncated) {
      notes.push('The repository file tree was truncated by GitHub (>100k entries). Some subsystems may be missing.');
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
  const useLlm = hasAnySourceFiles || hasAnySignals;

  if (!useLlm) {
    logger.info(`[Pipeline] Skipping LLM — repo appears empty (files=${snapshot.selectedFiles.length}, signals=${signals.length})`);
  }

  if (useLlm) {
    // Step 4: Build static detection report (deterministic, no LLM)
    logger.info('[Pipeline] Step 4: Building static detection report...');
    const detectionReport = buildStaticDetectionReport(snapshot, subsystems, signals);
    const detectionReportText = formatDetectionReport(detectionReport);
    logger.info(`  Detection report: ${detectionReportText.split('\n').length} lines`);

    if (signal?.aborted) throw new Error('Request aborted');

    // Step 5: Architecture classification (tiny LLM call)
    console.log('[Pipeline] Step 5: Classifying architecture (LLM)...');
    try {
      repoProfile = await classifyRepository(snapshot, detectionReportText, summaries);
      classifyFailed = repoProfile.confidence === 'low';
      console.log(`  Type: ${repoProfile.repoType}, pattern: ${repoProfile.architecturePattern}, domain: ${repoProfile.applicationDomain || 'N/A'}`);
    } catch (err) {
      console.warn('[Pipeline] Classification failed, using fallback:', err);
      const { buildFallbackRepoProfile } = await import('./agents/repo-deep-classifier');
      repoProfile = buildFallbackRepoProfile(snapshot);
      classifyFailed = true;
    }

    if (signal?.aborted) throw new Error('Request aborted');

    // Step 6: Component extraction (small LLM call, uses static report + classification)
    console.log('[Pipeline] Step 6: Extracting components (LLM)...');
    try {
      const llmNodes = await extractComponents(snapshot, repoProfile, detectionReportText, summaries);
      if (llmNodes.length > 0) {
        workingNodes = mergeLlmIntoBaseline(baseline.nodes, llmNodes);
        console.log(`  Baseline: ${baseline.nodes.length}, LLM: ${llmNodes.length}, Merged: ${workingNodes.length}`);
      } else {
        console.log('  No LLM nodes returned, keeping baseline');
      }
    } catch (err) {
      console.warn('[Pipeline] Component extraction failed, using heuristic fallback:', err);
      const heuristicNodes = (await import('./agents/repo-heuristic-extractor')).extractComponentsHeuristic(snapshot, repoProfile);
      if (heuristicNodes.length > 0) {
        workingNodes = mergeLlmIntoBaseline(baseline.nodes, heuristicNodes);
      }
    }

    const mergedGrounded = collectGroundedNodeIds(workingNodes, signals);

    if (signal?.aborted) throw new Error('Request aborted');

    // Step 7: Workflow-first relationship analysis (LLM)
    console.log('[Pipeline] Step 7: Analyzing relationships + workflows (LLM)...');
    try {
      const relOutput = await analyzeRelationships(snapshot, workingNodes, repoProfile ?? undefined, { dependencies: dependencyMapDeps }, summaries, detectionReportText);
      if (relOutput.edges.length > 0) {
        edges = relOutput.edges;
      }
      if (relOutput.workflows.length > 0) workflows = relOutput.workflows;
      console.log(`  Got ${edges.length} edges, ${workflows.length} workflows`);
    } catch {
      console.warn('[Pipeline] LLM relationship analysis failed');
      llmEdgeFailed = true;
    }

    let sanitized = sanitizeRepoGraph(workingNodes, edges, mergedGrounded);
    const needsFallback = sanitized.edges.length === 0 ||
      sanitized.edges.length < Math.min(3, baseline.edges.length) ||
      sanitized.edges.length < Math.floor(baseline.edges.length * 0.6);
    if (needsFallback) {
      console.warn(`[Pipeline] Relationship fallback: ${sanitized.edges.length} valid edges (baseline had ${baseline.edges.length}), running heuristic`);
      const heuristic = inferRelationshipsHeuristic(sanitized.nodes);
      if (heuristic.edges.length > 0) {
        const edgeKey = (e: RichEdge) => `${normalizeId(e.from)}->${normalizeId(e.to)}->${e.type}`;
        const existingKeys = new Set(edges.map(edgeKey));
        for (const he of heuristic.edges) {
          if (!existingKeys.has(edgeKey(he))) {
            edges.push({ ...he, confidence: 'low' as const });
          }
        }
        if (heuristic.workflows.length > 0) workflows = heuristic.workflows;
        sanitized = sanitizeRepoGraph(workingNodes, edges, mergedGrounded);
        console.log(`  After merge: ${sanitized.edges.length} edges`);
      }
    }
    workingNodes = sanitized.nodes;
    edges = sanitized.edges;

    const deduped = deduplicateNodes(workingNodes, edges);
    workingNodes = deduped.nodes;
    edges = pruneNoisyEdges(deduped.nodes, deduped.edges);
  } else {
    const deduped = deduplicateNodes(workingNodes, pruneNoisyEdges(workingNodes, edges));
    workingNodes = deduped.nodes;
    edges = deduped.edges;
  }

  const finalGrounded = collectGroundedNodeIds(workingNodes, signals);
  const finalSanitized = sanitizeRepoGraph(workingNodes, edges, finalGrounded);
  workingNodes = finalSanitized.nodes;
  edges = finalSanitized.edges;

  console.log(`[Pipeline] Step 8: Generating diagram (${workingNodes.length} nodes, ${edges.length} edges, ${workflows.length} workflows)`);
  const ndjson = compileToDiagram(workingNodes, edges, workflows);

  const allConfidences = [
    ...workingNodes.map((n) => n.confidence || 'medium'),
    ...edges.map((e) => e.confidence || 'medium'),
  ];
  const hasLow = allConfidences.some((c) => c === 'low');
  const allHigh = allConfidences.every((c) => c === 'high');
  const pipelineConfidence: 'high' | 'medium' | 'low' = allHigh ? 'high' : hasLow ? 'low' : 'medium';

  const reviewNotes = buildReviewNotes(workingNodes, edges, useLlm, classifyFailed, llmEdgeFailed);

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
  };

  if (snapshot.headSha) {
    setRepoDiagram(repoUrl, snapshot.headSha, result);
    console.log(`[Pipeline] Cached result for ${repoUrl} @ ${snapshot.headSha.slice(0, 7)}`);
  }

  return result;
}
