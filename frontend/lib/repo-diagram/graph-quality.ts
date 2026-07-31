import type {
  ExtractedNode,
  RichEdge,
  StaticSignal,
  Subsystem,
  ReviewCorrection,
  Workflow,
  NodeType,
} from '@/lib/types/repo-diagram';

function slugId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'node';
}

function titleCase(input: string): string {
  return input
    .split(/[-_\s/]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeLabelKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\b(api|service|database|db|cache|worker|module)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function confidenceRank(c: string | undefined): number {
  if (c === 'high') return 3;
  if (c === 'medium') return 2;
  return 1;
}

function deriveRouteGroup(sourcePath: string): { id: string; label: string; source: string } | null {
  const p = sourcePath.replace(/\\/g, '/');

  const appApi = p.match(/^(?:app\/api\/)(.+)\/route\.(?:tsx?|jsx?|js)$/);
  if (appApi) {
    const segments = appApi[1].split('/');
    const name = segments[segments.length - 1];
    return {
      id: `api_${segments.join('_')}`,
      label: `${titleCase(name)} API`,
      source: sourcePath,
    };
  }

  const pagesApi = p.match(/^pages\/api\/(.+)\.(?:tsx?|jsx?|js)$/);
  if (pagesApi) {
    const segments = pagesApi[1].split('/');
    const name = segments[segments.length - 1];
    return {
      id: `api_${segments.join('_')}`,
      label: `${titleCase(name)} API`,
      source: sourcePath,
    };
  }

  const routeDir = p.match(/^(?:routes|routers|controllers|api)\/([^/.]+)/);
  if (routeDir) {
    return {
      id: `api_${routeDir[1]}`,
      label: `${titleCase(routeDir[1])} API`,
      source: sourcePath,
    };
  }

  if (/route\.(tsx?|jsx?|js)$/.test(p) || /controller\.(tsx?|jsx?|js)$/.test(p)) {
    const base = p.split('/').pop()?.replace(/\.(tsx?|jsx?|js)$/, '') || 'route';
    const parent = p.split('/').slice(-2, -1)[0];
    const name = base === 'route' && parent ? parent : base;
    return {
      id: `api_${slugId(name)}`,
      label: `${titleCase(name)} API`,
      source: sourcePath,
    };
  }

  return null;
}

/**
 * Add granular API, middleware, and auth nodes from static signals
 * so the baseline isn't limited to coarse subsystem buckets.
 */
export function expandBaselineFromSignals(
  baselineNodes: ExtractedNode[],
  signals: StaticSignal[]
): ExtractedNode[] {
  const nodes = baselineNodes.map((n) => ({ ...n, sourceFiles: [...n.sourceFiles] }));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const addNode = (node: ExtractedNode) => {
    const id = slugId(node.id);
    const existing = byId.get(id);
    if (existing) {
      existing.sourceFiles = [...new Set([...existing.sourceFiles, ...node.sourceFiles])];
      if (confidenceRank(node.confidence) > confidenceRank(existing.confidence)) {
        existing.confidence = node.confidence;
      }
      if (node.description && !existing.description.includes(node.description)) {
        existing.description = node.description;
      }
      return;
    }
    const entry = { ...node, id };
    nodes.push(entry);
    byId.set(id, entry);
  };

  // Route groups → API_ROUTE nodes
  const routeGroups = new Map<string, { label: string; sources: string[] }>();
  for (const signal of signals.filter((s) => s.type === 'route')) {
    const source = signal.source;
    if (!source) continue;
    const group = deriveRouteGroup(source);
    if (!group) continue;
    const key = group.id;
    if (!routeGroups.has(key)) {
      routeGroups.set(key, { label: group.label, sources: [] });
    }
    const bucket = routeGroups.get(key)!;
    if (!bucket.sources.includes(source)) bucket.sources.push(source);
  }

  const routeEntries = Array.from(routeGroups.entries()).slice(0, 12);
  for (const [id, { label, sources }] of routeEntries) {
    addNode({
      id,
      label,
      type: 'API_ROUTE',
      description: `HTTP handlers for ${label.toLowerCase()}.`,
      sourceFiles: sources,
      confidence: 'high',
    });
  }

  // Middleware
  const mwSources = signals
    .filter((s) => s.type === 'middleware')
    .map((s) => s.source)
    .filter(Boolean);
  if (mwSources.length > 0) {
    addNode({
      id: 'middleware',
      label: 'Middleware',
      type: 'MIDDLEWARE',
      description: 'Request middleware and guards.',
      sourceFiles: [...new Set(mwSources)],
      confidence: 'high',
    });
  }

  // Auth from dependencies or dedicated signals
  const authSources = signals
    .filter(
      (s) =>
        (s.type === 'middleware' && /auth/i.test(s.source)) ||
        (s.type === 'dependency' && s.details.category === 'auth') ||
        (s.type === 'sdk_usage' && /clerk|auth0|next-auth|supabase/i.test(s.label))
    )
    .map((s) => s.source)
    .filter(Boolean);
  if (authSources.length > 0) {
    addNode({
      id: 'authentication',
      label: 'Authentication',
      type: 'AUTH',
      description: 'Authentication and authorization.',
      sourceFiles: [...new Set(authSources)],
      confidence: 'high',
    });
  }

  return nodes;
}

function shouldMergeNodes(a: ExtractedNode, b: ExtractedNode): boolean {
  if (a.type !== b.type) {
    // DATABASE + CACHE only merge when labels clearly refer to same store
    const dbTypes = new Set<NodeType>(['DATABASE', 'CACHE', 'STORAGE']);
    if (!(dbTypes.has(a.type) && dbTypes.has(b.type))) return false;
  }

  const keyA = normalizeLabelKey(a.label);
  const keyB = normalizeLabelKey(b.label);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  if (keyA.length >= 4 && keyB.length >= 4 && (keyA.includes(keyB) || keyB.includes(keyA))) return true;

  const sharedFiles = a.sourceFiles.filter((f) => b.sourceFiles.includes(f));
  if (sharedFiles.length > 0 && a.type === b.type) return true;

  return false;
}

function pickKeeper(a: ExtractedNode, b: ExtractedNode): ExtractedNode {
  const score = (n: ExtractedNode) =>
    confidenceRank(n.confidence) * 100 + n.sourceFiles.length + n.label.length;
  return score(a) >= score(b) ? a : b;
}

/**
 * Merge duplicate or near-duplicate nodes and rewire edges.
 */
export function deduplicateNodes(
  nodes: ExtractedNode[],
  edges: RichEdge[]
): { nodes: ExtractedNode[]; edges: RichEdge[] } {
  const idRemap = new Map<string, string>();
  const labelMap = new Map<string, ExtractedNode>();

  for (const node of nodes) {
    const normKey = normalizeLabelKey(node.label);
    let match = normKey ? labelMap.get(normKey) : undefined;

    if (!match) {
      for (const [, k] of labelMap) {
        if (shouldMergeNodes(k, node)) {
          match = k;
          break;
        }
      }
    }

    if (match) {
      idRemap.set(node.id, match.id);
      match.sourceFiles = [...new Set([...match.sourceFiles, ...node.sourceFiles])];
      if (confidenceRank(node.confidence) > confidenceRank(match.confidence)) {
        match.confidence = node.confidence;
      }
      const keeper = pickKeeper(match, node);
      if (keeper.label.length > match.label.length) match.label = keeper.label;
      if (node.description && node.description.length > (match.description?.length || 0)) {
        match.description = node.description;
      }
    } else {
      const copy: ExtractedNode = { ...node, sourceFiles: [...node.sourceFiles] };
      if (normKey) labelMap.set(normKey, copy);
      else labelMap.set(node.id, copy);
    }
  }

  const kept = [...labelMap.values()];
  const remappedEdges = edges.map((e) => ({
    ...e,
    from: idRemap.get(e.from) || e.from,
    to: idRemap.get(e.to) || e.to,
  }));

  return { nodes: kept, edges: remappedEdges };
}

function edgePairKey(e: RichEdge): string {
  return `${e.from}->${e.to}`;
}

/**
 * Remove redundant, low-confidence, and overly-generic edges.
 */
export function pruneNoisyEdges(nodes: ExtractedNode[], edges: RichEdge[]): RichEdge[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const valid = edges.filter((e) => {
    if (e.from === e.to) return false;
    if (!nodeById.has(e.from) || !nodeById.has(e.to)) return false;
    return true;
  });

  // Drop subsystem-level generic edges when specific child edges exist
  const subsystemIds = new Set(
    nodes
      .filter((n) => n.sourceFiles.length >= 5 && ['SERVICE', 'API_ROUTE', 'PAGE'].includes(n.type))
      .map((n) => n.id)
  );
  const specificPairs = new Set(
    valid
      .filter((e) => !subsystemIds.has(e.from) || !subsystemIds.has(e.to))
      .map(edgePairKey)
  );

  const filtered = valid.filter((e) => {
    if (subsystemIds.has(e.from) && subsystemIds.has(e.to) && e.type === 'http_call') {
      const hasSpecific = valid.some(
        (other) =>
          other !== e &&
          other.type === 'http_call' &&
          (subsystemIds.has(other.from) || subsystemIds.has(other.to)) &&
          (other.from === e.from || other.to === e.to)
      );
      if (hasSpecific) return false;
    }
    if (specificPairs.size > 3 && subsystemIds.has(e.from) && subsystemIds.has(e.to) && e.confidence === 'low') {
      return false;
    }
    return true;
  });

  // Deduplicate pairs — keep highest confidence
  const byPair = new Map<string, RichEdge>();
  for (const edge of filtered) {
    const key = edgePairKey(edge);
    const existing = byPair.get(key);
    if (!existing || confidenceRank(edge.confidence) > confidenceRank(existing.confidence)) {
      byPair.set(key, edge);
    }
  }

  // Cap fan-out per source node
  const outCount = new Map<string, number>();
  const result: RichEdge[] = [];
  const sorted = Array.from(byPair.values()).sort(
    (a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence)
  );
  const MAX_OUT = 20;
  for (const edge of sorted) {
    const count = outCount.get(edge.from) || 0;
    if (count >= MAX_OUT) continue;
    outCount.set(edge.from, count + 1);
    result.push(edge);
  }

  return result;
}

export function applyReviewCorrections(
  nodes: ExtractedNode[],
  edges: RichEdge[],
  workflows: Workflow[],
  corrections: ReviewCorrection
): { nodes: ExtractedNode[]; edges: RichEdge[]; workflows: Workflow[] } {
  let workingNodes = nodes.map((n) => ({ ...n, sourceFiles: [...n.sourceFiles] }));
  let workingEdges = edges.map((e) => ({ ...e }));
  let workingWorkflows = [...workflows];

  const removeIds = new Set(corrections.removeNodeIds.map(slugId));
  workingNodes = workingNodes.filter((n) => !removeIds.has(n.id));

  for (const merge of corrections.mergeNodes) {
    const keepId = slugId(merge.keepId);
    const removeId = slugId(merge.removeId);
    const keeper = workingNodes.find((n) => n.id === keepId);
    const removed = workingNodes.find((n) => n.id === removeId);
    if (keeper && removed) {
      keeper.sourceFiles = [...new Set([...keeper.sourceFiles, ...removed.sourceFiles])];
      if (merge.newLabel) keeper.label = merge.newLabel;
      workingNodes = workingNodes.filter((n) => n.id !== removeId);
      workingEdges = workingEdges.map((e) => ({
        ...e,
        from: e.from === removeId ? keepId : e.from,
        to: e.to === removeId ? keepId : e.to,
      }));
    }
  }

  for (const node of corrections.addNodes) {
    const id = slugId(node.id);
    if (!workingNodes.some((n) => n.id === id)) {
      workingNodes.push({ ...node, id, sourceFiles: node.sourceFiles || [] });
    }
  }

  const removeIndexes = new Set(
    corrections.removeEdgeIndexes.filter((i) => i >= 0 && i < workingEdges.length)
  );
  workingEdges = workingEdges.filter((_, i) => !removeIndexes.has(i));

  for (const update of corrections.updateEdges) {
    if (update.index >= 0 && update.index < workingEdges.length) {
      workingEdges[update.index] = { ...workingEdges[update.index], ...update.changes };
    }
  }

  for (const edge of corrections.addEdges) {
    workingEdges.push(edge);
  }

  if (corrections.workflowCorrections.length > 0 && workingWorkflows.length === 0) {
    workingWorkflows = corrections.workflowCorrections.slice(0, 3).map((desc, i) => ({
      name: `Flow ${i + 1}`,
      description: desc,
      steps: [],
    }));
  }

  return { nodes: workingNodes, edges: workingEdges, workflows: workingWorkflows };
}

/**
 * Keep disconnected nodes that have concrete source-file evidence.
 */
export function collectGroundedNodeIds(nodes: ExtractedNode[], signals: StaticSignal[]): Set<string> {
  const signalSources = new Set(signals.map((s) => s.source).filter(Boolean));
  const grounded = new Set<string>();
  for (const node of nodes) {
    if (node.sourceFiles.length > 0) grounded.add(node.id);
    if (node.sourceFiles.some((sf) => signalSources.has(sf))) grounded.add(node.id);
    if (node.confidence === 'high') grounded.add(node.id);
  }
  return grounded;
}

export function subsystemNamesToIds(subsystems: Subsystem[]): Set<string> {
  return new Set(subsystems.map((s) => slugId(s.name)));
}
