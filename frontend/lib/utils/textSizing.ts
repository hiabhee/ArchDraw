/**
 * Free-text node sizing — single source of truth for font maps and dimension
 * estimates shared by TextLabelNode / AnnotationNode, the Mermaid build stage,
 * and SVG export. Keeping the font maps here (instead of duplicated in the
 * components) ensures the layout box reserved by Dagre matches the rendered
 * node size.
 */

export type TextSize = 'small' | 'medium' | 'large' | 'heading'

export const TEXT_LABEL_FONT_SIZE: Record<TextSize, number> = {
  small: 24,
  medium: 32,
  large: 48,
  heading: 72,
}

export const TEXT_LABEL_FONT_WEIGHT: Record<TextSize, number> = {
  small: 400,
  medium: 500,
  large: 600,
  heading: 700,
}

export const ANNOTATION_FONT_SIZE: Record<TextSize, number> = {
  small: 20,
  medium: 24,
  large: 28,
  heading: 32,
}

export const ANNOTATION_FONT_WEIGHT: Record<TextSize, number> = {
  small: 400,
  medium: 500,
  large: 600,
  heading: 700,
}

export interface TextDimensions {
  width: number
  height: number
}

/** Average character width as a fraction of the font size. */
const AVG_CHAR_FACTOR = 0.6

const TEXT_LINE_HEIGHT = 1.3
const TEXT_PADDING_X = 16
const TEXT_PADDING_Y = 12
const TEXT_MIN_WIDTH = 60
const TEXT_MIN_HEIGHT = 30
/** Generous cap — headings may render wider than the 160/200/240 node grid. */
const TEXT_MAX_WIDTH = 560

const ANNOTATION_LINE_HEIGHT = 1.4
const ANNOTATION_PADDING_X = 24
const ANNOTATION_PADDING_Y = 20
const ANNOTATION_MIN_WIDTH = 180
const ANNOTATION_MIN_HEIGHT = 80
const ANNOTATION_MAX_WIDTH = 360

function linesOf(text: string | undefined): string[] {
  return String(text || '')
    .split(/\n/)
    .filter(Boolean)
}

/**
 * Estimate the natural size of a TextLabelNode (rendered `fit-content`, so the
 * box matches a single unwrapped line per explicit line break).
 */
export function estimateTextNodeSize(text: string, size: TextSize = 'medium'): TextDimensions {
  const fontSize = TEXT_LABEL_FONT_SIZE[size]
  const lines = linesOf(text || 'Text')
  const longestLine = Math.max(1, ...lines.map((line) => line.length))
  const width = Math.min(
    TEXT_MAX_WIDTH,
    Math.max(TEXT_MIN_WIDTH, Math.round(longestLine * fontSize * AVG_CHAR_FACTOR + TEXT_PADDING_X))
  )
  const height = Math.max(
    TEXT_MIN_HEIGHT,
    Math.round(Math.max(1, lines.length) * fontSize * TEXT_LINE_HEIGHT + TEXT_PADDING_Y)
  )
  return { width, height }
}

/**
 * Estimate a reasonable AnnotationNode box (rendered with a fixed React Flow
 * size + NodeResizer, so width/height are authoritative and text wraps inside).
 */
export function estimateAnnotationNodeSize(title?: string, body?: string): TextDimensions {
  const titleFont = ANNOTATION_FONT_SIZE.heading
  const bodyFont = ANNOTATION_FONT_SIZE.medium
  const titleLines = linesOf(title || 'Note')
  const bodyLines = linesOf(body)
  const longestLine =
    titleLines.length + bodyLines.length > 0
      ? Math.max(...titleLines.map((line) => line.length), ...bodyLines.map((line) => line.length))
      : 1
  const width = Math.min(
    ANNOTATION_MAX_WIDTH,
    Math.max(ANNOTATION_MIN_WIDTH, Math.round(longestLine * bodyFont * AVG_CHAR_FACTOR + ANNOTATION_PADDING_X))
  )
  const height = Math.max(
    ANNOTATION_MIN_HEIGHT,
    Math.round(
      Math.max(1, titleLines.length) * titleFont * ANNOTATION_LINE_HEIGHT +
        bodyLines.length * bodyFont * ANNOTATION_LINE_HEIGHT +
        ANNOTATION_PADDING_Y
    )
  )
  return { width, height }
}
