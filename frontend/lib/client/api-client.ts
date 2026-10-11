/**
 * Client-side API helpers for database operations.
 * These call Next.js API routes (which use Prisma server-side).
 * Never import lib/server/db.ts directly from client code.
 */

// ── Canvases ─────────────────────────────────────────────────────────────────

export async function fetchUserCanvases() {
  const res = await fetch('/api/user/canvases');
  if (!res.ok) throw new Error('Failed to fetch canvases');
  return res.json();
}

// Browsers cap keepalive request bodies at 64KB.
const KEEPALIVE_MAX_BYTES = 60_000;

export async function saveUserCanvas(data: {
  id: string;
  name: string;
  nodes: unknown;
  edges: unknown;
  /** Server updatedAt (ms) this edit is based on; enables conflict detection. */
  baseUpdatedAt?: number;
}, options: { keepalive?: boolean } = {}) {
  const body = JSON.stringify(data);
  const res = await fetch('/api/user/canvases', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: Boolean(options.keepalive) && body.length < KEEPALIVE_MAX_BYTES,
  });
  if (!res.ok) {
    let details: Record<string, unknown> = {};
    let bodyText = '';
    try {
      // Clone so we can try json then text
      details = await res.clone().json();
    } catch {
      try {
        bodyText = await res.text();
        details = bodyText ? { bodyText, statusText: res.statusText } : { statusText: res.statusText };
      } catch {
        details = { statusText: res.statusText };
      }
    }
    // Ensure details is never empty for logging
    if (Object.keys(details).length === 0) {
      details = { statusText: res.statusText, bodyText };
    }
    const message =
      (details.error as string) ||
      (details.message as string) ||
      (bodyText && bodyText.slice(0, 200)) ||
      `Failed to save canvas (${res.status} ${res.statusText || 'unknown'})`;
    const err = new Error(message) as Error & {
      status: number;
      code?: string;
      details: Record<string, unknown>;
    };
    err.status = res.status;
    err.code = details.code as string | undefined;
    err.details = details;
    throw err;
  }
  return res.json();
}

export async function deleteUserCanvasApi(canvasId: string) {
  const res = await fetch(`/api/user/canvases/${encodeURIComponent(canvasId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete canvas');
  return res.json();
}

// ── Tutorial Progress ────────────────────────────────────────────────────────

export async function fetchTutorialProgress(tutorialId: string) {
  const res = await fetch(`/api/user/tutorial/${encodeURIComponent(tutorialId)}`);
  if (!res.ok) throw new Error('Failed to fetch tutorial progress');
  return res.json();
}

export async function saveTutorialProgress(data: {
  tutorialId: string;
  currentLevel: number;
  currentStep: number;
  currentPhase: string;
  completedLevels: number[];
  completedStepIds: string[];
  canvasNodes: unknown;
  canvasEdges: unknown;
  explainCount: number;
}) {
  const res = await fetch('/api/user/tutorial', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save tutorial progress');
  return res.json();
}

export async function deleteTutorialProgressApi(tutorialId: string) {
  const res = await fetch('/api/user/tutorial', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tutorialId }),
  });
  if (!res.ok) throw new Error('Failed to delete tutorial progress');
  return res.json();
}

// ── Component Templates ──────────────────────────────────────────────────────

export async function fetchComponentTemplatesByIds(ids: string[]) {
  const res = await fetch(`/api/components/templates?ids=${ids.map(encodeURIComponent).join(',')}`);
  if (!res.ok) throw new Error('Failed to fetch component templates');
  return res.json();
}

export async function fetchAllComponentTemplates() {
  const res = await fetch('/api/components/templates/all');
  if (!res.ok) throw new Error('Failed to fetch component templates');
  return res.json();
}

// ── Live projects ────────────────────────────────────────────────────────────

async function projectRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error((body as { error?: string }).error || 'Request failed') as Error & { status?: number; code?: string };
    error.status = res.status;
    error.code = (body as { code?: string }).code;
    throw error;
  }
  return body as T;
}

export interface ProjectLink {
  canvasId: string;
  agenticProjectId: string | null;
  workspaceId: string | null;
  repositoryRemote: string | null;
}

export function makeCanvasProject(canvasId: string, data: { repositoryRemote?: string | null } = {}) {
  return projectRequest<{ project: ProjectLink }>(`/api/projects/${encodeURIComponent(canvasId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function unlinkCanvasProject(canvasId: string) {
  return projectRequest<{ ok: true }>(`/api/projects/${encodeURIComponent(canvasId)}`, { method: 'DELETE' });
}

export function fetchProjectLive(canvasId: string, signal?: AbortSignal) {
  return projectRequest<import('@/lib/diagram/projects/liveActivity').ProjectLiveSnapshot>(
    `/api/projects/${encodeURIComponent(canvasId)}/live`,
    { cache: 'no-store', signal },
  );
}

export function approveAgentPairing(data: { userCode: string; projectId: string; workspaceId: string }) {
  return projectRequest<{ approved: true }>('/api/agentic/pairing/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
