import type { RFNode, RFEdge, ValidationReport, ValidationWarning, Direction } from './types'
import { isTextNode } from './textNodes'
import { classifyNode } from './planTranslator'
import { isVerbNodeLabel } from './sanitize'
import { isReturnInteraction } from '@/lib/ai/pipeline/mermaid-pipeline/diagramIntent'

// Pipes are legitimate inside quoted labels ("Kafka | Redpanda").
const labelArtifacts = ['-->', '---', ' -- ', '["']

export function validateDiagramOutput(nodes: RFNode[], edges: RFEdge[], direction?: Direction): ValidationReport {
  const warnings: ValidationWarning[] = []
  const nodeIds = new Set(nodes.map(n => n.id))
  const nodesById = new Map(nodes.map(node => [node.id, node]))
  const absolutePosition = (node: RFNode) => {
    let x = node.position.x
    let y = node.position.y
    let parentId = node.parentNode
    const visited = new Set([node.id])
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId)
      const parent = nodesById.get(parentId)
      if (!parent) break
      x += parent.position.x
      y += parent.position.y
      parentId = parent.parentNode
    }
    return { x, y }
  }

  // 1. Node label artifacts (free-text labels may contain `|` or `-->` legitimately)
  for (const node of nodes) {
    if (node.type === 'groupNode' || isTextNode(node)) continue
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
  for (const edge of edges) {
    const src = nodesById.get(edge.source)
    const tgt = nodesById.get(edge.target)
    if (src && tgt) {
      const label = String(edge.data?.label ?? edge.label ?? '').toLowerCase()
      const isReverseOrAsync = isReturnInteraction(label) ||
        edge.data?.syncAsync === 'async' ||
        edge.data?.connectionType === 'async'
      // A response or event may intentionally run against the primary layout
      // direction. Its arrow still communicates direction without making the
      // diagram's top-level request flow invalid.
      if (isReverseOrAsync) continue
      const sourcePosition = absolutePosition(src)
      const targetPosition = absolutePosition(tgt)
      const dir = direction || 'TD'
      if (dir === 'LR') {
        if (sourcePosition.x >= targetPosition.x) {
          warnings.push({ type: 'LAYOUT_DIRECTION_FAILURE', edgeId: edge.id, message: `Edge ${edge.id}: source ${edge.source} not to the left of target ${edge.target}` })
        }
      } else if (dir === 'RL') {
        if (sourcePosition.x <= targetPosition.x) {
          warnings.push({ type: 'LAYOUT_DIRECTION_FAILURE', edgeId: edge.id, message: `Edge ${edge.id}: source ${edge.source} not to the right of target ${edge.target}` })
        }
      } else if (dir === 'BT') {
        if (sourcePosition.y <= targetPosition.y) {
          warnings.push({ type: 'LAYOUT_DIRECTION_FAILURE', edgeId: edge.id, message: `Edge ${edge.id}: source ${edge.source} not below target ${edge.target}` })
        }
      } else { // TD or TB
        if (sourcePosition.y >= targetPosition.y) {
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

      // 5d. General tier-reversal: Service/DB/Queue/Cache -> Gateway is backward (allow Auth returns)
      {
        const downstream = new Set(['service', 'function', 'container', 'cache', 'database', 'queue', 'storage']);
        // Re-classify if serviceType missing or generic — use label-based classify
        const srcClassified = src.data?.serviceType ? srcService : classifyNode(srcLabel, undefined).serviceType;
        const tgtClassified = tgt.data?.serviceType ? tgtService : classifyNode(tgtLabel, undefined).serviceType;
        if (downstream.has(srcClassified) && tgtClassified === 'load-balancer') {
          warnings.push({
            type: 'TIER_REVERSAL',
            edgeId: edge.id,
            message: `Backward tier edge: "${srcLabel}" (${srcClassified}) -> Gateway "${tgtLabel}" — services must not target gateway.`,
          });
        }
      }
    }
  }

  // 6. General verb-node detection (any prompt)
  for (const node of nodes) {
    if (node.type === 'groupNode' || isTextNode(node)) continue;
    const label = (node.data?.label as string) ?? '';
    if (isVerbNodeLabel(label, node.id)) {
      warnings.push({ type: 'VERB_NODE', nodeId: node.id, message: `Node "${label}" (id=${node.id}) is a single verb — should be an edge label, not a node.` });
    }
  }

  // 7. General duplicate/synonym detection (cache vs caches, etc.)
  // Intentional replicas with identical multi-word labels (e.g., two "Follower Replica" nodes) are NOT flagged
  {
    const seen = new Map<string, RFNode>();
    for (const node of nodes) {
      if (node.type === 'groupNode' || isTextNode(node)) continue;
      const label = (node.data?.label as string) || node.id;
      const cls = (node.data?.serviceType as string) || classifyNode(label, undefined).serviceType;
      const key = `${cls}:${label.toLowerCase().replace(/\s*\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '')}`;
      const singKey = key.endsWith('s') && key.length > 3 && !key.endsWith('ss') ? key.slice(0, -1) : key;
      const existing = seen.get(key) || seen.get(singKey);
      if (existing) {
        const existingLabel = (existing.data?.label as string) || existing.id;
        const aTokens = label.trim().split(/\s+/).length;
        const bTokens = String(existingLabel).trim().split(/\s+/).length;
        const identicalMultiWord = aTokens > 1 && bTokens > 1 && label.trim().toLowerCase() === String(existingLabel).trim().toLowerCase();
        if (!identicalMultiWord) {
          warnings.push({
            type: 'DUPLICATE_SYNONYM',
            nodeId: node.id,
            message: `Duplicate/synonym node "${label}" duplicates "${existing.data?.label || existing.id}" — reuse canonical id.`,
          });
        }
      } else {
        seen.set(key, node);
        if (singKey !== key) seen.set(singKey, node);
      }
    }
  }

  return { passed: warnings.length === 0, warnings }
}
