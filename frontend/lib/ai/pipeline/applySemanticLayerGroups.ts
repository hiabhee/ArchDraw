import type { LayoutedNode, PipelineLayer } from './types';

export interface SemanticGroupMeta {
  label: string;
  color: string;
  layer: PipelineLayer;
}

/** Canonical layer buckets — saturated per original design; GroupBackgroundLayer lightens to pastel for neubrutalism via toPastel(). */
export const SEMANTIC_GROUP_META: Record<string, SemanticGroupMeta> = {
  client: { label: 'Presentation', color: '#3b82f6', layer: 'client' },
  presentation: { label: 'Presentation', color: '#3b82f6', layer: 'presentation' },
  edge: { label: 'Edge / CDN', color: '#f59e0b', layer: 'edge' },
  gateway: { label: 'Authentication / Security', color: '#d97706', layer: 'gateway' },
  application: { label: 'Business Services', color: '#2563eb', layer: 'application' },
  queue: { label: 'Async / Messaging', color: '#3b82f6', layer: 'queue' },
  data: { label: 'Data Stores', color: '#10b981', layer: 'data' },
  observability: { label: 'Observability', color: '#64748b', layer: 'observability' },
  external: { label: 'External Services', color: '#f97316', layer: 'external' },
};

export interface ApplySemanticLayerGroupsOptions {
  /** Minimum leaf nodes required to create a group (default 2). */
  minNodesPerGroup?: number;
  /** Side/bottom padding around grouped children in px (default 60). */
  padding?: number;
  /** Top padding in px — extra clearance for the label tag (default 72). */
  paddingTop?: number;
}

function normalizeLayer(layer?: string): string {
  if (!layer) return 'application';
  const clean = layer.toLowerCase().trim().replace(/[\s-]/g, '');

  if (clean === 'presentation' || clean === 'client' || clean === 'frontend') return 'client';
  if (clean === 'edge' || clean === 'infrastructure') return 'edge';
  if (clean === 'gateway') return 'gateway';
  if (clean === 'compute' || clean === 'application' || clean === 'compute/application') return 'application';
  if (clean === 'async' || clean === 'queue') return 'queue';
  if (clean === 'data' || clean === 'cache' || clean === 'storage') return 'data';
  if (clean === 'observe' || clean === 'observability' || clean === 'monitoring') return 'observability';
  if (clean === 'thirdparty' || clean === 'external') return 'external';

  if (clean.includes('client') || clean.includes('present') || clean.includes('frontend')) return 'client';
  if (clean.includes('edge') || clean.includes('infra')) return 'edge';
  if (clean.includes('gate')) return 'gateway';
  if (clean.includes('compute') || (clean.includes('app') && !clean.includes('frontend'))) return 'application';
  if (clean.includes('async') || clean.includes('queue') || clean.includes('bus') || clean.includes('stream')) return 'queue';
  if (clean.includes('data') || clean.includes('db') || clean.includes('cache') || clean.includes('store') || clean.includes('sql') || clean.includes('mongo')) return 'data';
  if (clean.includes('observe') || clean.includes('monitor') || clean.includes('log') || clean.includes('trace') || clean.includes('alert')) return 'observability';
  if (clean.includes('third') || clean.includes('ext') || clean.includes('api') || clean.includes('vendor')) return 'external';

  return 'application';
}

export function getSemanticGroupKey(node: Pick<LayoutedNode, 'layer' | 'label'>): string {
  return normalizeLayer(node.layer);
}

/**
 * Wraps leaf nodes that share a semantic layer into groupNode containers.
 * Children are repositioned parent-relative (React Flow convention).
 */
export function applySemanticLayerGroups(
  nodes: LayoutedNode[],
  options: ApplySemanticLayerGroupsOptions = {}
): LayoutedNode[] {
  const minNodesPerGroup = options.minNodesPerGroup ?? 2;
  // Side/bottom padding. Top gets extra to clear the label tag (~28px) + breathing room so node never kisses title.
  const PAD_SIDE = options.padding    ?? 14;
  const PAD_TOP  = options.paddingTop ?? 36;
  const PAD_BOT  = PAD_SIDE;

  const existingGroups = nodes.filter((n) => n.isGroup);
  const alreadyGrouped = nodes.filter((n) => !n.isGroup && n.parentId);
  const ungroupedLeaves = nodes.filter((n) => !n.isGroup && !n.parentId);

  const buckets = new Map<string, LayoutedNode[]>();
  for (const node of ungroupedLeaves) {
    const key = getSemanticGroupKey(node);
    const list = buckets.get(key) ?? [];
    list.push(node);
    buckets.set(key, list);
  }

  const newGroups: LayoutedNode[] = [];
  const resultLeaves: LayoutedNode[] = [...alreadyGrouped];
  let groupSeq = 0;

  for (const [key, members] of buckets) {
    if (members.length < minNodesPerGroup) {
      resultLeaves.push(...members);
      continue;
    }

    const meta = SEMANTIC_GROUP_META[key] ?? SEMANTIC_GROUP_META.application;
    const groupId = `group-${key}-${groupSeq++}`;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const child of members) {
      minX = Math.min(minX, child.x);
      minY = Math.min(minY, child.y);
      maxX = Math.max(maxX, child.x + child.width);
      maxY = Math.max(maxY, child.y + child.height);
    }

    const groupX      = minX - PAD_SIDE;
    const groupY      = minY - PAD_TOP;
    const groupWidth  = maxX - minX + 2 * PAD_SIDE;
    const groupHeight = maxY - minY + PAD_TOP + PAD_BOT;

    newGroups.push({
      id: groupId,
      label: meta.label,
      layer: meta.layer,
      isGroup: true,
      groupLabel: meta.label,
      groupColor: meta.color,
      x: groupX,
      y: groupY,
      width: groupWidth,
      height: groupHeight,
    });

    for (const child of members) {
      resultLeaves.push({
        ...child,
        parentId: groupId,
        x: child.x - groupX,
        y: child.y - groupY,
      });
    }
  }

  return sortGroupsBeforeChildren([...existingGroups, ...newGroups, ...resultLeaves]);
}

/** Groups must precede children for React Flow and NDJSON import. */
export function sortGroupsBeforeChildren(nodes: LayoutedNode[]): LayoutedNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isGroup && !b.isGroup) return -1;
    if (!a.isGroup && b.isGroup) return 1;
    return 0;
  });
}

export function layoutedNodeToNdjsonRecord(node: LayoutedNode): Record<string, unknown> {
  const record: Record<string, unknown> = {
    id: node.id,
    label: node.label,
    layer: node.layer,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };

  if (node.subtitle) record.subtitle = node.subtitle;
  if (node.icon) record.icon = node.icon;
  if (node.serviceType) record.serviceType = node.serviceType;
  if (node.isGroup) {
    record.isGroup = true;
    record.groupLabel = node.groupLabel ?? node.label;
    if (node.groupColor) record.groupColor = node.groupColor;
  }
  if (node.parentId) record.parentId = node.parentId;

  return record;
}
