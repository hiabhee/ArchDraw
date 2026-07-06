import type { RFNode, RFEdge, ValidationReport, ValidationWarning, Direction } from './types'

const labelArtifacts = ['-->', '---', ' -- ', '|', '["']

export function validateDiagramOutput(nodes: RFNode[], edges: RFEdge[], direction?: Direction): ValidationReport {
  const warnings: ValidationWarning[] = []
  const nodeIds = new Set(nodes.map(n => n.id))

  // 1. Node label artifacts
  for (const node of nodes) {
    if (node.type === 'groupNode') continue
    const label = (node.data?.label as string) ?? ''
    if (labelArtifacts.some(a => label.includes(a))) {
      warnings.push({ type: 'NODE_LABEL_ARTIFACT', nodeId: node.id, message: `Node ${node.id} label contains edge syntax: "${label}"` })
    }
  }

  // 2. Edge label missing
  for (const edge of edges) {
    if (edge.data?.expectedLabel && !edge.label) {
      warnings.push({ type: 'EDGE_LABEL_MISSING', edgeId: edge.id, message: `Edge ${edge.id} expected label but got none` })
    }
  }

  // 3. Layout direction check
  const parentChildEdges = edges.filter(e => {
    const src = nodes.find(n => n.id === e.source)
    const tgt = nodes.find(n => n.id === e.target)
    return src && tgt && !src.parentNode && !tgt.parentNode
  })
  for (const edge of parentChildEdges) {
    const src = nodes.find(n => n.id === edge.source)
    const tgt = nodes.find(n => n.id === edge.target)
    if (src && tgt) {
      const dir = direction || 'TD'
      if (dir === 'LR') {
        if (src.position.x >= tgt.position.x) {
          warnings.push({ type: 'LAYOUT_DIRECTION_FAILURE', edgeId: edge.id, message: `Edge ${edge.id}: source ${edge.source} not to the left of target ${edge.target}` })
        }
      } else if (dir === 'RL') {
        if (src.position.x <= tgt.position.x) {
          warnings.push({ type: 'LAYOUT_DIRECTION_FAILURE', edgeId: edge.id, message: `Edge ${edge.id}: source ${edge.source} not to the right of target ${edge.target}` })
        }
      } else if (dir === 'BT') {
        if (src.position.y <= tgt.position.y) {
          warnings.push({ type: 'LAYOUT_DIRECTION_FAILURE', edgeId: edge.id, message: `Edge ${edge.id}: source ${edge.source} not below target ${edge.target}` })
        }
      } else { // TD or TB
        if (src.position.y >= tgt.position.y) {
          warnings.push({ type: 'LAYOUT_DIRECTION_FAILURE', edgeId: edge.id, message: `Edge ${edge.id}: source ${edge.source} not above target ${edge.target}` })
        }
      }
    }
  }

  // 4. Orphaned parentNode
  for (const node of nodes) {
    if (node.parentNode && !nodeIds.has(node.parentNode)) {
      warnings.push({ type: 'ORPHANED_NODE', nodeId: node.id, message: `Node ${node.id} parentNode '${node.parentNode}' missing` })
    }
  }

  // 5. Handle assignment (optional — store's distributeTargetHandles assigns these on import)
  // Edge component (SimpleFloatingEdge) computes its own positions at runtime, so null handles are fine.

  return { passed: warnings.length === 0, warnings }
}
