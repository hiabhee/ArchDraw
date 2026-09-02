import type {
  RepoSnapshot,
  Subsystem,
  StaticSignal,
  ExtractedNode,
  RichEdge,
  Workflow,
  RepoProfile,
  DependencyIntelligence,
  DegradedFlags,
} from '@/lib/types/repo-diagram';
import type { ImportGraph } from '@/lib/repo-diagram/import-graph';

/** Accumulating state through Classify → Extract → Relationships → Verify. */
export interface RepoEnrichmentState {
  snapshot: RepoSnapshot;
  subsystems: Subsystem[];
  signals: StaticSignal[];
  importGraph: ImportGraph;
  baselineNodes: ExtractedNode[];
  baselineEdges: RichEdge[];
  workflows: Workflow[];
  workingNodes: ExtractedNode[];
  edges: RichEdge[];
  repoProfile: RepoProfile | null;
  useLlm: boolean;
  degraded: DegradedFlags;
  dependencyMapDeps: DependencyIntelligence[];
  preVerifierHighEdgeCount: number;
  /** Cached for downstream LLM calls; not required by Finalization. */
  detectionReportText?: string;
  summaries?: string[];
  /** GH2R-024 — docs revalidation (DocsReviewStage) outcome; surfaced in reviewNotes. */
  docsReviewNotes?: string;
  docsReviewFailed?: boolean;
}

/** Baseline stage output is the entry point for enrichment. */
export type EnrichmentInput = {
  snapshot: RepoSnapshot;
  subsystems: Subsystem[];
  signals: StaticSignal[];
  importGraph: ImportGraph;
  baselineNodes: ExtractedNode[];
  baselineEdges: RichEdge[];
  workflows: Workflow[];
  detailLevel?: 1 | 2 | 3;
};

/** @deprecated Prefer RepoEnrichmentState */
export type LLMInput = EnrichmentInput;
/** @deprecated Prefer RepoEnrichmentState */
export type LLMOutput = RepoEnrichmentState;

export function emptyDegraded(snapshot: RepoSnapshot): DegradedFlags {
  const ingestion = (snapshot.failedPaths?.length ?? 0) > 0;
  return {
    classify: false,
    extract: false,
    edges: false,
    ingestion,
    anything: ingestion,
  };
}

export function recomputeDegradedAnything(degraded: DegradedFlags): DegradedFlags {
  return {
    ...degraded,
    anything: degraded.classify || degraded.extract || degraded.edges || degraded.ingestion,
  };
}
