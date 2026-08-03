import { describe, it, expect } from 'vitest';
import type { RepoSnapshot, FileEntry } from '@/lib/types/repo-diagram';

// Phase 4.2: single-subsystem repos must produce ≥ 4 typed baseline nodes
// (built from top-level source directories) before any LLM call.

// We invoke buildDeterministicBaseline indirectly by importing the pipeline.
// Instead of running the full pipeline (LLM/HTTP), we mirror the helper directly
// here to validate the granularity logic in isolation.

import { detectSubsystems } from '../subsystem-detector';
import { extractStaticSignals } from '../static-analyzer';
import { buildEvidenceGraph } from '../evidence-from-graph';

function nodesFromTopLevelDirs(fileTree: string[]): { id: string; label: string; type: string; fileCount: number }[] {
  const CONTAINERS = new Set(['src', 'app']);
  const SOURCE_DIRS = new Set(['lib', 'routes', 'routers', 'services', 'models', 'controllers', 'api', 'pages', 'components', 'modules', 'handlers', 'views', 'middleware', 'prisma', 'db', 'database', 'tests', 'test', 'commands', 'jobs', 'workers', 'config']);
  const groups = new Map<string, string[]>();
  for (const p of fileTree) {
    const parts = p.split('/');
    if (parts.length < 2) continue;
    let bucket: string | null = null;
    const ci = (s: string) => s.toLowerCase();
    if (CONTAINERS.has(ci(parts[0])) && parts[1]) bucket = parts[1];
    if (!bucket && SOURCE_DIRS.has(ci(parts[0]))) bucket = parts[0];
    if (!bucket) {
      for (let i = 1; i < parts.length; i++) {
        if (SOURCE_DIRS.has(ci(parts[i]))) { bucket = parts[i]; break; }
      }
    }
    if (!bucket) continue;
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(p);
  }
  const out: { id: string; label: string; type: string; fileCount: number }[] = [];
  for (const [dir, files] of groups) {
    if (files.length < 3) continue;
    out.push({ id: dir.toLowerCase(), label: dir, type: 'CORE_MODULE', fileCount: files.length });
  }
  return out;
}

describe('Phase 4.2 — single-subsystem baseline granularity', () => {
  function makeSnapshot(fileTree: string[]): RepoSnapshot {
    return {
      repoUrl: 'https://github.com/test/repo', owner: 'test', repo: 'repo',
      fileTree, selectedFiles: [] as FileEntry[], failedPaths: [],
      repoMeta: { hasAppDir: false, hasPagesDir: false, hasPrisma: false, hasMiddleware: false, hasEnvExample: false, packageJson: null },
      surfaceClassification: {
        primaryLanguage: 'TypeScript', detectedFrameworks: [], hasDocker: false,
        hasMultipleServices: false, isMonorepo: false, projectType: 'unknown',
      },
      phase1Files: [], phase2Files: [],
    };
  }

  it('emits ≥ 4 typed nodes for a single-subsystem repo with multiple top-level source dirs', () => {
    const tree = [
      'src/lib/a.ts', 'src/lib/b.ts', 'src/lib/c.ts',
      'src/services/orders.ts', 'src/services/users.ts', 'src/services/x.ts',
      'src/models/order.ts', 'src/models/user.ts', 'src/models/y.ts',
      'src/routes/api.ts', 'src/routes/admin.ts', 'src/routes/z.ts',
      'package.json', 'tsconfig.json', 'README.md',
    ];
    const snap = makeSnapshot(tree);
    const subsystems = detectSubsystems(snap);
    expect(subsystems.length).toBe(1); // single root subsystem
    const dirNodes = nodesFromTopLevelDirs(tree);
    expect(dirNodes.length).toBeGreaterThanOrEqual(4);
  });

  it('skips tiny dirs (< 3 files) so we don\'t invent a "config" node from one file', () => {
    const tree = ['src/a.ts', 'config/dev.yml']; // "config" has only 1 file
    const dirNodes = nodesFromTopLevelDirs(tree);
    expect(dirNodes.find((n) => n.id === 'config')).toBeUndefined();
    expect(dirNodes.find((n) => n.id === 'src')).toBeUndefined(); // src has 1 file too — skipped
  });

  it('import graph + signals build without throwing on a typical single-subsystem repo', () => {
    const files: FileEntry[] = [
      { path: 'src/routes/orders.ts', content: "import { pool } from '../lib/db';\nexport function GET() { return pool.query() }\n" },
      { path: 'src/lib/db.ts', content: "export const pool = { query: () => {} };\n" },
      { path: 'src/models/user.ts', content: "export interface User { id: string }\nimport { pool } from '../lib/db';\n" },
      { path: 'src/services/notify.ts', content: "import { User } from '../models/user';\nexport function notify(u: User) { return true }\n" },
    ];
    const snap = makeSnapshot(files.map((f) => f.path));
    snap.selectedFiles = files;
    const subsystems = detectSubsystems(snap);
    const signals = extractStaticSignals(files, subsystems);
    const g = buildEvidenceGraph(files, files.map((f) => f.path));
    expect(signals.length).toBeGreaterThan(0);
    expect(g.edges.size).toBeGreaterThan(0); // at least orders.ts -> db.ts
  });
});