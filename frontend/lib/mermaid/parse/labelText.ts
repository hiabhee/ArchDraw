// Label/text normalization helpers for the Mermaid parser.

/**
 * Mermaid allows labels that span multiple physical lines, e.g.
 *   P0["Partition 0
 * Offset 0"]
 * This parser is line-based, so a bare newline inside a quoted label would
 * otherwise be treated as a fresh statement (creating bogus nodes). Join those
 * continuation lines by replacing the newline inside a quoted region with a
 * literal "\n" escape (which Mermaid itself interprets as a line break). Both
 * " and ' quoted strings are supported, as are \" escapes and %% comments.
 */
export function mergeMultilineLabels(text: string): string {
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

export function unescapeLabel(label: string): string {
  return label
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

/**
 * Strip Mermaid markdown-string wrappers, light emphasis markers, and inline
 * HTML formatting tags, then decode HTML entities. Mermaid renders `<b>`,
 * `<i>`, `<u>`, … as styled text and `&nbsp;` / `&amp;` / `&bull;` as
 * characters; the canvas shows plain labels, so tags and entities must not leak
 * through literally. `<br>` / `<br/>` are intentionally left intact — the build
 * stage splits those into label + subtitle.
 */
const HTML_FORMAT_TAG = /<\/?(?:b|strong|i|em|u|s|mark|sub|sup|small|code|kbd|del|ins)(?:\s[^>]*)?>/gi

const HTML_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  copy: '©',
  reg: '®',
  trade: '™',
  bull: '•',
  middot: '·',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  plusmn: '±',
  times: '×',
  divide: '÷',
  larr: '←',
  uarr: '↑',
  rarr: '→',
  darr: '↓',
  check: '✓',
}

const HTML_ENTITY_PATTERN = /&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g

/** Decode named + numeric HTML entities (`&nbsp;`, `&#39;`, `&#x27;`, …). */
function decodeHtmlEntities(s: string): string {
  return s.replace(HTML_ENTITY_PATTERN, (match, entity: string) => {
    if (entity[0] === '#') {
      const hex = entity[1] === 'x' || entity[1] === 'X'
      const code = hex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      if (Number.isNaN(code)) return match
      try {
        return String.fromCodePoint(code)
      } catch {
        return match
      }
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match
  })
}

export function stripMarkdownLabel(label: string): string {
  let s = label.trim()
  if (s.startsWith('`') && s.endsWith('`') && s.length >= 2) {
    s = s.slice(1, -1)
  }
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/__([^_]+)__/g, '$1')
  s = s.replace(/\*([^*]+)\*/g, '$1')
  s = s.replace(/_([^_]+)_/g, '$1')
  s = s.replace(HTML_FORMAT_TAG, '')
  s = decodeHtmlEntities(s)
  return s
}

export function normalizeEdgeLabels(text: string): string {
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
