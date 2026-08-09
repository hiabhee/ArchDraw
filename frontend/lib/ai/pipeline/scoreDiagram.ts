import logger from '@/lib/logger';
import { Node, Edge } from 'reactflow';
import type { DiagramScore, ArchitectureStylePlan, ArchitectureStyle } from './types';
import { isTextNode } from '@/lib/mermaid/textNodes';

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

const SIZE_NODE_RANGES: Record<'small' | 'medium' | 'large', { ideal: [number, number]; min: number }> = {
  small: { ideal: [3, 7], min: 2 },
  medium: { ideal: [6, 12], min: 4 },
  large: { ideal: [10, 20], min: 8 },
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
    nodes.some((c) => (c.data as { parentId?: string })?.parentId === g.id)
  );

  const edgeCount = edges.length;
  const prompt = (options?.prompt || '').toLowerCase();
  const diagramSize = options?.diagramSize ?? 'medium';
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
    const label = (e.data as { label?: string })?.label;
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
  if (expectedLayers) {
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
  score += Math.max(0, 15 - Math.min(15, genericPenalty));

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

  score = Math.max(0, Math.min(100, score - preservationPenalty));

  let grade: 'A' | 'B' | 'C' | 'F';
  if (score >= 85) grade = 'A';
  else if (score >= 65) grade = 'B';
  else if (score >= 40) grade = 'C';
  else grade = 'F';

  return {
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
