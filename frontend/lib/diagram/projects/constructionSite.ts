import { getCodePaths, normalizeRepoPath, type CodePathNode } from './pathMatcher';

/**
 * Construction sites: new code an agent writes where no component on the
 * diagram owns it. The site is the outermost folder of the file that no
 * component covers (`src/export` for `src/export/formats/csv.py` when only
 * `src/data/**` and `src/training/**` are mapped), drawn next to the
 * component whose code is nearest. Pure: used by the activity API.
 */

const SOURCE_RE = /\.(m?[jt]sx?|c[jt]s|vue|svelte|astro|py|go|rs|java|kt|kts|rb|php|cs|swift|dart|ex|exs|scala|c|cc|cpp|h|hpp|sql|prisma|graphql|gql|proto)$/i;
const TEST_RE = /(^|\/)(__tests__|__mocks__|tests?|spec|e2e|__snapshots__)(\/|$)|\.(test|spec|stories)\.[^/]+$/i;

/** Source code (not docs, config, assets or tests): what a component is made of. */
export function isSourcePath(path: string): boolean {
  return SOURCE_RE.test(path) && !TEST_RE.test(path);
}

/** Literal folder part of each code path (`src/data/**` → `src/data`). */
function literalPrefixes(nodes: readonly CodePathNode[]): Array<{ id: string; segments: string[] }> {
  const out: Array<{ id: string; segments: string[] }> = [];
  for (const node of nodes) {
    for (const pattern of getCodePaths(node)) {
      const literal = normalizeRepoPath(pattern).split(/[*?[{]/)[0].replace(/\/+$/, '');
      if (literal) out.push({ id: node.id, segments: literal.split('/') });
    }
  }
  return out;
}

/**
 * Folder for a construction site, or null when the file is not new code in a
 * folder of its own (root files, tests, config, or a loose file in a folder
 * whose subfolders are mapped).
 */
export function siteAreaFor(filePath: string, nodes: readonly CodePathNode[]): string | null {
  const path = normalizeRepoPath(filePath);
  if (!isSourcePath(path)) return null;
  const dirs = path.split('/').slice(0, -1);
  if (dirs.length === 0) return null;
  const prefixes = literalPrefixes(nodes);
  for (let depth = 1; depth <= dirs.length; depth++) {
    const area = dirs.slice(0, depth);
    // Some component lives at or under this folder: go one level deeper.
    const covered = prefixes.some((p) => p.segments.length >= depth && area.every((seg, i) => p.segments[i] === seg));
    if (!covered) return area.join('/');
  }
  return null;
}

/** Component whose code shares the longest folder prefix with `area`; else `fallbackId`. */
export function siteAnchorFor(area: string, nodes: readonly CodePathNode[], fallbackId: string | null = null): string | null {
  const segments = area.split('/');
  let best: { id: string; shared: number; length: number } | null = null;
  for (const prefix of literalPrefixes(nodes)) {
    let shared = 0;
    while (shared < segments.length && shared < prefix.segments.length && segments[shared] === prefix.segments[shared]) shared++;
    if (shared === 0) continue;
    if (!best || shared > best.shared || (shared === best.shared && prefix.segments.length < best.length)) {
      best = { id: prefix.id, shared, length: prefix.segments.length };
    }
  }
  return best?.id ?? fallbackId;
}

/** "export" for `src/export`: the folder name a site is labelled with. */
export function siteLabel(area: string): string {
  return area.split('/').filter(Boolean).at(-1) ?? area;
}
