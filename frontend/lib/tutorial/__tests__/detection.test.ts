import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { evaluateValidationRule, validateRules } from '@/lib/tutorial/detection';

function node(
  id: string,
  data: Partial<Node['data']> = {},
  type = 'systemNode'
): Node {
  return { id, type, position: { x: 0, y: 0 }, data: { ...data } } as Node;
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target } as Edge;
}

const web = node('1', { label: 'Web', componentId: 'web_client', category: 'client', componentType: 'client_web' });
const apiGateway = node('2', { label: 'API Gateway', componentId: 'api_gateway', category: 'compute', componentType: 'api_gateway' });
const cache = node('3', { label: 'Redis', componentId: 'in_memory_cache', category: 'data', componentType: 'in_memory_cache' });

const nodes = [web, apiGateway, cache];
const edges = [edge('e1', '1', '2'), edge('e2', '2', '3')];

describe('evaluateValidationRule', () => {
  it('node_exists matches exact componentId', () => {
    expect(evaluateValidationRule({ type: 'node_exists', nodeType: 'api_gateway' }, nodes, edges)).toBe(true);
  });

  it('node_exists matches by nodeType via componentType/typeId', () => {
    expect(evaluateValidationRule({ type: 'node_exists', nodeType: 'client_web' }, nodes, edges)).toBe(true);
  });

  it('node_exists matches by category', () => {
    expect(evaluateValidationRule({ type: 'node_exists', nodeType: 'client' }, nodes, edges)).toBe(true);
  });

  it('node_exists respects label when provided', () => {
    const rule = { type: 'node_exists' as const, nodeType: 'api_gateway', label: 'API Gateway' };
    expect(evaluateValidationRule(rule, nodes, edges)).toBe(true);
    // Exact registry id wins even if the label differs (authoritative match)
    const wrongLabel = { type: 'node_exists' as const, nodeType: 'api_gateway', label: 'CDN' };
    expect(evaluateValidationRule(wrongLabel, nodes, edges)).toBe(true);
    expect(evaluateValidationRule({ type: 'node_exists', nodeType: 'cdn', label: 'CDN' }, nodes, edges)).toBe(false);
  });

  it('node_exists matches by label when id is not authoritative', () => {
    const cdnNode = node('9', { label: 'CDN', category: 'external', componentType: 'cdn' });
    expect(evaluateValidationRule({ type: 'node_exists', nodeType: 'cdn', label: 'CDN' }, [cdnNode], edges)).toBe(true);
    const wrongLabel = { type: 'node_exists' as const, nodeType: 'cdn', label: 'Database' };
    expect(evaluateValidationRule(wrongLabel, [cdnNode], edges)).toBe(false);
  });

  it('node_exists is false when node is missing', () => {
    expect(evaluateValidationRule({ type: 'node_exists', nodeType: 'message_broker' }, nodes, edges)).toBe(false);
  });

  it('node_count counts matches and requires min', () => {
    expect(evaluateValidationRule({ type: 'node_count', nodeType: 'client_web', min: 1 }, nodes, edges)).toBe(true);
    expect(evaluateValidationRule({ type: 'node_count', nodeType: 'api_gateway', min: 2 }, nodes, edges)).toBe(false);
  });

  it('edge_exists matches by node id', () => {
    expect(evaluateValidationRule({ type: 'edge_exists', source: 'web_client', target: 'api_gateway' }, nodes, edges)).toBe(true);
  });

  it('edge_exists matches by label', () => {
    expect(evaluateValidationRule({ type: 'edge_exists', source: 'Web', target: 'API Gateway' }, nodes, edges)).toBe(true);
  });

  it('edge_exists is false when only one side exists', () => {
    expect(evaluateValidationRule({ type: 'edge_exists', source: 'web_client', target: 'message_broker' }, nodes, edges)).toBe(false);
  });

  it('edge_exists passes when any of multiple source nodes connects to target', () => {
    const extraWeb = node('4', { label: 'Web', componentId: 'web_client', category: 'client', componentType: 'client_web' });
    const withExtra = [...nodes, extraWeb];
    const e1a = edge('e1', '4', '2');
    expect(evaluateValidationRule({ type: 'edge_exists', source: 'web_client', target: 'api_gateway' }, withExtra, [...edges, e1a])).toBe(true);
  });

  it('edge_from_type matches by nodeType', () => {
    expect(evaluateValidationRule({ type: 'edge_from_type', sourceType: 'client_web', targetType: 'api_gateway' }, nodes, edges)).toBe(true);
    expect(evaluateValidationRule({ type: 'edge_from_type', sourceType: 'api_gateway', targetType: 'client_web' }, nodes, edges)).toBe(false);
  });

  it('all_of requires every rule', () => {
    const ok = { type: 'all_of' as const, rules: [
      { type: 'node_exists' as const, nodeType: 'web_client' },
      { type: 'node_exists' as const, nodeType: 'api_gateway' },
    ]};
    expect(evaluateValidationRule(ok, nodes, edges)).toBe(true);

    const bad = { type: 'all_of' as const, rules: [
      { type: 'node_exists' as const, nodeType: 'web_client' },
      { type: 'node_exists' as const, nodeType: 'message_broker' },
    ]};
    expect(evaluateValidationRule(bad, nodes, edges)).toBe(false);
  });

  it('any_of passes when at least one rule holds (aliases)', () => {
    const aliased = { type: 'any_of' as const, rules: [
      { type: 'node_exists' as const, nodeType: 'app_cache' },
      { type: 'node_exists' as const, nodeType: 'in_memory_cache' },
    ]};
    expect(evaluateValidationRule(aliased, nodes, edges)).toBe(true);

    const none = { type: 'any_of' as const, rules: [
      { type: 'node_exists' as const, nodeType: 'app_cache' },
      { type: 'node_exists' as const, nodeType: 'cdn' },
    ]};
    expect(evaluateValidationRule(none, nodes, edges)).toBe(false);
  });
});

describe('validateRules', () => {
  it('reports unmet rules', () => {
    const result = validateRules([
      { type: 'node_exists', nodeType: 'web_client' },
      { type: 'node_exists', nodeType: 'message_broker' },
    ], nodes, edges);
    expect(result.passed).toBe(false);
    expect(result.unmetRules).toHaveLength(1);
    expect(result.unmetRules[0]).toMatchObject({ nodeType: 'message_broker' });
  });

  it('passes when all rules are met', () => {
    const result = validateRules([
      { type: 'node_exists', nodeType: 'web_client' },
      { type: 'edge_exists', source: 'web_client', target: 'api_gateway' },
    ], nodes, edges);
    expect(result.passed).toBe(true);
    expect(result.unmetRules).toEqual([]);
  });
});
