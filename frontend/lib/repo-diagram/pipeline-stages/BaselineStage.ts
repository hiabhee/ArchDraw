import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { buildSubsystemGraph, intermediateToArchitecture } from '@/lib/repo-diagram/intermediate-graphs';
import { expandBaselineFromSignals } from '@/lib/repo-diagram/graph-quality';
import { deriveEvidenceEdges } from '@/lib/repo-diagram/evidence-from-graph';
import type { RepoSnapshot, Subsystem, StaticSignal, ExtractedNode, RichEdge, Workflow } from '@/lib/types/repo-diagram';
import type { ImportGraph } from '@/lib/repo-diagram/import-graph';
import { buildEvidenceEdgeSet } from '@/lib/agents/repo-verifier';

function demoteGuessedEdges(edges: RichEdge[], nodes: ExtractedNode[], importGraph?: ImportGraph): RichEdge[] {
  const evidenceEdgeSet = buildEvidenceEdgeSet(nodes, importGraph);

  // Index unevidenced "calls" edges per source node. A source guessing at a
  // single backend is usually right (keep, demoted); a source fanning out to
  // multiple unevidenced backends is the old all-to-all assumption — drop it.
  const unevidencedPerSource = new Map<string, number>();
  for (const e of edges) {
    if (e.type === 'http_call' && e.label === 'calls' && !evidenceEdgeSet.has(`${e.from}->${e.to}`)) {
      unevidencedPerSource.set(e.from, (unevidencedPerSource.get(e.from) || 0) + 1);
    }
  }

  const result: RichEdge[] = [];
  for (const e of edges) {
    if (e.type === 'http_call' && e.label === 'calls' && !evidenceEdgeSet.has(`${e.from}->${e.to}`)) {
      if ((unevidencedPerSource.get(e.from) || 0) <= 1) {
        result.push({ ...e, confidence: 'low' as const, label: 'calls (assumed)' });
      }
      continue;
    }
    result.push(e);
  }
  return result;
}

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

export interface BaselineInput {
  snapshot: RepoSnapshot;
  subsystems: Subsystem[];
  signals: StaticSignal[];
  importGraph: ImportGraph;
}

export interface BaselineOutput {
  snapshot: RepoSnapshot;
  subsystems: Subsystem[];
  signals: StaticSignal[];
  importGraph: ImportGraph;
  baselineNodes: ExtractedNode[];
  baselineEdges: RichEdge[];
  workflows: Workflow[];
}

export class BaselineStage extends BaseStage<BaselineInput, BaselineOutput> {
  constructor() {
    super('baseline', { description: 'Build deterministic baseline from static analysis', weight: 2 });
  }

  async execute(input: BaselineInput, _context: PipelineContext): Promise<StageResult<BaselineOutput>> {
    const { snapshot, subsystems, signals, importGraph } = input;

    const graph = buildSubsystemGraph(subsystems, snapshot.selectedFiles, signals);
    let { nodes, edges } = intermediateToArchitecture(graph, subsystems);
    nodes = expandBaselineFromSignals(nodes, signals);
    if (subsystems.length === 1 && nodes.length <= 2) {
      const dirNodes = nodesFromTopLevelDirs(snapshot);
      if (dirNodes.length > 0) nodes = dirNodes;
    }
    edges = demoteGuessedEdges(edges, nodes, importGraph);
    const evidenceEdges = importGraph ? deriveEvidenceEdges(nodes, importGraph) : [];
    const mergedEdges = unionEdges([...edges, ...evidenceEdges]);

    return successResult({
      snapshot, subsystems, signals, importGraph,
      baselineNodes: nodes,
      baselineEdges: mergedEdges,
      workflows: [],
    });
  }
}

function nodesFromTopLevelDirs(snapshot: RepoSnapshot): ExtractedNode[] {
  const containers = new Set(['src', 'app']);
  const sourceDirs = new Set([
    'lib', 'routes', 'routers', 'services', 'models', 'controllers', 'api',
    'pages', 'components', 'modules', 'handlers', 'views', 'middleware',
    'prisma', 'db', 'database', 'tests', 'test', 'commands', 'jobs',
    'workers', 'config',
  ]);
  const groups = new Map<string, string[]>();

  for (const path of snapshot.fileTree) {
    const parts = path.split('/');
    if (parts.length < 2) continue;
    let bucket: string | null = null;
    const lower = (value: string) => value.toLowerCase();

    if (containers.has(lower(parts[0])) && parts[1]) {
      bucket = parts[1];
    }
    if (!bucket && sourceDirs.has(lower(parts[0]))) {
      bucket = parts[0];
    }
    if (!bucket) {
      for (let i = 1; i < parts.length; i++) {
        if (sourceDirs.has(lower(parts[i]))) {
          bucket = parts[i];
          break;
        }
      }
    }
    if (!bucket) continue;
    groups.set(bucket, [...(groups.get(bucket) ?? []), path]);
  }

  return Array.from(groups.entries())
    .filter(([, files]) => files.length >= 3)
    .map(([dir, files]) => ({
      id: dir.toLowerCase(),
      label: `${dir.charAt(0).toUpperCase()}${dir.slice(1)}`,
      type: inferNodeTypeFromDir(dir),
      description: `${dir}/ — ${files.length} files (source directory).`,
      sourceFiles: files.slice(0, 5),
      confidence: 'medium' as const,
    }));
}

function inferNodeTypeFromDir(dir: string): ExtractedNode['type'] {
  const normalized = dir.toLowerCase();
  if (['pages', 'app', 'components', 'views'].includes(normalized)) return 'PAGE';
  if (['routes', 'routers', 'controllers', 'api', 'handlers'].includes(normalized)) return 'API_ROUTE';
  if (['models', 'prisma', 'db', 'database'].includes(normalized)) return 'DATABASE';
  if (['workers', 'jobs'].includes(normalized)) return 'WORKER';
  if (['middleware', 'auth'].includes(normalized)) return 'MIDDLEWARE';
  if (['services'].includes(normalized)) return 'SERVICE';
  return 'CORE_MODULE';
}
