import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { step } from '@/lib/tutorial/builder';
import {
  validateStep,
  getStepRequirements,
  isNodeTypeMet,
  isEdgeMet,
} from '@/lib/tutorialValidation';

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

describe('getStepRequirements', () => {
  it('extracts node and edge requirements from a built step', () => {
    const s = step({ component: 'Redis Cache', nodeType: 'in_memory_cache', parent: 'API Gateway' });
    const reqs = getStepRequirements(s);
    expect(reqs.requiredNodeTypes).toEqual(['in_memory_cache']);
    expect(reqs.requiredEdges).toHaveLength(1);
    expect(reqs.requiredEdges[0]).toMatchObject({ source: 'api_gateway', target: 'in_memory_cache' });
  });

  it('handles aliases (any_of) and nested all_of', () => {
    const s = step({ component: 'App Cache', nodeType: 'in_memory_cache', aliases: ['app_cache'], parent: 'API Gateway' });
    const reqs = getStepRequirements(s);
    expect(reqs.requiredNodeTypes).toContain('in_memory_cache');
    expect(reqs.requiredNodeTypes).toContain('app_cache');
    expect(reqs.requiredEdges).toHaveLength(1);
  });

  it('returns no edges for first (noConnect) steps', () => {
    const s = step({ component: 'Web' });
    const reqs = getStepRequirements(s);
    expect(reqs.requiredNodeTypes).toContain('web');
    expect(reqs.requiredEdges).toEqual([]);
  });
});

describe('validateStep', () => {
  it('passes when node exists', () => {
    const s = step({ component: 'API Gateway' });
    const nodes = [node('1', { label: 'API Gateway', componentId: 'api_gateway', componentType: 'api_gateway' })];
    expect(validateStep(s, nodes, []).valid).toBe(true);
  });

  it('fails with descriptive message when node missing', () => {
    const s = step({ component: 'API Gateway' });
    const result = validateStep(s, [], []);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/API Gateway/);
  });

  it('passes when connection exists between two nodes', () => {
    const s = step({ component: 'Redis Cache', nodeType: 'in_memory_cache', parent: 'API Gateway' });
    const nodes = [
      node('1', { label: 'API Gateway', componentId: 'api_gateway', componentType: 'api_gateway' }),
      node('2', { label: 'Redis Cache', componentId: 'in_memory_cache', componentType: 'in_memory_cache' }),
    ];
    const edges = [edge('e1', '1', '2')];
    expect(validateStep(s, nodes, edges).valid).toBe(true);
  });

  it('fails when both nodes exist but edge missing', () => {
    const s = step({ component: 'Redis Cache', nodeType: 'in_memory_cache', parent: 'API Gateway' });
    const nodes = [
      node('1', { label: 'API Gateway', componentId: 'api_gateway', componentType: 'api_gateway' }),
      node('2', { label: 'Redis Cache', componentId: 'in_memory_cache', componentType: 'in_memory_cache' }),
    ];
    const result = validateStep(s, nodes, []);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/Connect/);
  });
});

describe('isNodeTypeMet / isEdgeMet', () => {
  const nodes = [
    node('1', { label: 'API Gateway', componentId: 'api_gateway', category: 'compute', componentType: 'api_gateway' }),
    node('2', { label: 'API Gateway', componentId: 'api_gateway', category: 'compute', componentType: 'api_gateway' }),
  ];
  const edges = [edge('e1', '1', '2')];

  it('isNodeTypeMet matches type, category, or label', () => {
    expect(isNodeTypeMet('api_gateway', nodes)).toBe(true);
    expect(isNodeTypeMet('compute', nodes)).toBe(true);
    expect(isNodeTypeMet('API Gateway', nodes)).toBe(true);
    expect(isNodeTypeMet('cdn', nodes)).toBe(false);
  });

  it('isEdgeMet passes when any pair of matching nodes is connected', () => {
    expect(isEdgeMet('api_gateway', 'api_gateway', nodes, edges)).toBe(true);
    expect(isEdgeMet('cdn', 'api_gateway', nodes, edges)).toBe(false);
  });
});
