import type { ReactFlowEdge, ReactFlowNode } from '../types/index.js';
import type { FixLayoutInput } from '../lib/schema.js';
import { fetchWithTimeout } from '../lib/http.js';

function escapeMermaidLabel(value: string): string {
  return value.replaceAll('"', "'").replaceAll('\n', ' ');
}

/** Layout via the canonical Mermaid → Dagre editor pipeline. */
export async function fixLayout(input: FixLayoutInput): Promise<{
  success: boolean;
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  elkPositions: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  metadata: { nodeCount: number; edgeCount: number; layoutAlgorithm: string; direction: string };
  errors?: string[];
}> {
  const apiBase = process.env.API_BASE_URL;
  if (!apiBase) {
    return { success: false, nodes: [], edges: [], elkPositions: [], metadata: { nodeCount: 0, edgeCount: 0, layoutAlgorithm: 'Mermaid → Dagre', direction: input.direction }, errors: ['fix_layout requires API_BASE_URL so it can use the ArchDraw editor layout pipeline.'] };
  }

  const direction = input.direction === 'DOWN' || input.direction === 'UP' ? 'TD' : 'LR';
  const lines = [`graph ${direction}`];
  for (const node of input.nodes) lines.push(`  ${node.id}["${escapeMermaidLabel(node.label)}"]`);
  for (const edge of input.edges) lines.push(`  ${edge.source} --> ${edge.target}`);

  try {
    const response = await fetchWithTimeout(`${apiBase}/api/diagram/load`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mermaid: lines.join('\n'), dryRun: true }),
    });
    if (!response.ok) {
      return { success: false, nodes: [], edges: [], elkPositions: [], metadata: { nodeCount: 0, edgeCount: 0, layoutAlgorithm: 'Mermaid → Dagre', direction: input.direction }, errors: ['The ArchDraw layout pipeline rejected this graph.'] };
    }
    const diagram = await response.json() as { nodes: ReactFlowNode[]; edges: ReactFlowEdge[]; warnings?: string[] };
    return {
      success: true,
      nodes: diagram.nodes,
      edges: diagram.edges,
      elkPositions: diagram.nodes.map(node => ({ id: node.id, x: node.position.x, y: node.position.y, width: node.width || 0, height: node.height || 0 })),
      metadata: { nodeCount: diagram.nodes.length, edgeCount: diagram.edges.length, layoutAlgorithm: 'Mermaid → Dagre', direction: input.direction },
      errors: diagram.warnings,
    };
  } catch (error) {
    return { success: false, nodes: [], edges: [], elkPositions: [], metadata: { nodeCount: 0, edgeCount: 0, layoutAlgorithm: 'Mermaid → Dagre', direction: input.direction }, errors: [error instanceof Error ? error.message : 'Layout request failed'] };
  }
}
