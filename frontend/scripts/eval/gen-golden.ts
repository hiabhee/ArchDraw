/**
 * Golden-graph source of truth.
 *
 * Each definition is hand-labeled to capture the *load-bearing* architecture of a
 * well-known public repo (8–20 nodes, 8–20 edges for apps; fewer for libraries).
 * `forbiddenNodes` lists concrete hallucination traps — services a keyword-driven
 * pipeline is likely to fabricate but that do NOT exist in the repo.
 *
 * Run `npx tsx scripts/eval/gen-golden.ts` to emit `golden/*.json` (the artifacts
 * the eval runner reads). Re-run after editing this file. Pin `pinnedHeadSha`
 * quarterly so labels stay in sync with upstream.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GoldenGraph } from './types';

const here = dirname(fileURLToPath(import.meta.url));
const goldenDir = resolve(here, 'golden');

const LIB_FORBIDDEN = ['PostgreSQL', 'Redis', 'MongoDB', 'MySQL', 'Stripe', 'Auth0', 'Stripe API'];

const GOLDEN: Record<string, GoldenGraph> = {
  // ── Fullstack apps (detailed graphs) ──────────────────────
  'vercel__nextjs-subscription-payments': {
    repo: 'https://github.com/vercel/nextjs-subscription-payments',
    classification: { repoType: 'fullstack_monolith', framework: 'Next.js', database: 'PostgreSQL' },
    nodes: [
      { id: 'web_frontend', label: 'Next.js Web App', type: 'PAGE', aliases: ['web app', 'frontend', 'app'] },
      { id: 'customer_auth', label: 'Supabase Auth', type: 'AUTH', aliases: ['authentication', 'auth', 'supabase auth'] },
      { id: 'checkout_api', label: 'Checkout API', type: 'API_ROUTE', aliases: ['checkout', 'stripe checkout'] },
      { id: 'webhook_api', label: 'Stripe Webhook', type: 'API_ROUTE', aliases: ['webhook', 'webhooks', 'stripe webhook'] },
      { id: 'postgres', label: 'PostgreSQL', type: 'DATABASE', aliases: ['database', 'postgres', 'supabase database'] },
      { id: 'stripe', label: 'Stripe', type: 'EXTERNAL_SERVICE', aliases: ['stripe api', 'stripe payments'] },
    ],
    edges: [
      { from: 'web_frontend', to: 'customer_auth' },
      { from: 'web_frontend', to: 'checkout_api' },
      { from: 'checkout_api', to: 'stripe' },
      { from: 'webhook_api', to: 'stripe' },
      { from: 'webhook_api', to: 'postgres' },
      { from: 'customer_auth', to: 'postgres' },
    ],
    forbiddenNodes: [],
    notes: 'Canonical Next.js SaaS. Stripe IS real (not forbidden). Webhook handler persists to Supabase Postgres.',
  },

  'shadcn__taxonomy': {
    repo: 'https://github.com/shadcn/taxonomy',
    classification: { repoType: 'fullstack_monolith', framework: 'Next.js', database: 'PostgreSQL' },
    nodes: [
      { id: 'web_frontend', label: 'Next.js Web App', type: 'PAGE', aliases: ['web app', 'frontend', 'app'] },
      { id: 'auth', label: 'NextAuth', type: 'AUTH', aliases: ['nextauth', 'authentication', 'auth'] },
      { id: 'prisma', label: 'Prisma ORM', type: 'CORE_MODULE', aliases: ['prisma', 'database client', 'orm'] },
      { id: 'postgres', label: 'PostgreSQL', type: 'DATABASE', aliases: ['database', 'postgres'] },
    ],
    edges: [
      { from: 'web_frontend', to: 'auth' },
      { from: 'web_frontend', to: 'prisma' },
      { from: 'auth', to: 'postgres' },
      { from: 'prisma', to: 'postgres' },
    ],
    forbiddenNodes: [],
    notes: 'Next.js app router + Prisma + NextAuth. DB provider may be MySQL/PlanetScale in some versions — re-check and update golden if the eval reports a database mismatch.',
  },

  'supabase__supabase': {
    repo: 'https://github.com/supabase/supabase',
    classification: { repoType: 'monorepo', framework: null, database: 'PostgreSQL' },
    nodes: [
      { id: 'studio', label: 'Supabase Studio', type: 'PAGE', aliases: ['studio', 'dashboard', 'apps/studio'] },
      { id: 'postgrest', label: 'PostgREST API', type: 'SERVICE', aliases: ['postgrest', 'rest api', 'api'] },
      { id: 'auth', label: 'GoTrue Auth', type: 'AUTH', aliases: ['gotrue', 'authentication', 'auth'] },
      { id: 'realtime', label: 'Realtime', type: 'SERVICE', aliases: ['realtime'] },
      { id: 'storage', label: 'Storage', type: 'SERVICE', aliases: ['storage-api', 'storage'] },
      { id: 'postgres', label: 'PostgreSQL', type: 'DATABASE', aliases: ['database', 'postgres'] },
    ],
    edges: [
      { from: 'studio', to: 'postgrest' },
      { from: 'studio', to: 'auth' },
      { from: 'postgrest', to: 'postgres' },
      { from: 'auth', to: 'postgres' },
      { from: 'realtime', to: 'postgres' },
      { from: 'storage', to: 'postgres' },
    ],
    forbiddenNodes: ['Stripe', 'Redis', 'MongoDB'],
    notes: 'Platform monorepo across TS/Go/Elixir. Every backend service mounts the same Postgres.',
  },

  // ── JS/TS libraries ───────────────────────────────────────
  'expressjs__express': {
    repo: 'https://github.com/expressjs/express',
    classification: { repoType: 'library', framework: 'Express', database: null },
    nodes: [
      { id: 'express_core', label: 'Express', type: 'CORE_MODULE', aliases: ['express', 'express.js', 'express core'], sourceFiles: ['lib/express.js', 'lib/application.js'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Pure web framework library. The pipeline must NOT fabricate a database/queue/auth service from keywords like "middleware" or "router".',
  },
  'fastify__fastify': {
    repo: 'https://github.com/fastify/fastify',
    classification: { repoType: 'library', framework: 'Fastify', database: null },
    nodes: [
      { id: 'fastify_core', label: 'Fastify', type: 'CORE_MODULE', aliases: ['fastify', 'fastify core'], sourceFiles: ['lib/fastify.js', 'index.js'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Pure web framework library — no runtime infrastructure.',
  },
  'nestjs__nest': {
    repo: 'https://github.com/nestjs/nest',
    classification: { repoType: 'framework', framework: 'NestJS', database: null },
    nodes: [
      { id: 'nestjs_core', label: 'NestJS', type: 'CORE_MODULE', aliases: ['nestjs', 'nest', 'nestjs framework'], sourceFiles: ['packages/core/lib/nest-application.ts'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Framework repo. Detection of @Controller decorators is fine but should not invent a deployed service with a database.',
  },
  'koajs__koa': {
    repo: 'https://github.com/koajs/koa',
    classification: { repoType: 'library', framework: 'Koa', database: null },
    nodes: [
      { id: 'koa_core', label: 'Koa', type: 'CORE_MODULE', aliases: ['koa', 'koa core'], sourceFiles: ['lib/application.js'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Pure web framework library.',
  },

  // ── Python libraries/frameworks ───────────────────────────
  'pallets__flask': {
    repo: 'https://github.com/pallets/flask',
    classification: { repoType: 'library', framework: 'Flask', database: null },
    nodes: [
      { id: 'flask_core', label: 'Flask', type: 'CORE_MODULE', aliases: ['flask', 'flask core'], sourceFiles: ['src/flask/app.py', 'src/flask/__init__.py'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Pure WSGI microframework — no bundled database or queue.',
  },
  'django__django': {
    repo: 'https://github.com/django/django',
    classification: { repoType: 'framework', framework: 'Django', database: null },
    nodes: [
      { id: 'django_core', label: 'Django', type: 'CORE_MODULE', aliases: ['django', 'django framework'], sourceFiles: ['django/__init__.py'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Framework repo ships ORM/database-abstraction but no actual database service.',
  },
  'encode__django-rest-framework': {
    repo: 'https://github.com/encode/django-rest-framework',
    classification: { repoType: 'library', framework: 'Django REST Framework', database: null },
    nodes: [
      { id: 'drf_core', label: 'Django REST Framework', type: 'CORE_MODULE', aliases: ['rest framework', 'drf', 'django rest framework'], sourceFiles: ['rest_framework/__init__.py'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Toolkit library built on Django — no runtime infrastructure of its own.',
  },
  'tiangolo__fastapi': {
    repo: 'https://github.com/tiangolo/fastapi',
    classification: { repoType: 'framework', framework: 'FastAPI', database: null },
    nodes: [
      { id: 'fastapi_core', label: 'FastAPI', type: 'CORE_MODULE', aliases: ['fastapi', 'fast api', 'fastapi framework'], sourceFiles: ['fastapi/__init__.py', 'fastapi/applications.py'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Pure ASGI web framework — no bundled database.',
  },
  'encode__uvicorn': {
    repo: 'https://github.com/encode/uvicorn',
    classification: { repoType: 'library', framework: 'Uvicorn', database: null },
    nodes: [
      { id: 'uvicorn_core', label: 'Uvicorn', type: 'CORE_MODULE', aliases: ['uvicorn', 'asgi server'], sourceFiles: ['uvicorn/__init__.py', 'uvicorn/main.py'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'ASGI server library — no database or message queue.',
  },

  // ── Rails / Laravel / Spring Boot ────────────────────────
  'rails__rails': {
    repo: 'https://github.com/rails/rails',
    classification: { repoType: 'framework', framework: 'Rails', database: null },
    nodes: [
      { id: 'rails_core', label: 'Ruby on Rails', type: 'CORE_MODULE', aliases: ['rails', 'ruby on rails', 'rails framework'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Framework monorepo (railties, activerecord, actionpack…). Detecting routes.py/controllers is correct but should not fabricate a live DB service.',
  },
  'laravel__laravel': {
    repo: 'https://github.com/laravel/laravel',
    classification: { repoType: 'framework', framework: 'Laravel', database: null },
    nodes: [
      { id: 'laravel_core', label: 'Laravel', type: 'CORE_MODULE', aliases: ['laravel', 'laravel framework', 'laravel app'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Laravel application skeleton/framework — ships Eloquent ORM but no bundled database service.',
  },
  'spring-projects__spring-boot': {
    repo: 'https://github.com/spring-projects/spring-boot',
    classification: { repoType: 'framework', framework: 'Spring Boot', database: null },
    nodes: [
      { id: 'spring_boot_core', label: 'Spring Boot', type: 'CORE_MODULE', aliases: ['spring boot', 'spring-boot', 'springboot'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Java framework — @Controller/@GetMapping exist across autoconfig samples; should not fabricate a deployed app with Postgres/Redis.',
  },

  // ── Go / Rust libraries ──────────────────────────────────
  'gin-gonic__gin': {
    repo: 'https://github.com/gin-gonic/gin',
    classification: { repoType: 'library', framework: 'Gin', database: null },
    nodes: [
      { id: 'gin_core', label: 'Gin', type: 'CORE_MODULE', aliases: ['gin', 'gin web framework'], sourceFiles: ['gin.go'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'HTTP web framework library — no database or queue.',
  },
  'labstack__echo': {
    repo: 'https://github.com/labstack/echo',
    classification: { repoType: 'library', framework: 'Echo', database: null },
    nodes: [
      { id: 'echo_core', label: 'Echo', type: 'CORE_MODULE', aliases: ['echo', 'echo framework'], sourceFiles: ['echo.go'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'High-performance HTTP web framework library.',
  },
  'tokio-rs__axum': {
    repo: 'https://github.com/tokio-rs/axum',
    classification: { repoType: 'library', framework: 'Axum', database: null },
    nodes: [
      { id: 'axum_core', label: 'Axum', type: 'CORE_MODULE', aliases: ['axum', 'axum web framework'], sourceFiles: ['axum/src/lib.rs'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Ergonomic Rust web framework — no bundled infrastructure.',
  },

  // ── Monorepo / CLI ───────────────────────────────────────
  'vercel__turborepo': {
    repo: 'https://github.com/vercel/turborepo',
    classification: { repoType: 'cli_tool', framework: null, database: null },
    nodes: [
      { id: 'turbo_cli', label: 'Turbo CLI', type: 'CORE_MODULE', aliases: ['turbo', 'turbo cli', 'turborepo'] },
      { id: 'turbo_core', label: 'Turbo Core', type: 'CORE_MODULE', aliases: ['turbo core', '@turbo/core', 'packages/turbo'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Build-system monorepo + CLI. Should yield a CLI/library profile, not a web app with a database.',
  },
  'shadcn-ui__ui': {
    repo: 'https://github.com/shadcn-ui/ui',
    classification: { repoType: 'monorepo', framework: 'React', database: null },
    nodes: [
      { id: 'ui_library', label: 'shadcn/ui Components', type: 'CORE_MODULE', aliases: ['ui', 'components', 'shadcn ui'] },
      { id: 'docs_site', label: 'Docs Site', type: 'PAGE', aliases: ['docs', 'apps/www', 'website'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'React component registry monorepo (apps/www + packages). Should not fabricate a backend/database.',
  },
  'pnpm__pnpm': {
    repo: 'https://github.com/pnpm/pnpm',
    classification: { repoType: 'cli_tool', framework: null, database: null },
    nodes: [
      { id: 'pnpm_cli', label: 'pnpm CLI', type: 'CORE_MODULE', aliases: ['pnpm', 'pnpm cli'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Package manager CLI — TypeScript monorepo, no runtime database.',
  },
  'sharkdp__bat': {
    repo: 'https://github.com/sharkdp/bat',
    classification: { repoType: 'cli_tool', framework: null, database: null },
    nodes: [
      { id: 'bat_cli', label: 'bat CLI', type: 'CORE_MODULE', aliases: ['bat', 'cat clone', 'bat cli'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Rust cat-clone CLI — no backend, no database.',
  },
  'charmbracelet__gum': {
    repo: 'https://github.com/charmbracelet/gum',
    classification: { repoType: 'cli_tool', framework: null, database: null },
    nodes: [
      { id: 'gum_cli', label: 'Gum CLI', type: 'CORE_MODULE', aliases: ['gum', 'gum cli', 'shell script tool'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'Go tool for glamorous shell scripts — pure CLI.',
  },
  'hashicorp__terraform': {
    repo: 'https://github.com/hashicorp/terraform',
    classification: { repoType: 'cli_tool', framework: null, database: null },
    nodes: [
      { id: 'terraform_cli', label: 'Terraform CLI', type: 'CORE_MODULE', aliases: ['terraform', 'terraform cli', 'terraform binary'] },
    ],
    edges: [],
    forbiddenNodes: ['Stripe', 'Auth0', 'Stripe API'],
    notes: 'IaC CLI written in Go. It *references* provider resources but the binary itself is not a database/queue service.',
  },

  // ── Config / docs / library negative cases ──────────────
  'docker__awesome-compose': {
    repo: 'https://github.com/docker/awesome-compose',
    classification: { repoType: 'devops_config', framework: null, database: null },
    nodes: [
      { id: 'compose_examples', label: 'Compose Examples', type: 'CORE_MODULE', aliases: ['compose', 'docker compose examples', 'examples'] },
    ],
    edges: [],
    forbiddenNodes: [],
    notes: 'Curated set of docker-compose YAML examples — config only, not a deployable app. Pipeline should label devops_config / documentation and avoid fabricating service nodes from the example YAML.',
  },
  'langchain-ai__langchain': {
    repo: 'https://github.com/langchain-ai/langchain',
    classification: { repoType: 'library', framework: 'LangChain', database: null },
    nodes: [
      { id: 'langchain_core', label: 'LangChain', type: 'CORE_MODULE', aliases: ['langchain', 'langchain library', 'langchain core'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'LLM application library with many optional integration packages. The core repo should classify as library and not fabricate a live database service, even though vectorstore integrations are referenced.',
  },
  'vercel__ai': {
    repo: 'https://github.com/vercel/ai',
    classification: { repoType: 'library', framework: 'AI SDK', database: null },
    nodes: [
      { id: 'ai_sdk', label: 'AI SDK', type: 'CORE_MODULE', aliases: ['ai', 'vercel ai sdk', 'ai sdk', 'ai core'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'TypeScript AI SDK monorepo (packages/ai, packages/provider...). Library — no runtime database of its own.',
  },
  'awesome-selfhosted__awesome-selfhosted': {
    repo: 'https://github.com/awesome-selfhosted/awesome-selfhosted',
    classification: { repoType: 'documentation', framework: null, database: null },
    nodes: [
      { id: 'docs', label: 'Awesome Selfhosted List', type: 'CORE_MODULE', aliases: ['readme', 'list', 'docs', 'markdown'] },
    ],
    edges: [],
    forbiddenNodes: LIB_FORBIDDEN,
    notes: 'A curated README list of self-hosted software. Pure documentation — almost any node beyond a docs/README node is a hallucination.',
  },
};

function main() {
  // Ensure every corpus repo has a golden graph.
  const corpusPath = resolve(here, 'repo-corpus.json');
  const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as { repos: { id: string }[] };
  const corpusIds = corpus.repos.map((r) => r.id);
  const goldenIds = Object.keys(GOLDEN);

  const missing = corpusIds.filter((id) => !GOLDEN[id]);
  const extra = goldenIds.filter((id) => !corpusIds.includes(id));
  if (missing.length || extra.length) {
    console.error('Golden/corpus mismatch:', { missing, extra });
    process.exit(1);
  }

  for (const [id, graph] of Object.entries(GOLDEN)) {
    const out = resolve(goldenDir, `${id}.json`);
    writeFileSync(out, JSON.stringify(graph, null, 2) + '\n', 'utf8');
  }
  console.log(`Wrote ${goldenIds.length} golden graphs to ${goldenDir}`);
}

main();