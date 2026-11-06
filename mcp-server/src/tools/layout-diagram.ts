import type { LayoutDiagramInput } from '../lib/schema.js';
import { getDiagramState } from '../lib/diagram-state.js';
import type { CanvasEdge, CanvasNode } from '../lib/canvas-ops.js';
import { fetchWithTimeout, getApiBase } from '../lib/http.js';
import { describeCanvas, publishCanvas, type DrawResult } from './draw-on-canvas.js';

const fail = (error: string, revision = 0): DrawResult => ({
  success: false, error, nodes: [], edges: [], steps: [], canvas: [], revision,
});

/**
 * Re-arranges the current diagram with ArchDraw's own layout engine (the one the toolbar's layout
 * toggle uses): direction, flow or zones, wrapping, per-group direction. Nothing is added or
 * removed: only positions and sizes change.
 */
export async function layoutDiagram(input: LayoutDiagramInput, workingSession?: string): Promise<DrawResult> {
  const state = getDiagramState(workingSession);
  if (state.nodes.length === 0) return fail('There is nothing to lay out: the canvas is empty. Draw or generate a diagram first.', state.revision);
  const apiBase = getApiBase();
  if (!apiBase) return fail('Layout needs the ArchDraw API (API_BASE_URL is not set), so nothing was changed.', state.revision);

  const known = new Set(state.nodes.map(node => node.id));
  const unknown = Object.keys(input.groupDirections ?? {}).filter(id => !known.has(id));
  if (unknown.length > 0) return fail(`groupDirections names unknown node id(s): ${unknown.join(', ')}. Nothing was changed.`, state.revision);

  const nodes = (state.nodes as unknown as CanvasNode[]).map(node => {
    const direction = input.groupDirections?.[node.id];
    return direction ? { ...node, data: { ...node.data, direction } } : node;
  });

  let laid: { nodes: CanvasNode[]; edges: CanvasEdge[]; warnings?: string[] };
  try {
    const response = await fetchWithTimeout(`${apiBase}/api/diagram/load`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodes, edges: state.edges, dryRun: true,
        layout: { direction: input.direction, style: input.arrangement, foldLongFlows: input.fold, mixGroupDirections: input.mixDirections, profile: 'studio-minimal' },
      }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({})) as { error?: string };
      return fail(`${detail.error ?? `ArchDraw could not lay the diagram out (HTTP ${response.status}).`} Nothing was changed.`, state.revision);
    }
    laid = await response.json() as typeof laid;
  } catch {
    return fail('Could not reach ArchDraw to lay the diagram out. Nothing was changed.', state.revision);
  }

  const { canvas, bounds } = describeCanvas(laid.nodes);
  const base: DrawResult = { success: true, nodes: laid.nodes, edges: laid.edges, steps: [], canvas, bounds, revision: state.revision, message: laid.warnings?.length ? laid.warnings.join(' ') : undefined };
  return publishCanvas(state, laid.nodes, laid.edges, base, false, input);
}
