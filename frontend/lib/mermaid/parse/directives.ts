// Comment/frontmatter stripping and ArchDraw `%%` directive parsing.

import type { ParsedText, TextSize, TextAnchor } from '../types'
import { SUPPORTED_SHAPES, type ShapeType } from '@/lib/shapeRegistry'

/** Drop YAML frontmatter (`---` … `---`) that Mermaid accepts before the diagram. */
export function stripFrontmatter(text: string): string {
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

export function stripComments(line: string): string {
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

const TEXT_SIZE_VALUES: TextSize[] = ['small', 'medium', 'large', 'heading']
const TEXT_ANCHOR_VALUES: TextAnchor[] = ['top', 'subgraph', 'node', 'none']

/**
 * Parse an ArchDraw free-text directive, e.g.
 *   %% archdraw-text: {"id":"title","text":"System Architecture","size":"heading","anchor":"top"}
 *   %% archdraw-note: {"id":"n1","title":"Note","body":"...","anchor":"none","x":120,"y":40}
 * Mermaid treats these as plain comments (invisible to stock renderers), but
 * the pipeline captures them so text nodes round-trip through the canonical
 * Mermaid path. Returns null when the line is not a valid directive.
 */
export function parseArchdrawDirective(rawLine: string): ParsedText | null {
  const trimmed = rawLine.trim()
  if (!trimmed.startsWith('%%')) return null
  const m = trimmed.match(/^%%\s*archdraw-(text|note)\s*:\s*(.*)$/i)
  if (!m) return null
  const kind: ParsedText['kind'] = m[1].toLowerCase() === 'note' ? 'note' : 'text'
  const payload = m[2].trim()
  const open = payload.indexOf('{')
  const close = payload.lastIndexOf('}')
  if (open === -1 || close === -1 || close <= open) return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(payload.slice(open, close + 1)) as Record<string, unknown>
  } catch {
    return null
  }

  if (typeof parsed.id !== 'string' || parsed.id.length === 0) return null

  const size =
    typeof parsed.size === 'string' && TEXT_SIZE_VALUES.includes(parsed.size as TextSize)
      ? (parsed.size as TextSize)
      : undefined
  const anchor =
    typeof parsed.anchor === 'string' && TEXT_ANCHOR_VALUES.includes(parsed.anchor as TextAnchor)
      ? (parsed.anchor as TextAnchor)
      : 'none'

  const base: ParsedText = {
    id: parsed.id,
    kind,
    size,
    anchor,
    anchorTarget:
      typeof parsed.anchorTarget === 'string' && parsed.anchorTarget.length > 0
        ? parsed.anchorTarget
        : undefined,
    position:
      typeof parsed.x === 'number' && typeof parsed.y === 'number'
        ? { x: parsed.x, y: parsed.y }
        : null,
  }

  if (kind === 'note') {
    base.title = typeof parsed.title === 'string' ? parsed.title : undefined
    base.body = typeof parsed.body === 'string' ? parsed.body : undefined
    if (!base.title && !base.body) return null
  } else {
    base.text = typeof parsed.text === 'string' ? parsed.text : ''
    if (!base.text) return null
  }

  return base
}

/**
 * Parse a `%% archdraw-shape: {"id":"lb","shape":"hexagon"}` override
 * directive. Mermaid renders the node with its native (rectangle) token; the
 * pipeline applies the silhouette on build. Returns null when invalid.
 */
export function parseArchdrawShapeDirective(rawLine: string): { id: string; shape: ShapeType } | null {
  const trimmed = rawLine.trim()
  if (!trimmed.startsWith('%%')) return null
  const m = trimmed.match(/^%%\s*archdraw-shape\s*:\s*(.*)$/i)
  if (!m) return null
  const payload = m[1].trim()
  const open = payload.indexOf('{')
  const close = payload.lastIndexOf('}')
  if (open === -1 || close === -1 || close <= open) return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(payload.slice(open, close + 1)) as Record<string, unknown>
  } catch {
    return null
  }

  if (typeof parsed.id !== 'string' || parsed.id.length === 0) return null
  if (typeof parsed.shape !== 'string' || !SUPPORTED_SHAPES.includes(parsed.shape as ShapeType)) {
    return null
  }
  return { id: parsed.id, shape: parsed.shape as ShapeType }
}
