import { describe, it, expect } from 'vitest';
import type { FileEntry } from '@/lib/types/repo-diagram';
import { extractStaticSignals } from '../static-analyzer';

// Compose-files with depends_on parsed via real YAML (Phase 3 fix).

function serviceSignals(composeContent: string) {
  const file: FileEntry = { path: 'docker-compose.yml', content: composeContent };
  return extractStaticSignals([file], []).filter(
    (s) => s.type === 'docker_service' || s.type === 'compose_dependency'
  );
}

describe('docker-compose detection (real YAML)', () => {
  it('parses the services block and emits a docker_service signal per service', () => {
    const compose = `
version: "3.9"
services:
  web:
    image: nginx
  api:
    image: myapi
  postgres:
    image: postgres:14
`;
    const sigs = serviceSignals(compose);
    const services = sigs.filter((s) => s.type === 'docker_service').map((s) => s.label);
    expect(services).toContain('web');
    expect(services).toContain('api');
    expect(services).toContain('postgres');
  });

  it('emits high-confidence compose_dependency edges from depends_on (block form)', () => {
    const compose = `
services:
  api:
    image: myapi
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
  worker:
    image: worker
    depends_on: [redis]
`;
    const sigs = serviceSignals(compose);
    const deps = sigs.filter((s) => s.type === 'compose_dependency');
    expect(deps.length).toBe(3);
    const apiDeps = deps.filter((d) => (d.details as { from: string }).from === 'api');
    expect(apiDeps.map((d) => d.label).sort()).toEqual(['postgres', 'redis']);
    const workerDeps = deps.filter((d) => (d.details as { from: string }).from === 'worker');
    expect(workerDeps).toHaveLength(1);
    expect(workerDeps[0].label).toBe('redis');
    expect(deps[0].confidence).toBe('high');
  });

  it('does not emit compose_dependency for missing depends_on', () => {
    const compose = `
services:
  a:
    image: alpine
  b:
    image: alpine
`;
    const sigs = serviceSignals(compose);
    expect(sigs.filter((s) => s.type === 'compose_dependency')).toHaveLength(0);
  });

  it('returns [] when the YAML is invalid', () => {
    const sigs = serviceSignals('this: : : is not valid yaml {{');
    expect(sigs).toHaveLength(0);
  });
});