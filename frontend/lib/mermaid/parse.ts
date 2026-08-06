import type {
  ParsedNode,
  ParsedEdge,
  ParsedSubgraph,
  Direction,
  Shape,
  EdgeType,
  ParseResult,
  ParsedNodeStyle,
} from './types'

const RESERVED_KEYWORDS = new Set(['end', 'graph', 'flowchart', 'subgraph', 'direction'])

/**
 * Mermaid arrow tokens. Longer / more-specific forms first so the regex engine
 * does not stop at a shorter prefix (e.g. `-->` inside `--x` is fine because
 * `--x` is listed; `~~~` before `~~`).
 */
const ARROW_TOKEN =
  '(?:' +
  [
    '<-->',
    'o--o',
    'x--x',
    '~~~~+',
    '~~~',
    '==[^=]*==>',
    '==+>',
    '-\\.[^.]*\\.->',
    '-\\.+->',
    'o--+>',
    'x--+>',
    '<--+',
    '--+>',
    '---+',
    '--x',
    '--o',
    'o--+',
    'x--+',
  ].join('|') +
  ')'

const ARROW_REGEX = new RegExp(`(?:([A-Za-z0-9_][A-Za-z0-9_\\-]*)@)?(${ARROW_TOKEN})`, 'g')

// Mermaid allows labels that span multiple physical lines, e.g.
//   P0["Partition 0
// Offset 0"]
// This parser is line-based, so a bare newline inside a quoted label would
// otherwise be treated as a fresh statement (creating bogus nodes). Join those
// continuation lines by replacing the newline inside a quoted region with a
// literal "\n" escape (which Mermaid itself interprets as a line break). Both
// " and ' quoted strings are supported, as are \" escapes and %% comments.
function mergeMultilineLabels(text: string): string {
  let out = ''
  let inQuote: '"' | "'" | '' = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuote) {
      if (ch === '\\') {
        out += ch
        if (i + 1 < text.length) {
          out += text[i + 1]
          i++
        }
        continue
      }
      if (ch === inQuote) {
        inQuote = ''
      } else if (ch === '\n') {
        out += '\\n'
        continue
      }
      out += ch
      continue
    }
    if (ch === '%' && text[i + 1] === '%') {
      const nl = text.indexOf('\n', i)
      if (nl === -1) {
        out += text.slice(i)
        break
      }
      out += text.slice(i, nl + 1)
      i = nl
      continue
    }
    if (ch === '\\') {
      // An escaped character outside a string (e.g. `H[\"label\"]`) is literal:
      // it must not open a quoted region, otherwise the quote state leaks into
      // the following lines.
      out += ch
      if (i + 1 < text.length) {
        out += text[i + 1]
        i++
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch
      out += ch
      continue
    }
    out += ch
  }
  return out
}

function unescapeLabel(label: string): string {
  return label
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

/** Strip Mermaid markdown-string wrappers and light emphasis markers. */
function stripMarkdownLabel(label: string): string {
  let s = label.trim()
  if (s.startsWith('`') && s.endsWith('`') && s.length >= 2) {
    s = s.slice(1, -1)
  }
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/__([^_]+)__/g, '$1')
  s = s.replace(/\*([^*]+)\*/g, '$1')
  s = s.replace(/_([^_]+)_/g, '$1')
  return s
}

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
      chunk = chunk.replace(/==\s+"([^"]+)"\s*==>/g, (_, label: string) => '==>|' + label.trim() + '|');
      chunk = chunk.replace(/==\s+(.+?)\s*==>/g, (_, label: string) => '==>|' + label.trim() + '|');
      out += chunk;
      i = chunkEnd;
    }
    return out;
  }).join('\n')
}

/** Drop YAML frontmatter (`---` … `---`) that Mermaid accepts before the diagram. */
function stripFrontmatter(text: string): string {
  const withoutBom = text.replace(/^\uFEFF/, '')
  const trimmedStart = withoutBom.replace(/^\s+/, '')
  if (!trimmedStart.startsWith('---')) return text
  const close = trimmedStart.indexOf('\n---', 3)
  if (close === -1) return text
  let rest = trimmedStart.slice(close + 4)
  if (rest.startsWith('\r\n')) rest = rest.slice(2)
  else if (rest.startsWith('\n')) rest = rest.slice(1)
  return rest
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

/** Map Mermaid `@{ shape: name }` / aliases onto ArchDraw canvas shapes. */
function mapMermaidShapeName(name: string): Shape {
  const n = name.toLowerCase().replace(/_/g, '-')
  switch (n) {
    case 'diam':
    case 'diamond':
    case 'decision':
    case 'question':
      return 'diamond'
    case 'circ':
    case 'circle':
    case 'double-circle':
      return 'circle'
    case 'cyl':
    case 'cylinder':
    case 'db':
    case 'database':
    case 'drum':
      return 'cylinder'
    case 'hex':
    case 'hexagon':
    case 'prepare':
      return 'hexagon'
    case 'stadium':
    case 'pill':
    case 'terminal':
    case 'rounded':
    case 'round':
    case 'event':
      return 'rounded'
    case 'lean-r':
    case 'lean-right':
    case 'lean-l':
    case 'lean-left':
    case 'parallelogram':
    case 'trap-b':
    case 'trap-t':
    case 'priority':
    case 'manual':
    case 'trapezoid':
    case 'trapezoid-top':
    case 'trapezoid-bottom':
    case 'inv-trapezoid':
    case 'curved-trapezoid':
    case 'curv-trap':
    case 'display':
    case 'asymmetric':
    case 'asym':
      return 'parallelogram'
    default:
      return 'rectangle'
  }
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

  // Longest openers first.
  if (afterId.startsWith('(((')) return 'circle' // double-circle → circle on canvas
  if (afterId.startsWith('[(')) return 'cylinder'
  if (afterId.startsWith('((')) return 'circle'
  if (afterId.startsWith('{{')) return 'hexagon'
  if (afterId.startsWith('{')) return 'diamond'
  if (afterId.startsWith('([')) return 'rounded' // stadium
  if (afterId.startsWith('[[')) return 'rectangle' // subroutine / framed rect
  if (afterId.startsWith('[/') || afterId.startsWith('[\\')) return 'parallelogram'
  if (afterId.startsWith('[')) return 'rectangle'
  if (afterId.startsWith('>')) return 'parallelogram' // asymmetric / flag
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
    { open: '([', close: '])' },
    { open: '[[', close: ']]' },
    // Trapezoids (mixed slashes) before parallelograms (matched slashes).
    { open: '[/', close: '\\]' },
    { open: '[\\', close: '/]' },
    { open: '[/', close: '/]' },
    { open: '[\\', close: '\\]' },
    { open: '[', close: ']' },
    { open: '>', close: ']' },
    { open: '(', close: ')' },
    { open: '{', close: '}' },
  ]

  for (const { open, close } of openers) {
    if (remaining.startsWith(open)) {
      const afterOpen = remaining.slice(open.length)
      const closeIdx = afterOpen.indexOf(close)
      if (closeIdx !== -1) {
        const content = afterOpen.slice(0, closeIdx)
        return stripMarkdownLabel(unescapeLabel(content.replace(/^["']|["']$/g, '')).trim())
      }
    }
  }

  return null
}

/** Split `A & B["x & y"] & C` on top-level `&` only. */
function splitByAmpersand(segment: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0
  let inQuote: '"' | "'" | '' = ''
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i]
    if (inQuote) {
      current += ch
      if (ch === '\\' && i + 1 < segment.length) {
        current += segment[i + 1]
        i++
        continue
      }
      if (ch === inQuote) inQuote = ''
      continue
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch
      current += ch
      continue
    }
    if (ch === '[' || ch === '(' || ch === '{') depth++
    if (ch === ']' || ch === ')' || ch === '}') depth = Math.max(0, depth - 1)
    if (ch === '&' && depth === 0) {
      const t = current.trim()
      if (t) parts.push(t)
      current = ''
      continue
    }
    current += ch
  }
  const t = current.trim()
  if (t) parts.push(t)
  return parts
}

function classifyArrow(fullArrow: string): { type: EdgeType; embeddedLabel: string | null } {
  if (/^~{3,}$/.test(fullArrow)) return { type: 'invisible', embeddedLabel: null }
  if (fullArrow === '<-->') return { type: 'bidirectional', embeddedLabel: null }
  if (fullArrow.startsWith('-.')) {
    const embedded = fullArrow.match(/^-\.(.+)\.->$/)
    return { type: 'dotted', embeddedLabel: embedded ? embedded[1] : null }
  }
  if (fullArrow.startsWith('==')) {
    const embedded = fullArrow.match(/^==(.+)==>$/)
    return { type: 'thick', embeddedLabel: embedded ? embedded[1] : null }
  }
  if (/^-{3,}$/.test(fullArrow)) return { type: 'open', embeddedLabel: null }
  if (
    fullArrow === '--x' ||
    fullArrow === '--o' ||
    fullArrow.startsWith('o--') ||
    fullArrow.startsWith('x--') ||
    fullArrow === 'o--o' ||
    fullArrow === 'x--x'
  ) {
    return { type: 'open', embeddedLabel: null }
  }
  if (fullArrow.startsWith('<--')) return { type: 'arrow', embeddedLabel: null }
  return { type: 'arrow', embeddedLabel: null }
}

function parseStyleProps(props: string): ParsedNodeStyle {
  const style: ParsedNodeStyle = {}
  for (const part of props.split(',')) {
    const [rawKey, ...rest] = part.split(':')
    if (!rawKey || rest.length === 0) continue
    const key = rawKey.trim().toLowerCase()
    const value = rest.join(':').trim()
    if (key === 'fill') style.fill = value
    else if (key === 'stroke') style.stroke = value
  }
  return style
}

function parseAtShapeBlock(line: string): { id: string; shape?: Shape; label?: string; isEdgeConfig: boolean } | null {
  const m = line.match(/^([A-Za-z0-9_][A-Za-z0-9_\-]*)\s*@\s*\{\s*([\s\S]*)\s*\}\s*$/)
  if (!m) return null
  const id = m[1]
  const body = m[2].trim()
  // Edge animation/curve config: `e1@{ curve: linear }` — no shape/label.
  const hasShape = /(?:^|,)\s*shape\s*:/i.test(body)
  const hasLabel = /(?:^|,)\s*label\s*:/i.test(body)
  if (!hasShape && !hasLabel) {
    return { id, isEdgeConfig: true }
  }
  let shape: Shape | undefined
  let label: string | undefined
  const shapeMatch = body.match(/shape\s*:\s*["']?([A-Za-z0-9_-]+)["']?/i)
  if (shapeMatch) shape = mapMermaidShapeName(shapeMatch[1])
  const labelMatch = body.match(/label\s*:\s*(?:"([^"]*)"|'([^']*)'|([^,}]+))/i)
  if (labelMatch) {
    label = stripMarkdownLabel(unescapeLabel((labelMatch[1] ?? labelMatch[2] ?? labelMatch[3] ?? '').trim()))
  }
  return { id, shape, label, isEdgeConfig: false }
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
  const nodeIdSet = new Set<string>()
  const classStyles = new Map<string, ParsedNodeStyle>()
  const nodeClassNames = new Map<string, string[]>()
  let edgeCounter = 0

  let currentSubgraphId: string | null = null
  const subgraphStack: string[] = []
  const lines = normalized.split('\n')

  let skipUntilCloseBrace = false

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const cleanLine = stripComments(rawLine)
    let line = cleanLine.trim()

    if (skipUntilCloseBrace) {
      if (line.includes('}')) skipUntilCloseBrace = false
      continue
    }

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

    ARROW_REGEX.lastIndex = 0
    const matches = [...line.matchAll(ARROW_REGEX)]
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
          pipeLabelMatch = targetPart.match(/^\s*\|"?([^|"]+)"?\|\s*(.*)$/)
          if (pipeLabelMatch) {
            edgeLabel = stripMarkdownLabel(pipeLabelMatch[1].trim())
            targetPart = pipeLabelMatch[2].trim()
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
          const labelOffset = line.slice(arrowIdx + match[0].length).indexOf(pipeLabelMatch[2])
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
    ast: { direction, nodes, edges, subgraphs },
  }
}
