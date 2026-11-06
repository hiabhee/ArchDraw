import type { ReactFlowNode, ReactFlowEdge } from '../types/index.js';
import type { DrawOnCanvasInput } from '../lib/schema.js';
import { getDiagramState } from '../lib/diagram-state.js';
import { applyDrawOps, DrawError, type CanvasEdge, type CanvasNode, type DrawStep } from '../lib/canvas-ops.js';
import { validateGraph } from './validate-diagram.js';
import { fetchWithTimeout, getApiBase } from '../lib/http.js';
import { describeSaveFailure, type ImageStyleName } from '../lib/preview-links.js';

/** One line per node: where it is on the canvas and how big, so the next drawing can be placed exactly. */
export interface CanvasEntry {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parent?: string;
  text?: string;
}

export interface DrawResult {
  success: boolean;
  error?: string;
  /** The operation that failed, when one did (0-based). */
  failedOperation?: number;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  steps: DrawStep[];
  canvas: CanvasEntry[];
  bounds?: { x: number; y: number; width: number; height: number };
  revision: number;
  sessionId?: string;
  updateToken?: string;
  diagramUrl?: string;
  shareUrl?: string;
  linkError?: string;
  previewSvg?: string;
  message?: string;
}

const textOf = (node: CanvasNode): string | undefined => {
  const d = node.data;
  const value = d.text ?? d.label ?? d.title;
  return typeof value === 'string' && value ? value.slice(0, 80) : undefined;
};

/** Canvas positions of every node (a node in a group stores its position relative to the group). */
export function describeCanvas(nodes: CanvasNode[]): { canvas: CanvasEntry[]; bounds?: DrawResult['bounds'] } {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const origin = (node: CanvasNode): { x: number; y: number } => {
    let x = node.position.x, y = node.position.y;
    const seen = new Set([node.id]);
    for (let p = node.parentNode ? byId.get(node.parentNode) : undefined; p && !seen.has(p.id); p = p.parentNode ? byId.get(p.parentNode) : undefined) {
      seen.add(p.id);
      x += p.position.x;
      y += p.position.y;
    }
    return { x, y };
  };
  const canvas = nodes.map(node => {
    const { x, y } = origin(node);
    const text = textOf(node);
    return {
      id: node.id, type: node.type, x: Math.round(x), y: Math.round(y),
      width: Math.round(node.width ?? 200), height: Math.round(node.height ?? 70),
      ...(node.parentNode ? { parent: node.parentNode } : {}),
      ...(text ? { text } : {}),
    };
  });
  if (canvas.length === 0) return { canvas };
  const minX = Math.min(...canvas.map(e => e.x)), minY = Math.min(...canvas.map(e => e.y));
  const maxX = Math.max(...canvas.map(e => e.x + e.width)), maxY = Math.max(...canvas.map(e => e.y + e.height));
  return { canvas, bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } };
}

const fail = (error: string, extra: Partial<DrawResult> = {}): DrawResult => ({
  success: false, error, nodes: [], edges: [], steps: [], canvas: [], revision: 0, ...extra,
});

async function preview(apiBase: string, nodes: CanvasNode[], edges: CanvasEdge[], style: ImageStyleName): Promise<string | undefined> {
  try {
    const response = await fetchWithTimeout(`${apiBase}/api/diagram/load`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes, edges, dryRun: true, preview: true, previewStyle: style }),
    });
    if (!response.ok) return undefined;
    return ((await response.json()) as { previewSvg?: string }).previewSvg;
  } catch {
    return undefined;
  }
}

export async function drawOnCanvas(input: DrawOnCanvasInput, workingSession?: string): Promise<DrawResult> {
  const state = getDiagramState(workingSession);

  let applied;
  try {
    applied = applyDrawOps(state.nodes as unknown as CanvasNode[], state.edges as unknown as CanvasEdge[], input.ops);
  } catch (error) {
    if (error instanceof DrawError) {
      return fail(`${error.message} Nothing was drawn.`, { failedOperation: error.index, revision: state.revision });
    }
    return fail(`${error instanceof Error ? error.message : 'Could not draw.'} Nothing was drawn.`, { revision: state.revision });
  }
  const { nodes, edges, steps, cleared } = applied;
  const { canvas, bounds } = describeCanvas(nodes);

  if (nodes.length > 0) {
    const errors = validateGraph(nodes as unknown as ReactFlowNode[], edges as unknown as ReactFlowEdge[]).issues.filter(issue => issue.severity === 'error');
    if (errors.length > 0) {
      return fail(`${errors.map(issue => issue.message).join(' ')} Nothing was drawn.`, { revision: state.revision });
    }
  }

  const base: DrawResult = { success: true, nodes, edges, steps, canvas, bounds, revision: state.revision };
  return publishCanvas(state, nodes, edges, base, cleared, input);
}

export interface PublishInput { label?: string; publish: boolean; style: ImageStyleName; expectedRevision?: number }

/**
 * Saves the canvas the way every drawing tool does: updated in place when it is published already
 * (with its capability token and revision), published as a new canvas for a link otherwise, or kept
 * in this session. `cleared` starts a new canvas instead of updating the old one.
 */
export async function publishCanvas(
  state: { sessionId?: string; updateToken?: string; revision: number },
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  base: DrawResult,
  cleared: boolean,
  input: PublishInput,
): Promise<DrawResult> {
  const apiBase = getApiBase();
  const links = apiBase && nodes.length > 0;

  // Start over after a `clear`: the old published canvas is not this drawing any more.
  const sessionId = cleared ? undefined : state.sessionId;
  const updateToken = cleared ? undefined : state.updateToken;

  // A published canvas is updated in place, with its capability token and revision.
  if (links && sessionId && updateToken) {
    try {
      const response = await fetchWithTimeout(`${apiBase}/api/diagram/load`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mcp-update', sessionId, updateToken, expectedRevision: input.expectedRevision ?? state.revision, nodes, edges }),
      });
      if (!response.ok) {
        return fail(response.status === 409
          ? 'The published canvas changed elsewhere. Call get_diagram_state to reload it, then draw again. Nothing was drawn.'
          : `ArchDraw could not update the published canvas (HTTP ${response.status}). Nothing was drawn.`, { revision: state.revision });
      }
      const saved = await response.json() as { sessionId: string; revision: number };
      return {
        ...base, revision: saved.revision, sessionId: saved.sessionId, updateToken,
        diagramUrl: `${apiBase}/editor?session=${saved.sessionId}`, shareUrl: `${apiBase}/share/${saved.sessionId}`,
        previewSvg: await preview(apiBase!, nodes, edges, input.style),
      };
    } catch {
      return fail('Could not reach ArchDraw to update the published canvas. Nothing was drawn.', { revision: state.revision });
    }
  }

  // A new canvas: published for a link when asked (the default), otherwise kept in this session.
  if (links && input.publish) {
    try {
      const response = await fetchWithTimeout(`${apiBase}/api/diagram/load`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, label: input.label || 'ArchDraw canvas', source: 'mcp', publish: true, preview: true, previewStyle: input.style }),
      });
      if (response.ok) {
        const saved = await response.json() as { sessionId: string; updateToken?: string; revision?: number; previewSvg?: string };
        return {
          ...base, revision: saved.revision ?? 1, sessionId: saved.sessionId, updateToken: saved.updateToken,
          diagramUrl: `${apiBase}/editor?session=${saved.sessionId}`, shareUrl: `${apiBase}/share/${saved.sessionId}`,
          previewSvg: saved.previewSvg,
        };
      }
      return { ...base, linkError: describeSaveFailure(response.status), previewSvg: await preview(apiBase!, nodes, edges, input.style) };
    } catch (error) {
      return { ...base, linkError: error instanceof Error ? error.message : 'ArchDraw could not save the canvas' };
    }
  }

  return { ...base, ...(links ? { previewSvg: await preview(apiBase!, nodes, edges, input.style) } : {}) };
}
