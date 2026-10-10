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
    ({ nodes, edges } = addComposeArchitecture(nodes, edges, signals));
    edges = addQueryEvidenceEdges(nodes, edges, signals);
    edges = addExternalSdkEvidenceEdges(nodes, edges, signals);
    // A single root subsystem is common for libraries and small APIs. Always
    // expose meaningful source-directory boundaries; the previous `nodes <= 2`
    // guard suppressed them as soon as a datastore or route signal appeared.
    if (subsystems.length === 1) {
      const detailLevel = Number(((_context.metadata as Record<string, unknown>)?.detailLevel ?? 2));
      const dirNodes = shouldExpandRoot(snapshot)
        ? nodesFromTopLevelDirs(snapshot, detailLevel === 1 ? 3 : 2, detailLevel === 3 ? 32 : detailLevel === 2 ? 16 : 8)
        : [];
      if (dirNodes.length > 0) nodes = mergeBaselineNodes(nodes, dirNodes);
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

/** Connect a route/module to an SDK boundary only when both use the same source file. */
export function addExternalSdkEvidenceEdges(
  nodes: ExtractedNode[],
  edges: RichEdge[],
  signals: StaticSignal[],
): RichEdge[] {
  const nextEdges = [...edges];
  for (const sdk of signals.filter((signal) => signal.type === 'sdk_usage')) {
    const target = nodes.find((node) => node.type === 'EXTERNAL_SERVICE' && node.label === sdk.label);
    const source = nodes.find((node) =>
      ['API_ROUTE', 'SERVICE', 'CONTROLLER'].includes(node.type) && node.sourceFiles.includes(sdk.source)
    );
    if (!source || !target || nextEdges.some((edge) => edge.from === source.id && edge.to === target.id)) continue;
    nextEdges.push({
      from: source.id,
      to: target.id,
      type: 'external_call',
      label: `uses ${sdk.label}`,
      direction: 'sync',
      protocol: 'sdk',
      dataFlow: '',
      triggeredBy: 'request',
      description: `${sdk.label} SDK usage detected in ${sdk.source}.`,
      confidence: 'high',
    });
  }
  return nextEdges;
}

/** Avoid turning reusable libraries and config-only repositories into fake layers. */
export function shouldExpandRoot(snapshot: RepoSnapshot): boolean {
  const paths = snapshot.fileTree.map(path => path.toLowerCase());
  const hasRuntime = paths.some(path => /\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|cs|kt)$/.test(path));
  if (!hasRuntime) return false;
  return paths.some(path =>
    /^(app|pages|routes|routers|controllers|handlers|services|backend|frontend|server|api)\//.test(path) ||
    /^(src|server|backend|frontend)\/(app|pages|routes|routers|controllers|handlers|services|api)\//.test(path) ||
    /(^|\/)(schema\.prisma|docker-compose\.ya?ml)$/.test(path)
  );
}

function mergeBaselineNodes(primary: ExtractedNode[], additions: ExtractedNode[]): ExtractedNode[] {
  const byId = new Map(primary.map(node => [node.id, { ...node, sourceFiles: [...node.sourceFiles] }]));
  for (const addition of additions) {
    const existing = byId.get(addition.id);
    if (!existing) {
      byId.set(addition.id, { ...addition, sourceFiles: [...addition.sourceFiles] });
      continue;
    }
    existing.sourceFiles = [...new Set([...existing.sourceFiles, ...addition.sourceFiles])];
    if (existing.confidence === 'low' && addition.confidence !== 'low') existing.confidence = addition.confidence;
  }
  return Array.from(byId.values());
}

/** Connect a source-backed API/module to a detected datastore only when code contains a query. */
export function addQueryEvidenceEdges(
  nodes: ExtractedNode[],
  edges: RichEdge[],
  signals: StaticSignal[],
): RichEdge[] {
  const datastores = nodes.filter(node => ['DATABASE', 'CACHE', 'STORAGE'].includes(node.type));
  if (datastores.length === 0) return edges;
  const nextEdges = [...edges];
  for (const query of signals.filter(signal => signal.type === 'db_query')) {
    const source = nodes.find(node =>
      ['API_ROUTE', 'SERVICE', 'CONTROLLER'].includes(node.type) && node.sourceFiles.includes(query.source)
    );
    if (!source) continue;
    // Static analysis can identify the query but not always its exact store;
    // only use an unambiguous single datastore in that case.
    if (datastores.length !== 1) continue;
    const target = datastores[0];
    if (nextEdges.some(edge => edge.from === source.id && edge.to === target.id)) continue;
    nextEdges.push({
      from: source.id,
      to: target.id,
      type: 'db_query',
      label: 'queries',
      direction: 'sync',
      protocol: 'database',
      dataFlow: '',
      triggeredBy: 'request',
      description: `Database query detected in ${query.source}.`,
      confidence: 'high',
    });
  }
  return nextEdges;
}

/** Materialize docker-compose as primary architecture evidence, not LLM hints. */
export function addComposeArchitecture(
  nodes: ExtractedNode[],
  edges: RichEdge[],
  signals: StaticSignal[],
): { nodes: ExtractedNode[]; edges: RichEdge[] } {
  const composeServices = signals.filter(signal => signal.type === 'docker_service');
  if (composeServices.length === 0) return { nodes, edges };

  const nextNodes = [...nodes];
  const nodeIdForService = new Map<string, string>();
  for (const service of composeServices) {
    const key = service.label.toLowerCase();
    const id = `compose_${key.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
    nodeIdForService.set(key, id);
    if (nextNodes.some(node => node.id === id)) continue;
    const type = /postgres|mysql|mariadb|mongo/.test(key) ? 'DATABASE'
      : /redis|memcached/.test(key) ? 'CACHE'
        : /kafka|rabbitmq|nats/.test(key) ? 'QUEUE'
          : 'SERVICE';
    nextNodes.push({
      id,
      label: service.label,
      type,
      description: `Docker Compose service declared in ${service.source}.`,
      sourceFiles: [service.source],
      confidence: 'high',
    });
  }

  const nextEdges = [...edges];
  for (const dependency of signals.filter(signal => signal.type === 'compose_dependency')) {
    const from = String(dependency.details.from ?? '').toLowerCase();
    const to = dependency.label.toLowerCase();
    const sourceId = nodeIdForService.get(from);
    const targetId = nodeIdForService.get(to);
    if (!sourceId || !targetId || nextEdges.some(edge => edge.from === sourceId && edge.to === targetId)) continue;
    nextEdges.push({
      from: sourceId,
      to: targetId,
      type: 'depends_on',
      label: 'depends on',
      direction: 'sync',
      protocol: 'docker-compose',
      dataFlow: '',
      triggeredBy: 'startup',
      description: `Compose dependency declared in ${dependency.source}.`,
      confidence: 'high',
    });
  }
  return { nodes: nextNodes, edges: nextEdges };
}

function nodesFromTopLevelDirs(snapshot: RepoSnapshot, minimumFiles = 3, maxGroups = 16): ExtractedNode[] {
  const containers = new Set(['src', 'app']);
  const sourceDirs = new Set([
    'lib', 'routes', 'routers', 'services', 'models', 'controllers', 'api',
    'pages', 'components', 'modules', 'handlers', 'views', 'middleware',
    'prisma', 'db', 'database', 'commands', 'jobs',
    'workers', 'config',
  ]);
  const groups = new Map<string, string[]>();

  for (const path of snapshot.fileTree) {
    if (/(^|\/)(examples?|samples?|tests?|__tests__|fixtures?)\//i.test(path) || /\.(test|spec)\.[^.\/]+$/i.test(path)) continue;
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
    .filter(([, files]) => files.length >= minimumFiles)
    .slice(0, maxGroups)
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
