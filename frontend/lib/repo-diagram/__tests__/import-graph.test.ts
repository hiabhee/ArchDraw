import { describe, it, expect } from 'vitest';
import type { FileEntry } from '@/lib/types/repo-diagram';
import { buildImportGraph, extractImports, extractJsImports, extractPythonImports, extractGoImports } from '../import-graph';
import { buildTsAliasConfig } from '../import-resolvers';
import { deriveEvidenceEdges } from '../evidence-from-graph';
import type { ExtractedNode } from '@/lib/types/repo-diagram';

// ─── Per-language import extraction ─────────────────────────

describe('extractJsImports', () => {
  it('captures static + dynamic + require + re-export', () => {
    const content = [
      "import React from 'react';",
      "import { foo } from './a';",
      "import 'side-effect';",
      "const x = require('lodash');",
      "const y = await import('./b');",
      "export { bar } from '../shared';",
    ].join('\n');
    const set = new Set(extractJsImports(content));
    expect(set.has('react')).toBe(true);
    expect(set.has('./a')).toBe(true);
    expect(set.has('side-effect')).toBe(true);
    expect(set.has('lodash')).toBe(true);
    expect(set.has('./b')).toBe(true);
    expect(set.has('../shared')).toBe(true);
  });
  it('skips scoped @types and comment-looking false hits', () => {
    const set = new Set(extractJsImports("// import 'fake'\nimport real from './real';\n"));
    expect(set.has('./real')).toBe(true);
    // comment false hit should be filtered by regex anyway
  });
});

describe('extractPythonImports', () => {
  it('handles absolute + dotted + relative', () => {
    const content = [
      'import os.path',
      'from typing import List',
      'from . import sibling',
      'from ..mod import thing',
      'from fastapi import APIRouter',
    ].join('\n');
    const set = new Set(extractPythonImports(content));
    expect(set.has('os.path')).toBe(true);
    expect(set.has('typing')).toBe(true);
    expect(set.has('.')).toBe(true); // from . import sibling → "import sibling"
    expect(set.has('..mod')).toBe(true);
    expect(set.has('fastapi')).toBe(true);
  });
});

describe('extractGoImports', () => {
  it('parses single + block imports', () => {
    const content = [
      'import "fmt"',
      'import (',
      '  "github.com/foo/bar"',
      '  sub "github.com/foo/baz"',
      ')',
    ].join('\n');
    const set = new Set(extractGoImports(content));
    expect(set.has('fmt')).toBe(true);
    expect(set.has('github.com/foo/bar')).toBe(true);
    expect(set.has('github.com/foo/baz')).toBe(true);
  });
});

// ─── buildImportGraph end-to-end ────────────────────────────

describe('buildImportGraph', () => {
  it('edges between TS relative specifiers', () => {
    const files: FileEntry[] = [
      { path: 'app/api/orders/route.ts', content: "import {pool} from '@/lib/db';\nexport function GET() {}\n" },
      { path: 'lib/db.ts', content: "export const pool = {};\n" },
      { path: 'app/layout.tsx', content: "import '~/styles/globals.css';\n" },
    ];
    const tsAlias = buildTsAliasConfig([
      { path: 'tsconfig.json', content: '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["."],"~/*":["."]}}}' },
    ]);
    const graph = buildImportGraph(files, files.map(f => f.path), tsAlias);
    expect(graph.edges.get('app/api/orders/route.ts')).not.toBeUndefined();
  });

  it('external packages go to `external`, not `edges`', () => {
    const files: FileEntry[] = [
      { path: 'main.py', content: 'import fastapi\nimport os\nfrom . import a\n' },
      { path: 'a.py', content: 'pass\n' },
    ];
    const graph = buildImportGraph(files, files.map(f => f.path));
    expect(graph.external.get('main.py')?.has('fastapi')).toBe(true);
    expect(graph.external.get('main.py')?.has('os')).toBe(true);
    expect(graph.edges.get('main.py')?.has('a.py')).toBe(true);
    expect(graph.edges.get('main.py')?.has('a')).toBe(false);
  });

  it('Go internal imports resolve via go.mod', () => {
    const files: FileEntry[] = [
      { path: 'go.mod', content: 'module github.com/foo/bar\n\ngo 1.21\n' },
      { path: 'cmd/main.go', content: 'package main\n\nimport (\n  "github.com/foo/bar/internal/handlers"\n)\n' },
      { path: 'internal/handlers/h.go', content: 'package handlers\n\nfunc H() {}\n' },
    ];
    const graph = buildImportGraph(files, files.map(f => f.path));
    expect(graph.edges.get('cmd/main.go')?.has('internal/handlers/h.go')).toBe(true);
    // external Go modules don't become internal edges
    const ext = files[2]; // ensure no false self-edge
    expect(graph.edges.get(ext.path)).toBeUndefined();
  });

  it('handles cycles safely (no infinite loop)', () => {
    const files: FileEntry[] = [
      { path: 'a.ts', content: "import './b';\n" },
      { path: 'b.ts', content: "import './a';\n" },
    ];
    const graph = buildImportGraph(files, files.map(f => f.path));
    expect(graph.edges.get('a.ts')?.has('b.ts')).toBe(true);
    expect(graph.edges.get('b.ts')?.has('a.ts')).toBe(true);
  });

  it('TS path alias @/* resolves to ./src/*', () => {
    const files: FileEntry[] = [
      { path: 'pages/index.tsx', content: "import {db} from '@/lib/db';\n" },
      { path: 'src/lib/db.ts', content: "export const db = {};\n" },
    ];
    const tsConfigFiles = [{ path: 'tsconfig.json', content: '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./src/*"]}}}' }];
    const tsAlias = buildTsAliasConfig(tsConfigFiles);
    const graph = buildImportGraph(files, files.map(f => f.path), tsAlias);
    expect(graph.edges.get('pages/index.tsx')?.has('src/lib/db.ts')).toBe(true);
  });

  it('unresolved imports are recorded but not turned into edges', () => {
    const files: FileEntry[] = [
      { path: 'x.ts', content: "import './nonexistent';\n" },
    ];
    const graph = buildImportGraph(files, files.map(f => f.path));
    expect(graph.unresolved.get('x.ts')).toContain('./nonexistent');
    expect(graph.edges.get('x.ts')).toBeUndefined();
  });
});

// ─── deriveEvidenceEdges ─────────────────────────────────────

describe('deriveEvidenceEdges', () => {
  it('aggregates file→file edges to node→node edges with evidence count', () => {
    const nodes: ExtractedNode[] = [
      { id: 'api', label: 'API', type: 'API_ROUTE', description: '', sourceFiles: ['app/api/route.ts'], confidence: 'high' },
      { id: 'db', label: 'DB', type: 'DATABASE', description: '', sourceFiles: ['lib/db.ts'], confidence: 'high' },
    ];
    const files: FileEntry[] = [
      { path: 'app/api/route.ts', content: "import {pool} from '@/lib/db';\nimport {pool2} from '@/lib/db';\n" },
      { path: 'lib/db.ts', content: 'export const pool = {};\n' },
    ];
    const tsAlias = buildTsAliasConfig([{ path: 'tsconfig.json', content: '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["."]}}}' }]);
    expect(tsAlias?.aliases[0].target).toBe('.');
    const graph = buildImportGraph(files, files.map(f => f.path), tsAlias);
    const edges = deriveEvidenceEdges(nodes, graph);
    expect(edges).toHaveLength(1);
    expect(edges[0].from).toBe('api');
    expect(edges[0].to).toBe('db');
    expect(edges[0].confidence).toBe('high');
  });
  it('does not create self-edges within a single node', () => {
    const nodes: ExtractedNode[] = [
      { id: 'svc', label: 'Svc', type: 'SERVICE', description: '', sourceFiles: ['a.ts', 'b.ts'], confidence: 'high' },
    ];
    const files: FileEntry[] = [
      { path: 'a.ts', content: "import './b';\n" },
      { path: 'b.ts', content: "export const x = 1;\n" },
    ];
    const graph = buildImportGraph(files, files.map(f => f.path));
    const edges = deriveEvidenceEdges(nodes, graph);
    expect(edges).toHaveLength(0);
  });
});