import type { ExtractedNode, RichEdge } from '@/lib/types/repo-diagram';
import {
  applySemanticLayerGroups,
  layoutedNodeToNdjsonRecord,
  sortGroupsBeforeChildren,
} from '@/lib/ai/pipeline/applySemanticLayerGroups';
import type { LayoutedNode } from '@/lib/ai/pipeline/types';
import { calculateNodeDimensions } from '@/lib/utils/nodeSizing';
import { z } from 'zod';
import logger from '@/lib/logger';

// Layer Y positions — ordered top-to-bottom as story layers
const LAYER_Y: Record<string, number> = {
  presentation: 0,
  gateway: 200,
  application: 400,
  data: 600,
  external: 800,
};

const LAYER_GAP = 80;
const COL_GAP = 220;
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

  // Preserve semantic labels from the LLM — they tell the story
  const lower = raw.toLowerCase();
  const genericLabels = new Set(['calls', 'uses', 'queries', 'auth', 'guards', 'routes', 'depends on', 'connects to', 'links to', 'talks to', 'sends data', 'syncs']);
  if (genericLabels.has(lower)) {
    if (type === 'db_query') return 'queries';
    if (type === 'external_call') return 'uses';
    if (type === 'auth_check') return 'auth';
    return lower;
  }

  // Descriptive semantic labels — truncate to 2 words max
  if (raw.length > 3 && raw.length <= 40) {
    const words = raw.split(/\s+/);
    if (words.length > 2) return words.slice(0, 2).join(' ').toLowerCase();
    return raw.toLowerCase();
  }

  // Fallback for very long labels
  if (raw.length > 40) {
    const words = raw.split(/\s+/);
    if (words.length >= 2) {
      return words.slice(0, 2).join(' ').toLowerCase();
    }
    if (type === 'db_query') return 'queries';
    if (type === 'external_call') return 'uses';
    return 'calls';
  }

  return raw.toLowerCase();
}

function getNodeLayerAndType(node: ExtractedNode): { layer: string; icon: string; serviceType: string } {
  // Use explicit layer from node if set (from LLM enrichment)
  if (node.layer) {
    const lc = node.layer.toLowerCase();
    if (['presentation', 'gateway', 'application', 'data', 'external'].includes(lc)) {
      return { layer: lc, icon: iconForLayer(lc), serviceType: serviceTypeForLayer(lc) };
    }
  }

  switch (node.type) {
    case 'PAGE':
    case 'UI_COMPONENT':
    case 'STATE_MANAGEMENT':
      return { layer: 'presentation', icon: 'monitor', serviceType: 'client' };
    case 'MIDDLEWARE':
    case 'AUTH':
    case 'CDN':
    case 'API_GATEWAY':
      return { layer: 'gateway', icon: 'shield', serviceType: 'gateway' };
    case 'API_ROUTE':
    case 'SERVICE':
    case 'CONTROLLER':
    case 'WORKER':
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

function iconForLayer(layer: string): string {
  switch (layer) {
    case 'presentation': return 'monitor';
    case 'gateway': return 'shield';
    case 'application': return 'webhook';
    case 'data': return 'database';
    case 'external': return 'server';
    default: return 'box';
  }
}

function serviceTypeForLayer(layer: string): string {
  switch (layer) {
    case 'presentation': return 'client';
    case 'gateway': return 'gateway';
    case 'application': return 'api';
    case 'data': return 'database';
    case 'external': return 'service';
    default: return 'generic';
  }
}

/**
 * Convert a full node description into a short subtitle suitable for display
 * on the canvas. Strips source-file lists and internal prefixes, then caps at 60 chars.
 */
function descriptionToSubtitle(description: string): string {
  if (!description) return '';

  let subtitle = description
    // Remove "Detected from repository structure (file1, file2)" boilerplate
    .replace(/Detected (?:component )?from (?:repository structure|source evidence)[^.]*\./gi, '')
    // Remove trailing parenthetical source-file lists: (app/api/route.ts, ...)
    .replace(/\s*\([^)]*\.(?:ts|tsx|js|py|go|rs)[^)]*\)/g, '')
    // Remove "X files" references
    .replace(/\(\d+ files?\)/g, '')
    // Remove "entry: file.ts" references
    .replace(/,?\s*entry:\s*[\w./,\s]+/gi, '')
    .trim()
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Strip trailing period/comma
    .replace(/[.,]+$/, '')
    .trim();

  // If nothing useful remains, return empty
  if (!subtitle || subtitle.length < 3) return '';

  // Cap at 60 characters, break on a word boundary
  if (subtitle.length > 60) {
    subtitle = subtitle.slice(0, 60).replace(/\s\S*$/, '').trim() + '…';
  }

  return subtitle;
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
    const subtitle = descriptionToSubtitle(node.description);
    const { width, height } = calculateNodeDimensions(label, subtitle);

    const layouted: LayoutedNode = {
      id: node.id,
      label,
      subtitle,
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
      (record as Record<string, unknown>).note = 'inferred from config';
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

  const validatedLines = validateNdjson(lines);
  return validatedLines.join('\n');
}

const NodeRecordSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});

const EdgeRecordSchema = z.object({
  path: z.array(z.string()).length(2),
  label: z.string().optional(),
  async: z.boolean().optional(),
});

function validateNdjson(lines: string[]): string[] {
  const validatedLines = lines.filter((line) => {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'workflow') return true;
      if (Array.isArray(obj.path)) {
        EdgeRecordSchema.parse(obj);
      } else if (obj.id) {
        NodeRecordSchema.parse(obj);
      } else {
        return true; // group nodes etc — skip validation
      }
      return true;
    } catch {
      logger.warn('[SchemaCompiler] Dropping invalid NDJSON record:', line.slice(0, 80));
      return false;
    }
  });
  return validatedLines;
}
