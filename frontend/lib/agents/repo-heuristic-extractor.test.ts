import { describe, it, expect } from 'vitest';
import { extractComponentsHeuristic, inferRelationshipsHeuristic } from './repo-heuristic-extractor';
import type { RepoSnapshot } from '@/lib/types/repo-diagram';

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

describe('repo-heuristic-extractor', () => {
  it('extracts app entry and database from a FastAPI-style tree', () => {
    const snapshot = makeSnapshot({
      fileTree: ['main.py', 'app/routers/campaign.py', 'requirements.txt'],
      selectedFiles: [{ path: 'main.py', content: 'import sqlite3\nfrom fastapi import FastAPI\n' }],
    });

    const nodes = extractComponentsHeuristic(snapshot, {
      repoType: 'backend_only',
      architecturePattern: 'layered',
      primaryStack: { framework: 'FastAPI', language: 'Python', runtime: 'Python' },
      applicationDomain: 'Python API server',
      coreCapabilities: [],
      primaryUserFlows: [],
      confidence: 'low',
      reasoning: 'test',
      extractionStrategy: { keyDirectories: ['app'], entryPoints: ['main.py'], moduleStructure: 'layered', focusAreas: [] },
    });

    expect(nodes.length).toBeGreaterThanOrEqual(2);
    expect(nodes.some((n) => n.type === 'DATABASE' || n.id.includes('database'))).toBe(true);
  });

  it('extracts Next.js architecture nodes', () => {
    const snapshot = makeSnapshot({
      fileTree: [
        'package.json', 'app/layout.tsx', 'app/page.tsx', 'app/api/auth/route.ts',
        'middleware.ts', 'prisma/schema.prisma',
      ],
      selectedFiles: [
        { path: 'package.json', content: '{"dependencies": {"next": "^14.0.0"}}' },
        { path: 'app/page.tsx', content: 'export default function Home() { return <div>Hello</div>; }' },
      ],
      surfaceClassification: { primaryLanguage: 'JavaScript/TypeScript', detectedFrameworks: ['Next.js'], hasDocker: false, hasMultipleServices: false, isMonorepo: false, projectType: 'unknown' },
    });

    const nodes = extractComponentsHeuristic(snapshot, {
      repoType: 'frontend_only',
      architecturePattern: 'layered',
      primaryStack: { framework: 'Next.js', language: 'TypeScript', runtime: 'Node.js' },
      applicationDomain: 'Next.js frontend app',
      coreCapabilities: [],
      primaryUserFlows: [],
      confidence: 'low',
      reasoning: 'test',
      extractionStrategy: { keyDirectories: ['app'], entryPoints: [], moduleStructure: '', focusAreas: [] },
    });

    expect(nodes.length).toBeGreaterThanOrEqual(3);
    expect(nodes.some((n) => n.id === 'app_entry')).toBe(true);
  });

  it('handles docs-only repos gracefully', () => {
    const snapshot = makeSnapshot({
      fileTree: ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'docs/api.md'],
      selectedFiles: [{ path: 'README.md', content: '# My Project' }],
    });

    const nodes = extractComponentsHeuristic(snapshot);
    // Should produce at least some nodes, not crash
    expect(Array.isArray(nodes)).toBe(true);
  });

  it('produces edges from entry to API routes and database', () => {
    const snapshot = makeSnapshot({
      fileTree: ['main.py', 'app/routers/api.py', 'requirements.txt'],
      selectedFiles: [{ path: 'main.py', content: 'import sqlite3' }],
    });

    const nodes = extractComponentsHeuristic(snapshot);
    const { edges, workflows } = inferRelationshipsHeuristic(nodes);

    expect(edges.length).toBeGreaterThan(0);
    expect(Array.isArray(workflows)).toBe(true);
  });

  it('detects external services from files', () => {
    const snapshot = makeSnapshot({
      fileTree: ['server.ts', 'stripe.ts', '.env.example'],
      selectedFiles: [
        { path: 'server.ts', content: 'import Stripe from "stripe";' },
        { path: '.env.example', content: 'STRIPE_API_KEY=sk_test_...' },
      ],
    });

    const nodes = extractComponentsHeuristic(snapshot);
    const hasStripe = nodes.some((n) => n.id.includes('stripe'));
    // Stripe should be detected from import
    expect(hasStripe).toBe(true);
  });

  it('does NOT fabricate external services from prose-only mentions', () => {
    const snapshot = makeSnapshot({
      fileTree: ['README.md', 'server.ts'],
      selectedFiles: [
        { path: 'README.md', content: '# My Project\n\nPayments powered by Stripe. Auth by Clerk. Email by Resend.' },
        { path: 'server.ts', content: 'export function handler() { return "ok"; }' },
      ],
    });

    const nodes = extractComponentsHeuristic(snapshot);
    expect(nodes.some((n) => n.id.includes('stripe'))).toBe(false);
    expect(nodes.some((n) => n.id.includes('clerk'))).toBe(false);
    expect(nodes.some((n) => n.id.includes('resend'))).toBe(false);
  });

  it('returns empty edges for single node', () => {
    const { edges, workflows } = inferRelationshipsHeuristic([
      { id: 'single', label: 'Only Node', type: 'SERVICE', description: '', sourceFiles: [], confidence: 'medium' },
    ]);
    expect(edges).toHaveLength(0);
    expect(workflows).toHaveLength(0);
  });
});
