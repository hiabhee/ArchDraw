import type { Node } from 'reactflow';
import { componentRegistry } from '@/lib/componentRegistry';
import logger from '@/lib/logger';
import { KNOWN_NODE_TYPES, RESERVED_LAYER_LABELS } from '../constants';

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

export function normalizeNodes(nodes: Node[]): Node[] {
  const validNodeIds = new Set(nodes.map((n) => n.id));

  return nodes.map((node) => {
    const parentId = node.parentId || (node as { parentNode?: string }).parentNode;
    const isValidParent = parentId && validNodeIds.has(parentId);

    return {
      ...node,
      type: normalizeNodeType(node.type as string | undefined),
      ...(isValidParent
        ? { parentId, parentNode: parentId, extent: node.extent || ('parent' as const) }
        : {
            parentId: undefined,
            parentNode: undefined,
            extent: undefined,
          }),
    };
  });
}

export function sanitizeNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    const isGroup =
      node.type === 'groupNode' ||
      node.type === 'frameNode' ||
      node.type === 'group' ||
      node.data?.isGroup === true;

    if (isGroup) {
      return {
        ...node,
        type: node.type || 'groupNode',
        data: {
          label: node.data?.label || node.data?.groupLabel || 'Group',
          groupLabel: node.data?.groupLabel || node.data?.label || 'Group',
          ...node.data,
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
          typeId,
          label: data.label ?? def?.label ?? 'Unnamed',
          color: data.color ?? def?.color ?? '#6366f1',
          category: data.category ?? def?.category ?? 'default',
          icon: data.icon ?? def?.icon ?? 'Box',
          ...data,
        },
      };
    }
    return node;
  });
}
