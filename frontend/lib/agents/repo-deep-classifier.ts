import type { RepoSnapshot, RepoProfile, RepoType, ArchitecturePattern, FileEntry } from '@/lib/types/repo-diagram';

function inferFrameworkFromFiles(files: FileEntry[]): string | null {
  for (const file of files) {
    const content = file.content.toLowerCase();
    if (file.path === 'requirements.txt' || file.path === 'pyproject.toml') {
      if (content.includes('fastapi')) return 'FastAPI';
      if (content.includes('django')) return 'Django';
      if (content.includes('flask')) return 'Flask';
    }
    if (file.path === 'package.json' || file.path.endsWith('package.json')) {
      if (content.includes('"next"') || content.includes("'next'")) return 'Next.js';
      if (content.includes('nestjs') || content.includes('@nestjs/core')) return 'NestJS';
      if (content.includes('express')) return 'Express';
      if (content.includes('fastify')) return 'Fastify';
      if (content.includes('nuxt') || content.includes('nuxt3')) return 'Nuxt';
      if (content.includes('sveltekit') || content.includes('@sveltejs/kit')) return 'SvelteKit';
      if (content.includes('remix') || content.includes('@remix-run/react')) return 'Remix';
      if (content.includes('vue') && !content.includes('nuxt')) return 'Vue';
      if (content.includes('react') && !content.includes('next')) return 'React';
    }
    if (file.path === 'go.mod') {
      if (content.includes('github.com/gin-gonic/gin')) return 'Gin';
      if (content.includes('github.com/labstack/echo')) return 'Echo';
      if (content.includes('github.com/gofiber/fiber')) return 'Fiber';
    }
    if (file.path === 'Cargo.toml') {
      if (content.includes('actix-web')) return 'Actix';
      if (content.includes('axum')) return 'Axum';
      if (content.includes('rocket')) return 'Rocket';
    }
  }
  return null;
}

function inferKeyDirectories(paths: string[]): string[] {
  const dirs = new Set<string>();
  for (const p of paths) {
    const top = p.split('/')[0];
    if (['app', 'src', 'api', 'routes', 'services', 'models', 'lib', 'backend', 'frontend'].includes(top)) {
      dirs.add(top);
    }
  }
  return Array.from(dirs).slice(0, 8);
}

function inferEntryPoints(paths: string[]): string[] {
  const candidates = ['main.py', 'app.py', 'manage.py', 'index.ts', 'index.js', 'server.ts', 'server.js'];
  return paths.filter((p) => candidates.some((c) => p === c || p.endsWith(`/${c}`))).slice(0, 6);
}

/** Deterministic profile when the LLM returns non-JSON (bullets, prose, etc.). */
export function buildFallbackRepoProfile(snapshot: RepoSnapshot): RepoProfile {
  const sc = snapshot.surfaceClassification;
  const paths = snapshot.fileTree.map((p) => p.toLowerCase());
  const frameworks = sc.detectedFrameworks;
  const framework =
    frameworks[0] ??
    inferFrameworkFromFiles([...snapshot.phase1Files, ...snapshot.phase2Files]);

  const hasFrontendFiles = paths.some((p) => /\.(tsx|jsx|vue|svelte)$/.test(p));
  const hasBackendPy = paths.some((p) => p.endsWith('.py'));
  const hasBackendJs = paths.some(
    (p) => p.includes('/api/') || p.includes('route.ts') || p.includes('routes/')
  );

  let repoType: RepoType = 'unknown';
  if (sc.isMonorepo) repoType = 'monorepo';
  else if (sc.hasMultipleServices) repoType = 'microservices';
  else if (hasFrontendFiles && (hasBackendPy || hasBackendJs)) repoType = 'fullstack_monolith';
  else if (hasFrontendFiles) repoType = 'frontend_only';
  else if (sc.primaryLanguage === 'Python' || framework === 'FastAPI' || framework === 'Django' || framework === 'Flask') {
    repoType = 'backend_only';
  } else if (sc.primaryLanguage === 'JavaScript/TypeScript' && !hasFrontendFiles) {
    repoType = 'backend_only';
  }

  let architecturePattern: ArchitecturePattern = 'unknown';
  if (repoType === 'backend_only' || repoType === 'fullstack_monolith') architecturePattern = 'layered';
  if (framework === 'FastAPI' || framework === 'Express') architecturePattern = 'layered';

  const language =
    sc.primaryLanguage === 'Python'
      ? 'Python'
      : sc.primaryLanguage === 'JavaScript/TypeScript'
        ? 'TypeScript'
        : sc.primaryLanguage === 'Go'
          ? 'Go'
          : sc.primaryLanguage;

  const runtime =
    language === 'Python'
      ? 'Python'
      : language === 'TypeScript'
        ? 'Node.js'
        : language === 'Go'
          ? 'Go'
          : 'unknown';

  const keyDirectories = inferKeyDirectories(paths);
  const focusAreas: string[] = ['API routes and handlers', 'data models and persistence'];

  if (keyDirectories.includes('prisma') || paths.some((p) => p.match(/prisma\/schema\.(prisma|ts)/))) focusAreas.push('database ORM (Prisma)');
  if (paths.some((p) => /\/supabase\//.test(p))) focusAreas.push('Supabase integration');
  if (paths.some((p) => /middleware\.(ts|js|py)$/.test(p))) focusAreas.push('authentication and middleware');
  if (paths.some((p) => /\/queue\/|worker|bull|celery/.test(p))) focusAreas.push('background workers and queues');
  if (framework && ['Next.js', 'Remix', 'Nuxt', 'SvelteKit'].includes(framework)) focusAreas.push('framework routing and layouts');

  return {
    repoType,
    architecturePattern,
    primaryStack: {
      framework,
      language,
      runtime,
    },
    applicationDomain: framework ? `${framework} application` : 'Web application',
    coreCapabilities: [],
    primaryUserFlows: [],
    confidence: 'low',
    reasoning:
      'Fallback classification from repository file tree and config (LLM response was not valid JSON).',
    extractionStrategy: {
      keyDirectories,
      entryPoints: inferEntryPoints(paths),
      moduleStructure: 'Inferred from top-level directories and common entry files.',
      focusAreas,
    },
  };
}
