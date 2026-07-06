import type { RepoSnapshot, SurfaceClassification, FileEntry } from './types/repo-diagram';

function parseGithubUrl(url: string): { owner: string; repo: string } {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const match = cleanUrl.match(/^https?:\/\/(?:www\.)?github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/);
  if (!match) {
    throw new Error('Invalid GitHub URL');
  }
  return { owner: match[1], repo: match[2] };
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

async function fetchJson(url: string, headers: Record<string, string>): Promise<Response> {
  try {
    return await fetch(url, { headers });
  } catch {
    throw new Error('Network error connecting to GitHub API');
  }
}

async function getDefaultBranch(owner: string, repo: string, headers: Record<string, string>): Promise<string> {
  const res = await fetchJson(`https://api.github.com/repos/${owner}/${repo}`, headers);
  if (res.status === 404) throw new Error('Repository not found or is private');
  if (res.status === 403) {
    const rl = readRateLimitInfo(res);
    if (rl.remaining === 0) throw new Error(`GitHub API rate limit reached. Try again in ${formatWait(rl.resetEpochSeconds)}.`);
    throw new Error('GitHub API access forbidden (possible abuse detection or insufficient permissions).');
  }
  if (!res.ok) throw new Error(`GitHub API returned status ${res.status}`);
  const data = await res.json();
  const branch = typeof data?.default_branch === 'string' ? data.default_branch : null;
  if (!branch) throw new Error('Could not determine default branch for repository');
  return branch;
}

async function getBranchHeadSha(owner: string, repo: string, branch: string, headers: Record<string, string>): Promise<string> {
  const res = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, headers);
  if (res.status === 404) throw new Error('Default branch ref not found');
  if (res.status === 403) {
    const rl = readRateLimitInfo(res);
    if (rl.remaining === 0) throw new Error(`GitHub API rate limit reached. Try again in ${formatWait(rl.resetEpochSeconds)}.`);
    throw new Error('GitHub API access forbidden (possible abuse detection or insufficient permissions).');
  }
  if (!res.ok) throw new Error(`GitHub API returned status ${res.status}`);
  const data = await res.json();
  const sha = typeof data?.object?.sha === 'string' ? data.object.sha : null;
  if (!sha) throw new Error('Could not resolve branch HEAD SHA');
  return sha;
}

async function getRecursiveTree(owner: string, repo: string, sha: string, headers: Record<string, string>): Promise<{ tree: GitTreeItem[]; truncated: boolean }> {
  const res = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`, headers);
  if (res.status === 404) throw new Error('Repository not found or is private');
  if (res.status === 403) {
    const rl = readRateLimitInfo(res);
    if (rl.remaining === 0) throw new Error(`GitHub API rate limit reached. Try again in ${formatWait(rl.resetEpochSeconds)}.`);
    throw new Error('GitHub API access forbidden (possible abuse detection or insufficient permissions).');
  }
  if (!res.ok) throw new Error(`GitHub API returned status ${res.status}`);
  return await res.json();
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

const isSkipped = (path: string, size?: number): boolean => {
  if (size && size > 100 * 1024) return true;
  const parts = path.split('/');
  if (
    parts.includes('node_modules') ||
    parts.includes('.next') ||
    parts.includes('dist') ||
    parts.includes('build') ||
    parts.includes('out') ||
    parts.includes('public') ||
    parts.includes('__pycache__') ||
    parts.includes('.git')
  ) {
    return true;
  }
  const filename = parts[parts.length - 1];
  if (
    filename.endsWith('.lock') ||
    filename === 'package-lock.json' ||
    filename === 'yarn.lock' ||
    filename === 'pnpm-lock.yaml'
  ) {
    return true;
  }
  if (
    filename.includes('.test.') ||
    filename.includes('.spec.') ||
    parts.includes('__tests__')
  ) {
    return true;
  }
  return false;
};

async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  headers: Record<string, string>
): Promise<FileEntry | null> {
  const response = await fetchJson(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    headers
  );

  if (response.status === 403) {
    const rl = readRateLimitInfo(response);
    if (rl.remaining === 0) {
      throw new Error(`GitHub API rate limit reached. Try again in ${formatWait(rl.resetEpochSeconds)}.`);
    }
  }

  if (!response.ok) {
    console.warn(`[Ingest] Failed to fetch content for ${path}: Status ${response.status}`);
    return null;
  }
  const data = await response.json();
  if (data.type !== 'file' || data.encoding !== 'base64' || typeof data.content !== 'string') {
    return null;
  }

  const base64 = data.content.replace(/\r?\n/g, '');
  let content = Buffer.from(base64, 'base64').toString('utf8');
  if (path.toLowerCase() === 'readme.md') {
    content = content.split('\n').slice(0, 200).join('\n');
  }
  return { path, content };
}

function determineSurfaceClassification(treeItems: GitTreeItem[], treeMap: Map<string, GitTreeItem>): SurfaceClassification {
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

  let primaryLanguage = 'unknown';
  if (hasPackageJson) primaryLanguage = 'JavaScript/TypeScript';
  else if (hasRequirementsTxt) primaryLanguage = 'Python';
  else if (hasGoMod) primaryLanguage = 'Go';
  else if (hasCargoToml) primaryLanguage = 'Rust';
  else if (hasComposerJson) primaryLanguage = 'PHP';
  else if (allPaths.some((p) => p.endsWith('.tf'))) primaryLanguage = 'Terraform/HCL';
  else if (allPaths.some((p) => p.endsWith('.py'))) primaryLanguage = 'Python';
  else if (allPaths.some((p) => p.endsWith('.html'))) primaryLanguage = 'HTML/CSS/JS';

  const detectedFrameworks: string[] = [];
  if (hasPackageJson) {
    // We'll parse content later, but flag common ones based on paths
    if (allPaths.some((p) => p.startsWith('app/') || p.startsWith('pages/'))) {
      detectedFrameworks.push('Next.js');
    }
  }

  let dockerServiceCount = 0;
  // We'll refine this after reading docker-compose content

  return {
    primaryLanguage,
    detectedFrameworks,
    hasDocker: hasDockerfile || hasDockerCompose,
    hasMultipleServices: false, // refined after reading docker-compose
    isMonorepo: hasTurboJson || hasNxJson || hasLernaJson,
    projectType: 'unknown',
  };
}

export async function ingestRepo(repoUrl: string): Promise<RepoSnapshot> {
  const { owner, repo } = parseGithubUrl(repoUrl);

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'ArchDraw-App',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  console.log(`[Ingest] Resolving default branch for ${owner}/${repo}...`);
  const defaultBranch = await getDefaultBranch(owner, repo, headers);
  console.log(`[Ingest] Default branch: ${defaultBranch}`);

  console.log(`[Ingest] Resolving branch HEAD SHA...`);
  const headSha = await getBranchHeadSha(owner, repo, defaultBranch, headers);

  console.log(`[Ingest] Fetching recursive tree for ${owner}/${repo}@${defaultBranch}...`);
  const treeData = await getRecursiveTree(owner, repo, headSha, headers);

  if (!treeData.tree || !Array.isArray(treeData.tree)) {
    throw new Error('Invalid repository tree received from GitHub');
  }

  const treeItems: GitTreeItem[] = treeData.tree;
  if (treeItems.length > 50000) {
    throw new Error('Repository is too large to ingest (file tree exceeds 50k entries). Try a smaller repo or add a GitHub token.');
  }
  const fileTree = treeItems.filter(item => item.type === 'blob').map(item => item.path);
  const treeMap = new Map<string, GitTreeItem>();
  treeItems.forEach(item => treeMap.set(item.path, item));

  // ── Phase 1: Triage Read ──────────────────────────────────
  console.log(`[Ingest] Phase 1: Triage read...`);

  const phase1Candidates: string[] = [];

  // Root directory listing from tree
  const rootItems = treeItems.filter((item) => !item.path.includes('/') && item.type === 'blob');
  rootItems.forEach((item) => { if (!isSkipped(item.path, item.size)) phase1Candidates.push(item.path); });

  const phase1Always: string[] = [
    'package.json', 'requirements.txt', 'go.mod', 'Cargo.toml', 'composer.json',
    'docker-compose.yml', 'docker-compose.yaml',
    'README.md',
    '.env.example',
    'turbo.json', 'nx.json', 'lerna.json',
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

  console.log(`[Ingest] Phase 1: Fetching ${phase1Candidates.length} files...`);
  const phase1Fetched = await promisePool(phase1Candidates, 6, async (path) => {
    const item = treeMap.get(path);
    if (!item || isSkipped(path, item.size)) return null;
    return fetchFileContent(owner, repo, path, headers);
  });

  const phase1Files: FileEntry[] = [];
  let phase1PackageJsonRaw: string | null = null;
  for (const entry of phase1Fetched) {
    if (!entry) continue;
    phase1Files.push(entry);
    if (entry.path === 'package.json') phase1PackageJsonRaw = entry.content;
  }

  // Refine surface classification with actual content
  let surfaceClassification = determineSurfaceClassification(treeItems, treeMap);

  // Check docker-compose services count
  const dcEntry = phase1Files.find((f) => f.path === 'docker-compose.yml' || f.path === 'docker-compose.yaml');
  if (dcEntry) {
    const serviceCount = (dcEntry.content.match(/^\s{2}\w+:/gm) || []).length;
    surfaceClassification.hasMultipleServices = serviceCount > 1;
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
  console.log(`[Ingest] Phase 2: Stack-guided deep file selection...`);

  const phase2Candidates: string[] = [];
  const totalLimit = 40 - phase1Files.length;
  let contentBudget = 100 * 1024; // 100KB total
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
      const isExpress = deps['express'] || deps['fastify'] || deps['hapi'];
      const isLibrary = pj.main || pj.exports;

      if (isNextJs) {
        // Next.js: app/ or pages/ routes (V1 behavior)
        // app routes
        const appPages = treeItems
          .filter(item => item.type === 'blob' && /^app\/(?:.+\/)?page\.tsx$/.test(item.path) && !isSkipped(item.path, item.size))
          .slice(0, 20)
          .map(item => item.path);
        appPages.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });

        const apiRoutes = treeItems
          .filter(item => item.type === 'blob' && /^app\/api\/(?:.+\/)?route\.ts$/.test(item.path) && !isSkipped(item.path, item.size))
          .slice(0, 20)
          .map(item => item.path);
        apiRoutes.forEach(p => { if (!phase2Candidates.includes(p)) phase2Candidates.push(p); });

        const otherNextFiles = ['middleware.ts', 'middleware.js', 'app/layout.tsx', 'prisma/schema.prisma', 'next.config.ts', 'next.config.js'];
        for (const p of otherNextFiles) {
          if (treeMap.has(p) && !phase2Candidates.includes(p)) phase2Candidates.push(p);
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

  // Enforce hard limits
  let phase2Slice = phase2Candidates.slice(0, Math.min(phase2Candidates.length, totalLimit));

  console.log(`[Ingest] Phase 2: Fetching ${phase2Slice.length} files...`);
  const phase2Fetched = await promisePool(phase2Slice, 6, async (path) => {
    const item = treeMap.get(path);
    if (!item || isSkipped(path, item.size)) return null;
    if (contentBudget <= 0) return null;
    if ((item.size || 0) > contentBudget) return null;
    contentBudget -= (item.size || 0);
    return fetchFileContent(owner, repo, path, headers);
  });

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

  return {
    repoUrl,
    owner,
    repo,
    fileTree,
    selectedFiles,
    repoMeta: {
      hasAppDir,
      hasPagesDir,
      hasPrisma,
      hasMiddleware,
      hasEnvExample,
      packageJson,
    },
    // New fields
    surfaceClassification,
    phase1Files,
    phase2Files,
  };
}
