/**
 * Maps repository-relative file paths to the project-canvas component that owns
 * them, using each node's `data.codePaths` (path prefixes or simple globs).
 * Pure: shared by the activity API and the editor's unmapped-file UI.
 */

export interface CodePathNode {
  id: string;
  type?: string;
  data?: { codePaths?: unknown; label?: unknown } | null;
}

interface CompiledPattern {
  /** Literal characters before the first wildcard — higher means more specific. */
  specificity: number;
  test: (path: string) => boolean;
}

const GROUP_NODE_TYPES = new Set(['groupNode', 'group']);

/** Normalize to a repo-relative POSIX path without leading `./` or `/`. */
export function normalizeRepoPath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/');
}

type GlobToken =
  | { kind: 'char'; char: string }
  | { kind: 'one' } // `?`: one character, not `/`
  | { kind: 'segment' } // `*`: any run without `/`
  | { kind: 'any' } // trailing or inline `**`: any run
  | { kind: 'dirs' }; // `**/`: zero or more whole directories

function tokenizeGlob(pattern: string): GlobToken[] {
  const tokens: GlobToken[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '*' && pattern[i + 1] === '*') {
      if (pattern[i + 2] === '/') {
        tokens.push({ kind: 'dirs' });
        i += 2;
      } else {
        tokens.push({ kind: 'any' });
        i += 1;
      }
    } else if (char === '*') {
      tokens.push({ kind: 'segment' });
    } else if (char === '?') {
      tokens.push({ kind: 'one' });
    } else {
      tokens.push({ kind: 'char', char });
    }
  }
  return tokens;
}

/**
 * Linear-time glob match (tokens × path characters). Patterns come from
 * agents, so a backtracking RegExp (`**a**a**a…`) could stall the server.
 */
function matchGlob(tokens: readonly GlobToken[], path: string): boolean {
  const n = path.length;
  // cur[j]: the tokens so far match path[0..j).
  let cur = new Uint8Array(n + 1);
  cur[0] = 1;
  for (const token of tokens) {
    const next = new Uint8Array(n + 1);
    let seen = 0; // some cur[k] with k <= j - 1 (for `dirs`)
    for (let j = 0; j <= n; j++) {
      switch (token.kind) {
        case 'char':
          if (j > 0 && cur[j - 1] && path[j - 1] === token.char) next[j] = 1;
          break;
        case 'one':
          if (j > 0 && cur[j - 1] && path[j - 1] !== '/') next[j] = 1;
          break;
        case 'segment':
          if (cur[j] || (j > 0 && next[j - 1] && path[j - 1] !== '/')) next[j] = 1;
          break;
        case 'any':
          if (cur[j] || (j > 0 && next[j - 1])) next[j] = 1;
          break;
        case 'dirs':
          if (cur[j] || (seen && path[j - 1] === '/')) next[j] = 1;
          break;
      }
      if (cur[j]) seen = 1;
    }
    cur = next;
  }
  return cur[n] === 1;
}

export function compilePattern(rawPattern: string): CompiledPattern | null {
  const pattern = normalizeRepoPath(rawPattern);
  if (!pattern) return null;

  const wildcardAt = pattern.search(/[*?]/);
  if (wildcardAt === -1) {
    // Plain path: matches the file itself or anything under it as a directory.
    const dir = pattern.replace(/\/+$/, '');
    return {
      specificity: dir.length,
      test: (path) => path === dir || path.startsWith(`${dir}/`),
    };
  }

  const tokens = tokenizeGlob(pattern);
  return { specificity: wildcardAt, test: (path) => matchGlob(tokens, path) };
}

export function getCodePaths(node: CodePathNode): string[] {
  const value = node.data?.codePaths;
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

export interface ComponentMatcher {
  match: (filePath: string) => string | null;
}

/**
 * Build a matcher over the given nodes. The most specific pattern wins; on a
 * tie a leaf component beats a group so activity lands on the concrete box.
 */
export function createComponentMatcher(nodes: readonly CodePathNode[]): ComponentMatcher {
  const entries: Array<{ nodeId: string; isGroup: boolean; pattern: CompiledPattern }> = [];
  for (const node of nodes) {
    const isGroup = GROUP_NODE_TYPES.has(node.type ?? '');
    for (const raw of getCodePaths(node)) {
      const pattern = compilePattern(raw);
      if (pattern) entries.push({ nodeId: node.id, isGroup, pattern });
    }
  }

  return {
    match(filePath) {
      const path = normalizeRepoPath(filePath);
      if (!path) return null;
      let best: (typeof entries)[number] | null = null;
      for (const entry of entries) {
        if (!entry.pattern.test(path)) continue;
        if (
          !best ||
          entry.pattern.specificity > best.pattern.specificity ||
          (entry.pattern.specificity === best.pattern.specificity && best.isGroup && !entry.isGroup)
        ) {
          best = entry;
        }
      }
      return best?.nodeId ?? null;
    },
  };
}
