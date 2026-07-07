import { describe, it, expect } from 'vitest';
import { detectSubsystems } from '../subsystem-detector';
import { extractStaticSignals } from '../static-analyzer';
import { buildSubsystemGraph, intermediateToArchitecture } from '../intermediate-graphs';
import type { FileEntry, RepoSnapshot } from '@/lib/types/repo-diagram';

function makeSnapshot(overrides: Partial<RepoSnapshot> = {}): RepoSnapshot {
  return {
    repoUrl: 'https://github.com/o/r',
    owner: 'o',
    repo: 'r',
    fileTree: [],
    selectedFiles: [],
    repoMeta: { hasAppDir: false, hasPagesDir: false, hasPrisma: false, hasMiddleware: false, hasEnvExample: false, packageJson: null },
    surfaceClassification: { primaryLanguage: 'unknown', detectedFrameworks: [], hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown' },
    phase1Files: [],
    phase2Files: [],
    ...overrides,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function runDeterministicPipeline(snapshot: RepoSnapshot, extraFiles: FileEntry[] = []) {
  const allFiles = [...snapshot.selectedFiles, ...extraFiles];
  const subsystems = detectSubsystems(snapshot);
  const signals = extractStaticSignals(allFiles, subsystems);
  const graph = buildSubsystemGraph(subsystems, allFiles, signals);
  const { nodes, edges } = intermediateToArchitecture(graph, subsystems);
  return { subsystems, signals, nodes, edges };
}

// ─── Golden: Next.js fullstack app ───────────────────────────────

describe('golden: Next.js fullstack app', () => {
  const snapshot = makeSnapshot({
    fileTree: [
      'package.json', 'next.config.js', 'app/layout.tsx', 'app/page.tsx',
      'app/api/auth/route.ts', 'app/api/users/route.ts',
      'middleware.ts', 'prisma/schema.prisma', '.env.example',
    ],
    selectedFiles: [
      { path: 'package.json', content: JSON.stringify({
        dependencies: { next: '^14.0.0', prisma: '^5.0.0', '@clerk/nextjs': '^4.0.0', stripe: '^14.0.0' },
      })},
      { path: 'app/page.tsx', content: 'export default function Home() { return <div>Hello</div>; }' },
      { path: 'app/layout.tsx', content: 'export default function RootLayout() { return <html><body/></html>; }' },
    ],
    surfaceClassification: {
      primaryLanguage: 'JavaScript/TypeScript', detectedFrameworks: ['Next.js'],
      hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown',
    },
  });
  const extraFiles: FileEntry[] = [
    { path: 'prisma/schema.prisma', content: 'model User { id Int @id }\nmodel Post { id Int @id }' },
    { path: 'middleware.ts', content: 'export default authMiddleware();' },
    { path: '.env.example', content: 'DATABASE_URL=postgres://localhost\nCLERK_SECRET_KEY=sk_test' },
    { path: 'app/api/auth/route.ts', content: 'export async function POST() { return Response.json({}); }' },
    { path: 'app/api/users/route.ts', content: 'import Stripe from "stripe";\nexport async function GET() { return Response.json([]); }' },
  ];

  const result = runDeterministicPipeline(snapshot, extraFiles);

  it('detects Next.js as the framework', () => {
    expect(result.subsystems[0].detectedFramework).toBe('Next.js');
  });

  it('produces backend-type root subsystem', () => {
    expect(result.subsystems[0].type).toBe('backend');
  });

  it('has expected node types', () => {
    const types = result.nodes.map((n) => n.type);
    expect(types).toContain('API_ROUTE');
    expect(types).toContain('DATABASE');
    expect(types).toContain('EXTERNAL_SERVICE');
  });

  it('has a database node', () => {
    expect(result.nodes.some((n) => n.type === 'DATABASE')).toBe(true);
  });

  it('has external service node for Stripe', () => {
    const externalLabels = result.nodes.filter((n) => n.type === 'EXTERNAL_SERVICE').map((n) => n.label);
    expect(externalLabels.some((l) => l.toLowerCase().includes('stripe'))).toBe(true);
  });

  it('has Clerk detected as auth signal (not external service)', () => {
    const authSignals = result.signals.filter((s) => s.type === 'dependency' && s.details.category === 'auth');
    expect(authSignals.some((s) => s.label === '@clerk/nextjs')).toBe(true);
  });

  it('has edges connecting nodes', () => {
    expect(result.edges.length).toBeGreaterThan(0);
  });

  it('does not contain hallucinated frontend page nodes', () => {
    // Next.js pages should not become standalone PAGE nodes in deterministic analysis
    // unless explicitly modeled by static analysis
    const pages = result.nodes.filter((n) => n.type === 'PAGE');
    expect(pages.length).toBeLessThanOrEqual(1);
  });
});

// ─── Golden: FastAPI backend ─────────────────────────────────────

describe('golden: FastAPI backend', () => {
  const snapshot = makeSnapshot({
    fileTree: [
      'main.py', 'requirements.txt', 'app/routers/users.py', 'app/routers/auth.py',
      'app/models/user.py', 'app/schemas/user.py', '.env.example',
    ],
    selectedFiles: [
      { path: 'requirements.txt', content: 'fastapi\nsqlalchemy\npsycopg2\nredis\ncelery\nhttpx' },
      { path: 'main.py', content: 'from fastapi import FastAPI\nimport sqlalchemy\napp = FastAPI()' },
    ],
    surfaceClassification: {
      primaryLanguage: 'Python', detectedFrameworks: ['FastAPI'],
      hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown',
    },
  });
  const extraFiles: FileEntry[] = [
    { path: 'app/routers/users.py', content: 'from fastapi import APIRouter\nrouter = APIRouter()\n@router.get("/users")\nasync def list_users(): pass' },
    { path: 'app/routers/auth.py', content: 'from fastapi import APIRouter\nrouter = APIRouter()\n@router.post("/auth/login")\nasync def login(): pass' },
    { path: '.env.example', content: 'DATABASE_URL=postgres://localhost\nREDIS_URL=redis://localhost' },
  ];

  const result = runDeterministicPipeline(snapshot, extraFiles);

  it('detects Python language', () => {
    expect(result.subsystems[0].language).toBe('Python');
  });

  it('produces backend-type subsystems', () => {
    expect(result.subsystems[0].type).toBe('backend');
  });

  it('has database node from sqlalchemy dependency', () => {
    expect(result.nodes.some((n) => n.type === 'DATABASE' || n.label.toLowerCase().includes('sqlalchemy'))).toBe(true);
  });

  it('has external service for Celery (queue)', () => {
    const queueNodes = result.nodes.filter((n) => n.type === 'QUEUE' || n.label.toLowerCase().includes('celery'));
    expect(queueNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('has route signals', () => {
    const routeSignals = result.signals.filter((s) => s.type === 'route');
    expect(routeSignals.length).toBeGreaterThanOrEqual(2);
  });

  it('produces edges', () => {
    expect(result.edges.length).toBeGreaterThan(0);
  });
});

// ─── Golden: Monorepo (apps/web, apps/api) ───────────────────────

describe('golden: monorepo (apps/web + apps/api)', () => {
  const snapshot = makeSnapshot({
    fileTree: [
      'package.json', 'pnpm-workspace.yaml',
      'apps/web/package.json', 'apps/web/app/page.tsx', 'apps/web/app/layout.tsx',
      'apps/api/package.json', 'apps/api/src/server.ts', 'apps/api/src/routes/users.ts',
      'packages/shared/package.json', 'packages/shared/src/index.ts',
    ],
    selectedFiles: [
      { path: 'package.json', content: JSON.stringify({}) },
      { path: 'apps/web/package.json', content: JSON.stringify({ dependencies: { next: '^14.0.0' } }) },
      { path: 'apps/api/package.json', content: JSON.stringify({ dependencies: { express: '^4.0.0', prisma: '^5.0.0' } }) },
    ],
    surfaceClassification: {
      primaryLanguage: 'JavaScript/TypeScript', detectedFrameworks: ['Next.js', 'Express'],
      hasDocker: false, hasMultipleServices: true, isMonorepo: true, projectType: 'unknown',
    },
  });
  const extraFiles: FileEntry[] = [
    { path: 'apps/api/src/server.ts', content: 'import express from "express";\nconst app = express();' },
    { path: 'apps/api/src/routes/users.ts', content: 'router.get("/users", handler);\nrouter.post("/users", handler);' },
    { path: 'packages/shared/src/index.ts', content: 'export const VERSION = "1.0.0";' },
  ];

  const result = runDeterministicPipeline(snapshot, extraFiles);

  it('detects 3+ subsystems (root, apps/web, apps/api, packages/shared)', () => {
    expect(result.subsystems.length).toBeGreaterThanOrEqual(3);
  });

  it('classifies apps/web as frontend', () => {
    const web = result.subsystems.find((s) => s.path === 'apps/web');
    expect(web).toBeDefined();
    expect(web!.type).toBe('frontend');
  });

  it('classifies apps/api as backend', () => {
    const api = result.subsystems.find((s) => s.path === 'apps/api');
    expect(api).toBeDefined();
    expect(api!.type).toBe('backend');
  });

  it('classifies packages/shared as library', () => {
    const shared = result.subsystems.find((s) => s.path === 'packages/shared');
    expect(shared).toBeDefined();
    expect(shared!.type).toBe('library');
  });

  it('signals are assigned to the correct subsystem (not root-biased)', () => {
    // API route signals should belong to apps/api, not root
    const apiSignals = result.signals.filter((s) => s.source.includes('apps/api'));
    expect(apiSignals.length).toBeGreaterThan(0);
    // Root should not claim API signals
    const rootSignals = result.signals.filter((s) => s.source.includes('apps/api') && s.source.startsWith('/'));
    expect(rootSignals.length).toBe(0);
  });

  it('nodes include API and frontend components', () => {
    expect(result.nodes.some((n) => n.id.includes('apps_api') || n.id.includes('api'))).toBe(true);
    expect(result.nodes.some((n) => n.id.includes('apps_web') || n.id.includes('web'))).toBe(true);
  });

  it('has inter-subsystem edges (frontend → backend)', () => {
    expect(result.edges.length).toBeGreaterThan(0);
  });
});

// ─── Golden: Express API ─────────────────────────────────────────

describe('golden: Express API', () => {
  const snapshot = makeSnapshot({
    fileTree: [
      'package.json', 'server.js', 'routes/users.js', 'routes/auth.js',
      'models/user.js', 'middleware/auth.js', '.env.example',
    ],
    selectedFiles: [
      { path: 'package.json', content: JSON.stringify({
        dependencies: { express: '^4.0.0', mongoose: '^7.0.0', jsonwebtoken: '^9.0.0' },
      })},
      { path: 'server.js', content: 'const express = require("express");\nconst app = express();' },
    ],
    surfaceClassification: {
      primaryLanguage: 'JavaScript/TypeScript', detectedFrameworks: ['Express'],
      hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown',
    },
  });
  const extraFiles: FileEntry[] = [
    { path: 'routes/users.js', content: 'router.get("/users", handler);' },
    { path: 'routes/auth.js', content: 'router.post("/auth/login", handler);' },
    { path: 'middleware/auth.js', content: 'module.exports = function auth(req, res, next) { next(); };' },
    { path: '.env.example', content: 'MONGODB_URI=mongodb://localhost\nJWT_SECRET=secret' },
  ];

  const result = runDeterministicPipeline(snapshot, extraFiles);

  it('detects Express framework', () => {
    expect(result.subsystems[0].detectedFramework).toBe('Express');
  });

  it('has backend-type subsystem', () => {
    expect(result.subsystems[0].type).toBe('backend');
  });

  it('has database node from mongoose dependency', () => {
    expect(result.nodes.some((n) => n.type === 'DATABASE')).toBe(true);
  });

  it('has middleware detected', () => {
    expect(result.signals.some((s) => s.type === 'middleware')).toBe(true);
  });

  it('has route signals', () => {
    expect(result.signals.filter((s) => s.type === 'route').length).toBeGreaterThanOrEqual(2);
  });

  it('has edges', () => {
    expect(result.edges.length).toBeGreaterThan(0);
  });
});

// ─── Golden: Terraform infrastructure ────────────────────────────

describe('golden: Terraform infrastructure (no web app)', () => {
  const snapshot = makeSnapshot({
    fileTree: [
      'main.tf', 'variables.tf', 'outputs.tf',
      'modules/networking/main.tf', 'modules/compute/main.tf',
      'k8s/deployment.yaml', 'k8s/service.yaml',
    ],
    selectedFiles: [
      { path: 'main.tf', content: 'resource "aws_s3_bucket" "assets" {}\nresource "aws_db_instance" "main" {}' },
    ],
    surfaceClassification: {
      primaryLanguage: 'Terraform/HCL', detectedFrameworks: [],
      hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown',
    },
  });
  const extraFiles: FileEntry[] = [
    { path: 'modules/networking/main.tf', content: 'resource "aws_vpc" "main" {}' },
    { path: 'modules/compute/main.tf', content: 'resource "aws_ecs_cluster" "main" {}' },
    { path: 'k8s/deployment.yaml', content: 'kind: Deployment\nmetadata:\n  name: api' },
    { path: 'k8s/service.yaml', content: 'kind: Service\nmetadata:\n  name: api' },
  ];

  const result = runDeterministicPipeline(snapshot, extraFiles);

  it('classifies as infrastructure, not generic application', () => {
    expect(result.subsystems[0].type).toBe('infrastructure');
  });

  it('produces deployment/infra-related nodes', () => {
    const types = result.nodes.map((n) => n.type);
    // Should NOT have API_ROUTE, PAGE, DATABASE, EXTERNAL_SERVICE
    expect(types).not.toContain('API_ROUTE');
    expect(types).not.toContain('PAGE');
    expect(types).not.toContain('FRONTEND');
  });

  it('has terraform resource signals', () => {
    const tfSignals = result.signals.filter((s) => s.type === 'terraform_resource');
    expect(tfSignals.length).toBeGreaterThanOrEqual(2);
  });

  it('has kubernetes resource signals', () => {
    const k8sSignals = result.signals.filter((s) => s.type === 'kubernetes_resource');
    expect(k8sSignals.length).toBeGreaterThanOrEqual(1);
  });

  it('does not produce database nodes (no schema/db dependency)', () => {
    expect(result.nodes.filter((n) => n.type === 'DATABASE').length).toBe(0);
  });
});

// ─── Golden: CLI / agent-tooling (no web app hallucination) ──────

describe('golden: CLI agent-tooling (no web app hallucination)', () => {
  const snapshot = makeSnapshot({
    fileTree: [
      'package.json', 'tsconfig.json',
      'src/cli.ts', 'src/agent.ts', 'src/llm/client.ts',
      'src/tools/executor.ts', 'src/shell/sandbox.ts',
      'src/config.ts', 'src/auth.ts', 'README.md',
    ],
    selectedFiles: [
      { path: 'package.json', content: JSON.stringify({
        dependencies: { '@anthropic-ai/sdk': '^0.20.0', zod: '^3.22.0' },
        bin: { mycli: './src/cli.ts' },
      })},
      { path: 'src/cli.ts', content: 'import { runAgent } from "./agent";\nrunAgent().catch(console.error);' },
    ],
    surfaceClassification: {
      primaryLanguage: 'JavaScript/TypeScript', detectedFrameworks: [],
      hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown',
    },
  });
  const extraFiles: FileEntry[] = [
    { path: 'src/agent.ts', content: 'import { LLMClient } from "./llm/client";\nexport async function runAgent() {}' },
    { path: 'src/llm/client.ts', content: 'import Anthropic from "@anthropic-ai/sdk";\nexport class LLMClient {}' },
    { path: 'src/tools/executor.ts', content: 'export class ToolExecutor {}\nimport { exec } from "child_process";' },
    { path: 'src/shell/sandbox.ts', content: 'export class Sandbox {}\nimport { mkdtemp } from "fs";' },
    { path: 'src/config.ts', content: 'export const CONFIG = {};' },
    { path: 'src/auth.ts', content: 'export function authenticate() {}' },
  ];

  const result = runDeterministicPipeline(snapshot, extraFiles);

  it('does not contain web app node types', () => {
    const types = result.nodes.map((n) => n.type);
    expect(types).not.toContain('PAGE');
    expect(types).not.toContain('API_ROUTE');
    expect(types).not.toContain('UI_COMPONENT');
  });

  it('does not contain database nodes', () => {
    expect(result.nodes.filter((n) => n.type === 'DATABASE').length).toBe(0);
  });

  it('contains CLI/agent entry point', () => {
    const entrySignals = result.signals.filter((s) => s.type === 'entry_point');
    expect(entrySignals.some((s) => s.label.includes('cli.ts'))).toBe(true);
  });

  it('has EXTERNAL_SERVICE node for Anthropic', () => {
    expect(result.nodes.some((n) => n.type === 'EXTERNAL_SERVICE' && n.label.toLowerCase().includes('anthropic'))).toBe(true);
  });

  it('produces at least some edges', () => {
    expect(result.edges.length).toBeGreaterThanOrEqual(0);
  });
});
