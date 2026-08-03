import type {
  ExtractedNode,
  RichEdge,
  RepoProfile,
  DependencyIntelligence,
} from '@/lib/types/repo-diagram';

// ─── Golden graph (human-labeled ground truth) ───────────────

export type GoldenNode = {
  id: string;
  label: string;
  type: string;
  aliases?: string[];
  /** Optional source-file globs/paths that this node should own (for overlap matching). */
  sourceFiles?: string[];
};

export type GoldenEdge = {
  from: string;
  to: string;
};

export type GoldenClassification = {
  repoType: string;
  framework: string | null;
  database: string | null;
};

export type GoldenGraph = {
  repo: string;
  classification: GoldenClassification;
  nodes: GoldenNode[];
  edges: GoldenEdge[];
  forbiddenNodes: string[];
  notes?: string;
};

// ─── Predicted graph (parsed from PipelineResult) ────────────

export type PredictedNode = {
  id: string;
  label: string;
  type: string;
  sourceFiles: string[];
};

export type PredictedEdge = {
  from: string;
  to: string;
};

export type PredictedClassification = {
  repoType: string;
  framework: string | null;
  database: string | null;
};

export type PredictedGraph = {
  classification: PredictedClassification;
  nodes: PredictedNode[];
  edges: PredictedEdge[];
};

// ─── Utility: parse a PipelineResult into a PredictedGraph ───

export function parsePipelineResult(
  repoProfile: RepoProfile,
  dependencyMap: DependencyIntelligence[],
  nodes: ExtractedNode[],
  edges: RichEdge[]
): PredictedGraph {
  const predictedNodes: PredictedNode[] = nodes.map((n) => ({
    id: n.id,
    label: n.label,
    type: n.type,
    sourceFiles: n.sourceFiles ?? [],
  }));

  const predictedEdges: PredictedEdge[] = edges
    .map((e) => ({ from: e.from, to: e.to }))
    .filter((e) => e.from && e.to && e.from !== e.to);

  // Database: derive from dependencyMap (category 'database') first, then DATABASE nodes.
  let database: string | null = null;
  const dbDep = dependencyMap.find((d) => d.category === 'database');
  if (dbDep) {
    database = dbDep.name;
  } else {
    const dbNode = nodes.find((n) => n.type === 'DATABASE');
    if (dbNode) database = dbNode.label;
  }

  return {
    classification: {
      repoType: repoProfile.repoType,
      framework: repoProfile.primaryStack.framework,
      database,
    },
    nodes: predictedNodes,
    edges: predictedEdges,
  };
}

// ─── Corpus manifest ──────────────────────────────────────────

export type CorpusRepo = {
  id: string;
  owner: string;
  repo: string;
  url: string;
  stack: string;
  detailLevel: 1 | 2 | 3;
  ref?: string;
  pinnedHeadSha?: string | null;
};

export type CorpusManifest = {
  repos: CorpusRepo[];
};