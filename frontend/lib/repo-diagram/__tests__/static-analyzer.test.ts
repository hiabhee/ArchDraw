import { describe, it, expect } from 'vitest';
import { extractStaticSignals } from '../static-analyzer';
import type { FileEntry, Subsystem } from '@/lib/types/repo-diagram';

const emptySubsystems: Subsystem[] = [];

describe('extractStaticSignals', () => {
  it('detects package.json dependencies', () => {
    const files: FileEntry[] = [
      { path: 'package.json', content: JSON.stringify({ dependencies: { express: '^4.0.0', stripe: '^10.0.0', prisma: '^5.0.0' } }) },
    ];
    const signals = extractStaticSignals(files, emptySubsystems);
    const deps = signals.filter((s) => s.type === 'dependency');
    expect(deps.some((d) => d.label === 'express')).toBe(true);
    expect(deps.some((d) => d.label === 'stripe')).toBe(true);
    expect(deps.some((d) => d.label === 'prisma')).toBe(true);
    const stripe = deps.find((d) => d.label === 'stripe');
    expect(stripe!.details.category).toBe('payments');
    const prisma = deps.find((d) => d.label === 'prisma');
    expect(prisma!.details.category).toBe('database');
  });

  it('detects routes from router files', () => {
    const files: FileEntry[] = [
      { path: 'src/routes/users.ts', content: 'router.get("/users", handler);\nrouter.post("/users/:id", handler);' },
    ];
    const signals = extractStaticSignals(files, emptySubsystems);
    const routes = signals.filter((s) => s.type === 'route');
    expect(routes.length).toBeGreaterThanOrEqual(2);
    expect(routes.some((r) => r.label === '/users')).toBe(true);
    expect(routes.some((r) => r.label === '/users/:id')).toBe(true);
  });

  it('detects Prisma schemas', () => {
    const files: FileEntry[] = [
      { path: 'prisma/schema.prisma', content: 'model User { id Int @id }\nmodel Post { id Int @id }' },
    ];
    const signals = extractStaticSignals(files, emptySubsystems);
    const schemas = signals.filter((s) => s.type === 'schema');
    expect(schemas).toHaveLength(2);
    expect(schemas.some((s) => s.label === 'User')).toBe(true);
    expect(schemas.some((s) => s.label === 'Post')).toBe(true);
  });

  it('detects environment variables from .env.example', () => {
    const files: FileEntry[] = [
      { path: '.env.example', content: 'DATABASE_URL=postgres://localhost\nSTRIPE_KEY=sk_test\nSMTP_HOST=smtp.example.com\nREDIS_URL=redis://localhost\n' },
    ];
    const signals = extractStaticSignals(files, emptySubsystems);
    const envVars = signals.filter((s) => s.type === 'env_var');
    expect(envVars).toHaveLength(4);
    const db = envVars.find((e) => e.label === 'DATABASE_URL');
    expect(db!.details.category).toBe('database');
    const stripe = envVars.find((e) => e.label === 'STRIPE_KEY');
    expect(stripe!.details.category).toBe('payments');
    const smtp = envVars.find((e) => e.label === 'SMTP_HOST');
    expect(smtp!.details.category).toBe('email');
    const redis = envVars.find((e) => e.label === 'REDIS_URL');
    expect(redis!.details.category).toBe('queue');
  });

  it('detects Docker services from docker-compose', () => {
    const files: FileEntry[] = [
      { path: 'docker-compose.yml', content: 'services:\n  postgres:\n    image: postgres:15\n  redis:\n    image: redis:7\n' },
    ];
    const signals = extractStaticSignals(files, emptySubsystems);
    const dockerSvcs = signals.filter((s) => s.type === 'docker_service');
    expect(dockerSvcs).toHaveLength(2);
    expect(dockerSvcs.some((d) => d.label === 'postgres')).toBe(true);
  });

  it('detects SDK usage from imports', () => {
    const files: FileEntry[] = [
      { path: 'src/stripe.ts', content: 'import Stripe from "stripe";\nconst stripe = new Stripe(key);' },
      { path: 'src/supabase.ts', content: 'import { createClient } from "@supabase/supabase-js";' },
    ];
    const signals = extractStaticSignals(files, emptySubsystems);
    const sdk = signals.filter((s) => s.type === 'sdk_usage');
    expect(sdk.some((s) => s.label === 'Stripe')).toBe(true);
    expect(sdk.some((s) => s.label === 'Supabase')).toBe(true);
    const stripe = sdk.find((s) => s.label === 'Stripe');
    expect(stripe!.details.category).toBe('payments');
  });

  it('detects middleware files', () => {
    const files: FileEntry[] = [
      { path: 'src/middleware.ts', content: 'export function authMiddleware() {}' },
    ];
    const signals = extractStaticSignals(files, emptySubsystems);
    expect(signals.some((s) => s.type === 'middleware')).toBe(true);
  });

  it('detects Terraform resources', () => {
    const files: FileEntry[] = [
      { path: 'infra/main.tf', content: 'resource "aws_s3_bucket" "assets" {}\nresource "aws_db_instance" "main" {}' },
    ];
    const signals = extractStaticSignals(files, emptySubsystems);
    const tf = signals.filter((s) => s.type === 'terraform_resource');
    expect(tf).toHaveLength(2);
    expect(tf.some((t) => t.label === 'aws_s3_bucket.assets')).toBe(true);
    expect(tf.some((t) => t.label === 'aws_db_instance.main')).toBe(true);
  });

  it('detects K8s resources from YAML', () => {
    const files: FileEntry[] = [
      { path: 'k8s/deployment.yaml', content: 'kind: Deployment\nmetadata:\n  name: api\nspec:\n  replicas: 3' },
    ];
    const signals = extractStaticSignals(files, emptySubsystems);
    expect(signals.some((s) => s.type === 'kubernetes_resource' && s.label === 'Deployment')).toBe(true);
  });

  it('detects entry points like main.py and app.py', () => {
    const files: FileEntry[] = [
      { path: 'main.py', content: 'def main():\n    pass' },
      { path: 'app.py', content: 'from flask import Flask' },
    ];
    const signals = extractStaticSignals(files, emptySubsystems);
    const entries = signals.filter((s) => s.type === 'entry_point');
    expect(entries).toHaveLength(2);
    expect(entries.some((e) => e.label === 'main.py')).toBe(true);
    expect(entries.some((e) => e.label === 'app.py')).toBe(true);
  });

  it('detects entry points with subsystem info', () => {
    const subsystems: Subsystem[] = [
      { name: 'api', path: 'services/api', type: 'backend', fileCount: 5, files: ['services/api/server.ts'], language: 'TypeScript', detectedFramework: null, entryPoints: ['server.ts'] },
    ];
    const files: FileEntry[] = [
      { path: 'services/api/server.ts', content: 'import express from "express";' },
    ];
    const signals = extractStaticSignals(files, subsystems);
    const entry = signals.find((s) => s.type === 'entry_point');
    expect(entry).toBeDefined();
    expect(entry!.details.subsystem).toBe('api');
  });

  it('detects queue topics', () => {
    const files: FileEntry[] = [
      { path: 'src/queue.ts', content: 'const emailQueue = new Queue("email-send");\nconst reportQueue = new Queue("report-gen");' },
    ];
    const signals = extractStaticSignals(files, emptySubsystems);
    const topics = signals.filter((s) => s.type === 'queue_topic');
    expect(topics).toHaveLength(2);
    expect(topics.some((t) => t.label === 'email-send')).toBe(true);
    expect(topics.some((t) => t.label === 'report-gen')).toBe(true);
  });

  it('does not produce duplicate signals', () => {
    const files: FileEntry[] = [
      { path: 'package.json', content: JSON.stringify({ dependencies: { express: '^4.0.0' } }) },
    ];
    const signals = extractStaticSignals(files, emptySubsystems);
    const expressDeps = signals.filter((s) => s.label === 'express');
    expect(expressDeps).toHaveLength(1);
  });

  it('handles empty file list', () => {
    const signals = extractStaticSignals([], emptySubsystems);
    expect(signals).toHaveLength(0);
  });

  it('detects ORM decorator entities', () => {
    const files: FileEntry[] = [
      { path: 'src/entities/User.ts', content: "@Entity('users')\nexport class User {}" },
    ];
    const signals = extractStaticSignals(files, emptySubsystems);
    const schemas = signals.filter((s) => s.type === 'schema');
    expect(schemas.some((s) => s.label === 'users')).toBe(true);
  });
});
