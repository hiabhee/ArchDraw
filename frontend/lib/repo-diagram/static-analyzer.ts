import type { FileEntry, StaticSignal, Subsystem } from '@/lib/types/repo-diagram';

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
  }

  return dedupSignals(signals);
}

function dedupSignals(signals: StaticSignal[]): StaticSignal[] {
  const seen = new Set<string>();
  return signals.filter((s) => {
    const key = `${s.type}:${s.label}:${s.source}`;
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
    } catch {}
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

  const routePatterns = [
    /app\.(?:get|post|put|delete|patch)\(['"`](\/[^'"`]+)/g,
    /router\.(?:get|post|put|delete|patch)\(['"`](\/[^'"`]+)/g,
    /@(?:get|post|put|delete|patch)\(['"`](\/[^'"`]+)/g,
    /\.route\(['"`](\/[^'"`]+)/g,
    /@app\.(?:get|post|put|delete|patch)\(['"`](\/[^'"`]+)/g,
  ];
  for (const pattern of routePatterns) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(file.content)) !== null) {
      signals.push({
        type: 'route',
        label: match[1],
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

function detectDockerServices(file: FileEntry, path: string, lower: string): StaticSignal[] {
  const signals: StaticSignal[] = [];
  if (!path.includes('docker-compose')) return signals;

  const serviceMatch = lower.match(/^  (\w+):\s*$/gm);
  if (serviceMatch) {
    for (const m of serviceMatch) {
      const name = m.trim().replace(':', '');
      if (['version', 'services', 'networks', 'volumes'].includes(name)) continue;
      signals.push({
        type: 'docker_service',
        label: name,
        source: path,
        details: {},
        confidence: 'high',
      });
    }
  }

  return signals;
}

// ── SDK Usage Detection ─────────────────────────────────────────

function detectSdkUsage(file: FileEntry, path: string, _lower: string): StaticSignal[] {
  // Skip config/manifest files — only scan source code for import/usage evidence
  const configFiles = /(package\.json|^requirements\.txt|pnpm-workspace\.yaml|composer\.json|\.env|docker-compose|yarn\.lock|pnpm-lock)/;
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
    } catch {}
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
