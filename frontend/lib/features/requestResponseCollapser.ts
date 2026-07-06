import type { Edge } from 'reactflow'

function edgeLabelString(edge: Edge): string {
  const lbl = edge.label
  if (typeof lbl === 'string') return lbl
  const dataLbl = (edge.data as Record<string, unknown> | undefined)?.label
  if (typeof dataLbl === 'string') return dataLbl
  return ''
}

const RESPONSE_LABEL_KEYWORDS = [
  'return', 'response', 'reply', 'ack', 'callback',
  'returns', 'responds', 'sends back', 'confirms', 'acknowledge',
]

const REQUEST_LABEL_KEYWORDS = [
  'request', 'send', 'trigger', 'invoke', 'call',
  'submit', 'push', 'dispatch',
]

/**
 * Given a pair of edges A→B and B→A, determines which is the request
 * (forward) edge by inspecting labels. The edge whose label matches a
 * RESPONSE keyword is the response; the other is the request.
 * If neither matches, the edge that appears earlier in the array is
 * treated as the request (so array order is the last tiebreaker).
 */
function detectDirection(
  edge: Edge,
  reverse: Edge,
): { forward: Edge; reverse: Edge } {
  const fwdLabel = edgeLabelString(edge).toLowerCase()
  const revLabel = edgeLabelString(reverse).toLowerCase()

  const fwdIsResponse = RESPONSE_LABEL_KEYWORDS.some(k => fwdLabel.includes(k))
  const revIsResponse = RESPONSE_LABEL_KEYWORDS.some(k => revLabel.includes(k))

  if (fwdIsResponse && !revIsResponse) {
    return { forward: reverse, reverse: edge }
  }
  if (revIsResponse && !fwdIsResponse) {
    return { forward: edge, reverse }
  }

  const fwdIsRequest = REQUEST_LABEL_KEYWORDS.some(k => fwdLabel.includes(k))
  const revIsRequest = REQUEST_LABEL_KEYWORDS.some(k => revLabel.includes(k))

  if (fwdIsRequest && !revIsRequest) {
    return { forward: edge, reverse }
  }
  if (revIsRequest && !fwdIsRequest) {
    return { forward: reverse, reverse: edge }
  }

  return { forward: edge, reverse }
}

export function collapseRequestResponse(edges: Edge[]): Edge[] {
  const edgePairs = new Map<string, { forward: Edge; reverse: Edge }>()

  for (const edge of edges) {
    const reverseEdge = edges.find(
      e =>
        e.source === edge.target &&
        e.target === edge.source &&
        e.id !== edge.id
    )

    if (reverseEdge) {
      const pairKey = `${edge.source}::${edge.target}`
      if (!edgePairs.has(pairKey) && !edgePairs.has(`${edge.target}::${edge.source}`)) {
        const { forward, reverse } = detectDirection(edge, reverseEdge)
        edgePairs.set(`${forward.source}::${forward.target}`, { forward, reverse })
      }
    }
  }

  if (edgePairs.size === 0) return edges

  const collapsedReverseIds = new Set<string>()
  const resultEdges: Edge[] = []

  for (const edge of edges) {
    if (collapsedReverseIds.has(edge.id)) continue

    let matched = false
    for (const [, pair] of edgePairs) {
      if (pair.forward === edge) {
        const reverseLabel = edgeLabelString(pair.reverse)

        const extendedData = {
          ...(edge.data as Record<string, unknown> || {}),
          responseLabel: reverseLabel || 'response',
          responseEdgeId: pair.reverse.id,
        }

        const mergedEdge: Edge = {
          ...edge,
          data: extendedData,
        }

        resultEdges.push(mergedEdge)
        collapsedReverseIds.add(pair.reverse.id)
        matched = true
        break
      }
    }

    if (!matched) {
      const isReverse = Array.from(edgePairs.values()).some(p => p.reverse === edge)
      if (!isReverse) {
        resultEdges.push(edge)
      }
    }
  }

  return resultEdges
}
