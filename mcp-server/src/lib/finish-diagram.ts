import type { DiagramState } from './diagram-state.js';
import { diagramPipeline } from './diagram-pipeline.js';
import { fetchWithTimeout, getApiBase } from './http.js';
import { checkLayout } from './layout-check.js';
import { describeCanvas } from '../tools/draw-on-canvas.js';
import type { CanvasNode } from './canvas-ops.js';

type Graph = Pick<DiagramState, 'nodes' | 'edges' | 'direction'>;

const namedCardTypes = new Set(['shapeNode', 'systemNode', 'architectureNode', 'custom']);

export async function finishDiagram(state: DiagramState, allowBlankCards: boolean) {
  const unnamed = state.nodes.filter(node =>
    namedCardTypes.has(node.type) && !String(node.data?.label ?? '').replace(/<br\s*\/?>|[\u200B-\u200D\uFEFF]/gi, '').trim(),
  );
  if (!allowBlankCards && unnamed.length) {
    return { error: `These cards need visible names: ${unnamed.map(node => node.id).join(', ')}. Supply their actual names or remove unintended cards in the same working session before showing the result.` };
  }

  const result = diagramPipeline ? await diagramPipeline.prepareMcpResult(state.nodes, state.edges, state.direction) : {
    nodes: state.nodes,
    direction: state.direction,
    collisions: checkLayout(describeCanvas(state.nodes as unknown as CanvasNode[]).canvas)
      .filter(issue => issue.kind === 'overlap').map(issue => issue.ids),
  };
  if (result.collisions.length) {
    const pairs = result.collisions.slice(0, 10).map(ids => ids.join(' and ')).join(', ');
    return { error: `The final canvas still has overlapping cards: ${pairs}. Re-layout the same working session before showing it.` };
  }
  return { result };
}

/** Refresh the existing published snapshot before handing out its links. */
export async function syncFinishedDiagram(state: DiagramState, nodes: Graph['nodes']): Promise<number | undefined> {
  const api = getApiBase();
  if (!api || !state.sessionId || !state.updateToken) return undefined;
  try {
    const response = await fetchWithTimeout(`${api}/api/diagram/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'mcp-update', sessionId: state.sessionId, updateToken: state.updateToken,
        expectedRevision: state.revision, nodes, edges: state.edges,
      }),
    });
    if (!response.ok) return undefined;
    const updated = await response.json() as { revision?: number };
    return updated.revision;
  } catch {
    return undefined;
  }
}
