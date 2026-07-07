import { describe, it, expect } from 'vitest';
import { parseRepoNdjsonToReactFlow } from '../parseRepoNdjson';

describe('parseRepoNdjsonToReactFlow', () => {
  const nodeLine = JSON.stringify({
    id: 'api_service', label: 'API Service', layer: 'application',
    x: 100, y: 200, width: 180, height: 80,
    icon: 'webhook', serviceType: 'api',
  });

  const groupLine = JSON.stringify({
    id: 'group-data', label: 'Data Stores', isGroup: true,
    layer: 'data', x: 50, y: 400, width: 400, height: 200,
    groupLabel: 'Data Stores', groupColor: '#10b981',
  });

  const childNodeLine = JSON.stringify({
    id: 'database', label: 'PostgreSQL', layer: 'data',
    x: 20, y: 20, width: 180, height: 80,
    parentId: 'group-data', icon: 'database', serviceType: 'database',
  });

  const edgeLine = JSON.stringify({
    path: ['api_service', 'database'], label: 'queries', async: false,
    direction: 'sync', protocol: 'db',
  });

  const asyncEdgeLine = JSON.stringify({
    path: ['worker', 'queue'], label: 'publishes', async: true,
    direction: 'async', protocol: 'queue',
  });

  const workflowLine = JSON.stringify({
    type: 'workflow', name: 'Request Flow',
    description: 'Handles user requests', steps: ['api_service', 'database'],
  });

  it('parses nodes from NDJSON', () => {
    const result = parseRepoNdjsonToReactFlow(nodeLine);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('api_service');
    expect(result.nodes[0].type).toBe('systemNode');
  });

  it('parses group nodes correctly', () => {
    const lines = [groupLine, childNodeLine].join('\n');
    const result = parseRepoNdjsonToReactFlow(lines);
    expect(result.nodes).toHaveLength(2);
    const group = result.nodes.find((n) => n.id === 'group-data');
    expect(group?.type).toBe('groupNode');
    expect(group?.data?.isGroup).toBe(true);
    const child = result.nodes.find((n) => n.id === 'database');
    expect(child?.parentId).toBe('group-data');
  });

  it('parses edges from NDJSON', () => {
    const result = parseRepoNdjsonToReactFlow(nodeLine + '\n' + edgeLine);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe('api_service');
    expect(result.edges[0].target).toBe('database');
  });

  it('marks async edges as animated', () => {
    const lines = [nodeLine, asyncEdgeLine].join('\n');
    const result = parseRepoNdjsonToReactFlow(lines);
    expect(result.edges[0].animated).toBe(true);
  });

  it('parses workflow annotations', () => {
    const result = parseRepoNdjsonToReactFlow(workflowLine);
    expect(result.workflows).toHaveLength(1);
    expect(result.workflows[0].name).toBe('Request Flow');
    expect(result.workflows[0].steps).toEqual(['api_service', 'database']);
  });

  it('handles empty or whitespace-only strings', () => {
    expect(parseRepoNdjsonToReactFlow('').nodes).toHaveLength(0);
    expect(parseRepoNdjsonToReactFlow('   \n  \n').nodes).toHaveLength(0);
  });

  it('skips malformed lines', () => {
    const lines = ['not json', '{"partial": true', nodeLine].join('\n');
    const result = parseRepoNdjsonToReactFlow(lines);
    expect(result.nodes).toHaveLength(1);
  });

  it('sorts groups before regular nodes', () => {
    const lines = [childNodeLine, nodeLine, groupLine].join('\n');
    const result = parseRepoNdjsonToReactFlow(lines);
    const groupIdx = result.nodes.findIndex((n) => n.data?.isGroup);
    const childIdx = result.nodes.findIndex((n) => n.id === 'database');
    expect(groupIdx).toBeLessThan(childIdx);
  });
});
