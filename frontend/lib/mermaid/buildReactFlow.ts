import { classifyNode, SERVICE_TYPE_META, CATEGORY_COLORS, getDeterministicColor } from './planTranslator'
import type { MermaidAST, RFObjects, RFNode, RFEdge } from './types'
import { NODE_WIDTH, NODE_HEIGHT } from './types'
import { calculateNodeDimensions } from '../utils/nodeSizing'
import { classifyEdge } from './edgeClassifier'
import { resolveNodeIcon } from '@/lib/nodeIconResolver'
const ARROW_MARKER = 'arrowclosed'

export function buildReactFlowObjects(ast: MermaidAST): RFObjects {
  const nodes: RFNode[] = []
  const edges: RFEdge[] = []
  const subgraphNodes = new Set(ast.subgraphs.map(s => s.id))

  // Create subgraph nodes first (parents must exist before children)
  for (const sub of ast.subgraphs) {
    const rfNode: RFNode = {
      id: sub.id,
      type: 'groupNode',
      position: { x: 0, y: 0 },
      data: {
        label: sub.label,
        groupLabel: sub.label,
        isGroup: true,
        color: getDeterministicColor(sub.id),
      },
      style: {
        width: NODE_WIDTH + 40,
        height: NODE_HEIGHT + 40,
      },
      zIndex: -1,
    }

    // Only set parent reference if parent exists in subgraphs
    if (sub.parentId && subgraphNodes.has(sub.parentId)) {
      rfNode.parentNode = sub.parentId
      rfNode.extent = 'parent'
    }

    nodes.push(rfNode)
  }

  // Create leaf nodes
  for (const pNode of ast.nodes) {
    let label = pNode.label
    let subtitle = ''
    const brRegex = /<br\s*\/?>/i
    if (brRegex.test(label)) {
      const parts = label.split(brRegex)
      label = parts[0].trim()
      subtitle = parts.slice(1).join(' \u00B7 ').trim()
    }

    const { width, height } = calculateNodeDimensions(label, subtitle)
    
    // Find parent group name for classification
    let parentGroupName: string | undefined
    if (pNode.subgraphId) {
      const sub = ast.subgraphs.find(s => s.id === pNode.subgraphId)
      if (sub) {
        parentGroupName = sub.label
      }
    }

    const { shape: classifiedShape, serviceType } = classifyNode(label, parentGroupName)
    const finalShape = pNode.shape !== 'rectangle' ? pNode.shape : classifiedShape

    const meta = SERVICE_TYPE_META[serviceType] || SERVICE_TYPE_META['service']
    const categoryColor = CATEGORY_COLORS[meta.category] || '#6366f1'
    const resolvedIcon = resolveNodeIcon({
      label,
      typeId: meta.typeId,
      componentType: meta.typeId,
      serviceType,
      category: meta.category,
      color: categoryColor,
    })

    const rfNode: RFNode = {
      id: pNode.id,
      type: 'shapeNode',
      position: { x: 0, y: 0 },
      data: {
        label,
        subtitle,
        sublabel: subtitle,
        shape: finalShape === 'rounded' ? 'rounded-rectangle' : finalShape,
        nodeWidth: width,
        nodeHeight: height,
        serviceType,
        typeId: meta.typeId,
        color: categoryColor,
        category: meta.category,
        icon: resolvedIcon.icon,
        iconSource: resolvedIcon.source,
        technology: resolvedIcon.technology,
      },
      width,
      height,
    }

    // Only set parent reference if subgraph parent exists
    if (pNode.subgraphId && subgraphNodes.has(pNode.subgraphId)) {
      rfNode.parentNode = pNode.subgraphId
      rfNode.extent = 'parent'
    }

    nodes.push(rfNode)
  }

  // Create edges
  for (const pEdge of ast.edges) {
    const srcNode = nodes.find(n => n.id === pEdge.source);
    const tgtNode = nodes.find(n => n.id === pEdge.target);
    const semantics = srcNode && tgtNode 
      ? classifyEdge(srcNode, tgtNode, pEdge.label ?? '', pEdge.type)
      : { importance: 'secondary' as const, syncAsync: 'sync' as const, protocol: 'HTTP' };

    const edgeVariant = pEdge.type === 'dotted' ? 'dashed'
      : pEdge.type === 'thick' ? 'thick'
      : pEdge.type === 'open' ? 'dashed'
      : pEdge.type === 'bidirectional' ? 'bidirectional'
      : 'solid'

    const rfEdge: RFEdge = {
      id: pEdge.id,
      source: pEdge.source,
      target: pEdge.target,
      sourceHandle: null,
      targetHandle: null,
      type: 'simpleFloating',
      label: pEdge.label ?? undefined,
      markerStart: pEdge.type === 'bidirectional' ? { type: ARROW_MARKER } : undefined,
      markerEnd: { type: ARROW_MARKER },
      data: {
        label: pEdge.label ?? undefined,
        connectionType: pEdge.type === 'dotted' ? 'async' : 'sync',
        edgeVariant,
        importance: semantics.importance,
        syncAsync: semantics.syncAsync,
        portType: semantics.portType,
        protocol: semantics.protocol,
      },
    }
    edges.push(rfEdge)
  }

  return { nodes, edges }
}
