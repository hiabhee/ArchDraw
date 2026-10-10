import type { ReactFlowNode, ReactFlowEdge } from '../types/index.js';
import { fetchWithTimeout } from './http.js';

export interface DiagramState {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  sessionId?: string;
  /** Opaque capability used only to update an explicitly published diagram. */
  updateToken?: string;
  revision: number;
}

const states = new Map<string, DiagramState>();

export const DEFAULT_WORKING_SESSION = 'default';

function copy(state: DiagramState): DiagramState {
  return {
    nodes: state.nodes.map(node => ({ ...node, position: { ...node.position }, data: { ...node.data } })),
    edges: state.edges.map(edge => ({ ...edge, data: edge.data ? { ...edge.data } : edge.data })),
    ...(state.sessionId ? { sessionId: state.sessionId } : {}),
    ...(state.updateToken ? { updateToken: state.updateToken } : {}),
    revision: state.revision,
  };
}

export function getDiagramState(workingSession = DEFAULT_WORKING_SESSION): DiagramState {
  const state = states.get(workingSession);
  return state ? copy(state) : { nodes: [], edges: [], revision: 0 };
}

export function setDiagramState(state: Omit<DiagramState, 'revision'> & { revision?: number }, workingSession = DEFAULT_WORKING_SESSION): DiagramState {
  const previous = states.get(workingSession);
  const next: DiagramState = {
    ...state,
    revision: state.revision ?? (previous?.revision ?? 0) + 1,
  };
  states.set(workingSession, copy(next));
  return copy(next);
}

export function setDiagramSessionId(sessionId: string | undefined, workingSession = DEFAULT_WORKING_SESSION): void {
  if (!sessionId) return;
  const state = getDiagramState(workingSession);
  setDiagramState({ ...state, sessionId }, workingSession);
}

export function hasDiagramState(workingSession = DEFAULT_WORKING_SESSION): boolean {
  return states.has(workingSession);
}

/**
 * Pull the latest diagram for a session from the frontend API and use it as the
 * local working state. Sessions are intentionally world-readable (sharedCanvas),
 * so this is a read-only sync — safe to call without auth. Returns false if the
 * session is missing or the API is unreachable (local state is left untouched).
 */
export async function syncDiagramStateFromSession(
  sessionId: string,
  apiBase?: string,
  workingSession = DEFAULT_WORKING_SESSION
): Promise<boolean> {
  const API_BASE = apiBase || process.env.API_BASE_URL;
  if (!API_BASE) return false;
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/diagram/session/${encodeURIComponent(sessionId)}`);
    if (!response.ok) return false;
    const data = await response.json() as { nodes?: ReactFlowNode[]; edges?: ReactFlowEdge[] };
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) return false;
    setDiagramState({ nodes: data.nodes, edges: data.edges, sessionId }, workingSession);
    return true;
  } catch {
    return false;
  }
}
