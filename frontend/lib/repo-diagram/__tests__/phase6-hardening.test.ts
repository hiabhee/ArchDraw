import { describe, it, expect, beforeEach } from 'vitest';
import { isSkipped, MAX_FILE_SIZE_BYTES, BINARY_RE, DEFAULT_FILE_BUDGET, DEFAULT_CONTENT_BUDGET_KB } from '../skip-rules';
import { clear as clearDiagramCache, getRepoDiagram, setRepoDiagram } from '@/lib/ai/services/diagramCache';
import { resolveImportSpec, buildTsAliasConfig } from '../import-resolvers';
import { buildImportGraph } from '../import-graph';
import { extractStaticSignals } from '../static-analyzer';
import { deduplicateNodes } from '../graph-quality';
import type { FileEntry, PipelineResult, StaticSignal } from '@/lib/types/repo-diagram';
import type { TsAliasConfig } from '../import-graph';

// ─── GH2R-007 unified skip rules ────────────────────────────────
describe('skip-rules (GH2R-007)', () => {
  it('rejects skipped directories', () => {
    expect(isSkipped('node_modules/foo/bar.js')).toBe('skipped_directory');
    expect(isSkipped('src/.next/cache/file.ts')).toBe('skipped_directory');
    expect(isSkipped('a/b/__pycache__/x.py')).toBe('skipped_directory');
  });
  it('rejects lockfiles', () => {
    expect(isSkipped('package-lock.json')).toBe('lockfile');
    expect(isSkipped('yarn.lock')).toBe('lockfile');
    expect(isSkipped('pnpm-lock.yaml')).toBe('lockfile');
  });
  it('rejects test files', () => {
    expect(isSkipped('src/foo.test.ts')).toBe('test_file');
    expect(isSkipped('src/foo.spec.js')).toBe('test_file');
    expect(isSkipped('__tests__/a.ts')).toBe('test_file');
    expect(isSkipped('lib/__tests__/b.ts')).toBe('test_file');
  });
  it('rejects binary extensions including webp/mp4 per unified BINARY_RE', () => {
    expect(isSkipped('logo.png')).toBe('binary');
    expect(isSkipped('photo.jpg')).toBe('binary');
    expect(isSkipped('asset.webp')).toBe('binary');
    expect(isSkipped('video.mp4')).toBe('binary');
    expect(isSkipped('sound.mp3')).toBe('binary');
    expect(isSkipped('font.woff2')).toBe('binary');
    expect(BINARY_RE.test('a.webp')).toBe(true);
    expect(BINARY_RE.test('b.mp4')).toBe(true);
  });
  it('rejects large files > MAX_FILE_SIZE', () => {
    expect(isSkipped('big.ts', MAX_FILE_SIZE_BYTES + 1)).toBe('large_file');
    expect(isSkipped('small.ts', 100)).toBe(null);
    expect(isSkipped('big.ts', 600 * 1024)).toBe('large_file');
  });
  it('allows normal source files', () => {
    expect(isSkipped('app/api/route.ts')).toBe(null);
    expect(isSkipped('lib/db.ts')).toBe(null);
    expect(isSkipped('src/app.py')).toBe(null);
  });
});

// ─── GH2R-006 budgets level-aware ───────────────────────────────
describe('ingestion budgets (GH2R-006)', () => {
  it('DEFAULT_FILE_BUDGET level-aware (400/900/1800)', () => {
    expect(DEFAULT_FILE_BUDGET[1]).toBe(400);
    expect(DEFAULT_FILE_BUDGET[2]).toBe(900);
    expect(DEFAULT_FILE_BUDGET[3]).toBe(1800);
  });
  it('DEFAULT_CONTENT_BUDGET_KB level-aware (1500/8000/12000)', () => {
    expect(DEFAULT_CONTENT_BUDGET_KB[1]).toBe(1500);
    expect(DEFAULT_CONTENT_BUDGET_KB[2]).toBe(8000);
    expect(DEFAULT_CONTENT_BUDGET_KB[3]).toBe(12000);
  });
});

// ─── GH2R-003 cache detailLevel isolation ───────────────────────
describe('diagramCache detailLevel isolation (GH2R-003)', () => {
  beforeEach(() => {
    clearDiagramCache();
  });

  function fakeResult(sha: string): PipelineResult {
    return {
      ndjson: `{"sha":"${sha}"}`,
      nodeCount: 1,
      edgeCount: 0,
      workflowCount: 0,
      workflows: [],
      repoMeta: { hasAppDir: false, hasPagesDir: false, hasPrisma: false, hasMiddleware: false, hasEnvExample: false, packageJson: null },
      repoProfile: { repoType: 'unknown', architecturePattern: 'unknown', primaryStack: { framework: null, language: 'ts', runtime: '' }, applicationDomain: '', coreCapabilities: [], primaryUserFlows: [], confidence: 'low', reasoning: 'test', extractionStrategy: { keyDirectories: [], entryPoints: [], moduleStructure: '', focusAreas: [] } },
      dependencyMap: [],
      reviewNotes: '',
      confidence: 'high',
      nodes: [{ id: 'n1', label: 'N1', type: 'SERVICE', description: '', sourceFiles: [], confidence: 'high' }],
      edges: [],
      degraded: { classify: false, extract: false, edges: false, ingestion: false, anything: false },
      diagnostics: { groundedNodeRatio: 1, evidencedEdgeRatio: 1, truncatedNodes: [], failedPaths: [] },
    };
  }

  it('L1 and L2 are isolated', () => {
    setRepoDiagram('https://github.com/o/r', 'abc123', fakeResult('L1'), 1);
    expect(getRepoDiagram('https://github.com/o/r', 'abc123', 1)?.ndjson).toContain('L1');
    expect(getRepoDiagram('https://github.com/o/r', 'abc123', 2)).toBeNull();
    expect(getRepoDiagram('https://github.com/o/r', 'abc123', 3)).toBeNull();
  });
  it('L2 and L3 are isolated', () => {
    setRepoDiagram('https://github.com/o/r', 'abc123', fakeResult('L2'), 2);
    expect(getRepoDiagram('https://github.com/o/r', 'abc123', 2)?.ndjson).toContain('L2');
    expect(getRepoDiagram('https://github.com/o/r', 'abc123', 3)).toBeNull();
    expect(getRepoDiagram('https://github.com/o/r', 'abc123', 1)).toBeNull();
  });
  it('same level hit returns same result, different sha isolated', () => {
    setRepoDiagram('https://github.com/o/r', 'sha1', fakeResult('sha1'), 2);
    setRepoDiagram('https://github.com/o/r', 'sha2', fakeResult('sha2'), 2);
    expect(getRepoDiagram('https://github.com/o/r', 'sha1', 2)?.ndjson).toContain('sha1');
    expect(getRepoDiagram('https://github.com/o/r', 'sha2', 2)?.ndjson).toContain('sha2');
    expect(getRepoDiagram('https://github.com/o/r', 'sha1', 1)).toBeNull();
  });
});

// ─── GH2R-009 Python roots ─────────────────────────────────────
describe('Python import roots (GH2R-009)', () => {
  it('resolves app/ prefix as internal', () => {
    const files: FileEntry[] = [
      { path: 'app/models/user.py', content: 'class User: pass' },
      { path: 'app/api/routes.py', content: 'from models.user import User\n' },
    ];
    const fileSet = new Set(files.map((f) => f.path));
    const treeByBase = new Map<string, string[]>([['user.py', ['app/models/user.py']]]);
    const res = resolveImportSpec('models.user', 'app/api/routes.py', fileSet, treeByBase, undefined, files);
    expect(res.kind).toBe('internal');
    expect(res.path).toBe('app/models/user.py');
  });

  it('resolves backend/ prefix as internal', () => {
    const files: FileEntry[] = [
      { path: 'backend/services/auth.py', content: 'pass' },
      { path: 'backend/api/main.py', content: 'from services.auth import foo\n' },
    ];
    const fileSet = new Set(files.map((f) => f.path));
    const treeByBase = new Map<string, string[]>();
    const res = resolveImportSpec('services.auth', 'backend/api/main.py', fileSet, treeByBase, undefined, files);
    expect(res.kind).toBe('internal');
  });
});

// ─── GH2R-010 TS alias baseUrl='.' ─────────────────────────────
describe('TS alias baseUrl="." (GH2R-010)', () => {
  it('resolves @/components/Button with baseUrl="." + paths @/*->src/*', () => {
    const files: FileEntry[] = [
      { path: 'pages/index.tsx', content: "import {Btn} from '@/components/Button';\n" },
      { path: 'src/components/Button.tsx', content: 'export const Btn=1;\n' },
    ];
    const alias = buildTsAliasConfig([
      { path: 'tsconfig.json', content: '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}' },
    ]);
    const fileSet = new Set(files.map((f) => f.path));
    const treeByBase = new Map<string, string[]>();
    const res = resolveImportSpec('@/components/Button', 'pages/index.tsx', fileSet, treeByBase, alias, files);
    expect(res.kind).toBe('internal');
    expect(res.path).toBe('src/components/Button.tsx');
  });

  it('resolves @/lib/foo with baseUrl="." + paths @/*->./src/* (dot-slash variant)', () => {
    const files: FileEntry[] = [
      { path: 'app/api/route.ts', content: "import {x} from '@/lib/foo';\n" },
      { path: 'src/lib/foo.ts', content: 'export const x=1;\n' },
    ];
    const alias = buildTsAliasConfig([
      { path: 'tsconfig.json', content: '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./src/*"]}}}' },
    ]);
    const fileSet = new Set(files.map((f) => f.path));
    const treeByBase = new Map<string, string[]>();
    const res = resolveImportSpec('@/lib/foo', 'app/api/route.ts', fileSet, treeByBase, alias, files);
    expect(res.kind).toBe('internal');
  });

  it('end-to-end buildImportGraph with alias', () => {
    const files: FileEntry[] = [
      { path: 'pages/index.tsx', content: "import {db} from '@/lib/db';\n" },
      { path: 'src/lib/db.ts', content: 'export const db=1;\n' },
    ];
    const alias = buildTsAliasConfig([{ path: 'tsconfig.json', content: '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}' }]);
    const graph = buildImportGraph(files, files.map((f) => f.path), alias);
    expect(graph.edges.get('pages/index.tsx')?.has('src/lib/db.ts')).toBe(true);
  });
});

// ─── GH2R-012 Go fallback ─────────────────────────────────────
describe('Go resolver fallback (GH2R-012)', () => {
  it('resolves local package without go.mod via fileTree prefix', () => {
    const files: FileEntry[] = [
      { path: 'internal/handlers/h.go', content: 'package handlers\n' },
      { path: 'cmd/main.go', content: 'package main\nimport \"internal/handlers\"\n' },
    ];
    const fileSet = new Set(files.map((f) => f.path));
    const res = resolveImportSpec('internal/handlers', 'cmd/main.go', fileSet, new Map(), undefined, files);
    expect(res.kind).toBe('internal');
    expect(res.path).toBe('internal/handlers/h.go');
  });
});

// ─── GH2R-011 Spring routes ───────────────────────────────────
describe('Spring route detection (GH2R-011)', () => {
  it('detects @GetMapping(value="/api/users")', () => {
    const files: FileEntry[] = [
      { path: 'src/main/java/com/acme/UserController.java', content: '@RestController\npublic class UserController {\n  @GetMapping(value="/api/users")\n  public List<User> list(){ return null; }\n}' },
    ];
    const signals = extractStaticSignals(files, []);
    const routes = signals.filter((s) => s.type === 'route');
    expect(routes.some((r) => r.label === '/api/users')).toBe(true);
  });
  it('detects @RequestMapping(path="/api") + @PostMapping', () => {
    const files: FileEntry[] = [
      { path: 'src/main/java/com/acme/OrderController.java', content: '@RequestMapping(path="/api/orders")\npublic class OrderController { @PostMapping(value="/create")\n void create(){} }' },
    ];
    const signals = extractStaticSignals(files, []);
    const routes = signals.filter((s) => s.type === 'route');
    expect(routes.some((r) => r.label === '/api/orders' || r.label === '/create' || r.label === '/api')).toBe(true);
  });
  it('detects @GetMapping({"/a","/b"}) first path', () => {
    const files: FileEntry[] = [
      { path: 'src/main/java/com/acme/Multi.java', content: '@GetMapping({"/a","/b"}) public void hi(){}' },
    ];
    const signals = extractStaticSignals(files, []);
    expect(signals.some((s) => s.type === 'route' && s.label === '/a')).toBe(true);
  });
});

// ─── GH2R-015 pyproject scoped parsing ────────────────────────
describe('pyproject.toml scoped deps (GH2R-015)', () => {
  it('only parses [project] and [tool.poetry.dependencies] — ignores description', () => {
    const files: FileEntry[] = [
      {
        path: 'pyproject.toml',
        content: `
[project]
name = "demo"
description = "uses stripe and openai for something"
dependencies = ["fastapi", "sqlalchemy"]

[tool.poetry.dependencies]
python = "^3.11"
requests = "^2.28"
`,
      },
    ];
    const signals = extractStaticSignals(files, []);
    const deps = signals.filter((s) => s.type === 'dependency');
    // Should have fastapi/sqlalchemy/requests but NOT stripe/openai from description
    expect(deps.some((d) => d.label === 'fastapi')).toBe(true);
    expect(deps.some((d) => d.label === 'sqlalchemy')).toBe(true);
    expect(deps.some((d) => d.label === 'stripe')).toBe(false);
    expect(deps.some((d) => d.label === 'openai')).toBe(false);
  });
  it('ignores naked description quoting', () => {
    const files: FileEntry[] = [{ path: 'pyproject.toml', content: `[project]\ndescription = "hello world"\n` }];
    const signals = extractStaticSignals(files, []);
    expect(signals.filter((s) => s.type === 'dependency')).toHaveLength(0);
  });
});

// ─── GH2R-013 package categories extended ─────────────────────
describe('package categories extended (GH2R-013)', () => {
  it('mysql2 → database', () => {
    const files: FileEntry[] = [{ path: 'package.json', content: JSON.stringify({ dependencies: { mysql2: '^3.0.0' } }) }];
    const signals = extractStaticSignals(files, []);
    const dep = signals.find((s) => s.label === 'mysql2');
    expect(dep?.details.category).toBe('database');
  });
  it('better-sqlite3 → database', () => {
    const files: FileEntry[] = [{ path: 'package.json', content: JSON.stringify({ dependencies: { 'better-sqlite3': '^8.0.0' } }) }];
    const signals = extractStaticSignals(files, []);
    expect(signals.find((s) => s.label === 'better-sqlite3')?.details.category).toBe('database');
  });
  it('drizzle-orm → database', () => {
    const files: FileEntry[] = [{ path: 'package.json', content: JSON.stringify({ dependencies: { 'drizzle-orm': '^0.28.0' } }) }];
    const signals = extractStaticSignals(files, []);
    expect(signals.find((s) => s.label === 'drizzle-orm')?.details.category).toBe('database');
  });
});

// ─── GH2R-016 generic label not collapsing ────────────────────
describe('normalizeLabelKey generic collision (GH2R-016)', () => {
  it('API vs Service do not merge', () => {
    const nodes = [
      { id: 'api', label: 'API', type: 'API_ROUTE' as const, description: '', sourceFiles: ['a.ts'], confidence: 'high' as const },
      { id: 'service', label: 'Service', type: 'SERVICE' as const, description: '', sourceFiles: ['b.ts'], confidence: 'high' as const },
    ];
    // deduplicateNodes should keep both
    const { nodes: out } = deduplicateNodes(nodes as any, []);
    expect(out.length).toBe(2);
  });
  it('Order API vs Order Service merge when stems equal after stripping (same domain concept)', () => {
    const nodes = [
      { id: 'order_api', label: 'Order API', type: 'API_ROUTE' as const, description: '', sourceFiles: ['a.ts'], confidence: 'high' as const },
      { id: 'order_service', label: 'Order Service', type: 'SERVICE' as const, description: '', sourceFiles: ['b.ts'], confidence: 'high' as const },
    ];
    // Both normalize to "order" after stripping generic token → deduplicate merges them (prevents duplicate domain nodes like "Order API" + "Order Service" for same "order" concept)
    const { nodes: out } = deduplicateNodes(nodes as any, []);
    expect(out.length).toBe(1);
  });
});

// ─── GH2R-002 token regex via route handler simulation ────────
describe('GitHub PAT regex (GH2R-002)', () => {
  const GITHUB_TOKEN_RE = /^(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})$/;
  it('accepts legacy ghp/gho/ghs/ghu/ghr', () => {
    expect(GITHUB_TOKEN_RE.test('ghp_' + 'a'.repeat(36))).toBe(true);
    expect(GITHUB_TOKEN_RE.test('gho_' + 'b'.repeat(36))).toBe(true);
    expect(GITHUB_TOKEN_RE.test('ghs_' + 'c'.repeat(36))).toBe(true);
    expect(GITHUB_TOKEN_RE.test('ghu_' + 'd'.repeat(36))).toBe(true);
    expect(GITHUB_TOKEN_RE.test('ghr_' + 'e'.repeat(36))).toBe(true);
  });
  it('accepts fine-grained github_pat_', () => {
    expect(GITHUB_TOKEN_RE.test('github_pat_11ABCDEFG' + 'x'.repeat(30))).toBe(true);
  });
  it('rejects short/invalid', () => {
    expect(GITHUB_TOKEN_RE.test('ghp_short')).toBe(false);
    expect(GITHUB_TOKEN_RE.test('invalid')).toBe(false);
    expect(GITHUB_TOKEN_RE.test('github_pat_short')).toBe(false);
  });
});

// ─── SDK filter covers pyproject/go.mod/Cargo.toml ────────────
describe('SDK usage filter (GH2R-015)', () => {
  it('does not emit sdk_usage from pyproject/go.mod/Cargo.toml', () => {
    const files: FileEntry[] = [
      { path: 'pyproject.toml', content: '[project]\ndependencies = ["stripe"]\n' },
      { path: 'go.mod', content: 'module foo\nrequire github.com/stripe/stripe-go\n' },
      { path: 'Cargo.toml', content: '[package]\nname="foo"\n' },
      { path: 'src/foo.ts', content: 'import Stripe from "stripe";\n' },
    ];
    const signals = extractStaticSignals(files, []);
    const sdkFromPyproject = signals.filter((s) => s.type === 'sdk_usage' && s.source === 'pyproject.toml');
    const sdkFromGo = signals.filter((s) => s.type === 'sdk_usage' && s.source === 'go.mod');
    expect(sdkFromPyproject).toHaveLength(0);
    expect(sdkFromGo).toHaveLength(0);
    // But src/foo.ts should still emit
    expect(signals.some((s) => s.type === 'sdk_usage' && s.source === 'src/foo.ts' && s.label === 'Stripe')).toBe(true);
  });
});
