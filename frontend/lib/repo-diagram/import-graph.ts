import type { FileEntry } from '@/lib/types/repo-diagram';
import { resolveImportSpec } from './import-resolvers';

/**
 * Evidence-based import graph built from static regex extraction (no parser dep).
 *
 * `edges`: importer file → set of imported *internal* files (paths that exist in
 *   the repo's fileTree).
 * `external`: file → set of external package names (npm packages, PyPI modules,
 *   Go modules, Maven coordinates) — used as dependency evidence, not edges.
 * `unresolved`: file → list of import specifiers we couldn't resolve to a real
 *   file (kept for debugging; never used to fabricate edges).
 * `aliasMaps`: per-tsconfig path-alias maps actually used (for diagnostics).
 */
export type ImportGraph = {
  edges: Map<string, Set<string>>;
  external: Map<string, Set<string>>;
  unresolved: Map<string, string[]>;
};

const SUPPORTED_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|java|rs|rb|php|cs|swift|kt|css|scss|less|ex|exs)$/i;

/** Build an import graph from selected files + the full fileTree (for resolution). */
export function buildImportGraph(
  files: FileEntry[],
  fileTree: string[],
  tsAliasConfig?: TsAliasConfig
): ImportGraph {
  const fileSet = new Set(fileTree);
  const graph: ImportGraph = {
    edges: new Map(),
    external: new Map(),
    unresolved: new Map(),
  };

  // Pre-build a path-normalized lookup for speedy resolution.
  const treeByBase = indexByBaseName(fileTree);

  for (const file of files) {
    if (!SUPPORTED_EXT.test(file.path)) continue;
    const importPaths = extractImports(file);
    if (importPaths.length === 0) continue;

    const importer = file.path;
    for (const { spec } of importPaths) {
      const resolved = resolveImportSpec(spec, importer, fileSet, treeByBase, tsAliasConfig, files);
      if (resolved.kind === 'internal' && resolved.path && fileSet.has(resolved.path) && resolved.path !== importer) {
        let set = graph.edges.get(importer);
        if (!set) { set = new Set(); graph.edges.set(importer, set); }
        set.add(resolved.path);
      } else if (resolved.kind === 'external' && resolved.path) {
        let set = graph.external.get(importer);
        if (!set) { set = new Set(); graph.external.set(importer, set); }
        set.add(resolved.path);
      } else if (resolved.kind === 'unresolved' && resolved.path) {
        let list = graph.unresolved.get(importer);
        if (!list) { list = []; graph.unresolved.set(importer, list); }
        if (list.length < 50) list.push(resolved.path);
      }
    }
  }

  return graph;
}

export type AliasEntry = { pattern: string; target: string };

/** Per-tsconfig alias config. `baseUrl` (repo root '') + list of {pattern,target} entries. */
export type TsAliasConfig = {
  baseUrl: string;
  aliases: AliasEntry[];
};

// ─── Per-language import extraction ──────────────────────────

type RawImport = { spec: string };

/** Extract raw import specifiers from a source file, language-aware. */
export function extractImports(file: FileEntry): RawImport[] {
  const raw: string[] = [];

  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file.path)) {
    raw.push(...extractJsImports(file.content));
  } else if (/\.py$/i.test(file.path)) {
    raw.push(...extractPythonImports(file.content));
  } else if (/\.go$/i.test(file.path)) {
    raw.push(...extractGoImports(file.content));
  } else if (/\.java$/i.test(file.path)) {
    raw.push(...extractJavaImports(file.content));
  } else if (/\.rs$/i.test(file.path)) {
    raw.push(...extractRustImports(file.content));
  } else if (/\.(rb)$/i.test(file.path)) {
    raw.push(...extractRubyImports(file.content));
  } else if (/\.(php)$/i.test(file.path)) {
    raw.push(...extractPhpImports(file.content));
  } else if (/\.(cs)$/i.test(file.path)) {
    raw.push(...extractCsharpImports(file.content));
  } else if (/\.(swift)$/i.test(file.path)) {
    raw.push(...extractSwiftImports(file.content));
  } else if (/\.(kt)$/i.test(file.path)) {
    raw.push(...extractKotlinImports(file.content));
  } else if (/\.(css|scss|less)$/i.test(file.path)) {
    raw.push(...extractCssImports(file.content));
  } else if (/\.(ex|exs)$/i.test(file.path)) {
    raw.push(...extractElixirImports(file.content));
  }

  // Dedup preserving order.
  return Array.from(new Set(raw)).map((s) => ({ spec: s }));
}

// ─── JS/TS ───────────────────────────────────────────────────
// Handles: import x from 'mod'; import 'mod'; export ... from 'mod';
// require('mod'); await import('mod'); dynamic import('mod').

const JS_IMPORT_RE = [
  // from "mod" — captures both `import X from "mod"` and `export X from "mod"`.
  // Restricted to non-newline specifiers so we don't span across statements.
  /\bfrom\s+(['"`])([^'"`\n]+)\1/g,
  // Side-effect: `import "mod";` (no `from` keyword on the same line).
  /\bimport\s+(['"`])([^'"`\n]+)\1(?=\s*[;}\n])/g,
  // require("mod")
  /\brequire\s*\(\s*['"`]([^'"`\n]+)['"`]\s*\)/g,
  // dynamic import("mod") — synchronous-expression form.
  /\bimport\s*\(\s*['"`]([^'"`\n]+)['"`]\s*\)/g,
];

export function extractJsImports(content: string): string[] {
  const out = new Set<string>();
  for (const re of JS_IMPORT_RE) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      // Both `from "..."` and side-effect capture the spec at group 2; require/import() at group 1.
      const spec = m[2] ?? m[1];
      if (!spec) continue;
      if (/^(\/\/|\/\*|\*)/.test(spec)) continue;
      out.add(spec);
    }
  }
  return Array.from(out);
}

// ─── Python ──────────────────────────────────────────────────

const PY_IMPORT_RE = [
  // import a.b.c  (optionally with trailing "as alias")
  /^\s*import\s+([A-Za-z_][\w.]*)\s*(?:as\s+\w+)?$/gm,
  // from a.b.c import x, y   (single-line form)
  /^\s*from\s+([A-Za-z_][\w.]*|\.+[\w.]*)\s+import\s+([^\n]+)$/gm,
  // from a.b.c import (multi-line list)
  /^\s*from\s+([A-Za-z_][\w.]*|\.+[\w.]*)\s+import\s*\(/gm,
];

export function extractPythonImports(content: string): string[] {
  const out = new Set<string>();
  for (const re of PY_IMPORT_RE) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      let s = m[1];
      if (!s) continue;
      s = s.trim();
      if (!s) continue;
      out.add(s);
      // For single-line "from x import ...", resolve the full module path.
      if (m[2]) {
        // Resolve imported names too (only the ones that look like submodule paths).
        for (const name of m[2].split(',').map((n) => n.trim().split(/\s+as\s+/)[0].trim())) {
          if (!name) continue;
          if (s.startsWith('.')) {
            // relative: combine dots + name as a module ref
            out.add(s + '.' + name.split('.')[0]);
          } else if (/^[A-Za-z_]\w*$/.test(name)) {
            // absolute dotted path: "from a.b import x" can refer to submodule "a.b.x"
            // but we only know it's a submodule if "a.b.x" exists as a file — defer to resolver.
          }
        }
      }
    }
  }
  return Array.from(out);
}

// ─── Go ──────────────────────────────────────────────────────

const GO_IMPORT_RE = /^\s*import\s+(?:\(\s*([\s\S]*?)\s*\)|([^\n]+))/gm;

export function extractGoImports(content: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(GO_IMPORT_RE);
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const block = m[1] || m[2] || '';
    if (!block) continue;
    // Each line of a block may be "alias "path"" or just "path".
    const pathRe = /"([^"]+)"/g;
    let pm: RegExpExecArray | null;
    while ((pm = pathRe.exec(block)) !== null) {
      out.add(pm[1]);
    }
  }
  return Array.from(out);
}

// ─── Java ────────────────────────────────────────────────────

const JAVA_IMPORT_RE = /^\s*import\s+(static\s+)?([\w.]+);/gm;

export function extractJavaImports(content: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(JAVA_IMPORT_RE);
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const pkg = m[2];
    if (!pkg) continue;
    out.add(pkg);
  }
  return Array.from(out);
}

// ─── Rust ────────────────────────────────────────────────────

const RUST_USE_RE = /\buse\s+([A-Za-z_][\w:]*(?:::\{[^}]+\})?)\s*;/g;

export function extractRustImports(content: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(RUST_USE_RE);
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const s = m[1];
    if (!s) continue;
    // Strip braces: use foo::{a, b} → foo
    const cleaned = s.replace(/::\{[^}]+\}$/, '');
    out.add(cleaned);
  }
  return Array.from(out);
}

// ─── Ruby ────────────────────────────────────────────────────

const RUBY_REQUIRE_RE = /^\s*(?:require|require_relative|load|include|extend)\s+['"]([^'"]+)['"]/gm;

export function extractRubyImports(content: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(RUBY_REQUIRE_RE);
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const spec = m[1];
    if (!spec) continue;
    out.add(spec);
  }
  return Array.from(out);
}

// ─── PHP ─────────────────────────────────────────────────────

const PHP_USE_RE = /^\s*(?:use|require|require_once|include|include_once)\s+['"]([^'"]+)['"]\s*;/gm;

export function extractPhpImports(content: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(PHP_USE_RE);
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const spec = m[1];
    if (!spec) continue;
    out.add(spec);
  }
  return Array.from(out);
}

// ─── C# ──────────────────────────────────────────────────────

const CSHARP_USING_RE = /^\s*using\s+([\w.]+)(?:\s*=\s*[\w.]+)?\s*;/gm;

export function extractCsharpImports(content: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(CSHARP_USING_RE);
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const ns = m[1];
    if (!ns) continue;
    out.add(ns);
  }
  return Array.from(out);
}

// ─── Swift ───────────────────────────────────────────────────

const SWIFT_IMPORT_RE = /^\s*import\s+(\w+(?:\.\w+)*)/gm;

export function extractSwiftImports(content: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(SWIFT_IMPORT_RE);
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const mod = m[1];
    if (!mod) continue;
    out.add(mod);
  }
  return Array.from(out);
}

// ─── Kotlin ──────────────────────────────────────────────────

const KOTLIN_IMPORT_RE = /^\s*import\s+([\w.*]+)/gm;

export function extractKotlinImports(content: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(KOTLIN_IMPORT_RE);
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const pkg = m[1];
    if (!pkg) continue;
    out.add(pkg);
  }
  return Array.from(out);
}

// ─── CSS/SCSS ────────────────────────────────────────────────

const CSS_IMPORT_RE = /@import\s+['"]([^'"]+)['"]/g;

export function extractCssImports(content: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(CSS_IMPORT_RE);
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const spec = m[1];
    if (!spec) continue;
    out.add(spec);
  }
  return Array.from(out);
}

// ─── Elixir ──────────────────────────────────────────────────

const ELIXIR_USE_RE = /^\s*(?:use|alias|import|require)\s+([\w.]+)/gm;

export function extractElixirImports(content: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(ELIXIR_USE_RE);
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const mod = m[1];
    if (!mod) continue;
    out.add(mod);
  }
  return Array.from(out);
}

// ─── Helpers ────────────────────────────────────────────────

/** Index the fileTree by base filename for fast relative-resolution fall-through. */
function indexByBaseName(tree: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const p of tree) {
    const base = p.split('/').pop() || '';
    if (!base) continue;
    const arr = map.get(base);
    if (arr) arr.push(p); else map.set(base, [p]);
  }
  return map;
}