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

  // 5. Accuracy Guardrails
  for (const edge of edges) {
    const src = nodes.find(n => n.id === edge.source)
    const tgt = nodes.find(n => n.id === edge.target)
    if (src && tgt) {
      const srcService = src.data?.serviceType as string || 'service'
      const tgtService = tgt.data?.serviceType as string || 'service'
      const srcLabel = src.data?.label as string || src.id
      const tgtLabel = tgt.data?.label as string || tgt.id
      const edgeLabel = (edge.data?.label as string || edge.label || '').toLowerCase()

      // 5a. Initiator Guardrail
      if (srcService === 'database' && tgtService !== 'database' && tgtService !== 'observability' && tgtService !== 'external-service') {
        const isCDC = edgeLabel.includes('cdc') || edgeLabel.includes('stream') || edgeLabel.includes('replication') || edgeLabel.includes('sync') || edgeLabel.includes('event') || edgeLabel.includes('publish')
        if (!isCDC) {
          warnings.push({
            type: 'DATABASE_INITIATOR',
            edgeId: edge.id,
            message: `Database component "${srcLabel}" should not initiate request flow to "${tgtLabel}" (unless using CDC/replication).`
          })
        }
      }

      // 5b. Security Guardrail
      if (srcService === 'client' && tgtService === 'database') {
        warnings.push({
          type: 'CLIENT_DIRECT_TO_DB',
          edgeId: edge.id,
          message: `Client "${srcLabel}" connects directly to Database "${tgtLabel}". Clients should route through API services/backends.`
        })
      }

      // 5c. Async Protocol Guardrail
      if (tgtService === 'queue' && edge.data?.connectionType === 'sync') {
        warnings.push({
          type: 'SYNC_TO_QUEUE',
          edgeId: edge.id,
          message: `Sync connection to Queue "${tgtLabel}". Connections to message queues/streams should be asynchronous.`
        })
      }
    }
  }

  return { passed: warnings.length === 0, warnings }
}
