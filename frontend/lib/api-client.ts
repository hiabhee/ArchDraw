/**
 * Client-side API helpers for database operations.
 * These call Next.js API routes (which use Prisma server-side).
 * Never import lib/db.ts directly from client code.
 */

// ── Canvases ─────────────────────────────────────────────────────────────────

export async function fetchUserCanvases() {
  const res = await fetch('/api/user/canvases');
  if (!res.ok) throw new Error('Failed to fetch canvases');
  return res.json();
}

export async function saveUserCanvas(data: {
  id: string;
  name: string;
  nodes: unknown;
  edges: unknown;
}) {
  const res = await fetch('/api/user/canvases', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save canvas');
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
