import type { Node, Edge } from 'reactflow'
import { removeArtifacts } from './artifactRemover'
import { collapseRequestResponse } from './requestResponseCollapser'
import { detectMainSpine, type SpineResult } from './mainSpineDetector'

export interface ClarityReport {
  artifactsRemoved: number
  requestResponseCollapsed: number
  spineFound: boolean
  spineNodeCount: number
  warnings: string[]
}

const OBSERVABILITY_KEYWORDS = [
  'log', 'monitor', 'observability', 'metric', 'tracing',
  'alert', 'prometheus', 'grafana', 'jaeger', 'zipkin',
  'datadog', 'sentry', 'cloudwatch',
]

const RESPONSE_LABEL_KEYWORDS = [
  'return', 'response', 'reply', 'ack', 'acknowledge',
  'respond', 'callback',
]

export function runClarityCompiler(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[]; report: ClarityReport } {
  const warnings: string[] = []

  let artifactsRemoved = 0

  const { nodes: cleanedNodes, edges: cleanedEdges } = removeArtifacts(nodes, edges)
  artifactsRemoved = nodes.length - cleanedNodes.length

  if (artifactsRemoved > 0) {
    warnings.push(`Removed ${artifactsRemoved} artifact node(s)`)
  }

  const collapsedResult = collapseRequestResponse(cleanedEdges)
  const collapsedCount = cleanedEdges.length - collapsedResult.length

  if (collapsedCount > 0) {
    warnings.push(`Collapsed ${collapsedCount} request/response edge pair(s)`)
  }

  const spineResult = detectMainSpine(cleanedNodes, collapsedResult)

  if (spineResult.spineNodeIds.length > 0) {
    warnings.push(`Detected main spine: ${spineResult.spineNodeIds.length} nodes, ${spineResult.spineEdgeIds.length} edges`)
  } else {
    warnings.push('No clear main spine detected')
  }

  const enhancedEdges = assignVisualHierarchy(collapsedResult, cleanedNodes, spineResult)

  const report: ClarityReport = {
    artifactsRemoved,
    requestResponseCollapsed: collapsedCount,
    spineFound: spineResult.spineNodeIds.length > 0,
    spineNodeCount: spineResult.spineNodeIds.length,
    warnings,
  }

  return { nodes: cleanedNodes, edges: enhancedEdges, report }
}

function assignVisualHierarchy(
  edges: Edge[],
  nodes: Node[],
  spine: SpineResult
): Edge[] {
  const spineEdgeSet = new Set(spine.spineEdgeIds)
  const spineNodeSet = new Set(spine.spineNodeIds)
  const nodeServiceTypes = new Map<string, string>()

  for (const node of nodes) {
    const data = node.data as Record<string, unknown> || {}
    nodeServiceTypes.set(node.id, (data.serviceType as string) || 'service')
  }

  return edges.map(edge => {
    const edgeData = (edge.data as Record<string, unknown>) || {}
    const currentImportance = edgeData.importance as string || 'secondary'
    const label = (edgeData.label as string) || (edge.label as string) || ''
    const labelLower = label.toLowerCase()

    let importance = currentImportance

    if (spineEdgeSet.has(edge.id)) {
      importance = 'primary'
    }

    if (importance === 'primary' && labelLower.includes('return')) {
      importance = 'secondary'
    }

    if (RESPONSE_LABEL_KEYWORDS.some(k => labelLower.includes(k))) {
      if (importance === 'primary') {
        importance = 'supporting'
      } else if (importance !== 'primary') {
        importance = 'diagnostic'
      }
    }

    const srcType = nodeServiceTypes.get(edge.source) || 'service'
    const tgtType = nodeServiceTypes.get(edge.target) || 'service'

    if (
      OBSERVABILITY_KEYWORDS.some(k => srcType.includes(k) || tgtType.includes(k))
    ) {
      importance = 'diagnostic'
    }

    if (labelLower.includes('optional') || labelLower.includes('fallback')) {
      importance = 'optional'
    }

    let portType = edgeData.portType as string || 'outbound'
    if (!edgeData.portType) {
      if (tgtType === 'database' || tgtType === 'cache') {
        portType = 'storage'
      } else if (tgtType === 'observability' || srcType === 'observability') {
        portType = 'observability'
      } else if (tgtType === 'queue') {
        portType = 'events'
      } else if (labelLower.includes('control') || labelLower.includes('admin')) {
        portType = 'control'
      } else if (labelLower.includes('auth') || labelLower.includes('sec')) {
        portType = 'security'
      } else if (edgeData.responseLabel || RESPONSE_LABEL_KEYWORDS.some(k => labelLower.includes(k))) {
        portType = 'outbound'
      }
    }

    return {
      ...edge,
      data: {
        ...edgeData,
        importance,
        portType,
        isSpine: spineEdgeSet.has(edge.id),
      },
    }
  })
}
