// Mermaid graph text → AST. Statement loop lives here; token/label/directive
// helpers live in sibling modules (tokens, labelText, directives, nodeShapes).

import type {
  ParsedNode,
  ParsedEdge,
  ParsedSubgraph,
  Direction,
  EdgeType,
  ParseResult,
  ParsedNodeStyle,
  ParsedText,
} from '../types'
import { type ShapeType } from '@/lib/shapeRegistry'
import { ARROW_REGEX, RESERVED_KEYWORDS } from './tokens'
import {
  mergeMultilineLabels,
  maskQuotedSpans,
  normalizeEdgeLabels,
  stripMarkdownLabel,
  unescapeLabel,
} from './labelText'
import {
  stripFrontmatter,
  stripComments,
  parseArchdrawDirective,
  parseArchdrawShapeDirective,
} from './directives'
import {
  splitStatements,
  extractId,
  detectDirection,
  detectShape,
  extractNodeLabel,
  splitByAmpersand,
  classifyArrow,
  parseStyleProps,
  parseAtShapeBlock,
} from './nodeShapes'

function ensureNode(
  raw: string,
  nodes: ParsedNode[],
  nodeIdSet: Set<string>,
  currentSubgraphId: string | null,
  subgraphs: ParsedSubgraph[],
): string | null {
  let id = extractId(raw)
  if (!id) return null

  if (RESERVED_KEYWORDS.has(id.toLowerCase())) {
    id = id + '_node'
  }

  if (nodeIdSet.has(id)) {
    // Upgrade label/shape if this reference carries a definition.
    const label = extractNodeLabel(raw)
    const shape = detectShape(raw)
    const existing = nodes.find(n => n.id === id)
    if (existing) {
      if (label) existing.label = label
      if (shape && raw.slice(id.length).trim().length > 0) existing.shape = shape
      if (currentSubgraphId && !existing.subgraphId) {
        existing.subgraphId = currentSubgraphId
        const sub = subgraphs.find(s => s.id === currentSubgraphId)
        if (sub && !sub.nodeIds.includes(id)) sub.nodeIds.push(id)
      }
    }
    return id
  }
  if (subgraphs.some(s => s.id === id)) return id
  const label = extractNodeLabel(raw) || id
  const shape = detectShape(raw)
  nodeIdSet.add(id)
  nodes.push({ id, label, shape, subgraphId: currentSubgraphId })
  if (currentSubgraphId) {
    const sub = subgraphs.find(s => s.id === currentSubgraphId)
    if (sub) sub.nodeIds.push(id)
  }
  return id
}

export function parseMermaid(mermaidText: string): ParseResult {
  const errors: { line: number; reason: string }[] = []
  const withoutFrontmatter = stripFrontmatter(mermaidText)
  const merged = mergeMultilineLabels(withoutFrontmatter)
  const normalized = normalizeEdgeLabels(merged)
  const direction = detectDirection(normalized)
  const subgraphs: ParsedSubgraph[] = []
  const nodes: ParsedNode[] = []
  const edges: ParsedEdge[] = []
  const texts: ParsedText[] = []
  const nodeIdSet = new Set<string>()
  const classStyles = new Map<string, ParsedNodeStyle>()
  const nodeClassNames = new Map<string, string[]>()
  const shapeOverrides = new Map<string, ShapeType>()
  let edgeCounter = 0

  let currentSubgraphId: string | null = null
  const subgraphStack: string[] = []
  const lines = normalized.split('\n')

  let skipUntilCloseBrace = false

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]

    const textElement = parseArchdrawDirective(rawLine)
    if (textElement) {
      texts.push(textElement)
      continue
    }

    const shapeDirective = parseArchdrawShapeDirective(rawLine)
    if (shapeDirective) {
      shapeOverrides.set(shapeDirective.id, shapeDirective.shape)
      continue
    }

    const cleanLine = stripComments(rawLine)
    const blockLine = cleanLine.trim()

    if (skipUntilCloseBrace) {
      if (blockLine.includes('}')) skipUntilCloseBrace = false
      continue
    }

    if (!blockLine) continue

    for (const statement of splitStatements(blockLine)) {
      const line = statement.trim()

      if (!line) continue

    // Accessibility / metadata directives Mermaid accepts but we do not render.
    if (/^accTitle(?:\s*:|$)/i.test(line) || /^accDescr(?:\s*:|$)/i.test(line)) {
      if (/^accDescr\s*\{/i.test(line) && !line.includes('}')) {
        skipUntilCloseBrace = true
      }
      continue
    }
    if (/^title(\s|:)/i.test(line)) {
      continue
    }

    if (line.startsWith('graph') || line.startsWith('flowchart')) {
      continue
    }

    const dirMatch = line.match(/^direction\s+(TD|LR|BT|RL|TB)\b/i)
    if (dirMatch) {
      if (currentSubgraphId) {
        const sub = subgraphs.find(s => s.id === currentSubgraphId)
        if (sub) {
          const d = dirMatch[1].toUpperCase()
          sub.direction = (d === 'TB' ? 'TD' : d) as Direction
        }
      }
      continue
    }

    // classDef myClass fill:#f9f,stroke:#333
    const classDefMatch = line.match(/^classDef\s+(\S+)\s+(.+)$/i)
    if (classDefMatch) {
      classStyles.set(classDefMatch[1], parseStyleProps(classDefMatch[2]))
      continue
    }

    // class A,B myClass
    const classAssignMatch = line.match(/^class\s+(\S+)\s+(\S+)\s*$/i)
    if (classAssignMatch) {
      const ids = classAssignMatch[1].split(',').map(s => s.trim()).filter(Boolean)
      const className = classAssignMatch[2]
      for (const nid of ids) {
        const list = nodeClassNames.get(nid) ?? []
        list.push(className)
        nodeClassNames.set(nid, list)
      }
      continue
    }

    // style A fill:#fff,stroke:#f66
    const styleMatch = line.match(/^style\s+(\S+)\s+(.+)$/i)
    if (styleMatch) {
      const nid = styleMatch[1]
      const props = parseStyleProps(styleMatch[2])
      const existing = nodes.find(n => n.id === nid)
      if (existing) {
        existing.style = { ...existing.style, ...props }
      } else {
        // Node may appear later; stash via a synthetic class name.
        const synthetic = `__style_${nid}`
        classStyles.set(synthetic, props)
        const list = nodeClassNames.get(nid) ?? []
        list.push(synthetic)
        nodeClassNames.set(nid, list)
      }
      continue
    }

    if (/^(linkStyle|click)\s/i.test(line)) {
      continue
    }

    // Expanded shape syntax: A@{ shape: diamond, label: "X" }
    const atShape = parseAtShapeBlock(line)
    if (atShape) {
      if (atShape.isEdgeConfig) continue
      const id = atShape.id
      if (RESERVED_KEYWORDS.has(id.toLowerCase())) continue
      if (nodeIdSet.has(id)) {
        const existing = nodes.find(n => n.id === id)
        if (existing) {
          if (atShape.label) existing.label = atShape.label
          if (atShape.shape) existing.shape = atShape.shape
        }
      } else if (!subgraphs.some(s => s.id === id)) {
        nodeIdSet.add(id)
        nodes.push({
          id,
          label: atShape.label ?? id,
          shape: atShape.shape ?? 'rectangle',
          subgraphId: currentSubgraphId,
        })
        if (currentSubgraphId) {
          const sub = subgraphs.find(s => s.id === currentSubgraphId)
          if (sub) sub.nodeIds.push(id)
        }
      }
      continue
    }

    const subgraphHeader = line.match(/^subgraph\s+/i)
    if (subgraphHeader) {
      const afterKw = line.slice(subgraphHeader[0].length)
      let rawId: string
      let label: string | null = null

      const labelMatch = afterKw.match(/\s*\[\s*("(.*?)"|'(.*?)'|(.*?))\s*\]\s*$/)
      if (labelMatch) {
        rawId = afterKw.slice(0, afterKw.length - labelMatch[0].length).trim()
        label = stripMarkdownLabel(unescapeLabel(labelMatch[2] ?? labelMatch[3] ?? labelMatch[4] ?? null))
      } else {
        rawId = afterKw.trim()
      }

      const id = rawId.replace(/\s+/g, '_')
      const parentId = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : undefined

      if (nodeIdSet.has(id)) {
        nodeIdSet.delete(id)
        const idx = nodes.findIndex(n => n.id === id)
        if (idx !== -1) nodes.splice(idx, 1)
      }

      subgraphStack.push(id)
      currentSubgraphId = id
      subgraphs.push({ id, label: (label ?? rawId).trim(), nodeIds: [], parentId })
      continue
    }

    if (line.toLowerCase() === 'end') {
      subgraphStack.pop()
      currentSubgraphId = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : null
      continue
    }

    // Scan for arrows on a quote-masked copy of the line so labels like
    // `A["x --> y"]` or `-->|"Kafka | Redpanda"|` cannot split into phantom
    // nodes/edges. Indices are identical, so segments are sliced from the
    // original line.
    ARROW_REGEX.lastIndex = 0
    const matches = [...maskQuotedSpans(line).matchAll(ARROW_REGEX)]
    if (matches.length > 0) {
      const segmentNodes: string[][] = []
      const edgeSpecs: Array<{
        sourceSeg: number
        targetSeg: number
        label: string | null
        type: EdgeType
        reverse: boolean
      }> = []

      let lastIndex = 0
      for (let mIdx = 0; mIdx < matches.length; mIdx++) {
        const match = matches[mIdx]
        const arrowIdx = match.index!
        const fullArrow = match[2]
        const segment = line.slice(lastIndex, arrowIdx).trim()

        const { type: edgeType, embeddedLabel } = classifyArrow(fullArrow)
        let edgeLabel: string | null = embeddedLabel
        const reverse = fullArrow.startsWith('<--') && fullArrow !== '<-->'

        const nextMatch = matches[mIdx + 1]
        const nextArrowIdx = nextMatch ? nextMatch.index! : line.length
        let targetPart = line.slice(arrowIdx + match[0].length, nextArrowIdx).trim()

        let pipeLabelMatch: RegExpMatchArray | null = null
        if (!edgeLabel) {
          // Quoted label first so pipes inside `|"Kafka | Redpanda"|` survive;
          // then a bare label up to the next pipe.
          pipeLabelMatch = targetPart.match(/^\s*\|(?:"((?:[^"\\]|\\.)*)"|([^|]*))\|\s*(.*)$/)
          if (pipeLabelMatch) {
            const rawPipeLabel = pipeLabelMatch[1] ?? pipeLabelMatch[2] ?? ''
            edgeLabel = stripMarkdownLabel(unescapeLabel(rawPipeLabel.trim()))
            targetPart = pipeLabelMatch[3].trim()
          }
        }

        const sourceRefs = splitByAmpersand(segment)
        const sourceIds: string[] = []
        for (const ref of sourceRefs) {
          const sid = ensureNode(ref, nodes, nodeIdSet, currentSubgraphId, subgraphs)
          if (sid) sourceIds.push(sid)
        }
        segmentNodes.push(sourceIds)

        edgeSpecs.push({
          sourceSeg: segmentNodes.length - 1,
          targetSeg: segmentNodes.length,
          label: edgeLabel,
          type: edgeType,
          reverse,
        })

        if (pipeLabelMatch) {
          const labelOffset = line.slice(arrowIdx + match[0].length).indexOf(pipeLabelMatch[3])
          lastIndex = arrowIdx + match[0].length + Math.max(0, labelOffset)
        } else {
          lastIndex = arrowIdx + match[0].length
        }
      }

      const finalSegment = line.slice(lastIndex).trim()
      const finalRefs = splitByAmpersand(finalSegment)
      const finalIds: string[] = []
      for (const ref of finalRefs) {
        const fid = ensureNode(ref, nodes, nodeIdSet, currentSubgraphId, subgraphs)
        if (fid) finalIds.push(fid)
      }
      segmentNodes.push(finalIds)

      for (const spec of edgeSpecs) {
        const sources = segmentNodes[spec.sourceSeg] ?? []
        const targets = segmentNodes[spec.targetSeg] ?? []
        for (const sourceId of sources) {
          for (const targetId of targets) {
            if (!sourceId || !targetId) continue
            const from = spec.reverse ? targetId : sourceId
            const to = spec.reverse ? sourceId : targetId
            edges.push({
              id: `${from}-${to}-${spec.label ?? 'nolabel'}-${edgeCounter++}`,
              source: from,
              target: to,
              label: spec.label,
              type: spec.type,
            })
          }
        }
      }
      continue
    }

    // Standalone node that may itself be an &-joined declaration list.
    const standaloneRefs = splitByAmpersand(line)
    if (standaloneRefs.length > 1) {
      for (const ref of standaloneRefs) {
        ensureNode(ref, nodes, nodeIdSet, currentSubgraphId, subgraphs)
      }
      continue
    }

    const idMatch = line.match(/^([A-Za-z0-9_][A-Za-z0-9_\-]*)\s*(.*)$/)
    if (idMatch) {
      const id = idMatch[1]
      const rest = idMatch[2].trim()
      const label = extractNodeLabel(line)
      const detectedShape = rest ? detectShape(line) : null

      if (subgraphs.some(s => s.id === id)) {
        const sub = subgraphs.find(s => s.id === id)
        if (sub && label) {
          sub.label = label
        }
        continue
      }

      if (nodeIdSet.has(id)) {
        const existingNode = nodes.find(n => n.id === id)
        if (existingNode) {
          if (label) existingNode.label = label
          if (detectedShape && rest) existingNode.shape = detectedShape
          if (currentSubgraphId) {
            existingNode.subgraphId = currentSubgraphId
            const sub = subgraphs.find(s => s.id === currentSubgraphId)
            if (sub && !sub.nodeIds.includes(id)) {
              sub.nodeIds.push(id)
            }
          }
        }
        continue
      }
      nodeIdSet.add(id)

      const node: ParsedNode = {
        id,
        label: label || id,
        shape: detectedShape || 'rectangle',
        subgraphId: currentSubgraphId,
      }
      nodes.push(node)

      if (currentSubgraphId) {
        const sub = subgraphs.find(s => s.id === currentSubgraphId)
        if (sub) sub.nodeIds.push(id)
      }
    }
    }
  }

  // Apply classDef / deferred style onto nodes.
  for (const node of nodes) {
    const classNames = nodeClassNames.get(node.id)
    if (!classNames) continue
    let mergedStyle: ParsedNodeStyle = { ...node.style }
    for (const cn of classNames) {
      const props = classStyles.get(cn)
      if (props) mergedStyle = { ...mergedStyle, ...props }
    }
    if (mergedStyle.fill || mergedStyle.stroke) {
      node.style = mergedStyle
    }
  }

  // Apply `%% archdraw-shape` silhouette overrides onto parsed nodes.
  for (const [id, shape] of shapeOverrides) {
    const node = nodes.find(n => n.id === id)
    if (node) node.shapeOverride = shape
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  // Total parse failure: the input had non-trivial, non-directive content but
  // we extracted zero nodes and zero edges (e.g. the LLM returned prose or
  // malformed mermaid that no rule matched). Previously `errors` was never
  // pushed to and this function always returned ok:true, which made the
  // pipeline's retry-on-parse-failure branch dead for garbage output. Report
  // a single synthetic error so the caller can retry / fall back.
  const meaningfulLines = lines
    .map((l) => stripComments(l).trim())
    .filter((l) => {
      if (l.length === 0) return false
      if (l.startsWith('graph') || l.startsWith('flowchart')) return false
      if (/^accTitle(?:\s*:|$)/i.test(l) || /^accDescr(?:\s*:|$)/i.test(l)) return false
      if (/^title(\s|:)/i.test(l)) return false
      if (/^(style|classDef|class|linkStyle|click)\s/i.test(l)) return false
      return true
    })
  if (nodes.length === 0 && edges.length === 0 && meaningfulLines.length > 0) {
    return {
      ok: false,
      errors: [{ line: 1, reason: 'No nodes or edges were parsed from non-empty input.' }],
    }
  }

  return {
    ok: true,
    ast: { direction, nodes, edges, subgraphs, texts },
  }
}
