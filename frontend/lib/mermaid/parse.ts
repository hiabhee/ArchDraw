import type { ParsedNode, ParsedEdge, ParsedSubgraph, Direction, Shape, EdgeType, ParseResult } from './types'

const RESERVED_KEYWORDS = new Set(['end', 'graph', 'flowchart', 'subgraph', 'direction'])

function normalizeEdgeLabels(text: string): string {
  return text.split('\n').map(line => {
    // Apply the arrow-label rewrite ONLY outside of quoted regions. The previous
    // implementation ran a global regex over the whole line, so a label like
    // A["config -- foo --> bar"] had its quoted "-- foo -->" rewritten too,
    // corrupting the node label. Walk the line, toggling in-quote state, and
    // only transform segments between quotes.
    let out = '';
    let i = 0;
    let inQuote: '"' | "'" | '' = '';
    while (i < line.length) {
      const ch = line[i];
      if (inQuote) {
        if (ch === inQuote && line[i - 1] !== '\\') inQuote = '';
        out += ch;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        out += ch;
        i++;
        continue;
      }
      // Find the next quote start so we can transform a whole unquoted chunk
      // with the same regexes the old code used.
      let nextQuote = -1;
      for (let j = i; j < line.length; j++) {
        if (line[j] === '"' || line[j] === "'") { nextQuote = j; break; }
      }
      const chunkEnd = nextQuote === -1 ? line.length : nextQuote;
      let chunk = line.slice(i, chunkEnd);
      chunk = chunk.replace(/--\s+"([^"]+)"\s*-->/g, (_, label: string) => '-->|' + label.trim() + '|');
      chunk = chunk.replace(/--\s+(.+?)\s*-->/g, (_, label: string) => '-->|' + label.trim() + '|');
      out += chunk;
      i = chunkEnd;
    }
    return out;
  }).join('\n')
}

function stripComments(line: string): string {
  let inQuote = false
  let quoteChar = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === quoteChar && line[i - 1] !== '\\') inQuote = false
    } else {
      if (ch === '"' || ch === "'") {
        inQuote = true
        quoteChar = ch
      } else if (ch === '%' && i + 1 < line.length && line[i + 1] === '%') {
        return line.slice(0, i)
      }
    }
  }
  return line
}

function extractId(raw: string): string | null {
  const m = raw.match(/^([A-Za-z0-9_][A-Za-z0-9_\-]*)/)
  return m ? m[1] : null
}

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

  if (nodeIdSet.has(id)) return id
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

function detectDirection(text: string): Direction {
  const lines = text.split('\n')
  for (const rawLine of lines) {
    const cleanLine = stripComments(rawLine)
    const line = cleanLine.trim()
    const m = line.match(/^(?:graph|flowchart)\s+(TD|LR|BT|RL|TB)\b/i)
    if (m) {
      const d = m[1].toUpperCase()
      if (d === 'TB') return 'TD'
      return d as Direction
    }
  }
  return 'TD'
}

function detectShape(line: string): Shape {
  let afterId = line
  const idMatch = line.match(/^([A-Za-z0-9_][A-Za-z0-9_\-]*)/)
  if (idMatch) {
    afterId = line.slice(idMatch[0].length).trimStart()
  }

  if (afterId.startsWith('[(')) return 'cylinder'
  if (afterId.startsWith('((')) return 'circle'
  if (afterId.startsWith('{{')) return 'hexagon'
  if (afterId.startsWith('{')) return 'diamond'
  if (afterId.startsWith('([')) return 'rounded'
  if (afterId.startsWith('[/') || afterId.startsWith('[\\')) return 'parallelogram'
  if (afterId.startsWith('[')) return 'rectangle'
  if (afterId.startsWith('(')) return 'rounded'
  return 'rectangle'
}

function extractNodeLabel(line: string): string | null {
  const idMatch = line.match(/^([A-Za-z0-9_][A-Za-z0-9_\-]*)/)
  if (!idMatch) return null

  let pos = idMatch[0].length
  while (pos < line.length && line[pos] === ' ') pos++
  if (pos >= line.length) return null

  const remaining = line.slice(pos)

  const openers: Array<{ open: string; close: string }> = [
    { open: '(((', close: ')))' },
    { open: '[(', close: ')]' },
    { open: '((', close: '))' },
    { open: '{{', close: '}}' },
    { open: '[/', close: '/]' },
    { open: '[\\', close: '\\]' },
    { open: '([', close: '])' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '{', close: '}' },
  ]

  for (const { open, close } of openers) {
    if (remaining.startsWith(open)) {
      const afterOpen = remaining.slice(open.length)
      const closeIdx = afterOpen.indexOf(close)
      if (closeIdx !== -1) {
        const content = afterOpen.slice(0, closeIdx)
        return content.replace(/^["']|["']$/g, '').trim()
      }
    }
  }

  return null
}

export function parseMermaid(mermaidText: string): ParseResult {
  const errors: { line: number; reason: string }[] = []
  const normalized = normalizeEdgeLabels(mermaidText)
  const direction = detectDirection(normalized)
  const subgraphs: ParsedSubgraph[] = []
  const nodes: ParsedNode[] = []
  const edges: ParsedEdge[] = []
  const nodeIdSet = new Set<string>()
  let edgeCounter = 0

  let currentSubgraphId: string | null = null
  const subgraphStack: string[] = []
  const lines = normalized.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const cleanLine = stripComments(rawLine)
    const line = cleanLine.trim()
    if (!line || line.startsWith('graph') || line.startsWith('flowchart')) {
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

    if (/^(style|classDef|class|linkStyle|click)\s/i.test(line)) {
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
        label = labelMatch[2] ?? labelMatch[3] ?? labelMatch[4] ?? null
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

    const arrowRegex = /(<-->|==(.+?)==>|-\.[^.]*\.->|-\.->|--+>|==+>|---(?!>)|--x|--o)/g
    const matches = [...line.matchAll(arrowRegex)]
    if (matches.length > 0) {
      const segmentNodes: string[] = []
      const edgeSpecs: Array<{ sourceIdx: number; targetIdx: number; label: string | null; type: EdgeType }> = []

      let lastIndex = 0
      for (let mIdx = 0; mIdx < matches.length; mIdx++) {
        const match = matches[mIdx]
        const arrowIdx = match.index!
        const fullArrow = match[1]

        const segment = line.slice(lastIndex, arrowIdx).trim()

        let edgeType: EdgeType = 'arrow'
        if (fullArrow === '<-->') edgeType = 'bidirectional'
        else if (fullArrow.startsWith('-.')) edgeType = 'dotted'
        else if (fullArrow.startsWith('==')) edgeType = 'thick'
        else if (fullArrow.match(/^-{3,}$/)) edgeType = 'open'
        else if (fullArrow === '--x' || fullArrow === '--o') edgeType = 'open'

        let edgeLabel: string | null = null

        const embeddedLabelMatch = fullArrow.match(/^-\.(.+)\.->$/)
        if (embeddedLabelMatch) {
          edgeLabel = embeddedLabelMatch[1]
        }

        if (!edgeLabel) {
          const thickEmbedded = fullArrow.match(/^==(.+)==>$/)
          if (thickEmbedded) {
            edgeLabel = thickEmbedded[1]
          }
        }

        const nextMatch = matches[mIdx + 1]
        const nextArrowIdx = nextMatch ? nextMatch.index! : line.length
        let targetPart = line.slice(arrowIdx + fullArrow.length, nextArrowIdx).trim()

        let pipeLabelMatch: RegExpMatchArray | null = null
        if (!edgeLabel) {
          pipeLabelMatch = targetPart.match(/^\s*\|"?([^|"]+)"?\|\s*(.*)$/)
          if (pipeLabelMatch) {
            edgeLabel = pipeLabelMatch[1].trim()
            targetPart = pipeLabelMatch[2].trim()
          }
        }

        const sourceId = ensureNode(segment, nodes, nodeIdSet, currentSubgraphId, subgraphs)
        if (sourceId) {
          segmentNodes.push(sourceId)
        }

        edgeSpecs.push({
          sourceIdx: segmentNodes.length - 1,
          targetIdx: segmentNodes.length,
          label: edgeLabel,
          type: edgeType,
        })

        if (pipeLabelMatch) {
          const labelOffset = line.slice(arrowIdx + fullArrow.length).indexOf(pipeLabelMatch[2])
          lastIndex = arrowIdx + fullArrow.length + labelOffset
        } else {
          lastIndex = arrowIdx + fullArrow.length
        }
      }

      const finalSegment = line.slice(lastIndex).trim()
      const finalNodeId = ensureNode(finalSegment, nodes, nodeIdSet, currentSubgraphId, subgraphs)
      if (finalNodeId) {
        segmentNodes.push(finalNodeId)
      }

      for (const spec of edgeSpecs) {
        const sourceId = segmentNodes[spec.sourceIdx]
        const targetId = segmentNodes[spec.targetIdx]
        if (sourceId && targetId) {
          edges.push({
            id: `${sourceId}-${targetId}-${spec.label ?? 'nolabel'}-${edgeCounter++}`,
            source: sourceId,
            target: targetId,
            label: spec.label,
            type: spec.type,
          })
        }
      }
      continue
    }

    const idMatch = line.match(/^([A-Za-z0-9_][A-Za-z0-9_\-]*)\s*(.*)$/)
    if (idMatch) {
      const id = idMatch[1]
      const rest = idMatch[2].trim()
      const label = extractNodeLabel(line)
      const shape = rest ? detectShape(rest) : null

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
          if (shape) existingNode.shape = shape
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
        shape: shape || 'rectangle',
        subgraphId: currentSubgraphId,
      }
      nodes.push(node)

      if (currentSubgraphId) {
        const sub = subgraphs.find(s => s.id === currentSubgraphId)
        if (sub) sub.nodeIds.push(id)
      }
    }
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
    .filter((l) => l.length > 0 && !l.startsWith('graph') && !l.startsWith('flowchart'));
  if (nodes.length === 0 && edges.length === 0 && meaningfulLines.length > 0) {
    return {
      ok: false,
      errors: [{ line: 1, reason: 'No nodes or edges were parsed from non-empty input.' }],
    };
  }

  return {
    ok: true,
    ast: { direction, nodes, edges, subgraphs },
  }
}
