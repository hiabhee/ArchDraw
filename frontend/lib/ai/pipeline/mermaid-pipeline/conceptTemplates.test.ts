import { describe, expect, it } from 'vitest';
import { detectImplicitConceptPrompt } from './conceptTemplates';
import { runMermaidPipeline } from './index';

function nodeLabels(result: Awaited<ReturnType<typeof runMermaidPipeline>>): string[] {
  return result.nodes.map((node) => String((node as { data?: { label?: unknown } }).data?.label ?? ''));
}

describe('implicit concept diagram generation', () => {
  it('detects short implicit concept prompts but leaves detailed prompts to the planner', () => {
    expect(detectImplicitConceptPrompt('Describe Docker architecture')).toMatchObject({ template: 'docker', domain: 'container-runtime' });
    expect(detectImplicitConceptPrompt('Describe API Gateway')).toMatchObject({ template: 'api-gateway', domain: 'api-edge' });
    expect(detectImplicitConceptPrompt('Explain Kafka architecture')).toMatchObject({ template: 'kafka', domain: 'messaging' });
    expect(detectImplicitConceptPrompt('Linux architecture overview')).toMatchObject({ template: 'linux', domain: 'operating-system' });
    expect(detectImplicitConceptPrompt('Describe Redis architecture')).toMatchObject({ subject: 'Redis', domain: 'cache' });
    expect(detectImplicitConceptPrompt('Explain PostgreSQL')).toMatchObject({ subject: 'PostgreSQL', domain: 'database' });
    expect(detectImplicitConceptPrompt('What is OpenTelemetry architecture')).toMatchObject({ subject: 'OpenTelemetry', domain: 'observability' });
    expect(detectImplicitConceptPrompt('Describe WeirdInfra')).toMatchObject({ subject: 'WeirdInfra', domain: 'generic-infrastructure' });

    expect(detectImplicitConceptPrompt('Describe Docker Swarm architecture')).toBeNull();
    expect(detectImplicitConceptPrompt('Describe API Gateway for my ecommerce backend')).toBeNull();
    expect(detectImplicitConceptPrompt('Kafka architecture for payment events using schema registry')).toBeNull();
  });

  it('uses canonical Docker Engine components for generic Docker architecture', async () => {
    const result = await runMermaidPipeline({
      description: 'Describe Docker architecture',
      systemType: 'architecture',
      complexity: 'low',
      diagramSize: 'medium',
    });

    const labels = nodeLabels(result);

    expect(labels).toEqual(expect.arrayContaining([
      'Docker Client / CLI',
      'Docker API',
      'Docker Daemon / Engine',
      'Docker Registry',
      'Local Image Store',
      'containerd',
      'runc',
      'Running Containers',
      'Docker Networks',
      'Docker Volumes',
      'Host OS Kernel',
    ]));
    expect(labels).not.toContain('Swarm Manager');
    expect(labels).not.toContain('Load Balancer');
    expect(labels).not.toContain('CI/CD Server');
    expect(labels).not.toContain('Overlay Network');
  });

  it('uses an API Gateway capability map instead of inventing an application architecture', async () => {
    const result = await runMermaidPipeline({
      description: 'Describe API Gateway',
      systemType: 'architecture',
      complexity: 'low',
      diagramSize: 'medium',
    });

    const labels = nodeLabels(result);

    expect(labels).toEqual(expect.arrayContaining([
      'HTTPS Listener',
      'Route Matcher',
      'AuthN / AuthZ',
      'Rate Limiter',
      'Request Validator',
      'Transform / Version',
      'Reverse Proxy',
      'Gateway Config',
      'Metrics / Traces',
    ]));
    expect(labels).not.toContain('Order Service');
    expect(labels).not.toContain('Product Service');
    expect(labels).not.toContain('User Service');
    expect(labels).not.toContain('PostgreSQL DB');
  });

  it('uses production Kafka platform elements for generic Kafka prompts', async () => {
    const result = await runMermaidPipeline({
      description: 'Explain Kafka architecture',
      systemType: 'architecture',
      complexity: 'low',
      diagramSize: 'medium',
    });

    const labels = nodeLabels(result);

    expect(labels).toEqual(expect.arrayContaining([
      'Producers',
      'Consumer Groups',
      'Broker Cluster',
      'Topics',
      'Partitions',
      'Replica Logs',
      'KRaft Controllers',
      'Schema Registry',
      'Kafka Connect',
      'Lag / Health Metrics',
    ]));
  });

  it('uses Linux internal layers for generic Linux prompts', async () => {
    const result = await runMermaidPipeline({
      description: 'Linux architecture overview',
      systemType: 'architecture',
      complexity: 'low',
      diagramSize: 'medium',
    });

    const labels = nodeLabels(result);

    expect(labels).toEqual(expect.arrayContaining([
      'Applications',
      'Shell / Utilities',
      'glibc / libc',
      'System Calls',
      'Process Scheduler',
      'Memory Manager',
      'Virtual File System',
      'Network Stack',
      'LSM / cgroups',
      'Device Drivers',
    ]));
  });

  it('generalizes implicit prompts for non-templated infrastructure concepts', async () => {
    const result = await runMermaidPipeline({
      description: 'Describe Redis architecture',
      systemType: 'architecture',
      complexity: 'low',
      diagramSize: 'medium',
    });

    const labels = nodeLabels(result);

    expect(labels).toEqual(expect.arrayContaining([
      'Redis Endpoint',
      'Auth / ACLs',
      'Key Space',
      'Data Structures',
      'Eviction Policy',
      'Replication',
      'Snapshots / AOF',
      'Sharding / Cluster',
      'Hit Rate / Latency',
    ]));
    expect(labels).not.toContain('Order Service');
    expect(labels).not.toContain('Product Service');
  });

  it('falls back to a structured production grid for unknown implicit concepts', async () => {
    const result = await runMermaidPipeline({
      description: 'Describe WeirdInfra',
      systemType: 'architecture',
      complexity: 'low',
      diagramSize: 'medium',
    });

    const labels = nodeLabels(result);

    expect(labels).toEqual(expect.arrayContaining([
      'Public API',
      'Core Engine',
      'State / Metadata',
      'Configuration',
      'Policy / Rules',
      'Workers / Executors',
      'Persistent Storage',
      'Security Boundary',
      'Metrics / Logs',
      'Health / Failover',
    ]));
  });
});
