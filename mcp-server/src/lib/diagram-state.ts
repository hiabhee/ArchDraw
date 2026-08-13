import type { ReactFlowNode, ReactFlowEdge } from '../types/index.js';
import { fetchWithTimeout } from './http.js';

export interface DiagramState {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  sessionId?: string;
}

let currentDiagramState: DiagramState | null = null;

export function getDiagramState(): DiagramState {
  if (!currentDiagramState) {
    return { nodes: [], edges: [] };
  }
  return {
    nodes: [...currentDiagramState.nodes],
    edges: [...currentDiagramState.edges],
    ...(currentDiagramState.sessionId ? { sessionId: currentDiagramState.sessionId } : {}),
  };
}

export function setDiagramState(state: DiagramState): void {
  currentDiagramState = {
    nodes: [...state.nodes],
    edges: [...state.edges],
    ...(state.sessionId ? { sessionId: state.sessionId } : {}),
  };
}

export function setDiagramSessionId(sessionId: string | undefined): void {
  if (!sessionId) return;
  if (!currentDiagramState) {
    currentDiagramState = { nodes: [], edges: [], sessionId };
  } else {
    currentDiagramState.sessionId = sessionId;
  }
}

export function hasDiagramState(): boolean {
  return currentDiagramState !== null;
}

/**
 * Pull the latest diagram for a session from the frontend API and use it as the
 * local working state. Sessions are intentionally world-readable (sharedCanvas),
 * so this is a read-only sync — safe to call without auth. Returns false if the
 * session is missing or the API is unreachable (local state is left untouched).
 */
export async function syncDiagramStateFromSession(
  sessionId: string,
  apiBase?: string
): Promise<boolean> {
  const API_BASE = apiBase || process.env.API_BASE_URL || 'http://localhost:3000';
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/diagram/session/${encodeURIComponent(sessionId)}`);
    if (!response.ok) return false;
    const data = await response.json() as { nodes?: ReactFlowNode[]; edges?: ReactFlowEdge[] };
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) return false;
    setDiagramState({ nodes: data.nodes, edges: data.edges, sessionId });
    return true;
  } catch {
    return false;
  }
}
