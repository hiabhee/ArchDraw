import type { FormatConfig, StyleConfig, InventoryConfig, EdgeConfig } from '@/lib/ai/pipeline/mermaid-pipeline/types'
import { applyLayout } from './layout'
import { sizeSubgraphs } from './subgraphSizing'
import type { RFObjects, RFNode, RFEdge } from './types'
import { NODE_WIDTH, NODE_HEIGHT, SUBGRAPH_PADDING } from './types'
import { hexToRgba } from '@/lib/utils'
import type { Node, Edge } from 'reactflow'
import logger from '@/lib/logger'

function toNodeId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'node'
}

export function getDeterministicColor(str: string): string {
  const colors = ['#a855f7', '#22c55e', '#ec4899', '#f97316', '#14b8a6', '#3b82f6', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}


// ── Unified classification — single source of truth for shape + serviceType ──

export interface NodeClassification {
  shape: string
  serviceType: string
}

export function classifyNode(name: string, groupName?: string): NodeClassification {
  const lower = name.toLowerCase()

  // 1. Name-based primary check (high-confidence visual symbols)
  if (
    lower.includes('database') || lower.includes('db') ||
    lower.includes('cache') || lower.includes('redis') ||
    lower.includes('postgres') || lower.includes('mysql') ||
    lower.includes('mongodb') || lower.includes('dynamodb') ||
    lower.includes('cassandra') || lower.includes('data store') ||
    lower.includes('lake') || lower.includes('store') ||
    lower.includes('storage') || lower.includes('warehouse') ||
    lower.includes('s3') || lower.includes('bucket') ||
    lower.includes('firestore')
  ) return { shape: 'cylinder', serviceType: 'database' }

  if (
    lower.includes('load balancer') || lower.includes('lb') ||
    lower.includes('gateway') || lower.includes('api gateway') ||
    lower.includes('proxy') || lower.includes('ingress') ||
    lower.includes('traff') || lower.includes('gw')
  ) return { shape: 'diamond', serviceType: 'load-balancer' }

  if (
    lower.includes('queue') || lower.includes('broker') ||
    lower.includes('kafka') || lower.includes('rabbitmq') ||
    lower.includes('message bus') || lower.includes('event') ||
    lower.includes('pub/sub') || lower.includes('stream') ||
    lower.includes('topic') || lower.includes('mq')
  ) return { shape: 'circle', serviceType: 'queue' }

  if (
    lower.includes('external') || lower.includes('third party') ||
    lower.includes('saas') || lower.includes('cdn') ||
    lower.includes('cloud') || lower.includes('vpc')
  ) return { shape: 'hexagon', serviceType: 'external-service' }

  if (
    lower === 'user' || lower === 'client' ||
    lower.includes('browser') || lower.includes('mobile') ||
    lower.includes('desktop') || lower.includes('app')
  ) return { shape: 'rounded', serviceType: 'client' }

  if (
    lower.includes('log') || lower.includes('monitor') ||
    lower.includes('observability') || lower.includes('metric') ||
    lower.includes('tracing') || lower.includes('alert')
  ) return { shape: 'rounded', serviceType: 'observability' }

  // 2. Group name fallback (if name is ambiguous/generic, e.g. "Auth" or "Billing")
  if (groupName) {
    const g = groupName.toLowerCase()
    if (g.includes('client')) {
      return { shape: 'rounded', serviceType: 'client' }
    }
    if (g.includes('data') || g.includes('storage') || g.includes('database')) {
      return { shape: 'cylinder', serviceType: 'database' }
    }
    if (g.includes('gateway') || g.includes('lb') || g.includes('load')) {
      return { shape: 'diamond', serviceType: 'load-balancer' }
    }
    if (g.includes('observability') || g.includes('monitor') || g.includes('log')) {
      return { shape: 'rounded', serviceType: 'observability' }
    }
  }

  // 3. Absolute fallback
  return { shape: 'rounded', serviceType: 'service' }
}

export const SERVICE_TYPE_META: Record<string, { typeId: string; icon: string; category: string }> = {
  'database':         { typeId: 'database',         icon: 'Database',  category: 'data' },
  'load-balancer':    { typeId: 'load-balancer',    icon: 'GitBranch', category: 'networking' },
  'queue':            { typeId: 'queue',             icon: 'Inbox',     category: 'messaging' },
  'external-service': { typeId: 'external-service',  icon: 'Globe',     category: 'external' },
  'client':           { typeId: 'client',            icon: 'Monitor',   category: 'client' },
  'observability':    { typeId: 'observability',     icon: 'Activity',  category: 'observability' },
  'service':          { typeId: 'service',           icon: 'Box',       category: 'compute' },
}

// Category-based color overrides (applied on top of theme primary color)
export const CATEGORY_COLORS: Record<string, string> = {
  'data':           '#1e293b',
  'networking':     '#4F46E5',
  'messaging':      '#0891b2',
  'external':       '#64748b',
  'client':         '#2563EB',
  'observability':  '#475569',
  'compute':        '#4F46E5',
}


export function translatePlanToReactFlow(
  formatConfig: FormatConfig,
  styleConfig: StyleConfig,
  inventoryConfig: InventoryConfig,
  edgeConfig: EdgeConfig,
  groupAssignments: Record<string, string>,
): { nodes: Node[]; edges: Edge[] } {
  const { nodes: nodeNames, groups } = inventoryConfig
  const { edges: rawEdges } = edgeConfig
  const diagramType = formatConfig.diagramType
  const direction = diagramType === 'graph LR' ? 'LR' as const : 'TD' as const

  // ── Deduplicate: detect node names that normalize to the same ID ──
  const idOccurrences = new Map<string, string[]>()
  for (const name of nodeNames) {
    const id = toNodeId(name)
    if (!idOccurrences.has(id)) idOccurrences.set(id, [])
    idOccurrences.get(id)!.push(name)
  }
  for (const [id, names] of idOccurrences) {
    if (names.length > 1) {
      logger.warn(`[planTranslator] Multiple nodes normalize to same ID "${id}": ${names.join(', ')} — using first occurrence, others dropped`)
    }
  }

  // Deduplicated node list (first occurrence wins)
  const seenIds = new Set<string>()
  const dedupedNodeNames: string[] = []
  for (const name of nodeNames) {
    const id = toNodeId(name)
    if (!seenIds.has(id)) {
      seenIds.add(id)
      dedupedNodeNames.push(name)
    }
  }

  const groupNodes: Record<string, string[]> = {}
  for (const nodeName of dedupedNodeNames) {
    const group = groupAssignments[nodeName] || 'Default Layer'
    if (!groupNodes[group]) groupNodes[group] = []
    groupNodes[group].push(nodeName)
  }

  // Build RFObjects for dagre layout
  const rfNodes: RFNode[] = []
  const rfEdges: RFEdge[] = []

  // Create group nodes first (subgraphs)
  const nodeToGroupMap = new Map<string, string>()
  for (const [groupName, members] of Object.entries(groupNodes)) {
    const groupId = toNodeId(groupName)
    for (const member of members) {
      nodeToGroupMap.set(member, groupId)
    }

    const deterministicColor = getDeterministicColor(groupId)

    rfNodes.push({
      id: groupId,
      type: 'groupNode',
      position: { x: 0, y: 0 },
      data: {
        label: groupName,
        groupLabel: groupName,
        isGroup: true,
        typeId: 'group',
        color: deterministicColor,
        category: 'group',
        icon: 'Box',
      },
      style: {
        width: NODE_WIDTH + SUBGRAPH_PADDING * 2,
        height: NODE_HEIGHT + 64 + SUBGRAPH_PADDING,
      },
      zIndex: -1,
    })
  }

  // Create leaf nodes
  for (const nodeName of dedupedNodeNames) {
    const id = toNodeId(nodeName)
    const groupName = groupAssignments[nodeName]
    const { shape, serviceType } = classifyNode(nodeName, groupName)

    const parentGroupId = nodeToGroupMap.get(nodeName)
    const config = {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }

    const meta = SERVICE_TYPE_META[serviceType] || SERVICE_TYPE_META['service']
    const categoryColor = CATEGORY_COLORS[meta.category] || styleConfig.primaryColor

    const rfNode: RFNode = {
      id,
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      data: {
        label: nodeName,
        shape: shape === 'rounded' ? 'rounded-rectangle' : shape,
        serviceType,
        nodeWidth: config.width,
        nodeHeight: config.height,
        typeId: meta.typeId,
        color: categoryColor,
        category: meta.category,
        icon: meta.icon,
      },
      width: config.width,
      height: config.height,
    }

    if (parentGroupId) {
      rfNode.parentNode = parentGroupId
      rfNode.extent = 'parent'
    }

    rfNodes.push(rfNode)
  }

  // Create edges with collision-resistant IDs (include label to allow parallel edges)
  const edgeIdSet = new Set<string>()
  for (const edge of rawEdges) {
    const fromId = toNodeId(edge.from)
    const toId = toNodeId(edge.to)
    if (fromId === toId) {
      logger.warn(`[planTranslator] Self-loop edge dropped: "${edge.from}" → "${edge.to}" (both normalize to "${fromId}")`)
      continue
    }
    if (!edge.label) {
      logger.warn(`[planTranslator] Edge with empty label dropped: "${edge.from}" → "${edge.to}"`)
      continue
    }

    const labelPart = edge.label.replace(/[^a-z0-9]+/gi, '-').slice(0, 30)
    let edgeId = `${fromId}->${toId}`
    if (labelPart) edgeId += `-${labelPart}`

    // Deduplicate edges with same from+to+label
    if (edgeIdSet.has(edgeId)) {
      logger.warn(`[planTranslator] Duplicate edge dropped: "${edge.from}" → "${edge.to}" ("${edge.label}")`)
      continue
    }
    edgeIdSet.add(edgeId)

    rfEdges.push({
      id: edgeId,
      source: fromId,
      target: toId,
      sourceHandle: null,
      targetHandle: null,
      type: 'simpleFloating',
      label: edge.label,
      data: {
        label: edge.label,
        connectionType: 'sync',
        edgeVariant: 'solid',
      },
    })
  }

  // ── Apply dagre layout with error boundary ──
  let layouted: RFObjects
  try {
    const rfObjects: RFObjects = { nodes: rfNodes, edges: rfEdges }
    layouted = applyLayout(rfObjects, direction)
  } catch (err) {
    logger.error('[planTranslator] Layout failed, falling back to un-laid-out nodes:', err)
    layouted = { nodes: rfNodes, edges: rfEdges }
  }

  // ── Size subgraph containers with error boundary ──
  let sized: RFNode[]
  try {
    sized = sizeSubgraphs(layouted.nodes)
  } catch (err) {
    logger.error('[planTranslator] Subgraph sizing failed, using layout positions as-is:', err)
    sized = layouted.nodes
  }

  // Apply styling
  const subgraphIds = new Set(Object.keys(groupNodes).map(toNodeId))

  const styledNodes: Node[] = sized.map(node => {
    const isSubgraph = subgraphIds.has(node.id) || node.type === 'groupNode'
    if (isSubgraph) {
      const deterministicColor = getDeterministicColor(node.id)
      return {
        ...node,
        type: 'frameNode',
        data: {
          ...node.data,
          groupColor: deterministicColor,
          isGroup: true,
          style: {
            backgroundColor: hexToRgba(deterministicColor, 0.08),
            borderColor: deterministicColor,
            borderRadius: '12px',
          },
        },
      } as Node
    }
    const nodeColor = (node.data as Record<string, unknown>)?.color as string || styleConfig.primaryColor
    return {
      ...node,
      type: 'shapeNode',
      data: {
        ...node.data,
        style: {
          backgroundColor: nodeColor,
          color: '#FFFFFF',
          borderRadius: '8px',
          fontFamily: styleConfig.fontFamily,
        },
      },
    } as Node
  })

  const styledEdges: Edge[] = layouted.edges.map(edge => ({
    ...edge,
    type: 'simpleFloating',
    markerEnd: { type: 'ArrowClosed', width: 24, height: 24 },
    style: {
      stroke: styleConfig.secondaryColor,
      strokeWidth: 2.5,
    },
    labelStyle: {
      fontSize: 12,
      fontFamily: styleConfig.fontFamily,
      fill: styleConfig.secondaryColor,
      fontWeight: 500,
    },
  })) as any as Edge[]

  return { nodes: styledNodes, edges: styledEdges }
}
