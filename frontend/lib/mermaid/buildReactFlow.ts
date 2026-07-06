import { classifyNode, SERVICE_TYPE_META, CATEGORY_COLORS, getDeterministicColor } from './planTranslator'
import type { MermaidAST, RFObjects, RFNode, RFEdge } from './types'
import { NODE_WIDTH, NODE_HEIGHT } from './types'
import { calculateNodeDimensions } from '../utils/nodeSizing'


export function buildReactFlowObjects(ast: MermaidAST): RFObjects {
  const nodes: RFNode[] = []
  const edges: RFEdge[] = []
  const subgraphNodes = new Set(ast.subgraphs.map(s => s.id))

  // Create subgraph nodes
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
      subtitle = parts.slice(1).join(' ').trim()
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
        icon: meta.icon,
      },
      width,
      height,
    }

    if (pNode.subgraphId && subgraphNodes.has(pNode.subgraphId)) {
      rfNode.parentNode = pNode.subgraphId
      rfNode.extent = 'parent'
    }

    nodes.push(rfNode)
  }


  // Create edges
  for (const pEdge of ast.edges) {
    const rfEdge: RFEdge = {
      id: pEdge.id,
      source: pEdge.source,
      target: pEdge.target,
      sourceHandle: null,
      targetHandle: null,
      type: 'simpleFloating',
      label: pEdge.label ?? undefined,
      data: {
        label: pEdge.label ?? undefined,
        connectionType: pEdge.type === 'dotted' ? 'async' : 'sync',
        edgeVariant: pEdge.type === 'dotted' ? 'dashed' : 'solid',
      },
    }
    edges.push(rfEdge)
  }

  return { nodes, edges }
}
