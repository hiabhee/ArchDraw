import type { Node } from 'reactflow';
import { componentRegistry } from '@/lib/componentRegistry';
import logger from '@/lib/logger';
import { KNOWN_NODE_TYPES, RESERVED_LAYER_LABELS } from '../constants';

const LEGACY_PURPLE = new Set(['#6366f1', '#6366F1', '#8b5cf6', '#a855f7', '#7c3aed']);
const BLUE_REPLACEMENT = '#3b82f6';

function normalizeLegacyColor(color?: string): string | undefined {
  if (!color) return color;
  return LEGACY_PURPLE.has(color) ? BLUE_REPLACEMENT : color;
}

const PASTEL_TO_SATURATED: Record<string, string> = {
  '#eff6ff': '#3b82f6',
  '#f0fdf4': '#22c55e',
  '#fefce8': '#f59e0b',
  '#fdf2f8': '#ec4899',
  '#eef2ff': '#2563eb',
  '#fff7ed': '#f97316',
  '#faf5ff': '#a855f7',
  '#f0fdfa': '#14b8a6',
};

function normalizePastelColor(color?: string): string | undefined {
  if (!color) return color;
  const lower = color.toLowerCase();
  return PASTEL_TO_SATURATED[lower] ?? color;
}

export function stripReservedLayerNodes(nodes: Node[]): Node[] {
  const result: Node[] = [];

  for (const node of nodes) {
    const data = node.data as Record<string, unknown> | undefined;
    const label = typeof data?.label === 'string' ? data.label.toLowerCase().trim() : '';
    const isGroup = data?.isGroup === true;

    if (isGroup) {
      result.push(node);
      continue;
    }

    if (RESERVED_LAYER_LABELS.has(label)) {
      logger.log(`[Store] Stripping reserved layer node: "${data?.label}" (${node.id})`);
      continue;
    }

    result.push(node);
  }

  return result;
}

export function normalizeNodeType(type?: string): string {
  if (!type) return 'systemNode';
  if (type === 'system') return 'systemNode';
  if (!KNOWN_NODE_TYPES.has(type)) return 'systemNode';
  return type;
}

function sortParentsFirst(nodes: Node[]): Node[] {
  // Defensive: parent/group nodes must appear before children to avoid
  // React Flow "Parent node not found" warning and (0,0) flash.
  const ids = new Set(nodes.map((n) => n.id));
  return [...nodes].sort((a, b) => {
    const aHasParent = !!(a.parentId || (a as unknown as { parentNode?: string }).parentNode) && ids.has((a.parentId || (a as unknown as { parentNode?: string }).parentNode)!);
    const bHasParent = !!(b.parentId || (b as unknown as { parentNode?: string }).parentNode) && ids.has((b.parentId || (b as unknown as { parentNode?: string }).parentNode)!);
    return Number(aHasParent) - Number(bHasParent);
  });
}

export function normalizeNodes(nodes: Node[]): Node[] {
  const validNodeIds = new Set(nodes.map((n) => n.id));

  const normalized = nodes.map((node) => {
    const parentId = node.parentId || (node as { parentNode?: string }).parentNode;
    const isValidParent = parentId && validNodeIds.has(parentId);
    // Group zones always render below edges (same rule as createGroup /
    // NodeConverter) so edges crossing into a group stay visible above its
    // translucent surface. Enforce on every load/import so older persisted
    // groups without a zIndex don't cover the edges.
    const isGroup =
      node.type === 'groupNode' ||
      node.type === 'frameNode' ||
      node.type === 'group' ||
      (node.data as { isGroup?: boolean } | undefined)?.isGroup === true;

    return {
      ...node,
      type: normalizeNodeType(node.type as string | undefined),
      ...(isGroup ? { zIndex: -1 } : {}),
      ...(isValidParent
        ? { parentId, parentNode: parentId, extent: node.extent || ('parent' as const) }
        : {
            parentId: undefined,
            parentNode: undefined,
            extent: undefined,
          }),
    };
  });
  return sortParentsFirst(normalized);
}

export function sanitizeNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    const isGroup =
      node.type === 'groupNode' ||
      node.type === 'frameNode' ||
      node.type === 'group' ||
      node.data?.isGroup === true;

    if (isGroup) {
      const rawGroupColor = node.data?.groupColor as string | undefined;
      const rawColor = node.data?.color as string | undefined;
      const groupColorAfterLegacy = normalizeLegacyColor(rawGroupColor) ?? normalizeLegacyColor(rawColor) ?? rawGroupColor ?? rawColor;
      const normalizedGroupColor = normalizePastelColor(groupColorAfterLegacy) ?? groupColorAfterLegacy;
      const colorAfterLegacy = normalizeLegacyColor(rawColor) ?? rawColor;
      const normalizedColor = normalizePastelColor(colorAfterLegacy) ?? colorAfterLegacy;
      return {
        ...node,
        type: node.type || 'groupNode',
        zIndex: -1,
        data: {
          label: node.data?.label || node.data?.groupLabel || 'Group',
          groupLabel: node.data?.groupLabel || node.data?.label || 'Group',
          ...node.data,
          groupColor: normalizedGroupColor ?? rawGroupColor,
          color: normalizedColor ?? rawColor,
          isGroup: true,
        },
      };
    }

    const hasRequired =
      node.data?.typeId &&
      node.data?.color &&
      node.data?.category &&
      node.data?.icon;

    if (!hasRequired) {
      logger.warn(`[sanitize] Node ${node.id} missing fields. Sanitizing in-place.`);
      const data = node.data || {};
      const typeId = (data as { typeId?: string }).typeId ?? 'default';
      const def = componentRegistry.get(typeId);
      return {
        ...node,
        type: node.type || 'systemNode',
        data: {
          ...data,
          typeId,
          label: data.label ?? def?.label ?? 'Unnamed',
          color: normalizeLegacyColor(data.color as string | undefined) ?? normalizeLegacyColor(def?.color) ?? '#3b82f6',
          category: data.category ?? def?.category ?? 'default',
          icon: data.icon ?? def?.icon ?? 'Box',
          accentColor: normalizeLegacyColor((data as { accentColor?: string }).accentColor) ?? (data as { accentColor?: string }).accentColor,
        },
      };
    }
    // Normalize legacy purple on fully-formed nodes (migrate old diagrams)
    const d = node.data as Record<string, unknown> | undefined;
    if (d && (LEGACY_PURPLE.has(d.color as string) || LEGACY_PURPLE.has(d.accentColor as string) || LEGACY_PURPLE.has(d.groupColor as string))) {
      return {
        ...node,
        data: {
          ...d,
          color: normalizeLegacyColor(d.color as string) ?? (d.color as string),
          accentColor: normalizeLegacyColor(d.accentColor as string) ?? (d.accentColor as string),
          groupColor: normalizeLegacyColor(d.groupColor as string) ?? (d.groupColor as string),
        },
      };
    }
    return node;
  });
}
