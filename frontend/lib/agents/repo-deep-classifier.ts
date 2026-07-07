import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { formatSourceFilesForPrompt, JSON_OUTPUT_REMINDER } from './repo-prompt-utils';
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

function normalizeRepoProfile(parsed: Record<string, unknown>): RepoProfile {
  const primaryStack = (parsed.primaryStack as Record<string, unknown>) || {};
  const extractionStrategy = (parsed.extractionStrategy as Record<string, unknown>) || {};

  return {
    repoType: (parsed.repoType as RepoType) || 'unknown',
    architecturePattern: (parsed.architecturePattern as ArchitecturePattern) || 'unknown',
    primaryStack: {
      framework: (primaryStack.framework as string | null) ?? null,
      language: (primaryStack.language as string) || 'unknown',
      runtime: (primaryStack.runtime as string) || 'unknown',
    },
    confidence: (parsed.confidence as RepoProfile['confidence']) || 'medium',
    reasoning: (parsed.reasoning as string) || 'Classified from repository analysis.',
    extractionStrategy: {
      keyDirectories: Array.isArray(extractionStrategy.keyDirectories)
        ? (extractionStrategy.keyDirectories as string[])
        : [],
      entryPoints: Array.isArray(extractionStrategy.entryPoints)
        ? (extractionStrategy.entryPoints as string[])
        : [],
      moduleStructure: (extractionStrategy.moduleStructure as string) || '',
      focusAreas: Array.isArray(extractionStrategy.focusAreas)
        ? (extractionStrategy.focusAreas as string[])
        : [],
    },
  };
}

export async function deepClassify(snapshot: RepoSnapshot, summaries?: string[]): Promise<RepoProfile> {
  const fileTreeText = snapshot.fileTree.slice(0, 300).join('\n');
  const surfaceText = JSON.stringify(snapshot.surfaceClassification, null, 2);

  const sourceFilesBlock = formatSourceFilesForPrompt([
    ...snapshot.phase1Files,
    ...snapshot.phase2Files,
  ]);

  const summariesBlock = summaries && summaries.length > 0
    ? `SUBSYSTEM SUMMARIES:\n${summaries.join('\n\n')}`
    : `CONFIG AND SOURCE FILES (reference only):\n${sourceFilesBlock}`;

  const prompt = `Classify this repository.

FILE TREE:
${fileTreeText}

SURFACE CLASSIFICATION:
${surfaceText}

${summariesBlock}

${JSON_OUTPUT_REMINDER}`;

  console.log(`[DeepClassifier] Calling LLM to classify repository...`);

  try {
    const result = await apiKeyManager.executeWithRetry(async (client) =>
      groqJsonCompletion(client, {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an expert software architect. You analyze code repositories and classify
their type, stack, and architectural pattern with precision.

You will receive a repository snapshot including file tree, config files, 
and selected source files.

Produce a definitive classification across these dimensions:

REPO TYPE — pick exactly one:
- documentation: only markdown, no runnable code
- static_site: plain HTML/CSS/JS, no framework
- library: exported package, no app entry point
- framework: has CLI, plugin system, or generates scaffolding
- cli_tool: command-line tool, bin entry point
- frontend_only: client-side app, no backend (React, Vue, Svelte SPA)
- backend_only: server/API only, no frontend
- fullstack_monolith: single codebase with both frontend and backend
- fullstack_separated: frontend and backend in same repo but clearly separated
- microservices: multiple independent services
- monorepo: multiple packages managed together
- mobile: React Native, Flutter, Swift, Kotlin
- data_ml: Jupyter notebooks, ML pipelines, data processing
- devops_config: Terraform, Helm, Kubernetes, CI/CD configs only
- unknown: cannot determine with confidence

ARCHITECTURE PATTERN — pick exactly one:
- mvc, layered, clean_architecture, hexagonal, event_driven, 
  serverless, jamstack, microservices, monolithic, pipeline, unknown

PRIMARY STACK — be specific:
- framework: e.g. "Next.js 14", "Express 4", "FastAPI", "Go net/http"
- language: e.g. "TypeScript", "Python", "Go"
- runtime: e.g. "Node.js", "Python 3.11", "Go 1.21"

EXTRACTION STRATEGY — tell downstream agents what to focus on:
- keyDirectories: string[] — which directories contain the core logic
- entryPoints: string[] — main entry files
- moduleStructure: string — one sentence describing how the code is organized
- focusAreas: string[] — what the component extractor should pay most attention to

CRITICAL: Reply with a single JSON object only. No markdown fences, no bullet lists, no text before or after the JSON.

{
  "repoType": "string",
  "architecturePattern": "string", 
  "primaryStack": {
    "framework": "string or null",
    "language": "string",
    "runtime": "string"
  },
  "confidence": "high | medium | low",
  "reasoning": "two sentences explaining why you classified it this way",
  "extractionStrategy": {
    "keyDirectories": [],
    "entryPoints": [],
    "moduleStructure": "string",
    "focusAreas": []
  }
}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      })
    );

    try {
      const parsed = parseLlmJson<Record<string, unknown>>(result, 'DeepClassifier');
      return normalizeRepoProfile(parsed);
    } catch (parseErr) {
      console.warn(
        '[DeepClassifier] JSON parse failed, using surface fallback:',
        parseErr instanceof Error ? parseErr.message : parseErr
      );
      console.warn('[DeepClassifier] Raw preview:', result.slice(0, 200));
      return buildFallbackRepoProfile(snapshot);
    }
  } catch (err) {
    console.error('[DeepClassifier] LLM call failed:', err);
    console.warn('[DeepClassifier] Using surface fallback after LLM failure');
    return buildFallbackRepoProfile(snapshot);
  }
}
