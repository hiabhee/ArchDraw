import type { RepoSnapshot, RepoProfile, ExtractedNode, RichEdge, NodeType, FileEntry } from '@/lib/types/repo-diagram';

const MAX_HEURISTIC_NODES = 18;

function slugId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'component';
}

function humanLabel(path: string): string {
  const base = path.split('/').pop()?.replace(/\.(py|ts|tsx|js|go|rs)$/, '') ?? path;
  return base
    .split(/[_-]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function detectDbFromFiles(files: FileEntry[]): { id: string; label: string; path: string } | null {
  for (const file of files) {
    const c = file.content.toLowerCase();
    if (c.includes('prisma')) return { id: 'database', label: 'Database (Prisma)', path: file.path };
    if (c.includes('drizzle')) return { id: 'database', label: 'Database (Drizzle)', path: file.path };
    if (c.includes('typeorm') || c.includes('type-orm')) return { id: 'database', label: 'Database (TypeORM)', path: file.path };
    if (c.includes('sqlite3') || c.includes('sqlite')) return { id: 'database', label: 'SQLite Database', path: file.path };
    if (c.includes('postgres') || c.includes('psycopg') || c.includes('pg-promise') || c.includes('pg_pool')) return { id: 'database', label: 'PostgreSQL Database', path: file.path };
    if (c.includes('mongodb') || c.includes('mongoose')) return { id: 'database', label: 'MongoDB', path: file.path };
    if (c.includes('redis')) return { id: 'redis_cache', label: 'Redis Cache', path: file.path };
    if (c.includes('supabase') || c.includes('supabase_client')) return { id: 'supabase', label: 'Supabase', path: file.path };
  }
  // Check for prisma file specifically
  if (files.some((f) => f.path === 'prisma/schema.prisma')) {
    return { id: 'database', label: 'Database (Prisma)', path: 'prisma/schema.prisma' };
  }
  const dbPaths = files.map((f) => f.path).filter((p) => /database|db\.py|models\//i.test(p));
  if (dbPaths[0]) {
    return { id: slugId(dbPaths[0]), label: humanLabel(dbPaths[0]), path: dbPaths[0] };
  }
  return null;
}

function detectExternalServices(files: FileEntry[]): { id: string; label: string; type: NodeType; sourceFiles: string[] }[] {
  const services: { name: string; id: string; label: string; file: string }[] = [];
  for (const file of files) {
    const c = file.content.toLowerCase();
    if (c.includes('stripe') || c.includes('stripe.api_key')) services.push({ name: 'stripe', id: 'stripe_api', label: 'Stripe API', file: file.path });
    if (c.includes('resend')) services.push({ name: 'resend', id: 'resend', label: 'Resend Email', file: file.path });
    if (c.includes('supabase') || c.includes('createclient') && c.includes('supabase')) {
      if (!services.some((s) => s.name === 'supabase')) services.push({ name: 'supabase', id: 'supabase', label: 'Supabase', file: file.path });
    }
    if (c.includes('clerk') || c.includes('@clerk')) services.push({ name: 'clerk', id: 'clerk_auth', label: 'Clerk Auth', file: file.path });
    if (c.includes('nextauth') || c.includes('next-auth')) services.push({ name: 'nextauth', id: 'next_auth', label: 'NextAuth', file: file.path });
    if (c.includes('auth0') || c.includes('@auth0')) services.push({ name: 'auth0', id: 'auth0', label: 'Auth0', file: file.path });
    if (c.includes('firebase')) services.push({ name: 'firebase', id: 'firebase', label: 'Firebase', file: file.path });
    if (c.includes('openai') || c.includes('@openai')) services.push({ name: 'openai', id: 'openai_api', label: 'OpenAI API', file: file.path });
    if (c.includes('bullmq') || c.includes('bull')) services.push({ name: 'bullmq', id: 'queue', label: 'Background Queue', file: file.path });
    if (c.includes('celery')) services.push({ name: 'celery', id: 'celery_worker', label: 'Celery Worker', file: file.path });
  }
  // Deduplicate and convert
  const seen = new Set<string>();
  return services.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  }).map((s) => ({
    id: s.id,
    label: s.label,
    type: 'EXTERNAL_SERVICE' as NodeType,
    sourceFiles: [s.file],
  }));
}

function inferNodeType(path: string): NodeType {
  const p = path.toLowerCase();
  if (p.includes('middleware')) return 'MIDDLEWARE';
  if (p.includes('auth')) return 'AUTH';
  if (/route|router|api|controller|endpoint|handler/.test(p)) return 'API_ROUTE';
  if (/model|schema|database|db|repository|dao/.test(p)) return 'DATABASE';
  if (/page\.(tsx|jsx|vue)|^pages\//.test(p)) return 'PAGE';
  if (/service|worker|task/.test(p)) return 'SERVICE';
  return 'SERVICE';
}

function inferArchitectureNodes(
  snapshot: RepoSnapshot,
  profile?: RepoProfile
): { appNodeLabel: string; fileCluster: Record<string, string[]> } {
  const paths = snapshot.fileTree;
  const framework = profile?.primaryStack?.framework?.toLowerCase() || '';

  let appNodeLabel = 'Application';
  const fileCluster: Record<string, string[]> = {
    api: [],
    pages: [],
    services: [],
    middleware: [],
    auth: [],
    database: [],
    workers: [],
  };

  if (framework.includes('next')) {
    appNodeLabel = 'Frontend App (Next.js)';
    fileCluster.api = paths.filter((p) => /^app\/api\/.+route\.(ts|js)$/.test(p)).slice(0, 8);
    fileCluster.pages = paths.filter((p) => /^app\/(?:.+\/)?page\.(tsx|ts|js)$/.test(p)).slice(0, 8);
    fileCluster.services = paths.filter((p) => /^lib\/|^utils\/|^services\//.test(p) && (p.endsWith('.ts') || p.endsWith('.js'))).slice(0, 6);
  } else if (framework.includes('express') || framework.includes('fastify') || framework.includes('nestjs')) {
    appNodeLabel = 'API Server';
    fileCluster.api = paths.filter((p) => /routes?\/|controllers?\//.test(p) && (p.endsWith('.ts') || p.endsWith('.js'))).slice(0, 8);
    fileCluster.services = paths.filter((p) => /services?\//.test(p) && (p.endsWith('.ts') || p.endsWith('.js'))).slice(0, 6);
  } else if (framework.includes('fastapi') || framework.includes('django') || framework.includes('flask')) {
    appNodeLabel = 'API Server';
    fileCluster.api = paths.filter((p) => /routers?\/|api\/|views?\//.test(p) && p.endsWith('.py')).slice(0, 8);
    fileCluster.services = paths.filter((p) => /services?\//.test(p) && p.endsWith('.py')).slice(0, 6);
    // Python-specific
    const hasPythonRoutes = fileCluster.api.length > 0;
    if (!hasPythonRoutes) fileCluster.services = paths.filter((p) => /core\/|main\.py|app\.py/.test(p)).slice(0, 4);
  }

  fileCluster.middleware = paths.filter((p) => /middleware\.(py|ts|js)$/i.test(p)).slice(0, 2);
  fileCluster.auth = paths.filter((p) => /auth\.(py|ts|js)$|auth\//i.test(p)).slice(0, 3);
  fileCluster.database = paths.filter((p) => /schema\.prisma|models?\//i.test(p) || p === 'prisma/schema.prisma').slice(0, 3);
  fileCluster.workers = paths.filter((p) => /worker|queue|task/i.test(p) && (p.endsWith('.py') || p.endsWith('.ts') || p.endsWith('.js'))).slice(0, 3);

  return { appNodeLabel, fileCluster };
}

/**
 * Deterministic component extraction from file tree + ingested sources when LLM output is invalid.
 */
export function extractComponentsHeuristic(
  snapshot: RepoSnapshot,
  repoProfile?: RepoProfile
): ExtractedNode[] {
  const nodes: ExtractedNode[] = [];
  const seen = new Set<string>();
  const paths = snapshot.fileTree;
  const files = snapshot.selectedFiles;

  const addNode = (partial: Omit<ExtractedNode, 'confidence' | 'description'> & { description?: string }) => {
    if (seen.has(partial.id) || nodes.length >= MAX_HEURISTIC_NODES) return;
    seen.add(partial.id);
    nodes.push({
      description: partial.description ?? `Detected from repository structure (${partial.sourceFiles.join(', ')})`,
      confidence: 'medium',
      ...partial,
    });
  };

  // Build architecture-centric nodes using file clustering
  const { appNodeLabel, fileCluster } = inferArchitectureNodes(snapshot, repoProfile);

  // Core application node
  const entryCandidates = ['main.py', 'app.py', 'manage.py', 'index.ts', 'server.ts', 'src/index.ts', 'src/app.ts'];
  let entryFile: string | null = null;
  for (const entry of entryCandidates) {
    if (paths.includes(entry)) { entryFile = entry; break; }
  }

  addNode({
    id: 'app_entry',
    label: appNodeLabel,
    type: 'SERVICE',
    sourceFiles: entryFile ? [entryFile] : files.map((f) => f.path).slice(0, 2),
    description: 'Core application entry point.',
  });

  // API routes / controllers
  if (fileCluster.api.length > 0) {
    addNode({
      id: 'api_routes',
      label: 'API Routes',
      type: 'API_ROUTE',
      sourceFiles: fileCluster.api,
      description: `API route handlers (${fileCluster.api.length} routes).`,
    });
  }

  // Services / core logic
  if (fileCluster.services.length > 0) {
    addNode({
      id: 'services',
      label: 'Services',
      type: 'SERVICE',
      sourceFiles: fileCluster.services,
      description: `Business logic and service layer (${fileCluster.services.length} files).`,
    });
  }

  // Pages (if frontend)
  if (fileCluster.pages.length > 0) {
    addNode({
      id: 'pages',
      label: 'Pages',
      type: 'PAGE',
      sourceFiles: fileCluster.pages,
      description: `Frontend pages and views (${fileCluster.pages.length} pages).`,
    });
  }

  // Middleware
  if (fileCluster.middleware.length > 0) {
    addNode({
      id: 'middleware',
      label: 'Middleware',
      type: 'MIDDLEWARE',
      sourceFiles: fileCluster.middleware,
      description: 'Request middleware layer.',
    });
  }

  // Auth
  if (fileCluster.auth.length > 0) {
    addNode({
      id: 'auth',
      label: 'Authentication',
      type: 'AUTH',
      sourceFiles: fileCluster.auth,
      description: 'Authentication and authorization logic.',
    });
  }

  // Database
  const db = detectDbFromFiles(files);
  if (db) {
    addNode({
      id: db.id,
      label: db.label,
      type: 'DATABASE',
      sourceFiles: [db.path],
      description: 'Data persistence layer.',
    });
  }

  // External services
  const externalServices = detectExternalServices(files);
  for (const svc of externalServices) {
    addNode({
      id: svc.id,
      label: svc.label,
      type: svc.type,
      sourceFiles: svc.sourceFiles,
      description: `External service integration.`,
    });
  }

  // Workers / queues
  if (fileCluster.workers.length > 0) {
    addNode({
      id: 'workers',
      label: 'Background Workers',
      type: 'WORKER',
      sourceFiles: fileCluster.workers,
      description: 'Background job and task processing.',
    });
  }

  // Framework-specific additions
  const framework = repoProfile?.primaryStack?.framework?.toLowerCase() || '';
  if (framework.includes('next') && nodes.length < 4) {
    if (!seen.has('api_routes') && paths.some((p) => p.startsWith('app/api/'))) {
      addNode({
        id: 'api_routes',
        label: 'API Routes',
        type: 'API_ROUTE',
        sourceFiles: paths.filter((p) => p.startsWith('app/api/')).slice(0, 5),
        description: 'Next.js API route handlers.',
      });
    }
  }

  // If we still have next to no nodes, fall back to per-file nodes
  if (nodes.length <= 2 && paths.length > 0) {
    const topCandidates = paths
      .filter((p) => !p.includes('test') && !p.includes('spec'))
      .filter((p) => p.endsWith('.py') || p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js'))
      .slice(0, 5);
    for (const path of topCandidates) {
      addNode({
        id: slugId(path),
        label: humanLabel(path),
        type: inferNodeType(path),
        sourceFiles: [path],
      });
    }
  }

  return nodes;
}

export function inferRelationshipsHeuristic(nodes: ExtractedNode[]): {
  edges: RichEdge[];
  workflows: { name: string; description: string; steps: string[] }[];
} {
  if (nodes.length < 2) {
    return { edges: [], workflows: [] };
  }

  const edges: RichEdge[] = [];
  const entry = nodes.find((n) => n.id === 'app_entry') ?? nodes[0];
  const apiRoutes = nodes.filter((n) => n.type === 'API_ROUTE');
  const databases = nodes.filter((n) => n.type === 'DATABASE' || n.type === 'CACHE');
  const auth = nodes.find((n) => n.type === 'AUTH');
  const middleware = nodes.find((n) => n.type === 'MIDDLEWARE');
  const pages = nodes.filter((n) => n.type === 'PAGE');
  const externalServices = nodes.filter((n) => n.type === 'EXTERNAL_SERVICE');
  const workers = nodes.filter((n) => n.type === 'WORKER');
  const services = nodes.filter((n) => n.id === 'services');

  const pushEdge = (from: string, to: string, type: string, label: string, protocol: string, direction: 'sync' | 'async' | 'event' = 'sync') => {
    const key = `${from}->${to}`;
    if (edges.some((e) => `${e.from}->${e.to}` === key)) return;
    edges.push({
      from,
      to,
      type,
      label,
      direction,
      protocol,
      dataFlow: '',
      triggeredBy: 'user_action',
      description: `Connection between ${from} and ${to}.`,
      confidence: 'low',
    });
  };

  // Frontend → API
  for (const page of pages) {
    if (entry) pushEdge(page.id, entry.id, 'http_call', 'makes request', 'http');
    for (const route of apiRoutes) {
      pushEdge(page.id, route.id, 'http_call', 'calls API', 'http');
    }
  }

  // Middleware guards entry
  if (middleware && entry) pushEdge(entry.id, middleware.id, 'guards', 'passes through', 'http');
  if (auth && entry) pushEdge(entry.id, auth.id, 'auth_check', 'authenticates', 'http');

  // Entry → API routes
  for (const route of apiRoutes) {
    if (entry) pushEdge(entry.id, route.id, 'http_call', 'routes request', 'http');

    // API → Services
    for (const svc of services) {
      pushEdge(route.id, svc.id, 'http_call', 'calls service', 'http');
    }

    // API → Database
    for (const db of databases) {
      pushEdge(route.id, db.id, 'db_query', 'queries', 'db');
    }

    // API → External
    for (const ext of externalServices) {
      pushEdge(route.id, ext.id, 'external_call', 'calls', 'sdk');
    }
  }

  // Entry → External (when no explicit API routes)
  if (apiRoutes.length === 0 && entry) {
    for (const ext of externalServices) {
      pushEdge(entry.id, ext.id, 'external_call', 'integrates', 'sdk');
    }
    for (const db of databases) {
      pushEdge(entry.id, db.id, 'db_query', 'queries', 'db');
    }
  }

  // Workers → Database/External
  for (const worker of workers) {
    for (const db of databases) {
      pushEdge(worker.id, db.id, 'db_query', 'processes', 'db', 'async');
    }
    for (const ext of externalServices) {
      pushEdge(worker.id, ext.id, 'external_call', 'calls', 'sdk', 'async');
    }
  }

  // Build workflows
  const workflows: { name: string; description: string; steps: string[] }[] = [];

  if (pages.length > 0 && apiRoutes.length > 0 && databases.length > 0) {
    workflows.push({
      name: 'User Request Flow',
      description: 'Request originates from a page, hits the API, and queries the database.',
      steps: [pages[0].id, entry.id, ...(middleware ? [middleware.id] : []), apiRoutes[0].id, databases[0].id],
    });
  } else if (apiRoutes.length > 0 && databases.length > 0) {
    workflows.push({
      name: 'API Request Flow',
      description: 'API route handler processes request with database interaction.',
      steps: [entry.id, apiRoutes[0].id, databases[0].id],
    });
  }

  if (entry && externalServices.length > 0) {
    workflows.push({
      name: 'External Integration',
      description: 'Application integrates with external services.',
      steps: [entry.id, ...(apiRoutes.length > 0 ? [apiRoutes[0].id] : []), externalServices[0].id],
    });
  }

  if (workers.length > 0) {
    workflows.push({
      name: 'Background Processing',
      description: 'Background workers process tasks asynchronously.',
      steps: [workers[0].id, ...(databases.length > 0 ? [databases[0].id] : []), ...(externalServices.length > 0 ? [externalServices[0].id] : [])],
    });
  }

  return { edges: edges.slice(0, 40), workflows: workflows.slice(0, 3) };
}
