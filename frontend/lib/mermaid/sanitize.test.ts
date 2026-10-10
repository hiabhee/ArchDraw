import { describe, expect, it } from 'vitest';
import { unwrapDomainResult } from '@/lib/pipeline-core';
import { parseMermaid } from './parse';
import { sanitizeMermaidAST } from './sanitize';

function parseGraph(source: string) {
  const result = parseMermaid(source);
  if (!result.ok) throw new Error(result.errors.map(error => error.reason).join(', '));
  return result.ast;
}

describe('generated diagram edge clarity', () => {
  it('merges parallel interactions into one readable relationship', () => {
    const result = sanitizeMermaidAST(parseGraph(`graph LR
      api[API] -->|reads| db[(Database)]
      api -->|writes| db`), { reduceRedundantEdges: true });

    expect(result.ast.edges).toHaveLength(1);
    expect(result.ast.edges[0].label).toBe('reads + writes');
    expect(result.warnings).toContain('[EDGE_CLARITY] Merged parallel edges api->db');
  });

  it('removes generic mirrored responses but preserves a distinct return operation', () => {
    const generic = sanitizeMermaidAST(parseGraph(`graph LR
      serviceA[Service A] -->|requests| serviceB[Service B]
      serviceB -->|response| serviceA`), { reduceRedundantEdges: true });
    expect(generic.ast.edges.map(edge => edge.label)).toEqual(['requests']);

    const distinct = sanitizeMermaidAST(parseGraph(`graph LR
      serviceA[Service A] -->|requests| serviceB[Service B]
      serviceB -->|returns token| serviceA`), { reduceRedundantEdges: true });
    expect(distinct.ast.edges).toHaveLength(2);
  });

  it('removes a dense long shortcut when an alternate path already explains the flow', () => {
    const result = sanitizeMermaidAST(parseGraph(`graph LR
      client[Client] --> gateway{{Gateway}}
      gateway --> service[Service]
      service --> db[(Database)]
      client -->|reads data| db
      gateway -->|direct data| db`), { reduceRedundantEdges: true });

    expect(result.ast.edges.some(edge => edge.source === 'client' && edge.target === 'db')).toBe(false);
    expect(result.ast.edges.some(edge => edge.source === 'gateway' && edge.target === 'db')).toBe(false);
    expect(result.ast.edges).toHaveLength(3);
  });

  it('does not change Mermaid unless the generated-diagram option is enabled', () => {
    const source = `graph LR
      client[Client] --> gateway{{Gateway}}
      gateway --> service[Service]
      service --> db[(Database)]
      client -->|reads data| db
      gateway -->|direct data| db`;
    const result = sanitizeMermaidAST(parseGraph(source));

    expect(result.ast.edges).toHaveLength(5);
  });

  it('applies the clarity pass through the production Mermaid pipeline', async () => {
    const { runMermaidPipeline } = await import('./pipeline');
    const data = unwrapDomainResult(await runMermaidPipeline(`graph LR
      client[Client] --> gateway{{Gateway}}
      gateway --> service[Service]
      service --> db[(Database)]
      client -->|reads data| db
      gateway -->|direct data| db`, { reduceRedundantEdges: true }));

    expect(data.edges.some(edge => edge.source === 'client' && edge.target === 'db')).toBe(false);
    expect(data.edges).toHaveLength(3);
  });
});
