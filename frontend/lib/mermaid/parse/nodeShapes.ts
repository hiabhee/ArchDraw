// Statement-level helpers: shape detection, label extraction, arrows, styles.

import type { Direction, Shape, EdgeType, ParsedNodeStyle } from '../types'
import { stripComments } from './directives'
import { unescapeLabel, stripMarkdownLabel } from './labelText'

export function splitStatements(line: string): string[] {
  const statements: string[] = []
  let current = ''
  let inQuote: '"' | "'" | '' = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      current += ch
      if (ch === '\\' && i + 1 < line.length) {
        current += line[i + 1]
        i++
      } else if (ch === inQuote) {
        inQuote = ''
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch
      current += ch
      continue
    }
    if (ch === ';') {
      statements.push(current)
      current = ''
      continue
    }
    current += ch
  }
  statements.push(current)
  return statements
}

export function extractId(raw: string): string | null {
  const m = raw.match(/^([A-Za-z0-9_][A-Za-z0-9_\-]*)/)
  return m ? m[1] : null
}

/** Map Mermaid `@{ shape: name }` / aliases onto ArchDraw canvas shapes. */
export function mapMermaidShapeName(name: string): Shape {
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

export function detectDirection(text: string): Direction {
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

export function detectShape(line: string): Shape {
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

export function extractNodeLabel(line: string): string | null {
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
export function splitByAmpersand(segment: string): string[] {
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

export function classifyArrow(fullArrow: string): { type: EdgeType; embeddedLabel: string | null } {
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

export function parseStyleProps(props: string): ParsedNodeStyle {
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

export function parseAtShapeBlock(line: string): { id: string; shape?: Shape; label?: string; isEdgeConfig: boolean } | null {
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
