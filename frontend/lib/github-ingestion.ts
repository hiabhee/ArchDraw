import type { RepoSnapshot, SurfaceClassification, FileEntry } from './types/repo-diagram';
import { parseGitHubUrl as sharedParseGitHubUrl } from '@/lib/utils/githubUrl';
import logger from '@/lib/logger';
import { fetchRepoArchive } from './repo-diagram/tarball-ingestion';
import { parse as parseYaml } from 'yaml';

function parseGithubUrl(url: string): { owner: string; repo: string } {
  const parsed = sharedParseGitHubUrl(url);
  if (!parsed) {
    throw new Error('Invalid GitHub URL');
  }
  return { owner: parsed.owner, repo: parsed.repo };
}

type RateLimitInfo = {
  remaining: number | null;
  resetEpochSeconds: number | null;
};

function readRateLimitInfo(res: Response): RateLimitInfo {
  const remainingRaw = res.headers.get('x-ratelimit-remaining');
  const resetRaw = res.headers.get('x-ratelimit-reset');
  const remaining = remainingRaw ? Number(remainingRaw) : null;
  const resetEpochSeconds = resetRaw ? Number(resetRaw) : null;
  return {
    remaining: Number.isFinite(remaining as number) ? (remaining as number) : null,
    resetEpochSeconds: Number.isFinite(resetEpochSeconds as number) ? (resetEpochSeconds as number) : null,
  };
}

function formatWait(resetEpochSeconds: number | null): string {
  if (!resetEpochSeconds) return 'a few minutes';
  const ms = resetEpochSeconds * 1000 - Date.now();
  if (ms <= 0) return 'a few minutes';
  const mins = Math.ceil(ms / (60 * 1000));
  if (mins <= 1) return 'about 1 minute';
  if (mins < 60) return `about ${mins} minutes`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `about ${hours} hours` : `about ${hours}h ${rem}m`;
}

async function fetchJson(url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, { headers, signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new Error('Network error connecting to GitHub API');
  }
}

async function getDefaultBranch(owner: string, repo: string, headers: Record<string, string>, signal?: AbortSignal): Promise<{ branch: string; isPrivate: boolean }> {
  const res = await fetchJson(`https://api.github.com/repos/${owner}/${repo}`, headers, signal);
  if (res.status === 404) throw new Error('Repository not found or is private');
  if (res.status === 403) {
    const rl = readRateLimitInfo(res);
    if (rl.remaining === 0) throw new Error(`GitHub API rate limit reached${!headers['Authorization'] ? ' (no token configured — set GITHUB_TOKEN for 5,000 req/hr)' : ''}. Try again in ${formatWait(rl.resetEpochSeconds)}.`);
    throw new Error('GitHub API access forbidden (possible abuse detection or insufficient permissions).');
  }
  if (!res.ok) throw new Error(`GitHub API returned status ${res.status}`);
  const data = await res.json();
  const branch = typeof data?.default_branch === 'string' ? data.default_branch : null;
  const isPrivate = data.private === true;
  if (!branch) throw new Error('Could not determine default branch for repository');
  return { branch, isPrivate };
}

async function getBranchHeadSha(owner: string, repo: string, branch: string, headers: Record<string, string>, signal?: AbortSignal): Promise<string> {
  const res = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, headers, signal);
  if (res.status === 404) throw new Error('Default branch ref not found');
  if (res.status === 403) {
    const rl = readRateLimitInfo(res);
    if (rl.remaining === 0) throw new Error(`GitHub API rate limit reached${!headers['Authorization'] ? ' (no token configured — set GITHUB_TOKEN for 5,000 req/hr)' : ''}. Try again in ${formatWait(rl.resetEpochSeconds)}.`);
    throw new Error('GitHub API access forbidden (possible abuse detection or insufficient permissions).');
  }
  if (!res.ok) throw new Error(`GitHub API returned status ${res.status}`);
  const data = await res.json();
  const sha = typeof data?.object?.sha === 'string' ? data.object.sha : null;
  if (!sha) throw new Error('Could not resolve branch HEAD SHA');
  return sha;
}

async function getRecursiveTree(owner: string, repo: string, sha: string, headers: Record<string, string>, signal?: AbortSignal): Promise<{ tree: GitTreeItem[]; truncated: boolean }> {
  const cacheKey = `${owner}/${repo}:${sha}`;
  const cached = treeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CONTENT_CACHE_TTL_MS) return cached;

  const res = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`, headers, signal);
  if (res.status === 404) throw new Error('Repository not found or is private');
  if (res.status === 403) {
    const rl = readRateLimitInfo(res);
    if (rl.remaining === 0) throw new Error(`GitHub API rate limit reached${!headers['Authorization'] ? ' (no token configured — set GITHUB_TOKEN for 5,000 req/hr)' : ''}. Try again in ${formatWait(rl.resetEpochSeconds)}.`);
    throw new Error('GitHub API access forbidden (possible abuse detection or insufficient permissions).');
  }
  if (!res.ok) throw new Error(`GitHub API returned status ${res.status}`);
  const data = await res.json();
  treeCache.set(cacheKey, { tree: data.tree, truncated: data.truncated, ts: Date.now() });
  evictIfNeeded(treeCache);
  return data;
}

async function promisePool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const run = async () => {
    while (true) {
      const idx = nextIndex++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  };

  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => run());
  await Promise.all(runners);
  return results;
}

interface GitTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  size?: number;
  sha: string;
  url: string;
}

const MAX_FILE_SIZE_BYTES = 500 * 1024;

const SKIPPED_DIRECTORIES = new Set([
  'node_modules', '.next', 'dist', 'build', 'out', 'public',
  '__pycache__', '.git', '.cache', '.turbo', '.nyc_output',
  'coverage', '.vercel', '.serverless', '.webpack',
  '.svelte-kit', '.nuxt', '.output',
]);

const ConfigSkipReason = {
  LARGE_FILE: 'large_file',
  SKIPPED_DIR: 'skipped_directory',
  LOCKFILE: 'lockfile',
  TEST_FILE: 'test_file',
  BINARY: 'binary',
} as const;

export const isSkipped = (path: string, size?: number): string | null => {
  if (size && size > MAX_FILE_SIZE_BYTES) return ConfigSkipReason.LARGE_FILE;
  const parts = path.split('/');
  if (parts.some((p) => SKIPPED_DIRECTORIES.has(p))) {
    return ConfigSkipReason.SKIPPED_DIR;
  }
  const filename = parts[parts.length - 1];
  if (
    filename.endsWith('.lock') ||
    filename === 'package-lock.json' ||
    filename === 'yarn.lock' ||
    filename === 'pnpm-lock.yaml'
  ) {
    return ConfigSkipReason.LOCKFILE;
  }
  if (
    filename.includes('.test.') ||
    filename.includes('.spec.') ||
    parts.includes('__tests__')
  ) {
    return ConfigSkipReason.TEST_FILE;
  }
  // Skip binary-looking file extensions
  if (/\.(png|jpg|jpeg|gif|ico|svg|woff2?|eot|ttf|otf|pdf|zip|tar|gz|br)$/i.test(filename)) {
    return ConfigSkipReason.BINARY;
  }
  return null;
};

// In-memory caches to avoid re-fetching the same data on re-runs.
// Content cache keyed by path; tree cache keyed by headSha.
const CONTENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ARCHIVE_CACHE_SIZE = Number(process.env.ARCHIVE_CACHE_SIZE) || 25;
const MAX_CACHE_SIZE = 25;
const fileContentCache = new Map<string, { entry: FileEntry | null; ts: number }>();
const treeCache = new Map<string, { tree: GitTreeItem[]; truncated: boolean; ts: number }>();
// Phase 2: archive (zipball) cache keyed by headSha — a hit reuses the in-memory
// file map across eval retries/cache-warming without re-downloading.
const archiveCache = new Map<string, { map: Map<string, string>; ts: number }>();

async function loadArchiveMap(
  owner: string,
  repo: string,
  ref: string,
  headers: Record<string, string>,
  signal?: AbortSignal
): Promise<Map<string, string> | null> {
  const cacheKey = `${owner}/${repo}:${ref}`;
  const cached = archiveCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CONTENT_CACHE_TTL_MS) return cached.map;
  const archive = await fetchRepoArchive(owner, repo, ref, headers, signal);
  if (!archive) return null;
  archiveCache.set(cacheKey, { map: archive.files, ts: Date.now() });
  void evictIfNeeded(archiveCache, 'archiveCache');
  return archive.files;
}

function evictIfNeeded(cache: Map<string, { ts: number }>, cacheName?: string) {
  const limit = cache === archiveCache ? MAX_ARCHIVE_CACHE_SIZE : MAX_CACHE_SIZE;
  let evicted = 0;
  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
    evicted++;
  }
  if (evicted > 0) {
    logger.warn(`[Cache] ${cacheName || 'cache'} evicted ${evicted} entry/entries (size=${cache.size + evicted}, limit=${limit})`);
  }
}

async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  headers: Record<string, string>,
  signal?: AbortSignal
): Promise<FileEntry | null> {
  const cacheKey = `${owner}/${repo}:${path}`;
  const cached = fileContentCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CONTENT_CACHE_TTL_MS) {
    return cached.entry;
  }

  const response = await fetchJson(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    headers,
    signal
  );

  if (response.status === 403) {
    const rl = readRateLimitInfo(response);
    if (rl.remaining === 0) {
      throw new Error(`GitHub API rate limit reached${!headers['Authorization'] ? ' (no token configured — set GITHUB_TOKEN for 5,000 req/hr)' : ''}. Try again in ${formatWait(rl.resetEpochSeconds)}.`);
    }
  }

  if (!response.ok) {
    logger.warn(`[Ingest] Failed to fetch content for ${path}: Status ${response.status}`);
    fileContentCache.set(cacheKey, { entry: null, ts: Date.now() });
    evictIfNeeded(fileContentCache);
    return null;
  }
  const data = await response.json();
  if (data.type !== 'file' || data.encoding !== 'base64' || typeof data.content !== 'string') {
    return null;
  }

  const base64 = data.content.replace(/\r?\n/g, '');
  const content = Buffer.from(base64, 'base64').toString('utf8');
  const entry: FileEntry = { path, content };
  fileContentCache.set(cacheKey, { entry, ts: Date.now() });
  evictIfNeeded(fileContentCache);
  return entry;
}

function determineSurfaceClassification(
  treeItems: GitTreeItem[],
  treeMap: Map<string, GitTreeItem>,
  phase1Files?: FileEntry[],
  phase1PackageJsonRaw?: string | null
): SurfaceClassification {
  const allPaths = treeItems.map((i) => i.path);
  const hasPackageJson = treeMap.has('package.json');
  const hasRequirementsTxt = treeMap.has('requirements.txt');
  const hasGoMod = treeMap.has('go.mod');
  const hasCargoToml = treeMap.has('Cargo.toml');
  const hasComposerJson = treeMap.has('composer.json');
  const hasDockerCompose = treeMap.has('docker-compose.yml') || treeMap.has('docker-compose.yaml');
  const hasDockerfile = allPaths.some((p) => p.endsWith('Dockerfile'));
  const hasTurboJson = treeMap.has('turbo.json');
  const hasNxJson = treeMap.has('nx.json');
  const hasLernaJson = treeMap.has('lerna.json');
  const hasPyprojectToml = treeMap.has('pyproject.toml');
  const hasPnpmWorkspace = treeMap.has('pnpm-workspace.yaml');
  const hasPipfile = treeMap.has('Pipfile');
  const hasPoetryLock = treeMap.has('poetry.lock');
  const hasGemfile = treeMap.has('Gemfile');

  let primaryLanguage = 'unknown';
  if (hasPackageJson) primaryLanguage = 'JavaScript/TypeScript';
  else if (hasPyprojectToml || hasRequirementsTxt || hasPipfile || hasPoetryLock) primaryLanguage = 'Python';
  else if (hasGoMod) primaryLanguage = 'Go';
  else if (hasCargoToml) primaryLanguage = 'Rust';
  else if (hasComposerJson) primaryLanguage = 'PHP';
  else if (hasGemfile) primaryLanguage = 'Ruby';
  else if (allPaths.some((p) => p.endsWith('pom.xml') || p.endsWith('build.gradle') || p.endsWith('build.gradle.kts') || p.endsWith('.java'))) primaryLanguage = 'Java';
  else if (allPaths.some((p) => p.endsWith('.csproj') || p.endsWith('.sln'))) primaryLanguage = 'C#';
  else if (allPaths.some((p) => p === 'mix.exs' || p.endsWith('/mix.exs'))) primaryLanguage = 'Elixir';
  else if (allPaths.some((p) => p.endsWith('.tf'))) primaryLanguage = 'Terraform/HCL';
  else if (allPaths.some((p) => p.endsWith('.py'))) primaryLanguage = 'Python';
  else if (allPaths.some((p) => p.endsWith('.rb'))) primaryLanguage = 'Ruby';
  else if (allPaths.some((p) => p.endsWith('.go'))) primaryLanguage = 'Go';
  else if (allPaths.some((p) => p.endsWith('.html'))) primaryLanguage = 'HTML/CSS/JS';

  const detectedFrameworks: string[] = [];
  if (hasPackageJson) {
    if (allPaths.some((p) => p.startsWith('app/') || p.startsWith('pages/'))) {
      detectedFrameworks.push('Next.js');
    }
  }

  // Detect monorepo from multiple sources
  const hasAppsDir = allPaths.some((p) => p.startsWith('apps/'));
  const hasPackagesDir = allPaths.some((p) => p.startsWith('packages/'));
  const hasAppsOrPackages = hasAppsDir || hasPackagesDir;

  // Check pnpm-workspace.yaml for 'packages:' key
  const pnpmWorkspaceEntry = phase1Files?.find((f) => f.path === 'pnpm-workspace.yaml');
  const pnpmConfirmed = !!pnpmWorkspaceEntry?.content.includes('packages:');

  // Check root package.json workspaces field
  let npmWorkspacesConfirmed = false;
  if (phase1PackageJsonRaw) {
    try {
      const pj = JSON.parse(phase1PackageJsonRaw);
      npmWorkspacesConfirmed = Array.isArray(pj.workspaces) && pj.workspaces.length > 0;
    } catch {
      // ignore parse error
    }
  }

  const workspaceToolSignal = hasTurboJson || hasNxJson || hasLernaJson || hasPnpmWorkspace || pnpmConfirmed || npmWorkspacesConfirmed;
  const isMonorepo = workspaceToolSignal || (hasAppsOrPackages && workspaceToolSignal);

  return {
    primaryLanguage,
    detectedFrameworks,
    hasDocker: hasDockerfile || hasDockerCompose,
    hasMultipleServices: false,
    isMonorepo,
    projectType: 'unknown',
  };
}

export async function ingestRepo(
  repoUrl: string,
  opts?: { fileBudget?: number; contentBudgetKB?: number },
  signal?: AbortSignal,
  userGithubToken?: string
): Promise<RepoSnapshot> {
  const { owner, repo } = parseGithubUrl(repoUrl);

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'ArchDraw-App',
  };

  const token = userGithubToken ?? process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    logger.warn('[Ingest] No GITHUB_TOKEN configured. Unauthenticated rate limit is 60 req/hr. Set GITHUB_TOKEN in .env for 5000 req/hr.');
  }

  logger.info(`[Ingest] Resolving default branch for ${owner}/${repo}...`);
  const { branch: defaultBranch, isPrivate } = await getDefaultBranch(owner, repo, headers, signal);
  logger.info(`[Ingest] Default branch: ${defaultBranch}`);

  logger.info(`[Ingest] Resolving branch HEAD SHA...`);
  const headSha = await getBranchHeadSha(owner, repo, defaultBranch, headers, signal);

  logger.log(`[Ingest] Fetching recursive tree for ${owner}/${repo}@${defaultBranch}...`);
  const treeData = await getRecursiveTree(owner, repo, headSha, headers, signal);

  if (!treeData.tree || !Array.isArray(treeData.tree)) {
    throw new Error('Invalid repository tree received from GitHub');
  }

  const treeItems: GitTreeItem[] = treeData.tree;
  if (treeItems.length > 50000) {
    logger.warn(`[Ingest] File tree exceeds 50k entries (${treeItems.length}) — sampling top entries. Quality may be reduced for this large repo.`);
  }
  const fileTree = treeItems.filter(item => item.type === 'blob').map(item => item.path);
  const treeMap = new Map<string, GitTreeItem>();
  treeItems.forEach(item => treeMap.set(item.path, item));

  // ── Phase 0: Tarball ingestion (1 API call → whole repo in memory) ──
  // When the archive is available, all subsequent "fetches" are free in-memory
  // lookups, eliminating 1-API-call-per-file rate-limit pressure and budget
  // starvation (fix 1.1, 1.4, 1.5). Falls back to the Contents-API path below.
  const archiveMap = await loadArchiveMap(owner, repo, defaultBranch, headers, signal);
  const usingArchive = archiveMap !== null;
  const failedPaths: string[] = [];
  logger.info(`[Ingest] archive=${usingArchive ? 'hit' : 'fallback'}`);

  // ── Phase 1: Triage Read ──────────────────────────────────
  logger.log(`[Ingest] Phase 1: Triage read...`);

  const phase1Candidates: string[] = [];

  // Root directory listing from tree
  const rootItems = treeItems.filter((item) => !item.path.includes('/') && item.type === 'blob');
  rootItems.forEach((item) => { if (!isSkipped(item.path, item.size)) phase1Candidates.push(item.path); });

  const phase1Always: string[] = [
    'package.json', 'requirements.txt', 'go.mod', 'Cargo.toml', 'composer.json',
    'pyproject.toml', 'Pipfile', 'poetry.lock',
    'pnpm-workspace.yaml',
    'docker-compose.yml', 'docker-compose.yaml',
    'README.md',
    '.env.example',
    'turbo.json', 'nx.json', 'lerna.json',
    // Phase 5: broader manifest coverage for non-JS stacks.
    'Gemfile', 'pom.xml', 'build.gradle', 'build.gradle.kts',
    'manage.py', 'mix.exs',
  ];
  for (const p of phase1Always) {
    if (treeMap.has(p) && !phase1Candidates.includes(p)) {
      phase1Candidates.push(p);
    }
  }

  // Root yaml/yml files and Dockerfiles
  const rootYamls = treeItems.filter(
    (item) => item.type === 'blob' && !item.path.includes('/') && (item.path.endsWith('.yml') || item.path.endsWith('.yaml'))
  );
  for (const y of rootYamls) {
    if (!phase1Candidates.includes(y.path)) phase1Candidates.push(y.path);
  }

  const dockerFiles = treeItems.filter(
    (item) => item.type === 'blob' && !item.path.includes('/') && item.path.toLowerCase().startsWith('dockerfile')
  );
  for (const d of dockerFiles) {
    if (!phase1Candidates.includes(d.path)) phase1Candidates.push(d.path);
  }

  logger.log(`[Ingest] Phase 1: Fetching ${phase1Candidates.length} files...`);
  let phase1Fetched: (FileEntry | null)[];
  if (usingArchive) {
    phase1Fetched = phase1Candidates.map((path) =>
      archiveMap!.has(path) ? { path, content: archiveMap!.get(path)! } : null
    );
  } else {
    phase1Fetched = await promisePool(phase1Candidates, 5, async (path) => {
      const item = treeMap.get(path);
      if (!item || isSkipped(path, item.size)) return null;
      const entry = await fetchFileContent(owner, repo, path, headers, signal);
      if (!entry && !isSkipped(path, item.size)) failedPaths.push(path);
      return entry;
    });
  }

  const phase1Files: FileEntry[] = [];
  let phase1PackageJsonRaw: string | null = null;
  for (const entry of phase1Fetched) {
    if (!entry) continue;
    phase1Files.push(entry);
    if (entry.path === 'package.json') phase1PackageJsonRaw = entry.content;
  }

  // Refine surface classification with actual content
  const surfaceClassification = determineSurfaceClassification(treeItems, treeMap, phase1Files, phase1PackageJsonRaw);

  // Check docker-compose services count (Phase 3: real YAML parse, not brittle regex)
  const dcEntry = phase1Files.find((f) => f.path === 'docker-compose.yml' || f.path === 'docker-compose.yaml');
  if (dcEntry) {
    try {
      const parsed = parseYaml(dcEntry.content) as Record<string, unknown>;
      const services = parsed?.services as Record<string, unknown> | undefined;
      const serviceCount = services && typeof services === 'object' ? Object.keys(services).length : 0;
      surfaceClassification.hasMultipleServices = serviceCount > 1;
    } catch {
      // ignore parse error — keep hasMultipleServices=false
    }
  }

  // Detect frameworks from package.json
  if (phase1PackageJsonRaw) {
    try {
      const pj = JSON.parse(phase1PackageJsonRaw);
      const deps = { ...(pj.dependencies || {}), ...(pj.devDependencies || {}) };
      const frameworkKeywords: Record<string, string[]> = {
        'Next.js': ['next'],
        'Express': ['express'],
        'Fastify': ['fastify'],
        'NestJS': ['@nestjs/core'],
        'Nuxt': ['nuxt'],
        'SvelteKit': ['@sveltejs/kit'],
        'Remix': ['@remix-run/react'],
        'React': ['react', 'react-dom'],
        'Vue': ['vue'],
        'Angular': ['@angular/core'],
        'Django': ['django'],
        'Flask': ['flask'],
        'FastAPI': ['fastapi'],
        'Spring': ['spring-boot'],
      };
      for (const [fw, keywords] of Object.entries(frameworkKeywords)) {
        if (keywords.some((k) => deps[k])) {
          if (!surfaceClassification.detectedFrameworks.includes(fw)) {
            surfaceClassification.detectedFrameworks.push(fw);
          }
        }
      }
    } catch {
      // ignore parse error
    }
  }

  // ── Phase 2: Stack-Guided Deep Read ───────────────────────
  logger.log(`[Ingest] Phase 2: Stack-guided deep file selection...`);

  const totalLimit = (opts?.fileBudget ?? 75) - phase1Files.length;
  let contentBudget = (opts?.contentBudgetKB ?? 280) * 1024; // 280KB default
  // Deduct phase1 consumed bytes from the budget
  for (const entry of phase1Files) {
    contentBudget -= entry.content.length;
  }
  contentBudget = Math.max(contentBudget, 50 * 1024); // keep minimum 50KB floor
  const phase2Candidates: string[] = [];
  const isNode = surfaceClassification.primaryLanguage === 'JavaScript/TypeScript';
  const isPython = surfaceClassification.primaryLanguage === 'Python';
  const isGo = surfaceClassification.primaryLanguage === 'Go';
  const isRust = surfaceClassification.primaryLanguage === 'Rust';
  const isTerraform = surfaceClassification.primaryLanguage === 'Terraform/HCL';
  const isHtml = surfaceClassification.primaryLanguage === 'HTML/CSS/JS';

  if (isNode && phase1PackageJsonRaw) {
    try {
      const pj = JSON.parse(phase1PackageJsonRaw);
      const deps = { ...(pj.dependencies || {}), ...(pj.devDependencies || {}) };
      const isNextJs = deps['next'];
      const isNestJs = deps['@nestjs/core'];
      const isExpress = deps['express'] || deps['fastify'] || deps['hapi'];
      const isLibrary = pj.main || pj.exports;

      if (isNextJs) {
        const routeExt = '(?:tsx?|jsx?|js)';
        // app router pages
        const appPages = treeItems
          .filter(item => item.type === 'blob' && new RegExp(`^app\\/(?:.+\\/)?page\\.${routeExt}$`).test(item.path) && !isSkipped(item.path, item.size))
          .slice(0, 20)
          .map(item => item.path);
        appPages.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });

        const apiRoutes = treeItems
          .filter(item => item.type === 'blob' && new RegExp(`^app\\/api\\/(?:.+\\/)?route\\.${routeExt}$`).test(item.path) && !isSkipped(item.path, item.size))
          .slice(0, 25)
          .map(item => item.path);
        apiRoutes.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });

        // pages router (legacy Next.js)
        const pagesRouter = treeItems
          .filter(item => item.type === 'blob' && /^pages\/(?!_).+\.(tsx?|jsx?|js)$/.test(item.path) && !isSkipped(item.path, item.size))
          .slice(0, 15)
          .map(item => item.path);
        pagesRouter.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });

        const pagesApi = treeItems
          .filter(item => item.type === 'blob' && /^pages\/api\/.+\.(tsx?|jsx?|js)$/.test(item.path) && !isSkipped(item.path, item.size))
          .slice(0, 15)
          .map(item => item.path);
        pagesApi.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });

        const otherNextFiles = ['middleware.ts', 'middleware.js', 'app/layout.tsx', 'app/layout.js', 'prisma/schema.prisma', 'next.config.ts', 'next.config.js', 'next.config.mjs'];
        for (const p of otherNextFiles) {
          if (treeMap.has(p) && !phase2Candidates.includes(p)) phase2Candidates.push(p);
        }
      } else if (isNestJs) {
        const nestPatterns = [
          (p: string) => /^src\/.+\.controller\.(ts|js)$/.test(p),
          (p: string) => /^src\/.+\.service\.(ts|js)$/.test(p),
          (p: string) => /^src\/.+\.module\.(ts|js)$/.test(p),
          (p: string) => /^src\/main\.(ts|js)$/.test(p),
        ];
        for (const match of nestPatterns) {
          const files = treeItems
            .filter(item => item.type === 'blob' && match(item.path) && !isSkipped(item.path, item.size))
            .slice(0, 12)
            .map(item => item.path);
          files.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });
        }
      } else if (isExpress) {
        const expressTargets = ['app.js', 'server.js', 'index.js', 'app.ts', 'server.ts', 'index.ts'];
        for (const p of expressTargets) {
          if (treeMap.has(p) && !phase2Candidates.includes(p)) phase2Candidates.push(p);
        }
        // routes/, controllers/, models/
        for (const dir of ['routes', 'controllers', 'models']) {
          const dirFiles = treeItems
            .filter(item => item.type === 'blob' && item.path.startsWith(dir + '/') && !isSkipped(item.path, item.size))
            .slice(0, 10)
            .map(item => item.path);
          dirFiles.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });
        }
      } else if (isLibrary) {
        // Library: src/, index.ts, core exports
        const libTargets = ['src/index.ts', 'src/index.js', 'index.ts', 'index.js'];
        for (const p of libTargets) {
          if (treeMap.has(p) && !phase2Candidates.includes(p)) phase2Candidates.push(p);
        }
        const srcFiles = treeItems
          .filter(item => item.type === 'blob' && item.path.startsWith('src/') && !isSkipped(item.path, item.size))
          .slice(0, 15)
          .map(item => item.path);
        srcFiles.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });
      }
    } catch {
      // ignore parse error
    }
  } else if (isPython) {
    const pythonTargets = ['main.py', 'app.py', 'database.py', 'db.py'];
    for (const p of pythonTargets) {
      if (treeMap.has(p) && !phase2Candidates.includes(p)) phase2Candidates.push(p);
    }
    for (const dir of ['app', 'routers', 'views', 'models', 'schemas', 'api', 'routes', 'services', 'core']) {
      const dirFiles = treeItems
        .filter(item => item.type === 'blob' && item.path.startsWith(dir + '/') && !isSkipped(item.path, item.size))
        .slice(0, 10)
        .map(item => item.path);
      dirFiles.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });
    }
    // Fallback: root .py files and src/
    const rootPyFiles = treeItems
      .filter(item => item.type === 'blob' && !item.path.includes('/') && item.path.endsWith('.py') && !isSkipped(item.path, item.size))
      .map(item => item.path);
    rootPyFiles.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });
    const srcPyFiles = treeItems
      .filter(item => item.type === 'blob' && item.path.startsWith('src/') && item.path.endsWith('.py') && !isSkipped(item.path, item.size))
      .slice(0, 15)
      .map(item => item.path);
    srcPyFiles.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });
  } else if (isGo) {
    const goTargets = ['main.go', 'cmd/', 'internal/', 'pkg/'];
    for (const p of goTargets) {
      if (p.endsWith('/')) {
        const dirFiles = treeItems
          .filter(item => item.type === 'blob' && item.path.startsWith(p) && !isSkipped(item.path, item.size))
          .slice(0, 10)
          .map(item => item.path);
        dirFiles.forEach(f => { if (!phase2Candidates.includes(f)) phase2Candidates.push(f); });
      } else {
        if (treeMap.has(p) && !phase2Candidates.includes(p)) phase2Candidates.push(p);
      }
    }
  } else if (isRust) {
    const rustTargets = ['src/main.rs', 'src/lib.rs'];
    for (const p of rustTargets) {
      if (treeMap.has(p) && !phase2Candidates.includes(p)) phase2Candidates.push(p);
    }
    const srcFiles = treeItems
      .filter(item => item.type === 'blob' && item.path.startsWith('src/') && item.path.endsWith('.rs') && !isSkipped(item.path, item.size))
      .slice(0, 15)
      .map(item => item.path);
    srcFiles.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });
  } else if (isTerraform) {
    const tfFiles = treeItems
      .filter(item => item.type === 'blob' && item.path.endsWith('.tf') && !isSkipped(item.path, item.size))
      .slice(0, 20)
      .map(item => item.path);
    tfFiles.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });
  } else if (isHtml) {
    const htmlFiles = treeItems
      .filter(item => item.type === 'blob' && item.path.endsWith('.html') && !isSkipped(item.path, item.size))
      .slice(0, 10)
      .map(item => item.path);
    htmlFiles.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });
    const jsFiles = treeItems
      .filter(item => item.type === 'blob' && !item.path.includes('/') && item.path.match(/\.(js|mjs|jsx)$/) && !isSkipped(item.path, item.size))
      .slice(0, 10)
      .map(item => item.path);
    jsFiles.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });
  }

  // ── Phase 5: new stack selectors ──────────────────────────
  // Each branch runs even when no earlier branch matched. Use tree-wide `findAll`
  // (path can live at any depth) so non-standard layouts are covered.
  const isJava = surfaceClassification.primaryLanguage === 'Java';
  const isRuby = surfaceClassification.primaryLanguage === 'Ruby';
  const isCSharp = surfaceClassification.primaryLanguage === 'C#';
  const isElixir = surfaceClassification.primaryLanguage === 'Elixir';
  if (isJava) {
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)(?:src\/main\/java\/.+\/)?[A-Z][\w]*Controller\.java$/, 20));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)[A-Z][\w]*Service\.java$/, 20));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)application\.(yml|yaml|properties)$/, 8));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)(pom\.xml|build\.gradle|build\.gradle\.kts)$/, 4));
  } else if (isRuby) {
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)config\/routes\.rb$/, 1));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)app\/controllers\/[^/]+_controller\.rb$/, 20));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)app\/models\/[^/]+\.rb$/, 20));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)(Gemfile|Rakefile)$/, 2));
  } else if (isCSharp) {
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)[A-Z][\w]*Controller\.cs$/, 20));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)(Program\.cs|Startup\.cs|appsettings\.json)$/, 6));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)[^/]+\.(csproj|sln)$/, 4));
  } else if (isElixir) {
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)lib\/[^/]+(?:_[a-z]+)?_controller\.ex$/, 20));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)lib\/[^/]+_web\/router\.ex$/, 4));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)mix\.exs$/, 1));
  }
  // Python: expand Django/Flask/FastAPI selection regardless of monorepo nesting.
  if (isPython) {
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)urls\.py$/, 5));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)views\.py$/, 8));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)models\.py$/, 8));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)settings\.py$/, 5));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)[\w]*blueprint[\w]*\.py$/i, 8));
    pushCandidates(phase2Candidates, findAll(treeItems, /(^|\/)(app\.py|main\.py|wsgi\.py|asgi\.py)$/, 6));
  }

  // Monorepo support: pick up package.json, configs, AND source files from apps/, packages/, services/
  if (surfaceClassification.isMonorepo || treeItems.some((i) => i.path.startsWith('apps/') || i.path.startsWith('packages/') || i.path.startsWith('services/') || i.path.startsWith('frontend/') || i.path.startsWith('client/') || i.path.startsWith('web/') || i.path.startsWith('server/') || i.path.startsWith('backend/') || i.path.startsWith('api/'))) {
    const monoDirs = ['apps', 'packages', 'services', 'frontend', 'client', 'web', 'server', 'backend', 'api'];
    for (const dir of monoDirs) {
      // 1) package.json files
      const subPkg = treeItems
        .filter((item) => item.type === 'blob' && item.path.startsWith(dir + '/') && item.path.endsWith('package.json') && !isSkipped(item.path, item.size))
        .slice(0, 6)
        .map((item) => item.path);
      subPkg.forEach((p) => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });
      // 2) Root-level configs in subdirectories
      const dirRootItems = treeItems.filter(
        (item) => item.type === 'blob' && item.path.startsWith(dir + '/') && !item.path.includes('/', dir.length + 1) && !isSkipped(item.path, item.size)
      );
      for (const item of dirRootItems) {
        if (!phase2Candidates.includes(item.path)) phase2Candidates.push(item.path);
      }
      // 3) Source files: per-subsystem, pick routes, pages, entry points, common patterns
      const sourceExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'];
      for (const subdir of subPkg) {
        const subPrefix = subdir.replace(/\/package\.json$/, '');
        if (!subPrefix || subPrefix === dir) continue;
        // Entry points
        const entryCandidates = ['main.ts', 'index.ts', 'app.ts', 'server.ts', 'main.py', 'app.py', 'main.go'];
        for (const entry of entryCandidates) {
          const entryPath = `${subPrefix}/${entry}`;
          if (treeMap.has(entryPath) && !phase2Candidates.includes(entryPath)) {
            phase2Candidates.push(entryPath);
          }
        }
        // Route/page files
        const routeFiles = treeItems.filter(
          (item) => item.type === 'blob' && item.path.startsWith(subPrefix + '/') &&
            (item.path.includes('route.') || item.path.includes('page.') || item.path.includes('controller') || item.path.includes('router')) &&
            sourceExts.some((ext) => item.path.endsWith(ext)) && !isSkipped(item.path, item.size)
        ).slice(0, 8).map((item) => item.path);
        routeFiles.forEach((p) => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });
        // src/ directory files
        const srcFiles = treeItems.filter(
          (item) => item.type === 'blob' && item.path.startsWith(`${subPrefix}/src/`) &&
            sourceExts.some((ext) => item.path.endsWith(ext)) && !isSkipped(item.path, item.size)
        ).slice(0, 6).map((item) => item.path);
        srcFiles.forEach((p) => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });
      }
    }
  }

  // If only markdown/mdx files — documentation repo
  const mdCount = fileTree.filter((p) => p.endsWith('.md') || p.endsWith('.mdx')).length;
  const nonMdCount = fileTree.filter((p) => !p.endsWith('.md') && !p.endsWith('.mdx')).length;
  if (mdCount > 0 && nonMdCount <= 5 && phase2Candidates.length === 0) {
    const mdFiles = treeItems
      .filter(item => item.type === 'blob' && (item.path.endsWith('.md') || item.path.endsWith('.mdx')) && !isSkipped(item.path, item.size))
      .slice(0, 10)
      .map(item => item.path);
    mdFiles.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });
  }

interface ScoredCandidate { path: string; score: number; }

/** Phase 5: tree-wide path matcher (any depth, not root-anchored). Cap per pattern. */
function findAll(tree: GitTreeItem[], pattern: RegExp, cap: number): string[] {
  return tree
    .filter((i) => i.type === 'blob' && pattern.test(i.path) && !isSkipped(i.path, i.size))
    .slice(0, cap)
    .map((i) => i.path);
}

/** Push new candidates into an array (de-duplicates). */
function pushCandidates(target: string[], newPaths: string[]): void {
  for (const p of newPaths) if (!target.includes(p)) target.push(p);
}

function scoreCandidate(path: string, treeMap: Map<string, GitTreeItem>): number {
  let score = 0;
  const item = treeMap.get(path);
  const depth = path.split('/').length;

  // Prefer shallower files (more likely entry points)
  score += Math.max(0, 5 - depth);

  // High-signal file names
  if (/route\.(ts|js|tsx)$/.test(path)) score += 4;
  if (/controller\.(ts|js|py)$/.test(path)) score += 4;
  if (/service\.(ts|js|py)$/.test(path)) score += 3;
  if (/schema\.prisma$/.test(path)) score += 5;
  if (/middleware\.(ts|js|py)$/.test(path)) score += 3;
  if (/main\.(py|ts|go|rs)$|app\.(py|ts|js)$/.test(path)) score += 5;
  if (/index\.(ts|js)$/.test(path)) score += 2;
  if (/worker\.(ts|js|py)$|queue\.(ts|js|py)$/.test(path)) score += 3;

  // Small files are cheaper — prefer if equal score
  const size = item?.size ?? 0;
  if (size < 5000) score += 1;
  if (size > 50000) score -= 2;

  return score;
}

  const scored: ScoredCandidate[] = phase2Candidates.map(path => ({
    path,
    score: scoreCandidate(path, treeMap),
  }));
  scored.sort((a, b) => b.score - a.score);
  const phase2Slice = scored.slice(0, Math.min(scored.length, totalLimit)).map(s => s.path);

  logger.log(`[Ingest] Phase 2: Fetching ${phase2Slice.length} files...`);
  let phase2Fetched: (FileEntry | null)[];
  if (usingArchive) {
    // Archive path: content is already in memory — no content-KB starvation (fix 1.4).
    phase2Fetched = phase2Slice.map((path) =>
      archiveMap!.has(path) ? { path, content: archiveMap!.get(path)! } : null
    );
  } else {
    phase2Fetched = await promisePool(phase2Slice, 6, async (path) => {
      const item = treeMap.get(path);
      if (!item || isSkipped(path, item.size)) return null;
      if (contentBudget <= 0) return null;
      if ((item.size || 0) > contentBudget) return null;
      contentBudget -= (item.size || 0);
      const entry = await fetchFileContent(owner, repo, path, headers, signal);
      if (!entry) failedPaths.push(path);
      return entry;
    });
  }

  const phase2Files: FileEntry[] = [];
  for (const entry of phase2Fetched) {
    if (!entry) continue;
    phase2Files.push(entry);
  }

  // ── Build combined selectedFiles (backward compat) ────────
  const selectedFiles = [...phase1Files, ...phase2Files];

  // ── Backward compatible repoMeta ───────────────────────────
  const hasAppDir = treeItems.some(item => item.path.startsWith('app/'));
  const hasPagesDir = treeItems.some(item => item.path.startsWith('pages/'));
  const hasPrisma = treeItems.some(item => item.path === 'prisma/schema.prisma');
  const hasMiddleware = treeItems.some(item => item.path === 'middleware.ts' || item.path === 'middleware.js');
  const hasEnvExample = treeItems.some(item => item.path === '.env.example');

  let packageJson: Record<string, unknown> | null = null;
  const pjFile = selectedFiles.find((f) => f.path === 'package.json');
  if (pjFile) {
    try {
      packageJson = JSON.parse(pjFile.content);
    } catch {
      // ignore
    }
  }

  // Count skipped reasons
  const skippedCounts: Record<string, number> = {};
  for (const item of treeItems) {
    if (item.type !== 'blob') continue;
    const reason = isSkipped(item.path, item.size);
    if (reason) {
      skippedCounts[reason] = (skippedCounts[reason] || 0) + 1;
    }
  }

  return {
    repoUrl,
    owner,
    repo,
    headSha,
    defaultBranch,
    isPrivate,
    treeTruncated: treeData.truncated || false,
    fileTree,
    selectedFiles,
    failedPaths,
    skippedCounts,
    repoMeta: {
      hasAppDir,
      hasPagesDir,
      hasPrisma,
      hasMiddleware,
      hasEnvExample,
      packageJson,
    },
    surfaceClassification,
    phase1Files,
    phase2Files,
    archiveMap: usingArchive ? archiveMap : null,
  };
}
