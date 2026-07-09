import type { RepoSnapshot, StaticSignal, Subsystem } from '@/lib/types/repo-diagram';

export type StaticDetectionReport = {
  framework: string | null;
  orm: string | null;
  database: string | null;
  email: string | null;
  auth: string | null;
  queue: string | null;
  aiMl: string | null;
  payments: string | null;
  externalApis: { name: string; category: string }[];
  keyDirectories: string[];
  entryPoints: string[];
  hasAppDir: boolean;
  hasPagesDir: boolean;
  hasMiddleware: boolean;
  hasWorkers: boolean;
  hasDocker: boolean;
  isMonorepo: boolean;
  primaryLanguage: string;
  hasDockerCompose: boolean;
  hasTerraform: boolean;
  topLevelDirs: string[];
  // ── ML-specific ──
  mlFramework: string | null;
  hasMlScripts: boolean;
  hasNotebooks: boolean;
  hasModelArtifacts: boolean;
};

export function buildStaticDetectionReport(
  snapshot: RepoSnapshot,
  subsystems: Subsystem[],
  signals: StaticSignal[]
): StaticDetectionReport {
  const deps = signals.filter((s) => s.type === 'dependency');
  const sdks = signals.filter((s) => s.type === 'sdk_usage');

  const detectFramework = (): string | null => {
    if (snapshot.surfaceClassification.detectedFrameworks.length > 0) {
      return snapshot.surfaceClassification.detectedFrameworks[0];
    }
    const hasNext = snapshot.fileTree.some((p) => p === 'next.config.js' || p === 'next.config.ts' || p === 'next.config.mjs');
    if (hasNext) return 'Next.js';
    const hasExpress = deps.some((d) => /^express$/.test(d.label));
    if (hasExpress) return 'Express';
    const hasNest = deps.some((d) => d.label === '@nestjs/core');
    if (hasNest) return 'NestJS';
    const hasFastify = deps.some((d) => d.label === 'fastify');
    if (hasFastify) return 'Fastify';
    const hasFastApi = deps.some((d) => /fastapi/i.test(d.label));
    if (hasFastApi) return 'FastAPI';
    const hasDjango = deps.some((d) => /django/i.test(d.label)) || snapshot.fileTree.some((p) => p === 'manage.py');
    if (hasDjango) return 'Django';
    const hasFlask = deps.some((d) => /flask/i.test(d.label));
    if (hasFlask) return 'Flask';
    const hasSpring = deps.some((d) => /spring/i.test(d.label));
    if (hasSpring) return 'Spring Boot';
    for (const sub of subsystems) {
      if (sub.detectedFramework) return sub.detectedFramework;
    }
    return null;
  };

  const detectOrm = (): string | null => {
    if (snapshot.repoMeta.hasPrisma) return 'Prisma';
    if (deps.some((d) => /^drizzle/i.test(d.label))) return 'Drizzle';
    if (deps.some((d) => /typeorm|type-orm/i.test(d.label))) return 'TypeORM';
    if (deps.some((d) => /^mongoose/i.test(d.label))) return 'Mongoose';
    if (deps.some((d) => /sequelize/i.test(d.label))) return 'Sequelize';
    if (deps.some((d) => /sqlalchemy/i.test(d.label))) return 'SQLAlchemy';
    if (deps.some((d) => /knex/i.test(d.label))) return 'Knex';
    if (signals.some((s) => s.type === 'schema' && s.details.orm === 'prisma')) return 'Prisma';
    if (signals.some((s) => s.type === 'schema' && s.details.orm === 'decorator')) return 'ORM (decorator-based)';
    return null;
  };

  const detectDatabase = (): string | null => {
    if (deps.some((d) => /^pg$|postgres|psycopg|pg-promise/i.test(d.label))) return 'PostgreSQL';
    if (deps.some((d) => /^mysql|mariadb/i.test(d.label))) return 'MySQL';
    if (deps.some((d) => /sqlite|sqlite3/i.test(d.label))) return 'SQLite';
    if (deps.some((d) => /mongodb|mongoose/i.test(d.label))) return 'MongoDB';
    if (deps.some((d) => /^redis/i.test(d.label))) return 'Redis';
    if (signals.some((s) => s.type === 'docker_service' && /postgres|mysql|mongo/i.test(s.label))) {
      const svc = signals.find((s) => s.type === 'docker_service' && /postgres|mysql|mongo/i.test(s.label))!;
      if (/postgres/i.test(svc.label)) return 'PostgreSQL';
      if (/mysql/i.test(svc.label)) return 'MySQL';
      if (/mongo/i.test(svc.label)) return 'MongoDB';
    }
    if (signals.some((s) => s.type === 'env_var' && s.details.category === 'database')) return 'Database (from env)';
    return null;
  };

  const detectEmail = (): string | null => {
    if (deps.some((d) => /^@resend/i.test(d.label))) return 'Resend';
    if (deps.some((d) => /nodemailer/i.test(d.label))) return 'Nodemailer';
    if (deps.some((d) => /sendgrid/i.test(d.label))) return 'SendGrid';
    if (sdks.some((s) => s.label === 'Resend')) return 'Resend';
    if (signals.some((s) => s.type === 'env_var' && s.details.category === 'email')) return 'Email (from env config)';
    return null;
  };

  const detectAuth = (): string | null => {
    if (deps.some((d) => /^@clerk/i.test(d.label))) return 'Clerk';
    if (deps.some((d) => /next-auth/i.test(d.label))) return 'NextAuth';
    if (deps.some((d) => /auth0/i.test(d.label))) return 'Auth0';
    if (deps.some((d) => /^passport/i.test(d.label))) return 'Passport';
    if (deps.some((d) => /^bcrypt/i.test(d.label))) return 'bcrypt';
    if (deps.some((d) => /^jose|jsonwebtoken/i.test(d.label))) return 'JWT';
    if (sdks.some((s) => s.label === 'Clerk')) return 'Clerk';
    if (sdks.some((s) => s.label === 'NextAuth')) return 'NextAuth';
    if (sdks.some((s) => s.label === 'Auth0')) return 'Auth0';
    if (sdks.some((s) => s.label === 'Supabase')) return 'Supabase Auth';
    return null;
  };

  const detectQueue = (): string | null => {
    if (deps.some((d) => /bullmq|bull\b/i.test(d.label))) return 'BullMQ/Bull';
    if (deps.some((d) => /^celery/i.test(d.label))) return 'Celery';
    if (deps.some((d) => /amqplib/i.test(d.label))) return 'AMQP (RabbitMQ)';
    if (deps.some((d) => /kafkajs/i.test(d.label))) return 'Kafka';
    if (sdks.some((s) => s.label === 'BullMQ')) return 'BullMQ';
    if (signals.filter((s) => s.type === 'queue_topic').length > 0) return 'Queue (topics detected)';
    return null;
  };

  const detectAiMl = (): string | null => {
    if (deps.some((d) => /^openai/i.test(d.label))) return 'OpenAI';
    if (deps.some((d) => /^@anthropic/i.test(d.label))) return 'Anthropic';
    if (deps.some((d) => /langchain/i.test(d.label))) return 'LangChain';
    if (deps.some((d) => /pinecone/i.test(d.label))) return 'Pinecone';
    if (sdks.some((s) => s.label === 'OpenAI')) return 'OpenAI';
    if (sdks.some((s) => s.label === 'Anthropic')) return 'Anthropic';
    // ML frameworks (Python/ML repos)
    if (deps.some((d) => /^(torch|pytorch)/i.test(d.label))) return 'PyTorch';
    if (deps.some((d) => /^(tensorflow|keras)/i.test(d.label))) return 'TensorFlow';
    if (deps.some((d) => /^scikit-learn|^sklearn/i.test(d.label))) return 'scikit-learn';
    if (deps.some((d) => /^xgboost/i.test(d.label))) return 'XGBoost';
    if (deps.some((d) => /^transformers/i.test(d.label))) return 'HuggingFace Transformers';
    // Detect from import-level signals
    if (signals.some((s) => s.type === 'ml_import')) return 'ML (imports detected)';
    return null;
  };

  const detectMlFramework = (): string | null => {
    if (deps.some((d) => /^(torch|pytorch)/i.test(d.label))) return 'PyTorch';
    if (deps.some((d) => /^(tensorflow|keras)/i.test(d.label))) return 'TensorFlow';
    if (deps.some((d) => /^scikit-learn|^sklearn/i.test(d.label))) return 'scikit-learn';
    if (deps.some((d) => /^xgboost/i.test(d.label))) return 'XGBoost';
    if (deps.some((d) => /^transformers/i.test(d.label))) return 'HuggingFace Transformers';
    if (deps.some((d) => /^lightgbm/i.test(d.label))) return 'LightGBM';
    if (deps.some((d) => /^catboost/i.test(d.label))) return 'CatBoost';
    return null;
  };

  const detectPayments = (): string | null => {
    if (deps.some((d) => /^stripe/i.test(d.label))) return 'Stripe';
    if (sdks.some((s) => s.label === 'Stripe')) return 'Stripe';
    return null;
  };

  const detectExternalApis = (): { name: string; category: string }[] => {
    const apiSignals = sdks.filter(
      (s) => !['Stripe', 'Resend', 'Clerk', 'NextAuth', 'Auth0', 'BullMQ', 'OpenAI', 'Anthropic'].includes(s.label)
    );
    return apiSignals.map((s) => ({ name: s.label, category: s.details.category as string || 'external_api' }));
  };

  const findKeyDirectories = (): string[] => {
    const dirs = new Set<string>();
    const dirPriority = ['src', 'app', 'api', 'routes', 'services', 'lib', 'components', 'pages', 'models', 'controllers', 'middleware', 'utils', 'helpers', 'validators', 'config', 'db', 'database', 'prisma', 'workers', 'jobs', 'queue', 'tests', '__tests__', 'notebooks', 'data', 'datasets', 'experiments', 'ml', 'training', 'deployment'];
    for (const p of snapshot.fileTree) {
      const top = p.split('/')[0];
      if (dirPriority.includes(top)) dirs.add(top);
    }
    return Array.from(dirs).sort((a, b) => dirPriority.indexOf(a) - dirPriority.indexOf(b)).slice(0, 12);
  };

  const findEntryPoints = (): string[] => {
    const candidates = ['main.py', 'app.py', 'manage.py', 'index.ts', 'server.ts', 'main.ts', 'src/index.ts', 'src/app.ts', 'src/main.ts', 'src/server.ts', 'index.js', 'server.js', 'main.go', 'main.rs'];
    const found: string[] = [];
    for (const c of candidates) {
      if (snapshot.fileTree.includes(c) || snapshot.fileTree.some((p) => p.endsWith('/' + c))) {
        found.push(c);
      }
    }
    return found.slice(0, 6);
  };

  const framework = detectFramework();
  const orm = detectOrm();
  const database = detectDatabase();
  const email = detectEmail();
  const auth = detectAuth();
  const queue = detectQueue();
  const aiMl = detectAiMl();
  const payments = detectPayments();
  const externalApis = detectExternalApis();
  const keyDirectories = findKeyDirectories();
  const entryPoints = findEntryPoints();
  const mlFramework = detectMlFramework();
  const hasMlScripts = signals.some((s) => s.type === 'ml_script');
  const hasNotebooks = signals.some((s) => s.type === 'notebook');
  const hasModelArtifacts = signals.some((s) => s.type === 'model_artifact');

  const dirSet = new Set(snapshot.fileTree.map((p) => p.split('/')[0]).filter(Boolean));
  const topLevelDirs = Array.from(dirSet).filter(
    (d) => !['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.venv', 'venv'].includes(d)
  ).sort();

  return {
    framework,
    orm,
    database,
    email,
    auth,
    queue,
    aiMl,
    payments,
    externalApis,
    keyDirectories,
    entryPoints,
    hasAppDir: snapshot.repoMeta.hasAppDir,
    hasPagesDir: snapshot.repoMeta.hasPagesDir,
    hasMiddleware: snapshot.repoMeta.hasMiddleware,
    hasWorkers: signals.some((s) => s.type === 'queue_topic') || deps.some((d) => /worker|bull|celery/i.test(d.label)) || snapshot.fileTree.some((p) => /worker|queue|job/i.test(p)),
    hasDocker: snapshot.surfaceClassification.hasDocker,
    isMonorepo: snapshot.surfaceClassification.isMonorepo,
    primaryLanguage: snapshot.surfaceClassification.primaryLanguage,
    hasDockerCompose: snapshot.fileTree.some((p) => p.includes('docker-compose')),
    hasTerraform: signals.some((s) => s.type === 'terraform_resource'),
    topLevelDirs,
    mlFramework,
    hasMlScripts,
    hasNotebooks,
    hasModelArtifacts,
  };
}

export function formatDetectionReport(report: StaticDetectionReport): string {
  const lines: string[] = [];
  lines.push('=== Static Detection Report ===');

  const addIf = (label: string, value: string | null | undefined) => {
    if (value) lines.push(`  ${label}: ${value}`);
  };

  addIf('Framework', report.framework);
  addIf('ORM', report.orm);
  addIf('Database', report.database);
  addIf('Email', report.email);
  addIf('Auth', report.auth);
  addIf('Queue', report.queue);
  addIf('AI/ML', report.aiMl);
  addIf('Payments', report.payments);

  if (report.externalApis.length > 0) {
    lines.push(`  External APIs: ${report.externalApis.map((a) => a.name).join(', ')}`);
  }

  lines.push(`  Language: ${report.primaryLanguage}`);
  lines.push(`  Type: ${report.isMonorepo ? 'Monorepo' : 'Single-package'}`);

  if (report.keyDirectories.length > 0) {
    lines.push(`  Key directories: ${report.keyDirectories.join(', ')}`);
  }
  if (report.entryPoints.length > 0) {
    lines.push(`  Entry points: ${report.entryPoints.join(', ')}`);
  }

  const features: string[] = [];
  if (report.hasAppDir) features.push('app/ directory');
  if (report.hasPagesDir) features.push('pages/ directory');
  if (report.hasMiddleware) features.push('middleware');
  if (report.hasWorkers) features.push('background workers');
  if (report.hasDocker) features.push('Docker');
  if (report.hasDockerCompose) features.push('Docker Compose');
  if (report.hasTerraform) features.push('Terraform');
  if (report.mlFramework) features.push(`ML: ${report.mlFramework}`);
  if (report.hasMlScripts) features.push('ML scripts (train/predict)');
  if (report.hasNotebooks) features.push('Jupyter notebooks');
  if (report.hasModelArtifacts) features.push('model artifacts');

  if (features.length > 0) {
    lines.push(`  Features: ${features.join(', ')}`);
  }

  const dirs = report.topLevelDirs.slice(0, 15);
  if (dirs.length > 0) {
    lines.push(`  Top-level dirs: ${dirs.join(', ')}`);
  }

  return lines.join('\n');
}
