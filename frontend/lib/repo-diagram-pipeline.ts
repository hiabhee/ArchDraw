import { ingestRepo } from './github-ingestion';
import { deepClassify } from './agents/repo-deep-classifier';
import { extractComponents } from './agents/repo-component-extractor';
import { analyzeRelationships } from './agents/repo-relationship-analyst';

import { compileToDiagram } from './agents/repo-schema-compiler';
import { inferRelationshipsHeuristic } from './agents/repo-heuristic-extractor';
import { getRepoDiagram, setRepoDiagram } from '@/lib/ai/services/diagramCache';
import { detectSubsystems, summarizeSubsystem } from './repo-diagram/subsystem-detector';
import { extractStaticSignals } from './repo-diagram/static-analyzer';
import { buildSubsystemGraph, intermediateToArchitecture } from './repo-diagram/intermediate-graphs';
import type { ExtractedNode, RichEdge, PipelineResult, RepoSnapshot, RepoProfile, Subsystem, StaticSignal, DependencyIntelligence } from './types/repo-diagram';

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
  edges: RichEdge[]
): { nodes: ExtractedNode[]; edges: RichEdge[] } {
  // Normalize all node IDs
  const idMap = new Map<string, string>();
  const normalizedNodes = nodes.map((n) => {
    const normalized = normalizeId(n.id);
    idMap.set(n.id, normalized);
    return { ...n, id: normalized };
  });

  // Normalize edge IDs
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

  const importantTypes = new Set(['SERVICE', 'API_ROUTE', 'PAGE', 'WORKER', 'AUTH', 'MIDDLEWARE', 'INFRASTRUCTURE']);
  let keptNodes = normalizedNodes.filter((n) =>
    connected.has(n.id) || importantTypes.has(n.type)
  );
  if (keptNodes.length === 0) {
    keptNodes = normalizedNodes.slice(0, Math.min(normalizedNodes.length, 2));
  }

  // Cap output
  const MAX_NODES = 30;
  const MAX_EDGES = 40;
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

/**
 * Build a deterministic architecture baseline from the repo snapshot.
 * No LLM calls — subsystem detection + static signals + graph composition.
 */
function buildDeterministicBaseline(
  snapshot: RepoSnapshot,
  subsystems: Subsystem[],
  signals: StaticSignal[]
): { nodes: ExtractedNode[]; edges: RichEdge[]; workflows: { name: string; description: string; steps: string[] }[] } {
  const graph = buildSubsystemGraph(subsystems, snapshot.selectedFiles, signals);
  const { nodes, edges } = intermediateToArchitecture(graph, subsystems);
  const sanitized = sanitizeRepoGraph(nodes, edges);
  return { nodes: sanitized.nodes, edges: sanitized.edges, workflows: [] };
}

/**
 * Build compact subsystem summaries for LLM consumption, replacing raw source feeding.
 */
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

/**
 * Merge LLM-refined nodes into the deterministic baseline.
 * Baseline nodes are the grounded source of truth — the LLM may enrich,
 * rename, merge, or add evidence-backed nodes, but must not replace nodes
 * that the deterministic analysis produced.
 *
 * Matching priority:
 *   1. Normalized ID
 *   2. Normalized label + type
 *   3. Overlapping sourceFiles
 *
 * New LLM-only nodes are only kept when backed by static signals or
 * when they carry high/medium confidence with a concrete type.
 */
function mergeLlmIntoBaseline(
  baseline: ExtractedNode[],
  llmNodes: ExtractedNode[],
  signals: StaticSignal[]
): ExtractedNode[] {
  if (llmNodes.length === 0) return baseline;

  // Build a set of signal-derived labels for validating new LLM nodes
  const signalLabels = new Set(signals.map((s) => s.label.toLowerCase()));

  const merged = new Map<string, ExtractedNode>();
  for (const n of baseline) merged.set(n.id, { ...n });

  for (const llm of llmNodes) {
    const llmId = normalizeId(llm.id);
    const llmLabel = llm.label.toLowerCase().trim();
    const llmType = llm.type;

    // (1) Try normalized ID match
    if (merged.has(llmId)) {
      const existing = merged.get(llmId)!;
      merged.set(llmId, {
        ...existing,
        description: llm.description || existing.description,
        confidence: llm.confidence === 'high' ? llm.confidence : existing.confidence,
        sourceFiles: [...new Set([...existing.sourceFiles, ...llm.sourceFiles])],
      });
      continue;
    }

    // (2) Try label + type match
    const labelTypeMatch = Array.from(merged.values()).find(
      (n) => n.label.toLowerCase().trim() === llmLabel && n.type === llmType
    );
    if (labelTypeMatch) {
      merged.set(labelTypeMatch.id, {
        ...labelTypeMatch,
        description: llm.description || labelTypeMatch.description,
        confidence: llm.confidence === 'high' ? llm.confidence : labelTypeMatch.confidence,
        sourceFiles: [...new Set([...labelTypeMatch.sourceFiles, ...llm.sourceFiles])],
      });
      continue;
    }

    // (3) Try label-only match
    const labelMatch = Array.from(merged.values()).find(
      (n) => n.label.toLowerCase().trim() === llmLabel
    );
    if (labelMatch) {
      merged.set(labelMatch.id, {
        ...labelMatch,
        description: llm.description || labelMatch.description,
        confidence: llm.confidence === 'high' ? llm.confidence : labelMatch.confidence,
        sourceFiles: [...new Set([...labelMatch.sourceFiles, ...llm.sourceFiles])],
      });
      continue;
    }

    // (4) Try overlapping source files
    if (llm.sourceFiles.length > 0) {
      const sourceMatch = Array.from(merged.values()).find((n) =>
        n.sourceFiles.some((sf) => llm.sourceFiles.includes(sf)) &&
        (n.type === llmType || llmType === 'SERVICE' || n.type === 'SERVICE')
      );
      if (sourceMatch) {
        merged.set(sourceMatch.id, {
          ...sourceMatch,
          description: llm.description || sourceMatch.description,
          confidence: llm.confidence === 'high' ? llm.confidence : sourceMatch.confidence,
          sourceFiles: [...new Set([...sourceMatch.sourceFiles, ...llm.sourceFiles])],
        });
        continue;
      }
    }

    // (5) New node — only keep if backed by signal evidence
    const isBackedBySignal = signalLabels.has(llmLabel) ||
      llm.sourceFiles.some((sf) =>
        signals.some((s) => s.source === sf || s.label.toLowerCase() === llmLabel)
      );
    const isValidType = !['PAGE', 'API_ROUTE', 'UI_COMPONENT'].includes(llmType) ||
      llm.sourceFiles.length > 0;
    if ((llm.confidence === 'high' || isBackedBySignal) && isValidType) {
      merged.set(llmId, { ...llm });
    }
  }

  return Array.from(merged.values());
}

/**
 * Build a deterministic dependency intelligence map from static signals.
 */
function buildDependencyIntelligence(signals: StaticSignal[]): DependencyIntelligence[] {
  const depSignals = signals.filter((s) => s.type === 'dependency');
  const seen = new Set<string>();
  const deps: DependencyIntelligence[] = [];

  for (const s of depSignals) {
    if (seen.has(s.label)) continue;
    seen.add(s.label);
    deps.push({
      name: s.label,
      category: (s.details.category as string) || 'unknown',
      purpose: `${s.label} — ${s.details.category || 'dependency'}`,
      usedIn: [s.source],
      usagePattern: 'declared',
      architecturalRole: s.details.category === 'database' ? 'data_persistence'
        : s.details.category === 'queue' ? 'async_messaging'
        : s.details.category === 'auth' ? 'authentication'
        : s.details.category === 'payments' ? 'payments'
        : s.details.category === 'email' ? 'notification'
        : s.details.category === 'ai_ml' ? 'ai_ml'
        : 'supporting_infrastructure',
      externalEndpoint: null,
      isOnCriticalPath: ['database', 'queue', 'auth'].includes(s.details.category as string),
    });
  }

  return deps;
}

export async function generateRepoArchitectureDiagram(repoUrl: string): Promise<PipelineResult> {
  // Step 1: Ingest
  console.log('[Pipeline] Step 1: Ingesting repo...');
  const snapshot: RepoSnapshot = await ingestRepo(repoUrl);

  // Cache check
  if (snapshot.headSha) {
    const cached = getRepoDiagram(repoUrl, snapshot.headSha);
    if (cached) {
      console.log(`[Pipeline] Cache hit for ${repoUrl} @ ${snapshot.headSha.slice(0, 7)}`);
      return cached;
    }
    console.log(`[Pipeline] Cache miss for ${repoUrl} @ ${snapshot.headSha.slice(0, 7)}`);
  }

  // Step 2: Hierarchical analysis (deterministic, no LLM)
  console.log('[Pipeline] Step 2: Detecting subsystems...');
  const subsystems = detectSubsystems(snapshot);
  console.log(`  Found ${subsystems.length} subsystems`);

  console.log('[Pipeline] Step 3: Extracting static signals...');
  const signals = extractStaticSignals(snapshot.selectedFiles, subsystems);
  console.log(`  Extracted ${signals.length} signals (${new Set(signals.map((s) => s.type)).size} types)`);

  // Build deterministic baseline from static analysis
  const baseline = buildDeterministicBaseline(snapshot, subsystems, signals);
  let workingNodes = baseline.nodes;
  let edges = baseline.edges;
  let workflows = baseline.workflows;
  let repoProfile: RepoProfile | null = null;
  const dependencyMapDeps = buildDependencyIntelligence(signals);
  const reviewNotes = '';

  const summaries = buildSummariesForLLM(subsystems, signals);

  // Determine whether LLM refinement is worthwhile
  const hasEnoughFiles = snapshot.phase2Files.length >= 3 || snapshot.selectedFiles.length >= 6;
  const hasEnoughSignals = signals.length >= 6;
  const baselineUseful = baseline.nodes.length >= 3;
  const useLlm = hasEnoughFiles && hasEnoughSignals && baselineUseful;

  if (!useLlm) {
    console.log(`[Pipeline] Skipping LLM (files=${snapshot.selectedFiles.length}, signals=${signals.length}, baselineNodes=${baseline.nodes.length})`);
  }

  if (useLlm) {
    // Step 4: LLM classification
    console.log('[Pipeline] Step 4: Classifying architecture (LLM)...');
    try {
      repoProfile = await deepClassify(snapshot, summaries);
      console.log(`  Type: ${repoProfile.repoType}, pattern: ${repoProfile.architecturePattern}`);
    } catch {
      console.warn('[Pipeline] LLM classification failed, using fallback');
      repoProfile = await deepClassify(snapshot);
    }

    // Step 5: LLM component refinement
    console.log('[Pipeline] Step 5: Refining components (LLM)...');
    try {
      const llmNodes = await extractComponents(snapshot, repoProfile, undefined, summaries);
      if (llmNodes.length > 0) {
        workingNodes = mergeLlmIntoBaseline(baseline.nodes, llmNodes, signals);
        console.log(`  Baseline: ${baseline.nodes.length} nodes, LLM: ${llmNodes.length}, Merged: ${workingNodes.length}`);
      }
    } catch {
      console.warn('[Pipeline] LLM component extraction failed, using deterministic baseline');
    }

    // Step 6: LLM relationship analysis
    console.log('[Pipeline] Step 6: Analyzing relationships (LLM)...');
    let llmEdgesProduced = false;
    try {
      const relOutput = await analyzeRelationships(snapshot, workingNodes, repoProfile, { dependencies: dependencyMapDeps }, summaries);
      if (relOutput.edges.length > 0) {
        edges = relOutput.edges;
        llmEdgesProduced = true;
      }
      if (relOutput.workflows.length > 0) workflows = relOutput.workflows;
      console.log(`  Got ${edges.length} edges, ${workflows.length} workflows`);
    } catch {
      console.warn('[Pipeline] LLM relationship analysis failed');
    }

    // Sanitize — heuristic fallback if LLM edges are poor
    let sanitized = sanitizeRepoGraph(workingNodes, edges);
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
        sanitized = sanitizeRepoGraph(workingNodes, edges);
        console.log(`  After merge: ${sanitized.edges.length} edges`);
      }
    }
    workingNodes = sanitized.nodes;
    edges = sanitized.edges;
  }

  const finalSanitized = sanitizeRepoGraph(workingNodes, edges);
  workingNodes = finalSanitized.nodes;
  edges = finalSanitized.edges;

  // Step 8: Compile (deterministic — always runs)
  console.log(`[Pipeline] Step 8: Compiling diagram (${workingNodes.length} nodes, ${edges.length} edges, ${workflows.length} workflows)`);
  const ndjson = compileToDiagram(workingNodes, edges, workflows);

  const allConfidences = [
    ...workingNodes.map((n) => n.confidence || 'medium'),
    ...edges.map((e) => e.confidence || 'medium'),
  ];
  const hasLow = allConfidences.some((c) => c === 'low');
  const allHigh = allConfidences.every((c) => c === 'high');
  const pipelineConfidence: 'high' | 'medium' | 'low' = allHigh ? 'high' : hasLow ? 'low' : 'medium';

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
