import { inferDiagramKind, isReturnInteraction } from './mermaid-pipeline/diagramIntent';
import { measureLayoutQuality } from '@/lib/pipeline-shared/layout/layoutQuality';
import logger from '@/lib/logger';
import { Node, Edge } from 'reactflow';
import type { DiagramScore, ArchitectureStylePlan, ArchitectureStyle } from './types';
import { isTextNode } from '@/lib/mermaid/textNodes';
import { classifyNode } from '@/lib/mermaid/planTranslator';
import { isVerbNodeLabel } from '@/lib/mermaid/sanitize';

const GENERIC_TEMPLATE_LABELS = [
  'api gateway',
  'load balancer',
  'circuit breaker',
  'observability stack',
  'observability',
  'dead letter',
  'dlq',
  'secrets manager',
  'service mesh',
  'ci/cd',
  'container orchestration',
  'web client',
  'mobile app',
  'auth service',
  'business logic service',
  'message queue',
  'worker service',
];

const STYLE_EXPECTED_LAYERS: Partial<Record<ArchitectureStyle, string[]>> = {
  mvc: ['application', 'client'],
  monolith: ['application'],
  modular_monolith: ['application'],
  data_pipeline: ['data', 'queue', 'application'],
  microservices: ['application', 'gateway'],
};

const DETAIL_NODE_RANGES: Record<1 | 2 | 3, { ideal: [number, number]; min: number }> = {
  1: { ideal: [3, 7], min: 2 },
  2: { ideal: [5, 12], min: 3 },
  3: { ideal: [8, 20], min: 5 },
};

export function scoreDiagram(
  nodes: Node[],
  edges: Edge[],
  options?: {
    nodesRemoved?: number;
    edgesRemoved?: number;
    groupsRemoved?: number;
    diagramSize?: 'small' | 'medium' | 'large';
    detailLevel?: 1 | 2 | 3;
    stylePlan?: ArchitectureStylePlan;
    prompt?: string;
  }
): DiagramScore {
  const nonGroupNodes = nodes.filter((n) => n.type !== 'groupNode' && !isTextNode(n));
  const groups = nodes.filter((n) => n.type === 'groupNode');
  const hasGroupsWithChildren = groups.some((g) =>
    nodes.some((c) => (c.parentNode ?? (c.data as { parentId?: string })?.parentId) === g.id)
  );

  const edgeCount = edges.length;
  const prompt = (options?.prompt || '').toLowerCase();
  const isArchitecture = inferDiagramKind(prompt) === 'architecture';
  const detailLevel = options?.detailLevel ?? 2;
  const style = options?.stylePlan?.style ?? 'generic';

  const connected = new Set<string>();
  for (const edge of edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }
  const orphanCount = nonGroupNodes.filter((n) => !connected.has(n.id)).length;

  const layersPresent = new Set<string>();
  for (const node of nonGroupNodes) {
    const layer = (node.data as { layer?: string })?.layer;
    if (layer) layersPresent.add(layer);
  }

  const edgesWithLabels = edges.filter((e) => {
    const label = typeof e.label === 'string' ? e.label : (e.data as { label?: string })?.label;
    return label && label.trim().length > 0;
  }).length;
  const labelQuality = edgeCount > 0 ? edgesWithLabels / edgeCount : 0;

  let score = 0;

  // 1. Size-appropriate node count (25 pts) — based on detail level
  const range = DETAIL_NODE_RANGES[detailLevel];
  const nodeCount = nonGroupNodes.length;
  if (nodeCount >= range.ideal[0] && nodeCount <= range.ideal[1]) {
    score += 25;
  } else if (nodeCount >= range.min && nodeCount <= range.ideal[1] + 5) {
    score += 20;
  } else if (nodeCount >= 2) {
    score += 12;
  } else {
    score += 5;
  }

  // 2. Edge connectivity (20 pts)
  if (edgeCount >= Math.max(2, Math.floor(nodeCount * 0.5))) score += 20;
  else if (edgeCount >= 1) score += 12;
  else score += 0;

  // 3. Orphans (20 pts) — allow intentional standalone only when no client tier expected
  const expectsClient = STYLE_EXPECTED_LAYERS[style]?.includes('client') ?? /\b(client|user|web|mobile)\b/.test(prompt);
  if (orphanCount === 0) score += 20;
  else if (!expectsClient && orphanCount <= 1) score += 15;
  else if (orphanCount <= 2) score += 10;
  else score += 0;

  // 4. Style-appropriate layer presence (15 pts) — NOT a fixed client/gateway/app/data quartet
  const expectedLayers = STYLE_EXPECTED_LAYERS[style];
  if (!isArchitecture) {
    score += 15;
  } else if (expectedLayers) {
    const matched = expectedLayers.filter((l) => layersPresent.has(l)).length;
    score += Math.round((matched / expectedLayers.length) * 15);
  } else {
    score += layersPresent.size >= 1 ? 15 : 5;
  }

  // 5. Edge label quality (10 pts)
  score += Math.round(labelQuality * 10);

  // 6. Generic template penalty (10 pts baseline minus deductions)
  let genericPenalty = 0;
  for (const node of nonGroupNodes) {
    const label = String((node.data as { label?: string })?.label || '').toLowerCase();
    for (const generic of GENERIC_TEMPLATE_LABELS) {
      if (!label.includes(generic)) continue;
      const mentionedInPrompt = prompt.includes(generic);
      if (!mentionedInPrompt && options?.stylePlan?.productionDepth !== 'production') {
        genericPenalty += 12;
      }
    }
  }
  score += Math.max(0, 10 - Math.min(10, genericPenalty));

  // 7. General quality penalties — verb-nodes, duplicate synonyms, tier reversal (covers ALL prompts)
  let qualityPenalty = 0;

  // Verb-node penalty (general — authenticates, caches, validates, etc.)
  let verbCount = 0;
  for (const n of nonGroupNodes) {
    const label = String((n.data as { label?: string })?.label || n.id || '');
    if (isArchitecture && isVerbNodeLabel(label, n.id)) verbCount++;
  }
  if (verbCount > 0) {
    qualityPenalty += Math.min(30, verbCount * 15);
    logger.info(`[Score] Verb-node penalty: -${Math.min(30, verbCount * 15)} (${verbCount} verb-nodes)`);
  }

  // Duplicate/synonym penalty (general — cache vs caches, but not intentional replicas like two "Follower Replica")
  const seenDup = new Map<string, { id: string; label: string }>();
  let dupCount = 0;
  for (const n of nonGroupNodes) {
    const label = String((n.data as { label?: string })?.label || n.id || '');
    const cls = (n.data as { serviceType?: string })?.serviceType || classifyNode(label, undefined).serviceType;
    const key = `${cls}:${label.toLowerCase().replace(/\s*\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '')}`;
    const singKey = key.endsWith('s') && key.length > 3 && !key.endsWith('ss') ? key.slice(0, -1) : key;
    const existing = seenDup.get(key) || seenDup.get(singKey);
    if (existing && isArchitecture) {
      const aTokens = label.trim().split(/\s+/).length;
      const bTokens = String(existing.label).trim().split(/\s+/).length;
      const identicalMultiWord = aTokens > 1 && bTokens > 1 && label.trim().toLowerCase() === String(existing.label).trim().toLowerCase();
      if (!identicalMultiWord) dupCount++;
    } else {
      seenDup.set(key, { id: n.id, label });
      if (singKey !== key) seenDup.set(singKey, { id: n.id, label });
    }
  }
  if (dupCount > 0) {
    qualityPenalty += Math.min(25, dupCount * 12);
    logger.info(`[Score] Duplicate synonym penalty: -${Math.min(25, dupCount * 12)} (${dupCount} duplicates)`);
  }

  // Tier-reversal penalty (general — Service/DB/Queue -> Gateway/LB, but allow Auth returns)
  let reversalCount = 0;
  const downstream = new Set(['service', 'function', 'container', 'cache', 'database', 'queue', 'storage']);
  for (const e of edges) {
    const src = nonGroupNodes.find(n => n.id === e.source);
    const tgt = nonGroupNodes.find(n => n.id === e.target);
    if (!src || !tgt) continue;
    const srcLabel = String((src.data as { label?: string })?.label || src.id || '');
    const tgtLabel = String((tgt.data as { label?: string })?.label || tgt.id || '');
    const srcType = (src.data as { serviceType?: string })?.serviceType || classifyNode(srcLabel, undefined).serviceType;
    const tgtType = (tgt.data as { serviceType?: string })?.serviceType || classifyNode(tgtLabel, undefined).serviceType;
    if (isArchitecture && downstream.has(srcType) && tgtType === 'load-balancer' && !isReturnInteraction(String(e.label ?? e.data?.label ?? ''))) reversalCount++;
  }
  if (reversalCount > 0) {
    qualityPenalty += Math.min(30, reversalCount * 15);
    logger.info(`[Score] Tier-reversal penalty: -${Math.min(30, reversalCount * 15)} (${reversalCount} backward edges)`);
  }

  if (qualityPenalty > 0) {
    logger.info(`[Score] Total quality penalty: -${qualityPenalty}`);
  }

  // Preservation penalties
  let preservationPenalty = 0;
  if (options?.nodesRemoved && options.nodesRemoved > 0) {
    preservationPenalty += Math.min(25, options.nodesRemoved * 5);
  }
  if (options?.edgesRemoved && options.edgesRemoved > 0) {
    preservationPenalty += Math.min(15, options.edgesRemoved * 3);
  }
  if (options?.groupsRemoved && options.groupsRemoved > 0) {
    preservationPenalty += options.groupsRemoved * 10;
  }

  if (preservationPenalty > 0) {
    logger.info(`[Score] Preservation penalty: -${preservationPenalty}`);
  }

  const geometry = measureLayoutQuality(nodes, edges);
  score = Math.max(0, Math.min(100, score - preservationPenalty - qualityPenalty - Math.min(25, geometry.penalty)));

  let grade: 'A' | 'B' | 'C' | 'F';
  if (score >= 85) grade = 'A';
  else if (score >= 65) grade = 'B';
  else if (score >= 40) grade = 'C';
  else grade = 'F';

  return {
    geometry,
    grade,
    nodeCount,
    edgeCount,
    orphanCount,
    hasGroups: hasGroupsWithChildren,
    score,
    nodesRemoved: options?.nodesRemoved || 0,
    edgesRemoved: options?.edgesRemoved || 0,
    groupsRemoved: options?.groupsRemoved || 0,
    preservationPenalty,
  };
}
