import type { RepoSnapshot, Subsystem } from '@/lib/types/repo-diagram';

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '__pycache__', 'dist', 'build', '.next',
  'coverage', '.venv', 'venv', 'env', '.env', 'target', 'bin', 'obj',
]);

function inferSubsystemType(path: string, files: string[]): Subsystem['type'] {
  const p = path.toLowerCase();
  if (p === 'apps/web' || p === 'apps/client' || p === 'frontend' || p === 'client') return 'frontend';
  if (p === 'apps/api' || p === 'apps/server' || p === 'backend' || p === 'server' || p === 'api') return 'backend';
  if (p === 'infra' || p === 'infrastructure' || p === 'deploy' || p === 'terraform' || p === 'k8s') return 'infrastructure';
  if (p.startsWith('workers/') || p === 'workers' || p.startsWith('jobs/')) return 'worker';
  if (p.startsWith('packages/') || p.startsWith('libs/')) return 'library';
  if (p.startsWith('services/') || p.startsWith('apps/')) return 'service';

  const allLower = files.map((f) => f.toLowerCase());
  const hasPages = allLower.some((f) => f.includes('page.') || f.includes('app.tsx') || f.includes('index.html'));
  const hasRoutes = allLower.some((f) => f.includes('route.') || f.includes('router') || f.includes('controller'));
  const hasSchemas = allLower.some((f) => f.includes('schema.prisma') || f.includes('model') || f.includes('migration'));
  const hasWorkers = allLower.some((f) => f.includes('worker') || f.includes('queue') || f.includes('job'));
  const hasInfra = allLower.some((f) =>
    f.endsWith('.tf') || f.includes('terraform') || f.includes('kubernetes') || f.includes('k8s') ||
    f.includes('dockerfile') || f.includes('docker-compose')
  );
  const hasCode = allLower.some((f) =>
    /\.(ts|tsx|js|jsx|py|go|rs)$/i.test(f)
  );

  if (hasPages && !hasRoutes) return 'frontend';
  if (hasRoutes && !hasPages) return 'backend';
  if (hasSchemas) return 'backend';
  if (hasWorkers) return 'worker';
  if (hasInfra && !hasCode) return 'infrastructure';
  return 'application';
}

function inferLanguage(files: string[]): string {
  const exts = files.map((f) => f.split('.').pop()?.toLowerCase() || '');
  const tsCount = exts.filter((e) => ['ts', 'tsx'].includes(e)).length;
  const jsCount = exts.filter((e) => ['js', 'jsx'].includes(e)).length;
  const pyCount = exts.filter((e) => e === 'py').length;
  const goCount = exts.filter((e) => e === 'go').length;
  const rsCount = exts.filter((e) => e === 'rs').length;
  const max = Math.max(tsCount, jsCount, pyCount, goCount, rsCount);
  if (max === tsCount) return 'TypeScript';
  if (max === jsCount) return 'JavaScript';
  if (max === pyCount) return 'Python';
  if (max === goCount) return 'Go';
  if (max === rsCount) return 'Rust';
  return 'Unknown';
}

function detectFramework(paths: string[], files: string[]): string | null {
  const all = [...paths, ...files];
  const hasNextConfig = all.some((p) => p === 'next.config.js' || p === 'next.config.ts' || p === 'next.config.mjs');
  if (hasNextConfig) return 'Next.js';
  const hasExpress = all.some((p) => p === 'app.js' || p === 'server.js' || p === 'server.ts') && files.some((f) => f.toLowerCase().includes('express'));
  if (hasExpress) return 'Express';
  const hasFastApi = all.some((p) => p.includes('requirements.txt')) && files.some((f) => f.toLowerCase().includes('fastapi'));
  if (hasFastApi) return 'FastAPI';
  const hasDjango = files.some((f) => f === 'manage.py' || f === 'django');
  if (hasDjango) return 'Django';
  const hasFlask = files.some((f) => f.toLowerCase().includes('flask'));
  if (hasFlask) return 'Flask';
  const hasNest = files.some((f) => f.toLowerCase().includes('@nestjs'));
  if (hasNest) return 'NestJS';
  return null;
}

function isMonorepoDir(fileTree: string[]): boolean {
  return fileTree.some((p) =>
    /^(apps|packages|services|libs)\/\w+\//.test(p)
  ) || fileTree.includes('pnpm-workspace.yaml') || fileTree.includes('turbo.json') || fileTree.includes('lerna.json') || fileTree.includes('nx.json');
}

/**
 * Detect top-level or monorepo subsystems from a file tree.
 * Returns a flat list of directory-backed subsystems.
 */
export function detectSubsystems(snapshot: RepoSnapshot): Subsystem[] {
  const { fileTree, surfaceClassification } = snapshot;
  const subsystems: Subsystem[] = [];

  if (isMonorepoDir(fileTree)) {
    const dirs = new Set<string>();
    for (const p of fileTree) {
      const parts = p.split('/');
      if (parts.length >= 2) {
        const top = parts[0];
        const sub = parts[1];
        if (['apps', 'packages', 'services', 'libs'].includes(top) && sub) {
          const fullPath = `${top}/${sub}`;
          if (!IGNORED_DIRS.has(sub)) dirs.add(fullPath);
        }
      }
    }
    for (const dir of Array.from(dirs).sort()) {
      const dirFiles = fileTree.filter((p) => p.startsWith(dir + '/'));
      if (dirFiles.length === 0) continue;
      subsystems.push({
        name: dir,
        path: dir,
        type: inferSubsystemType(dir, dirFiles),
        fileCount: dirFiles.length,
        files: dirFiles,
        language: inferLanguage(dirFiles),
        detectedFramework: detectFramework(dirFiles, dirFiles),
        entryPoints: findEntryPoints(dirFiles),
      });
    }
  }

  // If no monorepo structure found (or in addition to it), add root-level grouping
  const rootFiles = fileTree.filter((p) => !p.includes('/'));
  const rootSourceFiles = rootFiles.filter((p) => /\.(ts|tsx|js|jsx|py|go|rs)$/.test(p));
  const nonAppDirs = getTopLevelDirs(fileTree).filter((d) =>
    !['node_modules', '.git', 'dist', 'build', 'coverage'].includes(d) &&
    !subsystems.some((s) => s.path.startsWith(d))
  );

  if (rootSourceFiles.length > 0 || nonAppDirs.length > 0 || subsystems.length === 0) {
    const rootDirFiles = fileTree.filter((p) => !p.includes('/') || nonAppDirs.some((d) => p.startsWith(d + '/')));
    subsystems.unshift({
      name: 'root',
      path: '/',
      type: surfaceClassification.isMonorepo ? 'application' : inferSubsystemType('/', fileTree),
      fileCount: rootDirFiles.length,
      files: rootDirFiles,
      language: surfaceClassification.primaryLanguage || inferLanguage(rootDirFiles),
      detectedFramework: detectFramework(fileTree, rootDirFiles) || surfaceClassification.detectedFrameworks[0] || null,
      entryPoints: findEntryPoints(rootDirFiles),
    });
  }

  return subsystems;
}

function getTopLevelDirs(fileTree: string[]): string[] {
  const dirs = new Set<string>();
  for (const p of fileTree) {
    const parts = p.split('/');
    if (parts.length >= 2) dirs.add(parts[0]);
  }
  return Array.from(dirs).sort();
}

function findEntryPoints(files: string[]): string[] {
  const candidates = [
    'main.py', 'app.py', 'manage.py', 'index.ts', 'server.ts',
    'src/index.ts', 'src/app.ts', 'src/main.ts', 'main.ts',
    'index.js', 'server.js', 'app.js',
    'main.go', 'main.rs',
    'app/page.tsx', 'pages/index.tsx',
  ];
  return candidates.filter((c) => files.includes(c));
}

export type SignalSummary = {
  type: string;
  label: string;
  source?: string;
  category?: string;
  confidence?: string;
};

/**
 * Build a compact text summary for LLM consumption.
 */
export function summarizeSubsystem(sub: Subsystem, signals?: SignalSummary[]): string {
  const lines: string[] = [];
  lines.push(`${sub.name} (${sub.type})`);
  lines.push(`  Language: ${sub.language}`);
  lines.push(`  Files: ${sub.fileCount}`);
  if (sub.detectedFramework) lines.push(`  Framework: ${sub.detectedFramework}`);
  if (sub.entryPoints.length > 0) lines.push(`  Entry: ${sub.entryPoints.join(', ')}`);
  if (signals && signals.length > 0) {
    const grouped = groupSignals(signals);
    for (const [type, items] of Object.entries(grouped)) {
      lines.push(`  ${type}: ${items.join(', ')}`);
    }
  }
  return lines.join('\n');
}

function groupSignals(signals: SignalSummary[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const s of signals) {
    if (!grouped[s.type]) grouped[s.type] = [];
    let entry = s.label;
    if (s.category) entry += ` [${s.category}]`;
    if (s.source) entry += ` (${s.source})`;
    grouped[s.type].push(entry);
  }
  return grouped;
}
