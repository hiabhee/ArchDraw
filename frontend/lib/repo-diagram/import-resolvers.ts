import type { FileEntry } from '@/lib/types/repo-diagram';
import type { TsAliasConfig } from './import-graph';

export type ResolveResult =
  | { kind: 'internal'; path: string }
  | { kind: 'external'; path: string }
  | { kind: 'unresolved'; path: string };

const JS_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'];
const PY_EXTENSIONS = ['py'];
const GO_EXTENSIONS = ['go'];
const JAVA_EXTENSIONS = ['java'];
const RS_EXTENSIONS = ['rs'];

const NODE_BUILTINS = new Set([
  'fs', 'path', 'os', 'http', 'https', 'url', 'util', 'crypto', 'stream',
  'buffer', 'events', 'child_process', 'worker_threads', 'net', 'dns', 'tls',
  'zlib', 'querystring', 'assert', 'process', 'readline', 'repl', 'vm', 'timers',
  'string_decoder', 'cluster', 'dgram', 'perf_hooks', 'async_hooks', 'inspector',
]);

/**
 * Resolve a raw import specifier to (a) an internal repo file path, (b) an
 * external package name, or (c) unresolved.
 *
 * @param files all ingested files (for reading go.mod / tsconfig)
 */
export function resolveImportSpec(
  spec: string,
  importer: string,
  fileSet: Set<string>,
  treeByBase: Map<string, string[]>,
  tsAliasConfig: TsAliasConfig | undefined,
  files: FileEntry[]
): ResolveResult {
  if (!spec) return { kind: 'unresolved', path: spec };

  // ─── Detect importer language to drive strategy ───
  const importerExt = (importer.split('.').pop() || '').toLowerCase();

  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(`.${importerExt}`)) {
    return resolveJs(spec, importer, fileSet, treeByBase, tsAliasConfig);
  }
  if (importerExt === 'py') {
    return resolvePython(spec, importer, fileSet, files);
  }
  if (importerExt === 'go') {
    return resolveGo(spec, importer, fileSet, files);
  }
  if (importerExt === 'java') {
    return { kind: 'external', path: spec.split('.').slice(0, 2).join('.') };
  }
  if (importerExt === 'rs') {
    return resolveRust(spec, importer, fileSet, files);
  }
  return { kind: 'unresolved', path: spec };
}

// ─── JS/TS resolution ────────────────────────────────────────

function resolveJs(
  spec: string,
  importer: string,
  fileSet: Set<string>,
  treeByBase: Map<string, string[]>,
  tsAliasConfig: TsAliasConfig | undefined
): ResolveResult {
  // Relative / absolute-from-importer specifiers
  if (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/')) {
    const resolved = resolveRelative(spec, importer, fileSet, JS_EXTENSIONS);
    if (resolved) return { kind: 'internal', path: resolved };
  }

  // TS path aliases — match longest prefix first.
  if (tsAliasConfig && tsAliasConfig.aliases.length > 0) {
    for (const { pattern, target } of tsAliasConfig.aliases) {
      if (matchesAlias(spec, pattern)) {
        const targetPath = applyAlias(spec, pattern, target, tsAliasConfig.baseUrl);
        const resolved = resolveAliasTarget(targetPath, fileSet, JS_EXTENSIONS);
        if (resolved) return { kind: 'internal', path: resolved };
      }
    }
  }

  // Bare specifier — relative-looking secret resolution: try basename in same dir + index.
  if (spec.startsWith('.')) {
    return { kind: 'unresolved', path: spec };
  }

  // Bare specifier → external (npm package). Strip subpath.
  if (/^node:/.test(spec)) return { kind: 'external', path: spec.slice('node:'.length) };
  if (NODE_BUILTINS.has(spec.split('/')[0])) return { kind: 'external', path: spec.split('/')[0] };

  const pkg = spec.startsWith('@')
    ? spec.split('/').slice(0, 2).join('/')
    : spec.split('/')[0];
  if (!pkg) return { kind: 'unresolved', path: spec };
  return { kind: 'external', path: pkg };
}

/** Pattern like "@/foo/*" → true for spec "@/foo/bar". */
function matchesAlias(spec: string, pattern: string): boolean {
  const base = pattern.replace(/\/\*$/, '');
  return spec === base || spec.startsWith(base + '/');
}

/** "@/*" → "./src/*"; spec "@/components/Button" → "./src/components/Button". */
function applyAlias(spec: string, pattern: string, target: string, baseUrl: string): string {
  const base = pattern.replace(/\/\*$/, '');
  const suffix = spec.startsWith(base + '/') ? spec.slice(base.length + 1) : '';
  // Normalize targetBase — strip "/*" suffix, leading "./", collapse "." → "".
  let targetBase = target.replace(/\/\*$/, '').replace(/^\.\//, '');
  if (targetBase === '.' || targetBase === '') targetBase = '';
  const rel = suffix ? (targetBase ? `${targetBase}/${suffix}` : suffix) : targetBase;
  // Normalize baseUrl — strip leading "./", trailing "/" — "." treated as root "".
  let normBase = baseUrl.replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');
  if (normBase === '.') normBase = '';
  const joined = normBase ? `${normBase}/${rel.replace(/^\/+/, '')}` : rel;
  return joined.replace(/^\/+/, '').replace(/^\.\//, '');
}

function resolveAliasTarget(targetPath: string, fileSet: Set<string>, exts: string[]): string | null {
  const norm = targetPath.replace(/^\.\//, '').replace(/\/+/g, '/');
  // Try the target verbatim, then with extensions, then with /index.<ext>.
  for (const ext of ['', ...exts.map((e) => '.' + e)]) {
    const candidate = norm + ext;
    if (fileSet.has(candidate)) return candidate;
  }
  for (const ext of exts) {
    const candidate = `${norm}/index.${ext}`;
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

function resolveRelative(spec: string, importer: string, fileSet: Set<string>, exts: string[]): string | null {
  const dir = importer.includes('/') ? importer.slice(0, importer.lastIndexOf('/')) : '';
  let combined = (dir || '') + '/' + spec.replace(/^\.\//, '');
  combined = combined.replace(/\/+/g, '/').replace(/^\.\//, '');
  // Collapse ..
  combined = collapseDots(combined);
  // Try exact, +ext, +/index.ext
  for (const ext of ['', ...exts.map((e) => '.' + e)]) {
    const candidate = combined + ext;
    if (fileSet.has(candidate)) return candidate;
  }
  for (const ext of exts) {
    const candidate = `${combined}/index.${ext}`;
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

/** Collapse "../" segments: a/../b → b. */
function collapseDots(path: string): string {
  const parts = path.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop();
    } else if (part !== '.' && part !== '') {
      out.push(part);
    }
  }
  return out.join('/');
}

// ─── Python resolution ──────────────────────────────────────

function resolvePython(spec: string, importer: string, fileSet: Set<string>, files: FileEntry[]): ResolveResult {
  // Relative: from . import x → resolve module dir of importer.
  if (spec.startsWith('.')) {
    const dots = spec.match(/^\.+/)![0].length;
    const rest = spec.slice(dots).replace(/^\./, '');
    // Up one dir per dot beyond the first; first dot = current package.
    const segments = importer.split('/').slice(0, -1);
    const upDirs = Math.max(0, dots - 1);
    const base = segments.slice(0, segments.length - upDirs).join('/');
    if (rest) {
      const candidate = base ? `${base}/${rest.replace(/\./g, '/')}` : rest.replace(/\./g, '/');
      const file = resolvePyModule(candidate, fileSet);
      if (file) return { kind: 'internal', path: file };
    } else {
      const file = resolvePyModule(base, fileSet);
      if (file) return { kind: 'internal', path: file };
    }
    return { kind: 'unresolved', path: spec };
  }

  // Absolute: try repo root + each known subsystem root + src/.
  const candidateRoots = collectPythonRoots(files);
  const modulePath = spec.replace(/\./g, '/');
  for (const root of candidateRoots) {
    const candidate = root ? `${root}/${modulePath}` : modulePath;
    const file = resolvePyModule(candidate, fileSet);
    if (file) return { kind: 'internal', path: file };
  }
  // External — first segment is the package name (e.g. "fastapi").
  const top = spec.split('.')[0];
  if (STD_PY_STDLIB.has(top)) return { kind: 'external', path: top };
  return { kind: 'external', path: top };
}

const STD_PY_STDLIB = new Set([
  'os', 'sys', 're', 'json', 'typing', 'datetime', 'collections', 'functools',
  'itertools', 'pathlib', 'abc', 'io', 'asyncio', 'logging', 'math', 'time',
  'enum', 'dataclasses', 'contextlib', 'subprocess', 'threading', 'queue',
  'hashlib', 'base64', 'copy', 'random', 'warnings', 'argparse', 'logging',
]);

/** candidate file is either `<module>.py` or `<module>/__init__.py`. */
function resolvePyModule(modulePath: string, fileSet: Set<string>): string | null {
  if (fileSet.has(`${modulePath}.py`)) return `${modulePath}.py`;
  if (fileSet.has(`${modulePath}/__init__.py`)) return `${modulePath}/__init__.py`;
  return null;
}

function collectPythonRoots(files: FileEntry[]): string[] {
  // Common roots (most likely first): '', 'src', 'app', 'app/...top-level...
  const roots = new Set<string>(['', 'src']);
  for (const f of files) {
    if (!f.path.endsWith('.py')) continue;
    if (f.path.endsWith('/__init__.py')) {
      const pkgDir = f.path.slice(0, -'/__init__.py'.length);
      if (pkgDir && !pkgDir.includes('/')) roots.add(pkgDir);
    }
  }
  return Array.from(roots);
}

// ─── Go resolution ──────────────────────────────────────────

function resolveGo(spec: string, _importer: string, fileSet: Set<string>, files: FileEntry[]): ResolveResult {
  const modulePath = findGoModulePath(files);
  if (modulePath && (spec === modulePath || spec.startsWith(modulePath + '/'))) {
    // Internal: strip module prefix and resolve as a directory → files within.
    const sub = spec.startsWith(modulePath + '/') ? spec.slice(modulePath.length + 1) : '';
    if (sub) {
      // Try explicitly named file and any file inside the package dir.
      if (fileSet.has(`${sub}.go`)) return { kind: 'internal', path: `${sub}.go` };
      // Any .go file directly under the package dir.
      for (const p of fileSet) {
        if (p.startsWith(sub + '/') && p.endsWith('.go')) {
          // Return the first match (one edge is enough; multiple are aggregated upstream).
          return { kind: 'internal', path: p };
        }
      }
    }
    return { kind: 'unresolved', path: spec };
  }
  // External — top two segments of the import path (e.g. "github.com/foo").
  const parts = spec.split('/');
  const pkg = parts.length >= 1 ? parts.slice(0, Math.min(3, parts.length)).join('/') : spec;
  return { kind: 'external', path: pkg };
}

function findGoModulePath(files: FileEntry[]): string | null {
  const goMod = files.find((f) => f.path === 'go.mod');
  if (!goMod) return null;
  const m = goMod.content.match(/^module\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

// ─── Rust resolution ─────────────────────────────────────────

function resolveRust(spec: string, _importer: string, fileSet: Set<string>, files: FileEntry[]): ResolveResult {
  const crateName = findRustCrateName(files);
  if (crateName) {
    const base = spec.split('::')[0];
    if (base === 'crate' || base === 'self' || base === 'super' || base === crateName) {
      const cols = spec.split('::').slice(base === 'crate' || base === crateName ? 1 : 0).filter(Boolean);
      if (cols.length === 0) {
        // The crate itself — resolve to src/lib.rs.
        if (fileSet.has('src/lib.rs')) return { kind: 'internal', path: 'src/lib.rs' };
      }
      // Try src/<cols>/mod.rs then src/<cols>.rs
      const rel = cols.join('/');
      if (fileSet.has(`src/${rel}/mod.rs`)) return { kind: 'internal', path: `src/${rel}/mod.rs` };
      if (fileSet.has(`src/${rel}.rs`)) return { kind: 'internal', path: `src/${rel}.rs` };
      return { kind: 'unresolved', path: spec };
    }
  }
  return { kind: 'external', path: spec.split('::')[0] };
}

function findRustCrateName(files: FileEntry[]): string | null {
  const cargo = files.find((f) => f.path === 'Cargo.toml');
  if (!cargo) return null;
  const m = cargo.content.match(/^\s*\[package\][\s\S]*?name\s*=\s*"([^"]+)"/m);
  return m ? m[1] : null;
}

// ─── TS alias config builder (reads tsconfig.json from ingested files) ─

export function buildTsAliasConfig(files: FileEntry[]): TsAliasConfig | undefined {
  const tsconfigFiles = files.filter((f) => f.path === 'tsconfig.json' || f.path === 'jsconfig.json');
  // Prefer the root tsconfig; fall back to any.
  const tsconfig = tsconfigFiles.find((f) => f.path === 'tsconfig.json') ||
    tsconfigFiles.find((f) => f.path === 'jsconfig.json') || tsconfigFiles[0];
  if (!tsconfig) return undefined;
  try {
    const stripped = tsconfig.content.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const parsed = JSON.parse(stripped) as Record<string, unknown>;
    const co = (parsed.compilerOptions || {}) as Record<string, unknown>;
    const baseUrl = typeof co.baseUrl === 'string' ? co.baseUrl : '';
    const paths = co.paths as Record<string, string[]> | undefined;
    if (!paths) return baseUrl ? { baseUrl, aliases: [] } : undefined;
    const aliases: { pattern: string; target: string }[] = [];
    for (const [pattern, targets] of Object.entries(paths)) {
      const target = Array.isArray(targets) && targets.length > 0 ? targets[0] : '';
      if (target) aliases.push({ pattern, target });
    }
    // Sort longest-pattern first for greedy matching.
    aliases.sort((a, b) => b.pattern.length - a.pattern.length);
    return { baseUrl, aliases };
  } catch {
    return undefined;
  }
}