import logger from '@/lib/logger';
import type { Node, Edge, MarkerType } from 'reactflow';
import { componentRegistry } from '@/lib/componentRegistry';

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

  return {
    id: crypto.randomUUID(),
    type: (type as string | undefined) || 'custom',
    position,
    ...restExtra,
    data: {
      typeId,
      label:    label ?? def?.label ?? 'Unnamed',
      color:    def?.color    ?? '#6366f1',
      category: def?.category ?? 'default',
      icon:     def?.icon     ?? 'Box',
      ...(extraData || {}),
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
    type: 'floating',
    animated: true,
    label,
    style: { strokeWidth: 1.5, stroke: '#94a3b8' },
    markerEnd: { type: 'arrowclosed' as MarkerType, color: '#94a3b8' },
    ...extra,
  };
}
