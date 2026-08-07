import logger from '@/lib/logger';
import type { Node, Edge, MarkerType } from 'reactflow';
import { componentRegistry, type ComponentDefinition } from '@/lib/componentRegistry';
import { resolveNodeIcon } from '@/lib/nodeIconResolver';
import { calculateNodeDimensions } from '@/lib/utils/nodeSizing';
import type { ShapeType } from '@/components/ShapeNode';

/** Palette id for a blank node that opens inline rename on place. */
export const BLANK_INIT_COMPONENT_ID = 'research';

export function isBlankInitComponent(id: string | undefined | null): boolean {
  return id === BLANK_INIT_COMPONENT_ID;
}

/** Map serviceType → canvas silhouette (matches AI / Mermaid build). */
export function shapeForServiceType(serviceType?: string): ShapeType {
  switch (serviceType) {
    case 'database':
      return 'cylinder';
    case 'cache':
      return 'cylinder';
    case 'load-balancer':
    case 'external-service':
      return 'diamond';
    case 'queue':
      return 'circle';
    default:
      return 'rounded-rectangle';
  }
}

/**
 * Create a palette/⌘K node as a shapeNode so it matches AI-generated canvas nodes
 * (not the older systemNode card chrome).
 */
export function createPaletteNode(
  comp: Pick<ComponentDefinition, 'id' | 'label' | 'category' | 'color' | 'icon' | 'technology'>,
  position: { x: number; y: number },
  options?: {
    serviceType?: string;
    blankInit?: boolean;
  },
): Node {
  const blank = options?.blankInit ?? isBlankInitComponent(comp.id);
  const serviceType = options?.serviceType;
  const shape = shapeForServiceType(serviceType);
  const label = blank ? '' : comp.label;
  const { width, height } = calculateNodeDimensions(label || comp.label || 'Node', undefined, {
    shape,
  });

  return createNode(comp.id, label, position, {
    type: 'shapeNode',
    width,
    height,
    data: {
      componentId: comp.id,
      typeId: comp.id,
      componentType: comp.id,
      category: comp.category,
      color: comp.color,
      accentColor: comp.color,
      icon: comp.icon,
      technology: comp.technology,
      serviceType,
      shape,
      nodeWidth: width,
      nodeHeight: height,
      ...(blank ? { label: '', autoStartLabelEdit: true } : {}),
    },
  });
}

// ─── NODE FACTORY ────────────────────────────────────────────

export function createNode(
  typeId: string,
  label: string,
  position = { x: 0, y: 0 },
  extra: Record<string, unknown> = {}
): Node {
  const def = componentRegistry.get(typeId);

  const isBuiltInNode = [
    'textLabelNode',
    'groupNode',
    'annotationNode',
    'heroNode',
    'systemNode',
    'baseNode',
    'architectureNode',
    'databaseNode',
    'cacheNode',
    'shapeNode',
    'messageBrokerNode',
    'customNode',
    'service',
    'database',
    'client',
    'load-balancer',
    'queue',
    'external-service',
    'observability',
  ].includes(typeId);

  if (!def && !isBuiltInNode) {
    logger.warn(`[createNode] Unknown typeId: "${typeId}". 
                  Check components.json.`);
  }

  const { type, data: extraData, ...restExtra } = extra;
  const rawData = (extraData || {}) as Record<string, unknown>;
  const resolvedIcon = resolveNodeIcon({
    label: label ?? def?.label,
    typeId,
    componentType: typeId,
    serviceType: rawData.serviceType as string | undefined,
    technology: (rawData.technology as string | undefined) ?? def?.technology,
    category: (rawData.category as string | undefined) ?? def?.category,
    icon: (rawData.icon as string | undefined) ?? def?.icon,
    color: (rawData.color as string | undefined) ?? def?.color,
  });

  return {
    id: crypto.randomUUID(),
    type: (type as string | undefined) || 'custom',
    position,
    ...restExtra,
    data: {
      typeId,
      componentType: typeId,
      label:    label ?? def?.label ?? 'Unnamed',
      color:    def?.color    ?? '#6366f1',
      category: def?.category ?? 'default',
      ...rawData,
      icon:     resolvedIcon.icon,
      iconSource: resolvedIcon.source,
      technology: resolvedIcon.technology ?? def?.technology,
    },
  };
}

// ─── EDGE FACTORY ────────────────────────────────────────────

export function createEdge(
  source: string,
  target: string,
  label = 'Connection',
  extra: Record<string, unknown> = {}
): Edge {
  return {
    id: `${source}-${target}-${crypto.randomUUID()}`,
    source,
    target,
    type: 'smoothstep',
    animated: true,
    label,
    style: { strokeWidth: 1.5, stroke: '#94a3b8' },
    markerEnd: { type: 'arrowclosed' as MarkerType, color: '#94a3b8' },
    data: { pathType: 'Smoothstep' },
    ...extra,
  };
}
