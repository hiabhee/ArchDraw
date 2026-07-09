import { describe, it, expect } from 'vitest';
import { buildStaticDetectionReport, formatDetectionReport } from '../static-detector';
import { extractStaticSignals } from '../static-analyzer';
import type { RepoSnapshot, FileEntry, Subsystem, StaticSignal } from '@/lib/types/repo-diagram';

const emptySubsystems: Subsystem[] = [];

function makeSnapshot(overrides: Partial<RepoSnapshot> = {}): RepoSnapshot {
  return {
    repoUrl: 'https://github.com/test/test',
    owner: 'test',
    repo: 'test',
    fileTree: [],
    selectedFiles: [],
    repoMeta: {
      hasAppDir: false,
      hasPagesDir: false,
      hasPrisma: false,
      hasMiddleware: false,
      hasEnvExample: false,
      packageJson: null,
    },
    surfaceClassification: {
      primaryLanguage: 'TypeScript',
      detectedFrameworks: [],
      hasDocker: false,
      hasMultipleServices: false,
      isMonorepo: false,
      projectType: 'unknown',
    },
    phase1Files: [],
    phase2Files: [],
    ...overrides,
  };
}

describe('buildStaticDetectionReport', () => {
  it('detects Next.js framework from next.config', () => {
    const snapshot = makeSnapshot({
      fileTree: ['next.config.js', 'package.json', 'app/page.tsx', 'app/layout.tsx'],
    });
    const signals: StaticSignal[] = [];
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, signals);
    expect(report.framework).toBe('Next.js');
  });

  it('detects Express from package.json dependency signal', () => {
    const snapshot = makeSnapshot({
      fileTree: ['package.json', 'src/index.ts'],
    });
    const signals: StaticSignal[] = [
      { type: 'dependency', label: 'express', source: 'package.json', details: { category: 'http_client' }, confidence: 'high' },
    ];
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, signals);
    expect(report.framework).toBe('Express');
  });

  it('detects Prisma ORM from repoMeta', () => {
    const snapshot = makeSnapshot({
      repoMeta: { hasAppDir: false, hasPagesDir: false, hasPrisma: true, hasMiddleware: false, hasEnvExample: false, packageJson: null },
    });
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, []);
    expect(report.orm).toBe('Prisma');
  });

  it('detects Drizzle ORM from dependency', () => {
    const snapshot = makeSnapshot();
    const signals: StaticSignal[] = [
      { type: 'dependency', label: 'drizzle-orm', source: 'package.json', details: { category: 'database' }, confidence: 'high' },
    ];
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, signals);
    expect(report.orm).toBe('Drizzle');
  });

  it('detects PostgreSQL database from dependency', () => {
    const snapshot = makeSnapshot();
    const signals: StaticSignal[] = [
      { type: 'dependency', label: 'pg', source: 'package.json', details: { category: 'database' }, confidence: 'high' },
    ];
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, signals);
    expect(report.database).toBe('PostgreSQL');
  });

  it('detects MongoDB from dependency', () => {
    const snapshot = makeSnapshot();
    const signals: StaticSignal[] = [
      { type: 'dependency', label: 'mongoose', source: 'package.json', details: { category: 'database' }, confidence: 'high' },
    ];
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, signals);
    expect(report.database).toBe('MongoDB');
  });

  it('detects Resend email service', () => {
    const snapshot = makeSnapshot();
    const signals: StaticSignal[] = [
      { type: 'sdk_usage', label: 'Resend', source: 'src/email.ts', details: { category: 'email' }, confidence: 'medium' },
    ];
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, signals);
    expect(report.email).toBe('Resend');
  });

  it('detects Clerk auth from dependency', () => {
    const snapshot = makeSnapshot();
    const signals: StaticSignal[] = [
      { type: 'dependency', label: '@clerk/nextjs', source: 'package.json', details: { category: 'auth' }, confidence: 'high' },
    ];
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, signals);
    expect(report.auth).toBe('Clerk');
  });

  it('detects NextAuth from SDK usage', () => {
    const snapshot = makeSnapshot();
    const signals: StaticSignal[] = [
      { type: 'sdk_usage', label: 'NextAuth', source: 'src/auth.ts', details: { category: 'auth' }, confidence: 'medium' },
    ];
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, signals);
    expect(report.auth).toBe('NextAuth');
  });

  it('detects BullMQ queue', () => {
    const snapshot = makeSnapshot();
    const signals: StaticSignal[] = [
      { type: 'dependency', label: 'bullmq', source: 'package.json', details: { category: 'queue' }, confidence: 'high' },
    ];
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, signals);
    expect(report.queue).toBe('BullMQ/Bull');
  });

  it('detects OpenAI AI/ML', () => {
    const snapshot = makeSnapshot();
    const signals: StaticSignal[] = [
      { type: 'dependency', label: 'openai', source: 'package.json', details: { category: 'ai_ml' }, confidence: 'high' },
    ];
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, signals);
    expect(report.aiMl).toBe('OpenAI');
  });

  it('detects Stripe payments', () => {
    const snapshot = makeSnapshot();
    const signals: StaticSignal[] = [
      { type: 'sdk_usage', label: 'Stripe', source: 'src/payments.ts', details: { category: 'payments' }, confidence: 'medium' },
    ];
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, signals);
    expect(report.payments).toBe('Stripe');
  });

  it('detects PostgreSQL from Docker Compose service', () => {
    const snapshot = makeSnapshot({
      fileTree: ['docker-compose.yml'],
    });
    const signals: StaticSignal[] = [
      { type: 'docker_service', label: 'postgres', source: 'docker-compose.yml', details: {}, confidence: 'high' },
    ];
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, signals);
    expect(report.database).toBe('PostgreSQL');
  });

  it('detects database from env var when no other DB signal exists', () => {
    const snapshot = makeSnapshot({
      fileTree: ['.env'],
    });
    const signals: StaticSignal[] = [
      { type: 'env_var', label: 'DATABASE_URL', source: '.env', details: { category: 'database' }, confidence: 'high' },
    ];
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, signals);
    expect(report.database).toBe('Database (from env)');
  });

  it('detects Next.js surfaceClassification framework', () => {
    const snapshot = makeSnapshot({
      fileTree: ['app/page.tsx'],
      surfaceClassification: {
        primaryLanguage: 'TypeScript',
        detectedFrameworks: ['Next.js'],
        hasDocker: false,
        hasMultipleServices: false,
        isMonorepo: false,
        projectType: 'unknown',
      },
    });
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, []);
    expect(report.framework).toBe('Next.js');
  });

  it('identifies key directories from file tree', () => {
    const snapshot = makeSnapshot({
      fileTree: ['src/app.ts', 'src/routes/users.ts', 'src/services/userService.ts', 'src/models/user.ts', 'prisma/schema.prisma', 'components/Button.tsx'],
    });
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, []);
    expect(report.keyDirectories).toContain('src');
    expect(report.keyDirectories).toContain('components');
    expect(report.keyDirectories).toContain('prisma');
  });

  it('detects entry points from file tree', () => {
    const snapshot = makeSnapshot({
      fileTree: ['main.py', 'app.py', 'src/index.ts', 'README.md'],
    });
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, []);
    expect(report.entryPoints).toContain('main.py');
    expect(report.entryPoints).toContain('app.py');
    expect(report.entryPoints).toContain('src/index.ts');
  });

  it('detects monorepo from surface classification', () => {
    const snapshot = makeSnapshot({
      surfaceClassification: {
        primaryLanguage: 'TypeScript',
        detectedFrameworks: [],
        hasDocker: false,
        hasMultipleServices: false,
        isMonorepo: true,
        projectType: 'unknown',
      },
    });
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, []);
    expect(report.isMonorepo).toBe(true);
  });

  it('detects workers from queue_topic signals', () => {
    const signals: StaticSignal[] = [
      { type: 'queue_topic', label: 'email-send', source: 'src/queue.ts', details: {}, confidence: 'medium' },
    ];
    const report = buildStaticDetectionReport(makeSnapshot(), emptySubsystems, signals);
    expect(report.hasWorkers).toBe(true);
  });

  it('returns null for everything when no signals match', () => {
    const snapshot = makeSnapshot({
      fileTree: ['README.md', '.gitignore'],
    });
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, []);
    expect(report.framework).toBeNull();
    expect(report.orm).toBeNull();
    expect(report.database).toBeNull();
    expect(report.email).toBeNull();
    expect(report.auth).toBeNull();
    expect(report.queue).toBeNull();
    expect(report.aiMl).toBeNull();
    expect(report.payments).toBeNull();
    expect(report.primaryLanguage).toBe('TypeScript');
  });

  it('detects features from signals', () => {
    const snapshot = makeSnapshot({
      fileTree: ['app/page.tsx', 'middleware.ts'],
      repoMeta: { hasAppDir: true, hasPagesDir: false, hasPrisma: false, hasMiddleware: true, hasEnvExample: false, packageJson: null },
      surfaceClassification: {
        primaryLanguage: 'TypeScript',
        detectedFrameworks: [],
        hasDocker: true,
        hasMultipleServices: false,
        isMonorepo: false,
        projectType: 'unknown',
      },
    });
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, []);
    expect(report.hasAppDir).toBe(true);
    expect(report.hasMiddleware).toBe(true);
    expect(report.hasDocker).toBe(true);
  });

  it('detects external APIs from SDK signals', () => {
    const signals: StaticSignal[] = [
      { type: 'sdk_usage', label: 'Supabase', source: 'src/db.ts', details: { category: 'external_api' }, confidence: 'medium' },
      { type: 'sdk_usage', label: 'AWS SDK', source: 'src/storage.ts', details: { category: 'external_api' }, confidence: 'medium' },
    ];
    const report = buildStaticDetectionReport(makeSnapshot(), emptySubsystems, signals);
    expect(report.externalApis).toHaveLength(2);
    expect(report.externalApis[0].name).toBe('Supabase');
    expect(report.externalApis[1].name).toBe('AWS SDK');
  });

  it('detects Terraform from signals', () => {
    const signals: StaticSignal[] = [
      { type: 'terraform_resource', label: 'aws_s3_bucket.assets', source: 'infra/main.tf', details: {}, confidence: 'high' },
    ];
    const report = buildStaticDetectionReport(makeSnapshot(), emptySubsystems, signals);
    expect(report.hasTerraform).toBe(true);
  });

  it('extracts top-level dirs from file tree', () => {
    const snapshot = makeSnapshot({
      fileTree: ['src/app.ts', 'src/routes/users.ts', 'public/favicon.ico', 'tests/app.test.ts', 'prisma/schema.prisma'],
    });
    const report = buildStaticDetectionReport(snapshot, emptySubsystems, []);
    expect(report.topLevelDirs).toContain('src');
    expect(report.topLevelDirs).toContain('public');
    expect(report.topLevelDirs).toContain('tests');
    expect(report.topLevelDirs).toContain('prisma');
    expect(report.topLevelDirs).not.toContain('node_modules');
  });
});

describe('formatDetectionReport', () => {
  it('produces readable output with all fields', () => {
    const report = buildStaticDetectionReport(
      makeSnapshot({
        fileTree: ['package.json', 'app/page.tsx', 'src/index.ts', 'middleware.ts'],
        repoMeta: { hasAppDir: true, hasPagesDir: false, hasPrisma: true, hasMiddleware: true, hasEnvExample: false, packageJson: null },
        surfaceClassification: {
          primaryLanguage: 'TypeScript',
          detectedFrameworks: ['Next.js'],
          hasDocker: true,
          hasMultipleServices: false,
          isMonorepo: false,
          projectType: 'unknown',
        },
      }),
      emptySubsystems,
      [
        { type: 'dependency', label: 'prisma', source: 'package.json', details: { category: 'database' }, confidence: 'high' },
        { type: 'dependency', label: 'next-auth', source: 'package.json', details: { category: 'auth' }, confidence: 'high' },
      ]
    );
    const text = formatDetectionReport(report);
    expect(text).toContain('Framework: Next.js');
    expect(text).toContain('ORM: Prisma');
    expect(text).toContain('Auth:');
    expect(text).toContain('Language: TypeScript');
    expect(text).toContain('app/ directory');
    expect(text).toContain('middleware');
    expect(text).toContain('Docker');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });

  it('produces minimal output for empty repo', () => {
    const report = buildStaticDetectionReport(makeSnapshot(), emptySubsystems, []);
    const text = formatDetectionReport(report);
    expect(text).toContain('Language: TypeScript');
    expect(text).toContain('Type: Single-package');
  });
});
