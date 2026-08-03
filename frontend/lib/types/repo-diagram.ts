// ─── File Entry ───────────────────────────────────────────────

export type FileEntry = {
  path: string;
  content: string;
};

// ─── Surface Classification (Phase 1 output) ──────────────────

export type SurfaceClassification = {
  primaryLanguage: string;
  detectedFrameworks: string[];
  hasDocker: boolean;
  hasMultipleServices: boolean;
  isMonorepo: boolean;
  projectType: 'unknown';
};

// ─── Repo Snapshot ────────────────────────────────────────────

export type RepoSnapshot = {
  repoUrl: string;
  owner: string;
  repo: string;
  headSha?: string;
  defaultBranch?: string;
  isPrivate?: boolean;
  treeTruncated?: boolean;
  fileTree: string[];
  selectedFiles: FileEntry[];
  /** Paths that were selected but whose content could not be fetched (Phase 2 transparency). Defaults to []. */
  failedPaths?: string[];
  skippedCounts?: Record<string, number>;
  repoMeta: {
    hasAppDir: boolean;
    hasPagesDir: boolean;
    hasPrisma: boolean;
    hasMiddleware: boolean;
    hasEnvExample: boolean;
    packageJson: Record<string, unknown> | null;
  };
  surfaceClassification: SurfaceClassification;
  phase1Files: FileEntry[];
  phase2Files: FileEntry[];
  /**
   * Phase 2/6: in-memory archive map (when tarball ingestion succeeded).
   * Pass-2 fetch reads paths NOT originally selected from here → 0 API calls.
   * Null on the Contents-API fallback path.
   */
  archiveMap?: Map<string, string> | null;
};

// ─── Repo Profile (Deep Classifier output) ────────────────────

export type RepoType =
  | 'documentation'
  | 'static_site'
  | 'library'
  | 'framework'
  | 'cli_tool'
  | 'frontend_only'
  | 'backend_only'
  | 'fullstack_monolith'
  | 'fullstack_separated'
  | 'microservices'
  | 'monorepo'
  | 'mobile'
  | 'data_ml'
  | 'devops_config'
  | 'unknown';

export type ArchitecturePattern =
  | 'mvc'
  | 'layered'
  | 'clean_architecture'
  | 'hexagonal'
  | 'event_driven'
  | 'serverless'
  | 'jamstack'
  | 'microservices'
  | 'monolithic'
  | 'pipeline'
  | 'unknown';

export type Confidence = 'high' | 'medium' | 'low';

export type RepoProfile = {
  repoType: RepoType;
  architecturePattern: ArchitecturePattern;
  primaryStack: {
    framework: string | null;
    language: string;
    runtime: string;
  };
  applicationDomain: string;
  coreCapabilities: string[];
  primaryUserFlows: string[];
  confidence: Confidence;
  reasoning: string;
  extractionStrategy: {
    keyDirectories: string[];
    entryPoints: string[];
    moduleStructure: string;
    focusAreas: string[];
  };
};

// ─── Dependency Intelligence ──────────────────────────────────

export type DependencyIntelligence = {
  name: string;
  category: string;
  purpose: string;
  usedIn: string[];
  usagePattern: string;
  architecturalRole: string;
  externalEndpoint: string | null;
  isOnCriticalPath: boolean;
};

export type DependencyMap = {
  dependencies: DependencyIntelligence[];
};

// ─── Extracted Node ───────────────────────────────────────────

export type NodeType =
  | 'PAGE'
  | 'API_ROUTE'
  | 'DATABASE'
  | 'EXTERNAL_SERVICE'
  | 'AUTH'
  | 'MIDDLEWARE'
  | 'UI_COMPONENT'
  | 'SERVICE'
  | 'CONTROLLER'
  | 'WORKER'
  | 'QUEUE'
  | 'CACHE'
  | 'STORAGE'
  | 'API_GATEWAY'
  | 'CDN'
  | 'STATE_MANAGEMENT'
  | 'DOCUMENTATION_SECTION'
  | 'CORE_MODULE'
  | 'PLUGIN_SYSTEM'
  | 'INFRASTRUCTURE'
  | 'UNKNOWN';

export type ExtractedNode = {
  id: string;
  label: string;
  type: NodeType;
  description: string;
  sourceFiles: string[];
  confidence: Confidence;
  layer?: string;
};

// ─── Rich Edge ────────────────────────────────────────────────

export type RichEdge = {
  from: string;
  to: string;
  type: string;
  label: string;
  direction: 'sync' | 'async' | 'event';
  protocol: string;
  dataFlow: string;
  triggeredBy: string;
  description: string;
  confidence: Confidence;
};

// ─── Workflow ─────────────────────────────────────────────────

export type Workflow = {
  name: string;
  description: string;
  steps: string[];
};

// ─── Relationship Analyst Output ──────────────────────────────

export type RelationshipOutput = {
  edges: RichEdge[];
  workflows: Workflow[];
};

// ─── Review Result ────────────────────────────────────────────

export type ReviewCorrection = {
  addNodes: ExtractedNode[];
  removeNodeIds: string[];
  mergeNodes: { keepId: string; removeId: string; newLabel: string }[];
  addEdges: RichEdge[];
  removeEdgeIndexes: number[];
  updateEdges: { index: number; changes: Partial<RichEdge> }[];
  workflowCorrections: string[];
};

export type ReviewResult = {
  approved: boolean;
  corrections: ReviewCorrection;
  reviewNotes: string;
};

// ─── Pipeline Result ──────────────────────────────────────────

export type DegradedFlags = {
  classify: boolean;
  extract: boolean;
  edges: boolean;
  ingestion: boolean;
  anything: boolean;
};

export type PipelineResult = {
  ndjson: string;
  nodeCount: number;
  edgeCount: number;
  workflowCount: number;
  workflows: Workflow[];
  repoProfile: RepoProfile;
  dependencyMap: DependencyIntelligence[];
  reviewNotes: string;
  confidence: Confidence;
  repoMeta: RepoSnapshot['repoMeta'];
  /** Final architectural nodes after sanitize/dedupe/prune (exposed for eval + diagnostics). */
  nodes: ExtractedNode[];
  /** Final edges after sanitize/dedupe/prune (exposed for eval + diagnostics). */
  edges: RichEdge[];
  /** Coverage-derived diagnostics (Phase 8). Populated when computed. */
  diagnostics?: {
    groundedNodeRatio: number;
    evidencedEdgeRatio: number;
    truncatedNodes: string[];
    failedPaths: string[];
  };
  /** Degraded-mode flags (Phase 7). True when a stage fell back. */
  degraded?: DegradedFlags;
};

/** JSON body returned by POST /api/repo-diagram on success. */
export type RepoDiagramApiResponse = {
  success: true;
  ndjson: string;
  nodeCount: number;
  edgeCount: number;
  workflowCount: number;
  workflows: Workflow[];
  repoMeta: RepoSnapshot['repoMeta'];
  repoProfile: RepoProfile;
  dependencyMap: DependencyIntelligence[];
  reviewNotes: string;
  confidence: Confidence;
};

// ─── Hierarchical Analysis Types ───────────────────────────────

export type Subsystem = {
  name: string;
  path: string;
  type: 'application' | 'library' | 'service' | 'worker' | 'infrastructure' | 'frontend' | 'backend';
  fileCount: number;
  files: string[];
  language: string;
  detectedFramework: string | null;
  entryPoints: string[];
};

export type StaticSignal = {
  type: 'dependency' | 'route' | 'schema' | 'env_var' | 'docker_service'
      | 'terraform_resource' | 'kubernetes_resource' | 'queue_topic'
      | 'sdk_usage' | 'middleware' | 'auth_provider' | 'entry_point'
      | 'ml_script' | 'notebook' | 'model_artifact' | 'config'
      | 'ml_directory' | 'ml_import' | 'data_file' | 'pipeline'
      | 'compose_dependency' | 'ci_workflow' | 'http_call' | 'db_query';
  label: string;
  source: string;
  details: Record<string, unknown>;
  confidence: 'high' | 'medium' | 'low';
};

export type SubsystemSummary = {
  name: string;
  path: string;
  type: Subsystem['type'];
  fileCount: number;
  detectedFrameworks: string[];
  entryPoints: string[];
  keyFiles: string[];
  signals: StaticSignal[];
  summary: string;
};

export type IntermediateGraph = {
  type: 'package' | 'service' | 'route' | 'data_flow' | 'external';
  nodes: { id: string; label: string; type: string }[];
  edges: { from: string; to: string; type: string; label: string }[];
};
