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

function escapeRegex(value: string) {
  return value.replace(/[.+^${}()|[\]\\]/g, '\\$&');
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

  let source = '';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '*' && pattern[i + 1] === '*') {
      // `**/` matches zero or more directories; a trailing `**` matches anything.
      if (pattern[i + 2] === '/') {
        source += '(?:.*/)?';
        i += 2;
      } else {
        source += '.*';
        i += 1;
      }
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += escapeRegex(char);
    }
  }
  const regex = new RegExp(`^${source}$`);
  return { specificity: wildcardAt, test: (path) => regex.test(path) };
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
