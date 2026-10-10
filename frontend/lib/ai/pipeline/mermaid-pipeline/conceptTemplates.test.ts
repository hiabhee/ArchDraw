import { describe, expect, it } from 'vitest';
import { detectImplicitConceptPrompt, getConceptTemplatePlan, trimMermaidByDetailLevel } from './conceptTemplates';
import { runAiMermaidPipelineV2 } from './pipeline-v2';

function nodeLabels(result: Awaited<ReturnType<typeof runAiMermaidPipelineV2>>): string[] {
  if (!result.success) throw new Error(result.error.message);
  return result.data.nodes.map((node) => String((node as { data?: { label?: unknown } }).data?.label ?? ''));
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
    expect(detectImplicitConceptPrompt('Describe WeirdInfra')).toBeNull();

    // Conversational prompts must be reduced to the subject, not the full
    // prompt (otherwise the prompt leaks into template node labels).
    expect(detectImplicitConceptPrompt('Can you describe Redis in detail')).toMatchObject({ subject: 'Redis', domain: 'cache' });
    expect(detectImplicitConceptPrompt('Could you please explain Postgres in depth')).toMatchObject({ subject: 'Postgres', domain: 'database' });
    expect(detectImplicitConceptPrompt('What is Redis?')).toMatchObject({ subject: 'Redis', domain: 'cache' });

    const redisPlan = getConceptTemplatePlan({ subject: 'Can You Describe Redis In Detail', domain: 'cache' });
    expect(redisPlan.mermaidCode).toContain('Can You Describe Redis In Detail Endpoint');
    const redisConcept = detectImplicitConceptPrompt('Can you describe Redis in detail');
    expect(redisConcept).not.toBeNull();
    const cleanPlan = getConceptTemplatePlan(redisConcept!, 3);
    expect(cleanPlan.mermaidCode).toContain('Redis Endpoint');
    expect(cleanPlan.mermaidCode).not.toContain('Can You Describe Redis In Detail');
    expect(detectImplicitConceptPrompt('Describe Docker Swarm architecture')).toBeNull();
    expect(detectImplicitConceptPrompt('Describe API Gateway for my ecommerce backend')).toBeNull();
    expect(detectImplicitConceptPrompt('Kafka architecture for payment events using schema registry')).toBeNull();
    expect(detectImplicitConceptPrompt('Describe a agent loop in coding agent')).toBeNull();
    expect(detectImplicitConceptPrompt('Explain middleware handler pattern')).toBeNull();
    expect(detectImplicitConceptPrompt('Describe compiler framework architecture')).toBeNull();
  });

  it('uses canonical Docker Engine components for generic Docker architecture', async () => {
    const result = await runAiMermaidPipelineV2({
      description: 'Describe Docker architecture',
      systemType: 'architecture',
      complexity: 'low',
      diagramSize: 'large',
      detailLevel: 3,
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
    const result = await runAiMermaidPipelineV2({
      description: 'Describe API Gateway',
      systemType: 'architecture',
      complexity: 'low',
      diagramSize: 'large',
      detailLevel: 3,
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
    const result = await runAiMermaidPipelineV2({
      description: 'Explain Kafka architecture',
      systemType: 'architecture',
      complexity: 'low',
      diagramSize: 'large',
      detailLevel: 3,
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
    const result = await runAiMermaidPipelineV2({
      description: 'Linux architecture overview',
      systemType: 'architecture',
      complexity: 'low',
      diagramSize: 'large',
      detailLevel: 3,
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
    const result = await runAiMermaidPipelineV2({
      description: 'Describe Redis architecture',
      systemType: 'architecture',
      complexity: 'low',
      diagramSize: 'large',
      detailLevel: 3,
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

  it('trims trailing concept subgraphs for L2 detail', () => {
    const mermaid = `graph LR
  subgraph A["A"]
    a1["A1"]
  end
  subgraph B["B"]
    b1["B1"]
  end
  subgraph C["C"]
    c1["C1"]
  end
  subgraph OPS["Operations"]
    o1["Metrics"]
  end
  a1 --> b1
  b1 --> c1
  c1 --> o1
`;
    const trimmed = trimMermaidByDetailLevel(mermaid, 2);
    expect(trimmed).toContain('subgraph A');
    expect(trimmed).toContain('subgraph B');
    expect(trimmed).toContain('subgraph C');
    expect(trimmed).not.toContain('subgraph OPS');
    expect(trimmed).not.toContain('Metrics');
    expect(trimmed).toContain('a1 --> b1');
    expect(trimmed).toContain('b1 --> c1');
    expect(trimmed).not.toContain('c1 --> o1');
  });

  it('does not add a title directive by default (opt-in only)', () => {
    const plan = getConceptTemplatePlan({ subject: 'Docker', domain: 'container-runtime', template: 'docker' }, 3);
    expect(plan.mermaidCode).not.toContain('%% archdraw-text');
    const redisPlan = getConceptTemplatePlan({ subject: 'Redis', domain: 'cache' }, 3);
    expect(redisPlan.mermaidCode).not.toContain('%% archdraw-text');
  });

  it('preserves an explicit title directive when trimming OPS bands', () => {
    const mermaid = `graph LR
  %% archdraw-text: {"id":"title","text":"Kafka","size":"heading","anchor":"top"}
  subgraph A["A"]
    a1["A1"]
  end
  subgraph B["B"]
    b1["B1"]
  end
  subgraph C["C"]
    c1["C1"]
  end
  subgraph OPS["Operations"]
    o1["Metrics"]
  end
  a1 --> b1
  b1 --> c1
  c1 --> o1
`;
    const trimmed = trimMermaidByDetailLevel(mermaid, 2);
    expect(trimmed).toContain('%% archdraw-text: {"id":"title","text":"Kafka","size":"heading","anchor":"top"}');
    expect(trimmed).not.toContain('subgraph OPS');
    expect(trimmed).not.toContain('Metrics');
    expect(trimmed).toContain('a1 --> b1');
    expect(trimmed).toContain('b1 --> c1');
    expect(trimmed).not.toContain('c1 --> o1');
  });
});

