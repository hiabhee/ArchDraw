import type { Subsystem, StaticSignal, IntermediateGraph, ExtractedNode, RichEdge, NodeType, FileEntry } from '@/lib/types/repo-diagram';
import { extractStaticSignals } from './static-analyzer';

/**
 * Build multiple intermediate graphs from subsystems + static signals,
 * then merge into architecture-level nodes and edges.
 */
export function buildSubsystemGraph(
  subsystems: Subsystem[],
  files: FileEntry[],
  preExtracted?: StaticSignal[]
): IntermediateGraph {
  const signals = preExtracted ?? extractStaticSignals(files, subsystems);
  const nodes: { id: string; label: string; type: string }[] = [];
  const edges: { from: string; to: string; type: string; label: string }[] = [];

  const signalBySubsystem = groupSignalsBySubsystem(signals, subsystems);

  for (const sub of subsystems) {
    const subSignals = signalBySubsystem.get(sub.name) || [];
    const nodeType = subsystemTypeToNodeType(sub.type);
    const subId = toNodeId(sub.name);
    nodes.push({
      id: subId,
      label: labelForSubsystem(sub),
      type: nodeType,
    });

    // Add external services only from usage evidence, not package declarations.
    // Manifest dependencies alone are too weak and create noisy nodes like
    // @aws-sdk/client-dynamodb instead of meaningful architecture concepts.
    const externalCalls = aggregateExternalServices(subSignals);
    for (const ext of externalCalls) {
      const extId = `ext_${toNodeId(ext.label)}`;
      if (!nodes.some((n) => n.id === extId)) {
        nodes.push({
          id: extId,
          label: ext.label,
          type: 'EXTERNAL_SERVICE',
        });
      }
      edges.push({
        from: subId,
        to: extId,
        type: 'external_call',
        label: ext.label === 'OpenAI' ? 'model call' : 'uses',
      });
    }

    // Add database connections
    const dbSignals = aggregateDataStores(subSignals);
    for (const db of dbSignals) {
      const dbId = `db_${toNodeId(db.label)}`;
      if (!nodes.some((n) => n.id === dbId)) {
        nodes.push({
          id: dbId,
          label: db.label,
          type: db.type,
        });
      }
      edges.push({
        from: subId,
        to: dbId,
        type: 'db_query',
        label: db.type === 'CACHE' ? 'cache' : 'queries',
      });
    }

    // Add queues
    const queueSignals = aggregateQueues(subSignals);
    for (const q of queueSignals) {
      const qId = `queue_${toNodeId(q.label)}`;
      if (!nodes.some((n) => n.id === qId)) {
        nodes.push({
          id: qId,
          label: q.label,
          type: 'QUEUE',
        });
      }
      edges.push({
        from: subId,
        to: qId,
        type: 'publishes',
        label: 'publishes',
      });
    }
  }

  // Inter-subsystem edges — frontend calls backend
  // Only add edges where there's signal evidence or name-based affinity,
  // instead of brute-force O(F*B) edges.
  const frontends = subsystems.filter((s) => s.type === 'frontend' || s.type === 'application');
  const backends = subsystems.filter((s) => s.type === 'backend' || s.type === 'service' || s.type === 'worker');
  if (frontends.length > 0 && backends.length > 0 && frontends.length + backends.length <= 8) {
    // Small subsystem count: reasonable to assume all call all
    for (const fe of frontends) {
      for (const be of backends) {
        if (fe.name !== be.name) {
          edges.push({
            from: toNodeId(fe.name),
            to: toNodeId(be.name),
            type: 'http_call',
            label: 'calls',
          });
        }
      }
    }
  } else if (frontends.length > 0 && backends.length > 0) {
    // Large subsystem count: only connect frontends to the most referenced backends.
    // Pick the backend whose name shares the longest prefix with each frontend.
    for (const fe of frontends) {
      const feParts = fe.path.split('/').filter(Boolean);
      let bestScore = -1;
      let bestBe: typeof backends[0] | null = null;
      for (const be of backends) {
        if (fe.name === be.name) continue;
        const beParts = be.path.split('/').filter(Boolean);
        let score = 0;
        for (let i = 0; i < Math.min(feParts.length, beParts.length); i++) {
          if (feParts[i] === beParts[i]) score++;
          else break;
        }
        if (score > bestScore) { bestScore = score; bestBe = be; }
      }
      if (bestBe) {
        edges.push({
          from: toNodeId(fe.name),
          to: toNodeId(bestBe.name),
          type: 'http_call',
          label: 'calls',
        });
      }
    }
  }

  return { type: 'service', nodes, edges };
}

function toNodeId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'node';
}

function titleCase(input: string): string {
  return input
    .split(/[-_\s/]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function labelForSubsystem(sub: Subsystem): string {
  if (sub.name === 'root') {
    if (sub.detectedFramework) return `${sub.detectedFramework} Application`;
    if (sub.type === 'infrastructure') return 'Infrastructure';
    if (sub.type === 'frontend') return 'Frontend App';
    if (sub.type === 'backend') return 'Backend API';
    return 'Application';
  }

  const shortName = sub.name.split('/').pop() || sub.name;
  const readable = titleCase(shortName);
  if (sub.type === 'frontend') return `${readable} Frontend`;
  if (sub.type === 'backend') return `${readable} API`;
  if (sub.type === 'worker') return `${readable} Worker`;
  if (sub.type === 'library') return `${readable} Library`;
  if (sub.type === 'infrastructure') return `${readable} Infrastructure`;
  return readable;
}

function normalizeExternalLabel(signal: StaticSignal): string | null {
  if (signal.type === 'sdk_usage') return signal.label;
  return null;
}

function aggregateExternalServices(signals: StaticSignal[]): Array<{ label: string }> {
  const labels = new Set<string>();
  for (const signal of signals) {
    if (signal.type !== 'sdk_usage') continue;
    const label = normalizeExternalLabel(signal);
    if (label) labels.add(label);
  }
  return Array.from(labels).map((label) => ({ label }));
}

function normalizeDataStoreLabel(signal: StaticSignal): { label: string; type: ExtractedNode['type'] } | null {
  const label = signal.label.toLowerCase();
  const category = String(signal.details.category || '');
  if (category === 'queue') return null;
  if (label.includes('redis')) return { label: 'Redis Cache', type: 'CACHE' };
  if (label.includes('mongo') || label.includes('mongoose')) return { label: 'MongoDB', type: 'DATABASE' };
  if (label.includes('postgres') || label.includes('psycopg') || label === 'pg') return { label: 'PostgreSQL', type: 'DATABASE' };
  if (label.includes('mysql')) return { label: 'MySQL', type: 'DATABASE' };
  if (label.includes('sqlite')) return { label: 'SQLite', type: 'DATABASE' };
  if (label.includes('dynamodb')) return { label: 'DynamoDB', type: 'DATABASE' };
  if (signal.type === 'schema') return { label: 'Database', type: 'DATABASE' };
  if (category === 'database') return { label: titleCase(signal.label), type: 'DATABASE' };
  if (category === 'storage') return { label: 'Object Storage', type: 'STORAGE' };
  return null;
}

function aggregateDataStores(signals: StaticSignal[]): Array<{ label: string; type: ExtractedNode['type'] }> {
  const byLabel = new Map<string, { label: string; type: ExtractedNode['type'] }>();
  for (const signal of signals) {
    if (signal.type !== 'schema' && signal.type !== 'dependency' && signal.type !== 'env_var' && signal.type !== 'sdk_usage') continue;
    const normalized = normalizeDataStoreLabel(signal);
    if (normalized) byLabel.set(normalized.label, normalized);
  }
  return Array.from(byLabel.values());
}

function aggregateQueues(signals: StaticSignal[]): Array<{ label: string }> {
  const labels = new Set<string>();
  for (const signal of signals) {
    if (signal.type === 'queue_topic') {
      labels.add(titleCase(signal.label));
      continue;
    }
    if (signal.type === 'dependency' && signal.details.category === 'queue') {
      const label = signal.label.toLowerCase().includes('redis') ? 'Redis Queue' : 'Message Queue';
      labels.add(label);
    }
  }
  return Array.from(labels).map((label) => ({ label }));
}

function subsystemTypeToNodeType(subType: Subsystem['type']): string {
  switch (subType) {
    case 'frontend': return 'PAGE';
    case 'backend': return 'API_ROUTE';
    case 'service': return 'SERVICE';
    case 'worker': return 'WORKER';
    case 'infrastructure': return 'INFRASTRUCTURE';
    case 'library': return 'CORE_MODULE';
    default: return 'SERVICE';
  }
}

function groupSignalsBySubsystem(signals: StaticSignal[], subsystems: Subsystem[]): Map<string, StaticSignal[]> {
  const map = new Map<string, StaticSignal[]>();
  for (const sub of subsystems) {
    map.set(sub.name, []);
  }
  // Sort by path length descending so longest prefix wins (root "/" checked last)
  const sorted = [...subsystems].sort((a, b) => {
    if (a.path === '/') return 1;
    if (b.path === '/') return -1;
    return b.path.length - a.path.length;
  });
  for (const signal of signals) {
    const sub = sorted.find((s) =>
      s.path === '/' ? false : signal.source.startsWith(s.path)
    ) || sorted.find((s) => s.path === '/');
    const key = sub?.name || 'root';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(signal);
  }
  return map;
}

/**
 * Convert intermediate graph + subsystems into architecture-level ExtractedNodes and RichEdges.
 */
export function intermediateToArchitecture(
  graph: IntermediateGraph,
  subsystems: Subsystem[]
): { nodes: ExtractedNode[]; edges: RichEdge[] } {
  const nodes: ExtractedNode[] = [];
  const edges: RichEdge[] = [];
  const seen = new Set<string>();

  for (const gn of graph.nodes) {
    if (seen.has(gn.id)) continue;
    seen.add(gn.id);

    const sub = subsystems.find((s) => toNodeId(s.name) === gn.id);

    const nodeType = gn.type as NodeType;
    nodes.push({
      id: gn.id,
      label: gn.label,
      type: nodeType || 'SERVICE',
      description: sub ? describeSubsystem(sub) : 'Detected component from source evidence.',
      sourceFiles: sub ? sub.files.slice(0, 5) : [],
      confidence: sub ? 'high' : 'medium',
    });
  }

  for (const ge of graph.edges) {
    if (!seen.has(ge.from) || !seen.has(ge.to)) continue;

    const edgeType = mapEdgeType(ge.type);
    const isAsync = edgeType === 'async' || edgeType === 'event';

    edges.push({
      from: ge.from,
      to: ge.to,
      type: ge.type,
      label: ge.label,
      direction: isAsync ? 'async' : 'sync',
      protocol: inferProtocol(ge.type),
      dataFlow: ge.label,
      triggeredBy: isAsync ? 'system' : 'user_action',
      description: edgeDescription(ge.type, ge.label),
      confidence: 'high',
    });
  }

  return { nodes, edges };
}

function describeSubsystem(sub: Subsystem): string {
  const parts = [`${sub.fileCount} files`];
  if (sub.language && sub.language !== 'Unknown') parts.push(sub.language);
  if (sub.detectedFramework) parts.push(sub.detectedFramework);
  if (sub.entryPoints.length > 0) parts.push(`entry: ${sub.entryPoints.slice(0, 2).join(', ')}`);
  return `${labelForSubsystem(sub)} subsystem (${parts.join(', ')}).`;
}

function edgeDescription(type: string, label: string): string {
  switch (type) {
    case 'http_call': return 'Request or API call between architectural components.';
    case 'db_query': return 'Reads or writes persisted data.';
    case 'external_call': return 'Calls an external platform or API.';
    case 'publishes': return 'Publishes asynchronous work.';
    case 'subscribes': return 'Consumes asynchronous work.';
    default: return label || 'Architectural relationship inferred from source evidence.';
  }
}

function mapEdgeType(type: string): string {
  if (['http_call', 'route'].includes(type)) return 'sync';
  if (['publishes', 'subscribes', 'queue', 'cron'].includes(type)) return 'async';
  if (['db_query', 'schema'].includes(type)) return 'sync';
  return 'sync';
}

function inferProtocol(type: string): string {
  switch (type) {
    case 'http_call': return 'http';
    case 'db_query': return 'db';
    case 'publishes':
    case 'subscribes': return 'queue';
    case 'external_call': return 'sdk';
    default: return 'http';
  }
}
