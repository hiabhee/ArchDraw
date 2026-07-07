import type { ExtractedNode, RichEdge } from '@/lib/types/repo-diagram';
import {
  applySemanticLayerGroups,
  layoutedNodeToNdjsonRecord,
  sortGroupsBeforeChildren,
} from '@/lib/ai/pipeline/applySemanticLayerGroups';
import type { LayoutedNode } from '@/lib/ai/pipeline/types';
import { calculateNodeDimensions } from '@/lib/utils/nodeSizing';

// Layer Y positions
const LAYER_Y: Record<string, number> = {
  infrastructure: 0,
  client: 200,
  application: 400,
  data: 600,
  external: 800,
};

const LAYER_GAP = 80;
const COL_GAP = 200;
const START_X = 100;

function cleanNodeLabel(label: string): string {
  let cleaned = label
    .replace(/\s*[ⓘ⚠]\s*$/g, '')
    .replace(/^root$/i, 'Application')
    .trim();

  // If the label is completely UPPERCASE and is longer than 3 characters, normalize it to Title Case
  if (cleaned.length > 3 && cleaned === cleaned.toUpperCase()) {
    cleaned = cleaned
      .split(/[-_\s]+/)
      .map((word) => {
        const upperWord = word.toUpperCase();
        if (['API', 'SDK', 'DB', 'CDN', 'UI', 'AWS', 'URL', 'REST', 'SQL', 'JWT', 'OAUTH'].includes(upperWord)) {
          return upperWord;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  return cleaned;
}

function cleanEdgeLabel(label: string, type: string): string {
  const raw = label.trim();
  if (!raw) {
    if (type === 'db_query') return 'queries';
    if (type === 'external_call') return 'uses';
    if (type === 'auth_check') return 'auth';
    if (type === 'guards') return 'guards';
    if (type === 'publishes') return 'publishes';
    return 'calls';
  }

  const lower = raw.toLowerCase();
  if (lower.includes('external') || lower.startsWith('uses ')) return type === 'external_call' ? 'uses' : 'calls';
  if (lower.includes('database') || lower.includes('datastore') || lower.includes('query')) return 'queries';
  if (lower.includes('authenticate')) return 'auth';
  if (lower.includes('route')) return 'routes';
  if (lower.length > 22) {
    if (type === 'external_call') return 'uses';
    if (type === 'db_query') return 'queries';
    if (type === 'http_call') return 'calls';
  }
  return raw.toLowerCase();
}

function getNodeLayerAndType(node: ExtractedNode): { layer: string; icon: string; serviceType: string } {
  switch (node.type) {
    case 'MIDDLEWARE':
    case 'CDN':
    case 'API_GATEWAY':
      return { layer: 'infrastructure', icon: 'shield', serviceType: 'gateway' };
    case 'PAGE':
    case 'UI_COMPONENT':
    case 'STATE_MANAGEMENT':
      return { layer: 'client', icon: 'monitor', serviceType: 'client' };
    case 'API_ROUTE':
    case 'SERVICE':
    case 'CONTROLLER':
    case 'WORKER':
    case 'AUTH':
    case 'CORE_MODULE':
    case 'PLUGIN_SYSTEM':
      return { layer: 'application', icon: 'webhook', serviceType: 'api' };
    case 'DATABASE':
    case 'CACHE':
    case 'QUEUE':
    case 'STORAGE':
      return { layer: 'data', icon: 'database', serviceType: 'database' };
    case 'EXTERNAL_SERVICE':
    case 'INFRASTRUCTURE':
      return { layer: 'external', icon: 'server', serviceType: 'service' };
    default:
      return { layer: 'application', icon: 'box', serviceType: 'generic' };
  }
}

export function compileToDiagram(
  nodes: ExtractedNode[],
  edges: RichEdge[],
  workflows?: { name: string; description: string; steps: string[] }[]
): string {
  const lines: string[] = [];

  // Build counters per layer for horizontal spacing
  const layerCounters: Record<string, number> = {};
  for (const key of Object.keys(LAYER_Y)) {
    layerCounters[key] = 0;
  }

  const layoutedLeaves: LayoutedNode[] = nodes.map((node) => {
    const { layer, icon, serviceType } = getNodeLayerAndType(node);
    if (!layerCounters[layer]) layerCounters[layer] = 0;

    const x = START_X + layerCounters[layer] * COL_GAP;
    const y = LAYER_Y[layer] + LAYER_GAP;
    layerCounters[layer]++;

    const label = cleanNodeLabel(node.label);
    const { width, height } = calculateNodeDimensions(label, node.description);

    const layouted: LayoutedNode = {
      id: node.id,
      label,
      subtitle: node.description,
      layer: layer as LayoutedNode['layer'],
      icon,
      serviceType: serviceType as LayoutedNode['serviceType'],
      x,
      y,
      width,
      height,
    };

    return layouted;
  });

  // Apply semantic layer grouping (wraps same-layer nodes in group containers)
  const grouped = sortGroupsBeforeChildren(applySemanticLayerGroups(layoutedLeaves));

  // Output nodes
  for (const node of grouped) {
    const record = layoutedNodeToNdjsonRecord(node);
    if (node.subtitle && node.subtitle.includes('inferred')) {
      (record as any).note = 'inferred from config';
    }
    lines.push(JSON.stringify(record));
  }

  // Output edges (match V1 flow format: { path, label, async, communicationType })
  for (const edge of edges) {
    const isAsync = edge.direction === 'async' || edge.direction === 'event';
    const label = cleanEdgeLabel(edge.label, edge.type);
    const flowObj: Record<string, unknown> = {
      path: [edge.from, edge.to],
      label,
      async: isAsync,
      direction: edge.direction || 'sync',
      protocol: edge.protocol || 'http',
      dataFlow: edge.dataFlow || '',
      description: edge.description || '',
    };

    // Map edge type to communication type
    if (edge.type === 'guards') flowObj.communicationType = 'dep';
    else if (edge.type === 'auth_check') flowObj.communicationType = 'sync';
    else if (edge.type === 'db_query') flowObj.communicationType = 'sync';
    else flowObj.communicationType = 'sync';

    if (edge.confidence && edge.confidence !== 'high') {
      flowObj.note = edge.confidence === 'medium' ? 'inferred from config' : 'possibly present';
    }

    lines.push(JSON.stringify(flowObj));
  }

  // Output workflow metadata as special annotation lines
  if (workflows && workflows.length > 0) {
    for (const wf of workflows) {
      lines.push(JSON.stringify({
        type: 'workflow',
        name: wf.name,
        description: wf.description,
        steps: wf.steps,
      }));
    }
  }

  return lines.join('\n');
}
