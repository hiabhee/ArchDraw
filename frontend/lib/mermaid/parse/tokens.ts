// Lexical tokens for the Mermaid statement parser.

export const RESERVED_KEYWORDS = new Set(['end', 'graph', 'flowchart', 'subgraph', 'direction'])

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

export const ARROW_REGEX = new RegExp(`(?:([A-Za-z0-9_][A-Za-z0-9_\\-]*)@)?(${ARROW_TOKEN})`, 'g')
