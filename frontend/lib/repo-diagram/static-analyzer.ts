import type { FileEntry, StaticSignal, Subsystem } from '@/lib/types/repo-diagram';
import logger from '@/lib/logger';
import { parse as parseYaml } from 'yaml';

/**
 * Deterministically extract architectural signals from ingested files.
 * No LLM calls — pure pattern matching against file names and content.
 */
export function extractStaticSignals(
  files: FileEntry[],
  subsystems: Subsystem[]
): StaticSignal[] {
  const signals: StaticSignal[] = [];

  for (const file of files) {
    const content = file.content;
    const path = file.path;
    const allLower = content.toLowerCase();

    signals.push(...detectPackageDeps(file, allLower));
    signals.push(...detectRoutes(file, path, allLower));
    signals.push(...detectSchemas(file, path, allLower));
    signals.push(...detectEnvVars(file, path, allLower));
    signals.push(...detectDockerServices(file, path, allLower));
    signals.push(...detectSdkUsage(file, path, allLower));
    signals.push(...detectMiddleware(file, path, allLower));
    signals.push(...detectQueues(file, path, allLower));
    signals.push(...detectTerraformResources(file, path, allLower));
    signals.push(...detectEntryPoints(file, path, subsystems));
    signals.push(...detectBinEntries(file, path));
    signals.push(...detectMlFiles(file, path, allLower));
    signals.push(...detectDataPipeline(file, path, allLower));
    signals.push(...detectCiWorkflows(file, path, allLower));
    signals.push(...detectReadmeDiagram(file, path));
    signals.push(...detectHttpCalls(file, path, allLower));
    signals.push(...detectDbQueries(file, path, allLower));
  }

  return dedupSignals(signals);
}

function dedupSignals(signals: StaticSignal[]): StaticSignal[] {
  const seen = new Set<string>();
  return signals.filter((s) => {
    // compose_dependency dedups on (from,to), not just (label, source) — a service
    // can be depended on by multiple upstreams (`api→redis` and `worker→redis` are indep).
    const fromKey = s.type === 'compose_dependency' && (s.details as { from?: string }).from
      ? (s.details as { from: string }).from
      : '';
    const key = `${s.type}:${fromKey}:${s.label}:${s.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Package Dependency Detection ────────────────────────────────

function detectPackageDeps(file: FileEntry, _lower: string): StaticSignal[] {
  const signals: StaticSignal[] = [];
  if (file.path.endsWith('package.json')) {
    try {
      const parsed = JSON.parse(file.content);
      const allDeps = { ...parsed.dependencies, ...parsed.devDependencies } as Record<string, string>;
      for (const [name, version] of Object.entries(allDeps)) {
        if (!name) continue;
        const cat = categorizePackage(name);
        if (cat) {
          signals.push({
            type: 'dependency',
            label: name,
            source: file.path,
            details: { category: cat, version },
            confidence: 'high',
          });
        }
      }
    } catch { logger.warn('[static-analyzer] Failed to process %s', file.path) }
  }
  if (file.path.endsWith('requirements.txt')) {
    const lines = file.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;
      const name = trimmed.split(/[=<>~!]/)[0]?.trim().toLowerCase();
      if (!name) continue;
      const cat = categorizePackage(name);
      if (cat) {
        signals.push({
          type: 'dependency',
          label: name,
          source: file.path,
          details: { category: cat },
          confidence: 'high',
        });
      }
    }
  }

  if (file.path.endsWith('pyproject.toml')) {
    // GH2R-015: scope to [project].dependencies and [tool.poetry.dependencies] only — avoid false positives from description/authors etc.
    const extractSections = (toml: string): string => {
      const projectSec = toml.match(/\[project\][\s\S]*?(?=\n\[|$)/)?.[0] ?? '';
      const poetrySec = toml.match(/\[tool\.poetry\.dependencies\][\s\S]*?(?=\n\[|$)/)?.[0] ?? '';
      return projectSec + '\n' + poetrySec;
    };
    const depSection = extractSections(file.content);
    const source = depSection || ''; // if neither section found, parse nothing (avoid naive whole-file scan)
    for (const match of source.matchAll(/"([a-zA-Z][a-zA-Z0-9_.-]*)"/g)) {
      const name = match[1].toLowerCase();
      if (name.startsWith('python') || name.startsWith('_')) continue;
      const cat = categorizePackage(name);
      if (cat) {
        signals.push({ type: 'dependency', label: name, source: file.path, details: { category: cat }, confidence: 'high' });
      }
    }
    // Also handle TOML bare-dep form: dependencies = ["requests>=2.0", ...] already covered; PEP bug: handle names without quotes via fallback?
    // Keep quoted-only for precision; unquoted dependencies are rare and will be caught via requirements.txt heuristic if present.
  }
  return signals;
}

const PACKAGE_CATEGORIES: [RegExp, string][] = [
  [/^(@prisma|prisma|drizzle|typeorm|mongoose|sequelize|knex|sqlalchemy|psycopg|aiosqlite)/, 'database'],
  [/^(@clerk|next-auth|auth0|passport|bcrypt|jsonwebtoken|jose)/, 'auth'],
  [/^(@redis|redis|ioredis|bullmq|bull$|amqplib|kafkajs|celery)/, 'queue'],
  [/^(stripe|@stripe|@polar-sh)/, 'payments'],
  [/^@resend|nodemailer|sendgrid/, 'email'],
  [/^(openai|@openai|langchain|pinecone|weaviate|chromadb|@anthropic)/, 'ai_ml'],
  [/^(@supabase|supabase|firebase|@firebase)/, 'external_api'],
  [/^@sentry|winston|pino|log4js|datadog/, 'monitoring'],
  [/^(aws-sdk|@aws-sdk|@google-cloud|@azure)/, 'external_api'],
  [/^(react|vue|@angular|svelte|solid-js)/, 'ui_framework'],
  [/^(express|@nestjs|fastify|hapi|koa|@fastify)/, 'http_client'],
  [/^(axios|got|undici|node-fetch|superagent)/, 'http_client'],
  [/^(zustand|redux|mobx|pinia|vuex|jotai|valtio)/, 'state_management'],
  [/^(socket\.io|ws$|uWebSockets)/, 'realtime'],
  // ── Python / ML ecosystem ──────────────────────────────────
  [/^scikit-learn|^sklearn/, 'ml_framework'],
  [/^(xgboost|lightgbm|catboost)/, 'ml_framework'],
  [/^(tensorflow|keras|tf-keras)/, 'ml_framework'],
  [/^(torch|pytorch|torchvision|torchaudio)/, 'ml_framework'],
  [/^(transformers|datasets|huggingface|accelerate|sentence-transformers)/, 'ml_framework'],
  [/^(pandas|numpy|scipy|dask|modin)/, 'data_processing'],
  [/^(matplotlib|seaborn|plotly|bokeh|altair)/, 'visualization'],
  [/^(flask|fastapi|streamlit|gradio|dash|nicegui)/, 'web_framework'],
  [/^(django|wagtail)/, 'web_framework'],
  [/^(jupyter|ipython|notebook|ipykernel|jupyterlab)/, 'notebook'],
  [/^(mlflow|kubeflow|zenml|wandb|dvc)/, 'mlops'],
  [/^(opencv|pillow|Pillow|scikit-image)/, 'image_processing'],
  [/^(nltk|spacy|gensim|stanza|flair)/, 'nlp'],
  [/^(pytest|unittest|coverage|tox|nose)/, 'testing'],
  [/^(joblib|cloudpickle|dill)/, 'model_serialization'],
  [/^(sqlalchemy|alembic|tortoise-orm|pony)/, 'database'],
  [/^(httpx|aiohttp|requests|urllib3)/, 'http_client'],
  [/^(pydantic|marshmallow|attrs)/, 'validation'],
  [/^(celery|rq|huey|dramatiq|prefect|dagster)/, 'queue'],
  [/^(gunicorn|uvicorn|waitress|hypercorn)/, 'http_server'],
  [/^(boto3|moto|google-cloud|azure-)/, 'external_api'],
  [/^(pydantic-settings|python-dotenv|python-decouple)/, 'config'],
  // GH2R-013: previously missing drivers / modern stacks
  [/^(mysql2|oracledb|pgvector|@planetscale\/.*|better-sqlite3)$/, 'database'],
  [/^(@auth\/core|@auth\/.*)/, 'auth'],
  [/^(drizzle-orm|kysely|mikro-orm)$/, 'database'],
  [/^(opentelemetry|@opentelemetry\/.*)/, 'monitoring'],
];

function categorizePackage(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [pattern, category] of PACKAGE_CATEGORIES) {
    if (pattern.test(lower)) return category;
  }
  return null;
}

// ── Route Detection ────────────────────────────────────────────

function detectRoutes(file: FileEntry, path: string, _lower: string): StaticSignal[] {
  const signals: StaticSignal[] = [];

  if (/route\.(ts|js|tsx)$/.test(path) || /router/.test(path) || /controller/.test(path)) {
    signals.push({
      type: 'route',
      label: path.split('/').pop() || path,
      source: path,
      details: { path, lineCount: file.content.split('\n').length },
      confidence: 'high',
    });
  }

  // Phase 5 — GraphQL SDL field names (only for .graphql/.gql files to avoid false hits).
  if (/\.(graphql|gql)$/i.test(path)) {
    const fieldRe = /^\s*([A-Za-z_]\w*)\s*(?:\([^)]*\))?\s*:\s*[A-Za-z_!\[]/gm;
    let fm: RegExpExecArray | null;
    while ((fm = fieldRe.exec(file.content)) !== null) {
      const name = fm[1];
      if (!name || ['type', 'input', 'schema', 'enum', 'scalar', 'extend'].includes(name)) continue;
      signals.push({ type: 'route', label: name, source: path, details: { kind: 'graphql_field' }, confidence: 'medium' });
    }
    return signals;
  }

  const routePatterns = [
    // Express / Koa / Fastify
    /app\.(?:get|post|put|delete|patch)\(['"`](\/[^'"`]+)/g,
    /router\.(?:get|post|put|delete|patch)\(['"`](\/[^'"`]+)/g,
    // Decorators (NestJS / tsoa)
    /@(?:get|post|put|delete|patch)\(['"`](\/[^'"`]+)/g,
    // Generic .route()
    /\.route\(['"`](\/[^'"`]+)/g,
    // Express chained
    /@app\.(?:get|post|put|delete|patch)\(['"`](\/[^'"`]+)/g,
    // Phase 5 — Flask / FastAPI (paths may or may not start with /).
    /@\w+\.route\(['"`](\/?[^'"`]+)/g,
    /@(?:router|api_router|app)\.(?:get|post|put|delete|patch)\(['"`](\/?[^'"`]+)/g,
    /APIRouter\(prefix=['"`](\/?[^'"`]+)/g,
    // Phase 5 — Django urls.py
    /path\(\s*['"`](\/?[^'"`]+)/g,
    /re_path\(\s*r['"`](\/?[^'"`]+)/g,
    // Phase 5 — Rails routes.rb (resources :name + get/post/...)
    /\bresources\s+:(\w+)/g,
    /\b(?:get|post|put|delete|patch)\s+['"`]([^'"`]+)['"`]\s+(?:to:|=>)/g,
    /\b(?:get|post|put|delete|patch)\s+['"`]([^'"`]+)/g,
    // Phase 5 — Spring @*Mapping (GH2R-011: handle value=/path, path=/path, {"/a","/b"})
    /@(?:Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?(?:\{\s*)?['"`]([^'"`]+)['"`]/g,
  ];

  for (const pattern of routePatterns) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(file.content)) !== null) {
      // Spring/Rails/GraphQL variants — prefer the explicit path group, else first.
      const label = match[2] ?? match[1] ?? match[0].split(/[(:]/)[0];
      if (!label) continue;
      signals.push({
        type: 'route',
        label,
        source: path,
        details: { path, method: 'http' },
        confidence: 'high',
      });
    }
  }

  return signals;
}

// ── Schema Detection ────────────────────────────────────────────

function detectSchemas(file: FileEntry, path: string, lower: string): StaticSignal[] {
  const signals: StaticSignal[] = [];

  if (path.endsWith('schema.prisma')) {
    const modelNames = file.content.match(/model\s+(\w+)/g) || [];
    for (const m of modelNames) {
      signals.push({
        type: 'schema',
        label: m.replace('model ', ''),
        source: path,
        details: { orm: 'prisma' },
        confidence: 'high',
      });
    }
  }

  if (lower.includes('create table') || lower.includes('create_table')) {
    signals.push({
      type: 'schema',
      label: path.split('/').pop() || 'schema',
      source: path,
      details: { kind: 'sql_migration' },
      confidence: 'high',
    });
  }

  // TypeORM / MikroORM entity detection
  if (/@(entity|objecttype|table|schema)/i.test(file.content)) {
    const nameMatch = file.content.match(/@(?:Entity|ObjectType|Table|Schema)\(['"]?(\w+)/);
    if (nameMatch) {
      signals.push({
        type: 'schema',
        label: nameMatch[1],
        source: path,
        details: { orm: 'decorator' },
        confidence: 'medium',
      });
    }
  }

  return signals;
}

// ── Environment Variable Detection ──────────────────────────────

function detectEnvVars(file: FileEntry, path: string, _lower: string): StaticSignal[] {
  const signals: StaticSignal[] = [];

  if (path.includes('.env') || path === '.env.example') {
    const varPattern = /^([A-Za-z_][A-Za-z0-9_]*)=/gm;
    let match: RegExpExecArray | null;
    while ((match = varPattern.exec(file.content)) !== null) {
      const varName = match[1];
      const signal: StaticSignal = {
        type: 'env_var',
        label: varName,
        source: path,
        details: {},
        confidence: 'high',
      };
      // Infer what it might configure (order matters — more specific first)
      if (/QUEUE|REDIS/i.test(varName)) signal.details.category = 'queue';
      else if (/DATABASE|DB_|POSTGRES|MONGODB/i.test(varName)) signal.details.category = 'database';
      else if (/API_KEY|SECRET|TOKEN|AUTH/i.test(varName)) signal.details.category = 'auth';
      else if (/STRIPE|PAYMENT/i.test(varName)) signal.details.category = 'payments';
      else if (/SMTP|EMAIL|MAIL/i.test(varName)) signal.details.category = 'email';
      else if (/AWS_|S3_|BUCKET/i.test(varName)) signal.details.category = 'storage';
      signals.push(signal);
    }
  }

  return signals;
}

// ── Docker Service Detection ────────────────────────────────────

function detectDockerServices(file: FileEntry, path: string, _lower: string): StaticSignal[] {
  const signals: StaticSignal[] = [];
  if (!path.includes('docker-compose')) return signals;

  let compose: Record<string, unknown>;
  try {
    compose = parseYaml(file.content) as Record<string, unknown>;
  } catch {
    logger.warn('[static-analyzer] docker-compose YAML parse failed for %s', path);
    return signals;
  }
  if (!compose || typeof compose !== 'object') return signals;

  const services = (compose.services ?? {}) as Record<string, Record<string, unknown>>;
  if (!services || typeof services !== 'object') return signals;

  for (const [name, def] of Object.entries(services)) {
    if (!def || typeof def !== 'object') continue;
    signals.push({
      type: 'docker_service',
      label: name,
      source: path,
      details: { image: typeof def.image === 'string' ? def.image : undefined },
      confidence: 'high',
    });

    // depends_on → high-confidence inter-service dependency edge.
    const dependsOn = def.depends_on;
    if (dependsOn) {
      const deps: string[] = [];
      if (Array.isArray(dependsOn)) {
        for (const d of dependsOn) if (typeof d === 'string') deps.push(d);
      } else if (dependsOn && typeof dependsOn === 'object') {
        for (const k of Object.keys(dependsOn as Record<string, unknown>)) deps.push(k);
      } else if (typeof dependsOn === 'string') {
        deps.push(dependsOn);
      }
      for (const dep of deps) {
        if (!dep) continue;
        signals.push({
          type: 'compose_dependency',
          label: dep,
          source: path,
          details: { from: name, to: dep, kind: 'depends_on' },
          confidence: 'high',
        });
      }
    }

    // environment refs to DB → db_query-style hint (degraded if env var only).
    const env = def.environment;
    if (env) {
      const envStr = Array.isArray(env)
        ? env.join('\n')
        : (env && typeof env === 'object' ? Object.entries(env).map(([k, v]) => `${k}=${v ?? ''}`).join('\n') : String(env));
      if (/DATABASE|POSTGRES|MYSQL|MONGO|REDIS|DB_/i.test(envStr)) {
        signals.push({
          type: 'docker_service',
          label: name,
          source: path,
          details: { usesDatabase: true },
          confidence: 'medium',
        });
      }
    }
  }

  return signals;
}

// ── SDK Usage Detection ─────────────────────────────────────────

function detectSdkUsage(file: FileEntry, path: string, _lower: string): StaticSignal[] {
  // Skip config/manifest files — only scan source code for import/usage evidence (GH2R-015 extended)
  const configFiles =
    /(package\.json|pyproject\.toml|requirements\.txt|go\.mod|Cargo\.toml|pnpm-workspace\.yaml|composer\.json|\.env|docker-compose|yarn\.lock|pnpm-lock)/;
  if (configFiles.test(path)) return [];

  const signals: StaticSignal[] = [];
  const sdkPatterns: [RegExp, string, string][] = [
    [/stripe|stripe\./i, 'Stripe', 'payments'],
    [/resend\./i, 'Resend', 'email'],
    [/supabase\.|createclient.*supabase/i, 'Supabase', 'external_api'],
    [/clerk|@clerk/i, 'Clerk', 'auth'],
    [/nextauth|next-auth/i, 'NextAuth', 'auth'],
    [/auth0/i, 'Auth0', 'auth'],
    [/firebase\.|admin\.firebase/i, 'Firebase', 'external_api'],
    [/openai\.|@openai/i, 'OpenAI', 'ai_ml'],
    [/anthropic|@anthropic-ai/i, 'Anthropic', 'ai_ml'],
    [/bullmq|bull\./i, 'BullMQ', 'queue'],
    [/celery/i, 'Celery', 'queue'],
    [/@sentry|sentry\./i, 'Sentry', 'monitoring'],
    [/datadog/i, 'Datadog', 'monitoring'],
    [/aws-sdk|@aws-sdk/i, 'AWS SDK', 'external_api'],
    [/@google-cloud/i, 'Google Cloud', 'external_api'],
  ];

  for (const [pattern, label, category] of sdkPatterns) {
    if (pattern.test(file.content)) {
      signals.push({
        type: 'sdk_usage',
        label,
        source: path,
        details: { category },
        confidence: 'medium',
      });
    }
  }

  return signals;
}

// ── Middleware Detection ────────────────────────────────────────

function detectMiddleware(file: FileEntry, path: string, _lower: string): StaticSignal[] {
  if (path.includes('middleware') || path === 'middleware.ts' || path === 'middleware.js' || path === 'middleware.py') {
    return [{
      type: 'middleware',
      label: path.split('/').pop() || 'middleware',
      source: path,
      details: { path },
      confidence: 'high',
    }];
  }
  return [];
}

// ── Queue / Topic Detection ─────────────────────────────────────

function detectQueues(file: FileEntry, path: string, _lower: string): StaticSignal[] {
  const signals: StaticSignal[] = [];

  const topicPatterns = [
    /(?:queue|topic|channel|exchange)['"`]?:\s*['"`]([\w-]+)['"`]/gi,
    /new\s+Queue\(['"`]([\w-]+)['"`]/g,
    /bullmq\s*\.\s*Queue\(['"`]([\w-]+)['"`]/gi,
  ];

  for (const pattern of topicPatterns) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(file.content)) !== null) {
      signals.push({
        type: 'queue_topic',
        label: match[1],
        source: path,
        details: {},
        confidence: 'medium',
      });
    }
  }

  return signals;
}

// ── Terraform / K8s Detection ───────────────────────────────────

function detectTerraformResources(file: FileEntry, path: string, _lower: string): StaticSignal[] {
  const signals: StaticSignal[] = [];

  if (path.endsWith('.tf')) {
    const resourceMatch = file.content.match(/resource\s+"(\w+)"\s+"(\w+)"/g);
    if (resourceMatch) {
      for (const r of resourceMatch) {
        const parts = r.match(/resource\s+"(\w+)"\s+"(\w+)"/);
        if (parts) {
          signals.push({
            type: 'terraform_resource',
            label: `${parts[1]}.${parts[2]}`,
            source: path,
            details: { resourceType: parts[1], name: parts[2] },
            confidence: 'high',
          });
        }
      }
    }
  }

  if (path.endsWith('.yaml') || path.endsWith('.yml')) {
    if (/kind:\s*(deployment|service|ingress|configmap|secret|cronjob)/i.test(file.content)) {
      const kindMatch = file.content.match(/kind:\s*(\w+)/i);
      if (kindMatch) {
        signals.push({
          type: 'kubernetes_resource',
          label: kindMatch[1],
          source: path,
          details: { kind: kindMatch[1] },
          confidence: 'medium',
        });
      }
    }
  }

  return signals;
}

// ── Entry Point Detection ───────────────────────────────────────

function detectBinEntries(file: FileEntry, path: string): StaticSignal[] {
  if (path.endsWith('package.json')) {
    try {
      const parsed = JSON.parse(file.content);
      if (parsed.bin) {
        const bins = typeof parsed.bin === 'string' ? [parsed.bin] : Object.values(parsed.bin);
        return bins.map((binPath: string) => ({
          type: 'entry_point',
          label: binPath.replace(/^\.\//, ''),
          source: path,
          details: { kind: 'bin' },
          confidence: 'high',
        }));
      }
    } catch { logger.warn('[static-analyzer] Failed to process binary: %s', path) }
  }
  return [];
}

function detectEntryPoints(file: FileEntry, path: string, subsystems: Subsystem[]): StaticSignal[] {
  const signals: StaticSignal[] = [];

  const entryNames = ['main.py', 'app.py', 'manage.py', 'index.ts', 'server.ts', 'main.ts', 'index.js', 'server.js', 'main.go', 'main.rs', 'cli.ts', 'cli.js'];
  const fileName = path.split('/').pop();

  if (fileName && entryNames.includes(fileName)) {
    // Longest-prefix match (root last)
    const sorted = [...subsystems].sort((a, b) => {
      if (a.path === '/') return 1;
      if (b.path === '/') return -1;
      return b.path.length - a.path.length;
    });
    const parentSubsystem = sorted.find((s) =>
      s.path === '/' ? true : path.startsWith(s.path)
    );
    signals.push({
      type: 'entry_point',
      label: path,
      source: path,
      details: {
        subsystem: parentSubsystem?.name || 'root',
      },
      confidence: 'high',
    });
  }

  // Dockerfile detection
  if (path === 'Dockerfile' || path.endsWith('/Dockerfile')) {
    signals.push({
      type: 'entry_point',
      label: path,
      source: path,
      details: { kind: 'dockerfile' },
      confidence: 'high',
    });
  }

  return signals;
}

// ── Python / ML File Detection ──────────────────────────────────

function detectMlFiles(file: FileEntry, path: string, allLower: string): StaticSignal[] {
  const signals: StaticSignal[] = [];

  const fileName = path.split('/').pop() || '';

  // Training / prediction scripts
  if (/^train(ing)?\.(py|ipynb)$/.test(fileName) || /^train_/.test(fileName)) {
    signals.push({ type: 'ml_script', label: path, source: path, details: { kind: 'training' }, confidence: 'high' });
  }
  if (/^predict(ion)?\.(py|ipynb)$/.test(fileName) || /^predict_/.test(fileName) || /^inference\.(py|ipynb)$/.test(fileName)) {
    signals.push({ type: 'ml_script', label: path, source: path, details: { kind: 'inference' }, confidence: 'high' });
  }
  if (/^model\.(py|ipynb)$/.test(fileName) || /^models?\.(py|ipynb)$/.test(fileName)) {
    signals.push({ type: 'ml_script', label: path, source: path, details: { kind: 'model_definition' }, confidence: 'high' });
  }
  if (/^eval(uate)?\.(py|ipynb)$/.test(fileName) || /^test_model/.test(fileName)) {
    signals.push({ type: 'ml_script', label: path, source: path, details: { kind: 'evaluation' }, confidence: 'high' });
  }
  if (/^dataset?\.(py|ipynb)$/.test(fileName) || /^data_/.test(fileName)) {
    signals.push({ type: 'ml_script', label: path, source: path, details: { kind: 'data_prep' }, confidence: 'high' });
  }
  if (/^feature/.test(fileName) && /\.(py|ipynb)$/.test(fileName)) {
    signals.push({ type: 'ml_script', label: path, source: path, details: { kind: 'feature_engineering' }, confidence: 'high' });
  }

  // Jupyter notebooks
  if (/\.ipynb$/.test(path)) {
    signals.push({ type: 'notebook', label: path, source: path, details: {}, confidence: 'high' });
  }

  // Model artifacts
  if (/\.(pkl|joblib|h5|hdf5|pt|pth|ckpt|onnx|pb|tflite)$/.test(path)) {
    signals.push({ type: 'model_artifact', label: path, source: path, details: {}, confidence: 'high' });
  }

  // ML config files (hyperparameters, Conda env, Docker compose with ML services)
  if (/^(config|hyperparameters?|params)\.(yml|yaml|json|toml)$/.test(fileName)) {
    // Only flag if file mentions ML terms
    if (/model|train|predict|data|feature|learning.rate|batch|epoch|classifier|regression|embedding/.test(allLower)) {
      signals.push({ type: 'config', label: path, source: path, details: { kind: 'ml_config' }, confidence: 'high' });
    }
  }

  if (/^(environment|requirements)\.yml$/.test(fileName) && /tensorflow|pytorch|sklearn|xgboost/.test(allLower)) {
    signals.push({ type: 'dependency', label: fileName, source: path, details: { category: 'ml_environment' }, confidence: 'high' });
  }

  // Detect ML subdirectories by path pattern
  if (/\/models?\//.test(path)) {
    signals.push({ type: 'ml_directory', label: 'models/', source: path, details: { kind: 'model_storage' }, confidence: 'medium' });
  }
  if (/\/notebooks?\//.test(path)) {
    signals.push({ type: 'ml_directory', label: 'notebooks/', source: path, details: { kind: 'experimentation' }, confidence: 'medium' });
  }
  if (/\/data(tasets?)?\//.test(path)) {
    signals.push({ type: 'ml_directory', label: 'data/', source: path, details: { kind: 'dataset_storage' }, confidence: 'medium' });
  }

  // Python import-level ML detection (catch repos that import ML libs without standard file names)
  if (/\.(py|ipynb)$/.test(path)) {
    let mlKind: string | null = null;
    if (/from\s+sklearn|import\s+sklearn|from\s+sklearn\./.test(allLower)) mlKind = 'ml_framework';
    else if (/from\s+torch\b|import\s+torch|from\s+torchvision/.test(allLower)) mlKind = 'ml_framework';
    else if (/from\s+tensorflow|import\s+tensorflow|import\s+keras/.test(allLower)) mlKind = 'ml_framework';
    else if (/from\s+xgboost|import\s+xgboost|from\s+lightgbm|import\s+lightgbm/.test(allLower)) mlKind = 'ml_framework';
    else if (/from\s+transformers|import\s+transformers|from\s+datasets|import\s+datasets/.test(allLower)) mlKind = 'ml_framework';

    if (mlKind && !/^train|^predict|^model|^eval|^dataset/.test(fileName)) {
      signals.push({ type: 'ml_import', label: path, source: path, details: { kind: mlKind }, confidence: 'medium' });
    }
  }

  return signals;
}

// ── Data Pipeline Detection ─────────────────────────────────────

function detectDataPipeline(file: FileEntry, path: string, _allLower: string): StaticSignal[] {
  const signals: StaticSignal[] = [];

  // Data files (CSV, Parquet, JSONL, Feather)
  if (/\.(csv|parquet|feather|arrow|jsonl|ndjson|avro)$/.test(path)) {
    signals.push({ type: 'data_file', label: path, source: path, details: { format: path.split('.').pop() }, confidence: 'high' });
  }

  // ETL / pipeline scripts
  const fileName = path.split('/').pop() || '';
  if (/^(etl|pipeline|process|transform|clean|extract|load)\.(py|ipynb)$/.test(fileName)) {
    signals.push({ type: 'pipeline', label: path, source: path, details: {}, confidence: 'high' });
  }

  // SQL / schema files
  if (/\.(sql|ddl|dml)$/.test(path)) {
    signals.push({ type: 'schema', label: path, source: path, details: { kind: 'sql' }, confidence: 'high' });
  }

  return signals;
}

// ── CI Workflow / README diagram detection (Phase 5) ───────────

function detectCiWorkflows(file: FileEntry, path: string, _lower: string): StaticSignal[] {
  if (!path.startsWith('.github/workflows/') && !path.startsWith('.gitlab-ci') && !path.startsWith('.circleci/')) return [];
  // Cap analysis to small files.
  if (file.content.length > 20_000) return [];
  const signals: StaticSignal[] = [];
  // Job names + service containers + deploy targets → architecture hints.
  const jobRe = /^(\w+):\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = jobRe.exec(file.content)) !== null) {
    const name = m[1];
    if (!name || ['name', 'on', 'jobs', 'env', 'defaults', 'permissions', 'concurrency', 'strategy', 'steps', 'uses', 'with'].includes(name)) continue;
    signals.push({ type: 'ci_workflow', label: name, source: path, details: {}, confidence: 'medium' });
  }
  // Detect references to services declared via `services:` blocks (DB/Redis/etc).
  if (/services:\s*\n\s*([\w-]+):\s*$/m.test(file.content)) {
    const svcRe = /^\s{4,}([\w-]+):\s*$/gm;
    while ((m = svcRe.exec(file.content)) !== null) {
      const n = m[1];
      if (n && !['image', 'env', 'ports', 'options', 'volumes'].includes(n)) {
        signals.push({ type: 'ci_workflow', label: n, source: path, details: { kind: 'service_container' }, confidence: 'medium' });
      }
    }
  }
  return signals;
}

function detectReadmeDiagram(file: FileEntry, path: string): StaticSignal[] {
  if (!/readme\.md$/i.test(path)) return [];
  if (file.content.length > 50_000) return [];
  const mermaidBlock = file.content.match(/```mermaid\n([\s\S]*?)\n```/i);
  if (!mermaidBlock) return [];
  return [{
    type: 'config',
    label: 'readme_diagram',
    source: path,
    details: { kind: 'mermaid', content: mermaidBlock[1].slice(0, 4000) },
    confidence: 'high',
  }];
}

/**
 * Detect HTTP client calls (fetch, axios, etc.) between services.
 * Generates http_call signals that can corroborate inter-service edges.
 */
function detectHttpCalls(file: FileEntry, path: string, _lower: string): StaticSignal[] {
  const signals: StaticSignal[] = [];
  const ext = path.split('.').pop()?.toLowerCase();
  if (!ext || !['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'go', 'java', 'rb', 'php'].includes(ext)) return signals;

  const content = file.content;
  const patterns: RegExp[] = [
    // fetch('https://...' or fetch('/api/...')
    /\bfetch\s*\(\s*['"`](https?:\/\/[^'"`]+|(\/[^'"`]+))['"`]/g,
    // axios.get/post/put/delete(...)
    /axios\s*\.\s*(?:get|post|put|delete|patch|request)\s*\(\s*['"`](https?:\/\/[^'"`]+|(\/[^'"`]+))['"`]/g,
    // $.ajax({url:...}) / $.get/post(...)
    /\$\.(?:ajax|get|post|getJSON)\s*\(\s*['"`](https?:\/\/[^'"`]+|(\/[^'"`]+))['"`]/g,
    // got.get/post(...)
    /got\s*\.\s*(?:get|post|put|delete|patch)\s*\(\s*['"`](https?:\/\/[^'"`]+|(\/[^'"`]+))['"`]/g,
    // Python requests.get/post(...)
    /requests\.\s*(?:get|post|put|delete|patch|request)\s*\(\s*['"`](https?:\/\/[^'"`]+|(\/[^'"`]+))['"`]/g,
    // Python httpx.Client().get/post(...)
    /httpx\.\s*(?:get|post|put|delete|patch|request)\s*\(\s*['"`](https?:\/\/[^'"`]+|(\/[^'"`]+))['"`]/g,
    // Python aiohttp.ClientSession().get/post(...)
    /aiohttp\.\s*(?:get|post|put|delete|patch|request)\s*\(\s*['"`](https?:\/\/[^'"`]+|(\/[^'"`]+))['"`]/g,
    // Go http.Get/Post(...) / http.NewRequest(...)
    /http\.\s*(?:Get|Post|Head|Do|NewRequest)\s*\(\s*['"`](https?:\/\/[^'"`]+|(\/[^'"`]+))['"`]/g,
    // Java HttpClients / HttpClient.send / RestTemplate / WebClient
    /RestTemplate\.\s*(?:getForObject|postForObject|exchange|execute)\s*\(\s*['"`](https?:\/\/[^'"`]+|(\/[^'"`]+))['"`]/g,
    /WebClient\.\s*(?:get|post|put|delete)\s*\(\s*['"`](https?:\/\/[^'"`]+|(\/[^'"`]+))['"`]/g,
    // Ruby Faraday, Net::HTTP, HTTParty
    /Faraday\.\s*(?:get|post|put|delete|patch)\s*\(\s*['"`](https?:\/\/[^'"`]+|(\/[^'"`]+))['"`]/g,
    /HTTParty\.\s*(?:get|post|put|delete|patch)\s*\(\s*['"`](https?:\/\/[^'"`]+|(\/[^'"`]+))['"`]/g,
    // PHP Guzzle
    /\$client->\s*(?:get|post|put|delete|patch|request)\s*\(\s*['"`](https?:\/\/[^'"`]+|(\/[^'"`]+))['"`]/g,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const url = m[1];
      if (!url) continue;
      signals.push({
        type: 'http_call',
        label: url.includes('://') ? new URL(url).hostname : `local_${url.slice(0, 40)}`,
        source: path,
        details: { url: url.slice(0, 200), kind: 'outbound_http' },
        confidence: 'high',
      });
    }
  }

  return signals;
}

/**
 * Detect database query patterns in source code.
 * Generates db_query signals that corroborate database edges.
 */
function detectDbQueries(file: FileEntry, path: string, _lower: string): StaticSignal[] {
  const signals: StaticSignal[] = [];
  const ext = path.split('.').pop()?.toLowerCase();
  if (!ext || !['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'go', 'java', 'rb', 'rs', 'kt', 'cs'].includes(ext)) return signals;

  const content = file.content;
  const patterns: [RegExp, string][] = [
    // Prisma
    [/prisma\.\s*\w+\s*\.\s*(?:findMany|findUnique|findFirst|create|update|delete|upsert|aggregate|count|queryRaw|executeRaw)\s*\(/g, 'prisma'],
    // TypeORM / MikroORM
    [/\.\s*(?:find|findOne|findAndCount|save|update|delete|remove|insert|createQueryBuilder)\s*\(/g, 'orm'],
    // Mongoose
    [/\.\s*(?:find|findOne|findById|create|updateOne|deleteOne|save|aggregate|populate)\s*\(/g, 'mongoose'],
    // Knex
    [/knex\.\s*(?:select|from|insert|update|del|where|join|raw|table|schema)\s*\(/g, 'knex'],
    // SQLAlchemy (Python)
    [/session\.\s*(?:query|execute|add|commit|rollback|flush|scalar|all|first|one)\s*\(/g, 'sqlalchemy'],
    [/\.\s*filter\s*\([^)]*\)\s*\.\s*(?:all|first|one|count|update|delete)\s*\(/g, 'sqlalchemy'],
    // psycopg / database/sql (Go)
    [/db\.\s*(?:Query|QueryRow|Exec|Prepare|ExecContext|QueryContext)\s*\(/g, 'go_database'],
    // JDBC / Spring Data (Java)
    [/jdbcTemplate\.\s*(?:query|update|execute|batchUpdate|queryForList|queryForObject)\s*\(/g, 'jdbc'],
    [/\w*Repository\.\s*(?:findBy|save|deleteBy|countBy|existsBy|findAll|findById|saveAll)\s*\(/g, 'spring_data'],
    // Raw SQL keywords
    [/\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE|DROP TABLE)\s+/gi, 'raw_sql'],
  ];

  for (const [re, _kind] of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const label = `${_kind}_query_${path.split('/').pop()?.split('.')[0] || 'db'}`;
      signals.push({
        type: 'db_query',
        label,
        source: path,
        details: { kind: _kind, snippet: content.slice(Math.max(0, m.index - 20), m.index + 40) },
        confidence: 'high',
      });
    }
  }

  return signals;
}
