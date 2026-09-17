import type { MermaidAST, ParsedNode, ParsedEdge } from './types';
import { classifyNode } from './planTranslator';

/**
 * General-purpose AST sanitizer for LLM hallucinations.
 * Runs BEFORE build so it fixes the Mermaid IR for *any* prompt, not just URL shortener.
 *
 * Fixes:
 *  - Verb-nodes: single-verb labels like "authenticates", "caches", "validates" turned into nodes
 *  - Plural/synonym duplicates: "caches" vs "cache", "dbs" vs "db"
 *  - Backward tier edges: Service/DB/Queue -> Gateway/LB (e.g., redirect --> lb)
 */

// ── Verb-node detection ───────────────────────────────────────────────────────
/**
 * Singular verb stems that should be edge labels, not nodes.
 * Covers auth, cache, CRUD, messaging, and generic actions.
 * List is intentionally general — these verbs appear as hallucinations across domains.
 */
export const VERB_STEMS = new Set([
  'authenticate',
  'authenticates',
  'authenticate',
  'authorize',
  'authorizes',
  'validate',
  'validates',
  'verify',
  'verifies',
  'check',
  'checks',
  'cache',
  'caches',
  'store',
  'stores',
  'fetch',
  'fetches',
  'retrieve',
  'retrieves',
  'process',
  'processes',
  'handle',
  'handles',
  'redirect',
  'redirects',
  'publish',
  'publishes',
  'consume',
  'consumes',
  'enqueue',
  'enqueues',
  'send',
  'sends',
  'receive',
  'receives',
  'create',
  'creates',
  'update',
  'updates',
  'delete',
  'deletes',
  'get',
  'post',
  'put',
  'list',
  'extract',
  'transform',
  'load',
  'subscribe',
  'unsubscribe',
  'notify',
  'notifies',
  'enrich',
  'enriches',
  'aggregate',
  'aggregates',
  'route',
  'routes',
  'forward',
  'forwards',
  'balance',
  'balances',
  'upload',
  'uploads',
  'uploading',
  'download',
  'downloads',
  'downloading',
  'stream',
  'streams',
  'streaming',
  'transcode',
  'transcodes',
  'transcoding',
  'encode',
  'encodes',
  'encoding',
  'open',
  'opens',
  'ack',
  'acks',
  'acknowledge',
  'acknowledges',
  'retry',
  'retries',
  'replicate',
  'replicates',
]);

function singularize(word: string): string {
  const w = word.toLowerCase().trim();
  if (VERB_STEMS.has(w)) return w.replace(/s$/, '');
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) {
    const sing = w.slice(0, -1);
    if (VERB_STEMS.has(sing) || VERB_STEMS.has(sing + 'e')) return sing;
  }
  return w;
}

function normalizeVerbLabel(label: string): string {
  // Strip quotes, parens, extra words: "authenticates" -> authenticates, "Cache (Redis)" stays with parens
  let s = label.trim().toLowerCase();
  s = s.replace(/^["'`]+|["'`]+$/g, '');
  s = s.replace(/^\s*\[\(?\s*"?\s*|\s*"?\s*\)?\]?\s*$/g, '');
  // If label contains spaces, parens, or "service"/"db"/"queue" qualifiers, it's a noun phrase, not a verb-node
  if (s.includes(' ') && (s.includes('service') || s.includes('cache') && s.includes('(') || s.includes('db') || s.includes('queue') || s.includes('worker'))) {
    return '__noun_phrase__';
  }
  s = s.replace(/[^a-z]/g, '');
  return s;
}

const VERB_TARGET_HINTS: Record<string, string[]> = {
  authenticate: ['auth', 'identity', 'credential', 'session'],
  authorize: ['auth', 'permission', 'policy', 'identity'],
  validate: ['validation', 'validator', 'schema', 'auth'],
  cache: ['cache', 'redis', 'memcached'],
  store: ['database', 'storage', 'store', 'postgres', 'mysql', 'mongo'],
  fetch: ['api', 'service', 'database', 'cache'],
  publish: ['queue', 'kafka', 'event', 'broker', 'topic'],
  consume: ['worker', 'consumer', 'queue', 'kafka'],
  notify: ['notification', 'email', 'push', 'webhook'],
};

export function isVerbNodeLabel(label: string, id: string): boolean {
  const normLabel = normalizeVerbLabel(label);
  if (normLabel === '__noun_phrase__') return false;
  // Single-token verb check
  const singLabel = singularize(normLabel);
  const withE = singLabel + 'e';
  if (VERB_STEMS.has(normLabel) || VERB_STEMS.has(singLabel) || VERB_STEMS.has(withE)) {
    // Guard: allow "Cache" noun when id is canonical cache and label has qualifier like "Cache (Redis)"
    // But flag "caches" (plural) when label === id and is single verb
    if (normLabel === 'cache' && label.toLowerCase().includes('redis')) return false;
    if (normLabel === 'caches' || normLabel === 'cache' && label.trim().toLowerCase() === 'caches') return true;
    // For cache, only flag plural verb; singular "Cache" with shape cache is legitimate via classifyNode, but "caches" verb is not
    if (normLabel === 'cache' && label.trim().toLowerCase() !== 'cache' && label.trim().toLowerCase() !== 'caches') return false;
    return label.trim().split(/\s+/).length === 1;
  }
  // Also check id itself if label is generic but id is verb
  const normId = normalizeVerbLabel(id);
  if (VERB_STEMS.has(normId) || VERB_STEMS.has(singularize(normId))) {
    if (label.trim().split(/\s+/).length === 1 && label.toLowerCase() === id.toLowerCase()) return true;
  }
  return false;
}

// ── Dedup helpers ─────────────────────────────────────────────────────────────
function normalizeDedupKey(label: string): string {
  let s = label.toLowerCase();
  s = s.replace(/\s*\([^)]*\)/g, ''); // remove parens: "Cache (Redis)" -> "Cache"
  s = s.replace(/[^a-z0-9]/g, ''); // alnum only
  return s;
}

function shouldMergeMermaidNodes(a: ParsedNode, b: ParsedNode): boolean {
  const ca = classifyNode(a.label, undefined);
  const cb = classifyNode(b.label, undefined);
  // Only merge if same serviceType family or both are cache/storage/db variants
  const sameFamily = ca.serviceType === cb.serviceType;
  const cacheFamily = new Set(['cache', 'database', 'storage']);
  const bothCacheLike = cacheFamily.has(ca.serviceType) && cacheFamily.has(cb.serviceType);
  if (!sameFamily && !bothCacheLike) return false;

  const ka = normalizeDedupKey(a.label);
  const kb = normalizeDedupKey(b.label);
  if (!ka || !kb) return false;

  // Intentional replicas: two nodes with identical multi-word labels like "Follower Replica" should stay separate
  const aRaw = a.label.trim().toLowerCase();
  const bRaw = b.label.trim().toLowerCase();
  const aTokens = aRaw.split(/\s+/).length;
  const bTokens = bRaw.split(/\s+/).length;
  if (ka === kb && aTokens > 1 && bTokens > 1 && aRaw === bRaw) {
    // Both multi-word identical — likely intentional replicas (e.g., two "Follower Replica" nodes)
    return false;
  }

  if (ka === kb) return true;
  // Domain-specific duplicate: Ride Matching Service vs Driver Matching Service (both contain "matching")
  // and similar service splits (e.g., Ride Matching / Driver Matching) should collapse to one Matching Service
  if (aRaw.includes('matching') && bRaw.includes('matching') && sameFamily) return true;
  // Also handle generic split like "Trip Service" vs "Ride Matching Service" — share "service" but not matching
  // Only merge matching-related duplicates to avoid over-merging unrelated services
  // Plural vs singular: "caches" vs "cache" (single-token verb vs canonical)
  const singA = ka.endsWith('s') && ka.length > 3 && !ka.endsWith('ss') ? ka.slice(0, -1) : ka;
  const singB = kb.endsWith('s') && kb.length > 3 && !kb.endsWith('ss') ? kb.slice(0, -1) : kb;
  if (singA === singB && singA.length >= 3) {
    // Only merge singular/plural if at least one is single-token (hallucinated plural like "caches")
    // This preserves "Follower Replica" replicas but merges "cache" vs "caches"
    const aSingle = aTokens === 1;
    const bSingle = bTokens === 1;
    if (aSingle || bSingle) return true;
    // Both multi-word but singularized equal? Rare — be conservative and don't merge
    return false;
  }
  return false;
}

// ── Main sanitizer ───────────────────────────────────────────────────────────
export interface SanitizeResult {
  ast: MermaidAST;
  warnings: string[];
  removedNodeIds: string[];
  removedEdgeIds: string[];
  addedEdges: ParsedEdge[];
}

export interface SanitizeOptions {
  /** Reduce only relationships that are redundant for a generated diagram. */
  reduceRedundantEdges?: boolean;
  diagramKind?: 'architecture' | 'workflow';
  /** Remove disconnected generated infrastructure nodes that have no role in the graph. */
  pruneOrphans?: boolean;
}

const RESPONSE_LABELS = new Set([
  'response',
  'responds',
  'return',
  'returns',
  'reply',
  'replies',
  'ack',
  'acknowledges',
  'success',
  'completed',
]);

const NON_REDUNDANT_EDGE_TERMS = [
  'replicat',
  'mirror',
  'backup',
  'export',
  'archive',
  'audit',
  'telemetr',
  'metric',
  'observ',
  'webhook',
  'callback',
  'fallback',
  'failover',
  'dead letter',
  'dlq',
];

function isExplicitReturnLabel(label: string | null | undefined): boolean {
  return /\b(return|returns|response|responds|reply|callback|webhook|push|notification|control|health)\b/i.test(label ?? '');
}

function normalizedEdgeLabel(edge: ParsedEdge): string {
  return (edge.label ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isGenericResponseEdge(edge: ParsedEdge): boolean {
  const label = normalizedEdgeLabel(edge);
  return RESPONSE_LABELS.has(label);
}

function isNonRedundantEdge(edge: ParsedEdge): boolean {
  const label = normalizedEdgeLabel(edge);
  return NON_REDUNDANT_EDGE_TERMS.some(term => label.includes(term));
}

function mergeParallelEdges(edges: ParsedEdge[], warnings: string[]): ParsedEdge[] {
  const merged = new Map<string, ParsedEdge>();
  const labels = new Map<string, string[]>();
  const types = new Map<string, Set<ParsedEdge['type']>>();

  for (const edge of edges) {
    const key = `${edge.source}->${edge.target}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...edge });
      labels.set(key, edge.label ? [edge.label] : []);
      types.set(key, new Set([edge.type]));
      continue;
    }

    const edgeLabels = labels.get(key)!;
    if (edge.label && !edgeLabels.includes(edge.label)) edgeLabels.push(edge.label);
    types.get(key)!.add(edge.type);
    warnings.push(`[EDGE_CLARITY] Merged parallel edges ${edge.source}->${edge.target}`);
  }

  for (const [key, edge] of merged) {
    const edgeLabels = labels.get(key)!;
    if (edgeLabels.length > 0) {
      edge.label = edgeLabels.length <= 2
        ? edgeLabels.join(' + ')
        : `${edgeLabels.slice(0, 2).join(' + ')} + ${edgeLabels.length - 2} more`;
    }
    // A mixed sync/async pair cannot be represented faithfully by one dashed
    // or solid stroke, so keep it visually neutral rather than mislabeling it.
    if (types.get(key)!.size > 1) edge.type = 'arrow';
  }

  return [...merged.values()];
}

function hasAlternatePath(
  source: string,
  target: string,
  excludedEdgeId: string,
  edges: ParsedEdge[],
): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.id === excludedEdgeId) continue;
    const next = adjacency.get(edge.source) ?? [];
    next.push(edge.target);
    adjacency.set(edge.source, next);
  }

  const queue = [source];
  const visited = new Set([source]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (next === target) return true;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

function reduceRedundantEdges(edges: ParsedEdge[], warnings: string[]): ParsedEdge[] {
  let reduced = mergeParallelEdges(edges, warnings);

  // Remove a generic response only when its forward interaction exists. A
  // labeled return such as "returns token" is intentionally preserved.
  const mirrorIds = new Set<string>();
  for (const edge of reduced) {
    if (!isGenericResponseEdge(edge)) continue;
    const forward = reduced.find(candidate =>
      candidate.source === edge.target &&
      candidate.target === edge.source &&
      candidate.id !== edge.id
    );
    if (forward) {
      mirrorIds.add(edge.id);
      warnings.push(`[EDGE_CLARITY] Removed generic mirrored response ${edge.source}->${edge.target}`);
    }
  }
  if (mirrorIds.size > 0) reduced = reduced.filter(edge => !mirrorIds.has(edge.id));

  // Long shortcuts are the most common source of edge webs. Only remove one
  // when another directed path already preserves the same reachability and the
  // edge is not a distinct replication/export/observability relationship.
  const shortcutIds = new Set<string>();
  for (const edge of reduced) {
    if (edge.type === 'bidirectional' || edge.type === 'invisible' || isNonRedundantEdge(edge)) continue;
    if (hasAlternatePath(edge.source, edge.target, edge.id, reduced)) {
      shortcutIds.add(edge.id);
      warnings.push(`[EDGE_CLARITY] Removed redundant shortcut ${edge.source}->${edge.target}`);
    }
  }
  if (shortcutIds.size > 0) reduced = reduced.filter(edge => !shortcutIds.has(edge.id));

  return reduced;
}

export function sanitizeMermaidAST(ast: MermaidAST, options: SanitizeOptions = {}): SanitizeResult {
  const warnings: string[] = [];
  let nodes = [...ast.nodes];
  let edges = [...ast.edges];
  const removedNodeIds: string[] = [];
  const removedEdgeIds: string[] = [];
  const addedEdges: ParsedEdge[] = [];
  const isArchitecture = options.diagramKind !== 'workflow';

  // 1. Deduplicate synonym/plural nodes FIRST (so "caches" merges to "cache" before verb pruning drops its edge)
  const idRemap = new Map<string, string>();
  const labelToKeeper = new Map<string, ParsedNode>();
  const idToKeeper = new Map<string, ParsedNode>();

  for (const node of nodes) {
    let keeper: ParsedNode | undefined;
    // Try normalized key match — shouldMerge handles exact, singular, and matching-service cases
    const key = normalizeDedupKey(node.label);
    if (key) {
      for (const [, kept] of labelToKeeper) {
        if (shouldMergeMermaidNodes(kept, node)) {
          keeper = kept;
          break;
        }
      }
    }
    // Also check direct exact label match (case-insensitive)
    if (!keeper) {
      for (const [, kept] of idToKeeper) {
        if (shouldMergeMermaidNodes(kept, node)) {
          if (kept.label.trim().toLowerCase() === node.label.trim().toLowerCase()) {
            keeper = kept;
            break;
          }
        }
      }
    }

    if (keeper) {
      idRemap.set(node.id, keeper.id);
      warnings.push(`[DUPLICATE_NODE] Merged duplicate "${node.label}" (id=${node.id}) into "${keeper.label}" (id=${keeper.id})`);
      // Prefer longer/more descriptive label for keeper if it adds qualifier (e.g., keep "Cache (Redis)" over "caches")
      if (node.label.length > keeper.label.length && node.label.toLowerCase().includes('redis')) {
        keeper.label = node.label;
      }
      removedNodeIds.push(node.id);
    } else {
      labelToKeeper.set(key || node.id, node);
      idToKeeper.set(node.id, node);
    }
  }

  if (idRemap.size > 0) {
    // Remap edges
    const remappedEdges: ParsedEdge[] = [];
    const seenPair = new Set<string>();
    for (const e of edges) {
      const from = idRemap.get(e.source) || e.source;
      const to = idRemap.get(e.target) || e.target;
      if (from === to) {
        removedEdgeIds.push(e.id);
        warnings.push(`[DUPLICATE_NODE] Dropped self-loop ${e.source}->${e.target} after dedup`);
        continue;
      }
      const pairKey = `${from}->${to}:${e.label ?? ''}`;
      if (seenPair.has(pairKey)) {
        removedEdgeIds.push(e.id);
        warnings.push(`[DUPLICATE_NODE] Dropped duplicate edge ${from}->${to}`);
        continue;
      }
      seenPair.add(pairKey);
      remappedEdges.push({ ...e, source: from, target: to });
    }
    edges = remappedEdges;
    nodes = nodes.filter(n => !idRemap.has(n.id));
    // Fix subgraph nodeIds
    for (const sg of ast.subgraphs) {
      sg.nodeIds = sg.nodeIds.map(id => idRemap.get(id) || id).filter((id, _i, arr) => arr.indexOf(id) === arr.lastIndexOf(id) ? true : arr.indexOf(id) === arr.lastIndexOf(id));
      // Deduplicate after remap
      sg.nodeIds = [...new Set(sg.nodeIds)];
    }
  }

  // 2. Prune verb-nodes from architecture diagrams only. In workflows these
  // are meaningful action steps and are retained by the stage above.
  const verbNodeIds = new Set<string>();
  for (const n of nodes) {
    if (!isArchitecture) continue;
    if (isVerbNodeLabel(n.label, n.id)) {
      // Special guard: "cache" with qualifier is not verb; already handled in isVerbNodeLabel
      // But "caches" always verb
      verbNodeIds.add(n.id);
      warnings.push(`[VERB_NODE] Removed verb-node "${n.label}" (id=${n.id}) — verbs belong on edges`);
    }
  }

  if (verbNodeIds.size > 0) {
    // Attempt splice for verb nodes that bridge two services: A->verb->B => A->B
    for (const vid of verbNodeIds) {
      const vNode = nodes.find(n => n.id === vid);
      if (!vNode) continue;
      const preds = edges.filter(e => e.target === vid);
      const succs = edges.filter(e => e.source === vid);
      if (preds.length > 0 && succs.length > 0) {
        for (const p of preds) {
          for (const s of succs) {
            if (p.source === s.target) continue; // self-loop
            const existing = edges.find(e => e.source === p.source && e.target === s.target);
            if (existing) continue;
            const newLabel = vNode.label || p.label || s.label || 'validates';
            const newId = `${p.source}->${s.target}__via_${vid}`;
            const spliced: ParsedEdge = {
              id: newId,
              source: p.source,
              target: s.target,
              label: newLabel,
              type: p.type || s.type || 'arrow',
            };
            edges.push(spliced);
            addedEdges.push(spliced);
            warnings.push(`[VERB_NODE] Spliced ${p.source} -> ${vid} -> ${s.target} into ${p.source}->${s.target} ("${newLabel}")`);
          }
        }
      }
      // Single-sided verb node that looks like a service (e.g., "uploads" vs "upload" service) — remap to similar service
      if ((preds.length > 0 && succs.length === 0) || (preds.length === 0 && succs.length > 0)) {
        const verbStem = singularize(normalizeVerbLabel(vNode.label) || normalizeVerbLabel(vNode.id));
        const hints = VERB_TARGET_HINTS[verbStem] ?? [];
        const candidates = nodes.filter(n => {
          if (verbNodeIds.has(n.id)) return false;
          const candId = n.id.toLowerCase();
          const candLabel = n.label.toLowerCase();
          const stem = verbStem.toLowerCase();
          return candId === stem || candId === vNode.id.toLowerCase().replace(/s$/, '') || candLabel.includes(stem) || stem.includes(candId) || hints.some(hint => candId.includes(hint) || candLabel.includes(hint));
        });
        // Prefer a component whose label matches the operation's semantic
        // target ("authenticates" → Auth Service, "caches" → Redis Cache).
        const candidate = candidates.sort((a, b) => {
          const score = (node: ParsedNode) => {
            const text = `${node.id} ${node.label}`.toLowerCase();
            return hints.reduce((total, hint) => total + (text.includes(hint) ? 1 : 0), 0);
          };
          return score(b) - score(a);
        })[0];
        if (candidate) {
          const relatedEdges = preds.length > 0 ? preds : succs;
          for (const e of relatedEdges) {
            const newSource = preds.length > 0 ? e.source : candidate.id;
            const newTarget = preds.length > 0 ? candidate.id : e.target;
            const existing = edges.find(x => x.source === newSource && x.target === newTarget);
            if (existing) continue;
            const newLabel = e.label || vNode.label || 'validates';
            const newId = `${newSource}->${newTarget}__remap_${vid}`;
            const remapped: ParsedEdge = {
              id: newId,
              source: newSource,
              target: newTarget,
              label: newLabel,
              type: e.type,
            };
            edges.push(remapped);
            addedEdges.push(remapped);
            warnings.push(`[VERB_NODE] Remapped ${e.source}->${e.target} via verb "${vNode.label}" to ${newSource}->${newTarget} ("${newLabel}")`);
          }
        }
      }
    }
    // Now delete verb nodes and incident edges
    const incidentEdgeIds = new Set(
      edges.filter(e => verbNodeIds.has(e.source) || verbNodeIds.has(e.target)).map(e => e.id)
    );
    for (const eid of incidentEdgeIds) removedEdgeIds.push(eid);
    edges = edges.filter(e => !verbNodeIds.has(e.source) && !verbNodeIds.has(e.target));
    nodes = nodes.filter(n => !verbNodeIds.has(n.id));
    for (const vid of verbNodeIds) removedNodeIds.push(vid);
    // Also drop subgraph membership
    for (const sg of ast.subgraphs) {
      sg.nodeIds = sg.nodeIds.filter(id => !verbNodeIds.has(id));
    }
  }

  // Helper: respect explicit shapeOverride (e.g., actor/mobile/monitor) for tier checks
  const getNodeServiceType = (n: ParsedNode): string => {
    const override = (n as unknown as { shapeOverride?: string }).shapeOverride;
    if (override === 'actor') return 'actor';
    if (override === 'mobile') return 'mobile';
    if (override === 'monitor') return 'client';
    if (override === 'shield') return 'security';
    if (override === 'queue') return 'queue';
    if (override === 'cache') return 'cache';
    if (override === 'bucket') return 'storage';
    if (override === 'function') return 'function';
    if (override === 'cloud') return 'external-service';
    return classifyNode(n.label, undefined).serviceType;
  };

  // 3. Prune backward tier edges: Service/DB/Queue -> Gateway/LB (architecture only)
  const toRemoveEdgeIds = new Set<string>();
  for (const e of edges) {
    if (!isArchitecture) break;
    const srcNode = nodes.find(n => n.id === e.source);
    const tgtNode = nodes.find(n => n.id === e.target);
    if (!srcNode || !tgtNode) continue;
    const srcType = getNodeServiceType(srcNode);
    const tgtType = getNodeServiceType(tgtNode);
    // Allow security (Auth) -> LB when it's a return flow (e.g., "returns token") — that's the canonical auth pattern
    if (srcType === 'security') continue;
    const srcIsDownstream = ['service', 'function', 'container', 'cache', 'database', 'queue', 'storage'].includes(srcType);
    const tgtIsGateway = tgtType === 'load-balancer';
    if (srcIsDownstream && tgtIsGateway) {
      toRemoveEdgeIds.add(e.id);
      warnings.push(`[TIER_REVERSAL] Removed backward edge ${srcNode.label} (${srcType}) -> ${tgtNode.label} (${tgtType}) "${e.label ?? ''}" — services must not target gateway`);
    }
  }
  if (toRemoveEdgeIds.size > 0) {
    edges = edges.filter(e => !toRemoveEdgeIds.has(e.id));
    for (const id of toRemoveEdgeIds) removedEdgeIds.push(id);
  }

  // 4. Prune Service/Security -> Client backward edges (architecture only).
  const toRemoveClientIds = new Set<string>();
  for (const e of edges) {
    if (!isArchitecture) break;
    const srcNode = nodes.find(n => n.id === e.source);
    const tgtNode = nodes.find(n => n.id === e.target);
    if (!srcNode || !tgtNode) continue;
    const srcType = getNodeServiceType(srcNode);
    const tgtType = getNodeServiceType(tgtNode);
    const srcIsBackend = ['service', 'security', 'function', 'container', 'cache', 'database', 'queue', 'storage'].includes(srcType);
    const tgtIsClient = ['client', 'mobile', 'actor'].includes(tgtType);
    if (srcIsBackend && tgtIsClient && !isExplicitReturnLabel(e.label)) {
      // No backend should directly target a client (must go via Gateway). This catches "auth success -> app".
      toRemoveClientIds.add(e.id);
      warnings.push(`[TIER_REVERSAL] Removed backward edge ${srcNode.label} (${srcType}) -> ${tgtNode.label} (${tgtType}) "${e.label ?? ''}" — backend must not target client directly (route via Gateway)`);
    }
  }
  if (toRemoveClientIds.size > 0) {
    edges = edges.filter(e => !toRemoveClientIds.has(e.id));
    for (const id of toRemoveClientIds) removedEdgeIds.push(id);
  }

  if (isArchitecture && options.pruneOrphans) {
    const connected = new Set<string>();
    for (const edge of edges) {
      connected.add(edge.source);
      connected.add(edge.target);
    }
    const orphanIds = new Set(nodes.filter(node => !connected.has(node.id)).map(node => node.id));
    if (orphanIds.size > 0) {
      for (const id of orphanIds) {
        removedNodeIds.push(id);
        warnings.push(`[ORPHAN_NODE] Removed disconnected architecture component "${nodes.find(node => node.id === id)?.label ?? id}"`);
      }
      nodes = nodes.filter(node => !orphanIds.has(node.id));
      for (const subgraph of ast.subgraphs) subgraph.nodeIds = subgraph.nodeIds.filter(id => !orphanIds.has(id));
    }
  }

  if (options.reduceRedundantEdges) {
    edges = reduceRedundantEdges(edges, warnings);
  }

  const sanitizedAST: MermaidAST = {
    direction: ast.direction,
    nodes,
    edges,
    subgraphs: ast.subgraphs,
    texts: ast.texts,
  };

  return {
    ast: sanitizedAST,
    warnings,
    removedNodeIds,
    removedEdgeIds,
    addedEdges,
  };
}
