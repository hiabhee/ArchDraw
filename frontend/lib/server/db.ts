import prisma from '@/lib/server/prisma';
import { isAutoCanvasName } from '@/lib/diagram/canvas/canvasNames';
import { type Prisma } from '@/src/generated/prisma/client';

type InputJson = Prisma.InputJsonValue;

// ── Profile ──────────────────────────────────────────────────────────────────
// RLS equivalent: users can only read/update their own profile

export async function getProfile(userId: string) {
  return prisma.profile.findUnique({ where: { id: userId } });
}

export async function upsertProfile(userId: string, data: { email?: string; fullName?: string; avatarUrl?: string; provider?: string }) {
  return prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, ...data },
    update: data,
  });
}

// ── User Canvases ────────────────────────────────────────────────────────────
// RLS equivalent: users can only CRUD their own canvases

export async function getUserCanvases(userId: string) {
  return prisma.userCanvas.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}

export class CanvasOwnershipError extends Error {
  constructor(public canvasId: string) {
    super(`Canvas ${canvasId} is owned by another user`);
    this.name = 'CanvasOwnershipError';
  }
}

export class CanvasConflictError extends Error {
  constructor(public canvasId: string, public serverUpdatedAt: Date | null) {
    super(`Canvas ${canvasId} was changed elsewhere`);
    this.name = 'CanvasConflictError';
  }
}

export async function upsertUserCanvas(userId: string, data: {
  id: string;
  name: string;
  nodes: InputJson;
  edges: InputJson;
  /**
   * Server `updatedAt` (ms) the client last saw. When present, the write only
   * applies if nobody saved since — otherwise CanvasConflictError. Omitted for
   * brand-new canvases and explicit "keep mine" overwrites.
   */
  baseUpdatedAt?: number;
}) {
  const { baseUpdatedAt, ...canvas } = data;
  // Defense-in-depth: Prisma's upsert keys only on the globally-unique `id`,
  // so without an ownership check an attacker who knows a canvas id could
  // overwrite a victim's canvas. Verify ownership before upserting; routes
  // are expected to gate too, but a buggy/missing route gate must not turn
  // into a data-loss privilege escalation.
  const existing = await prisma.userCanvas.findUnique({
    where: { id: canvas.id },
    select: { userId: true, name: true, agenticProjectId: true },
  });
  if (existing && existing.userId !== userId) {
    throw new CanvasOwnershipError(canvas.id);
  }
  // A linked agent names an auto-named project canvas after its repository
  // (without bumping updatedAt). A tab that saves before its next live poll
  // still carries the generated name; don't let that undo the rename.
  if (existing?.agenticProjectId && isAutoCanvasName(canvas.name) && !isAutoCanvasName(existing.name)) {
    canvas.name = existing.name;
  }

  if (existing && baseUpdatedAt !== undefined) {
    // Conditional write: compare-and-set on updatedAt so two tabs/devices
    // can't silently overwrite each other (last-write-wins).
    const updated = await prisma.userCanvas.updateMany({
      where: { id: canvas.id, userId, updatedAt: { lte: new Date(baseUpdatedAt) } },
      data: { name: canvas.name, nodes: canvas.nodes, edges: canvas.edges },
    });
    const row = await prisma.userCanvas.findUnique({ where: { id: canvas.id } });
    if (updated.count === 0) {
      throw new CanvasConflictError(canvas.id, row?.updatedAt ?? null);
    }
    return row;
  }

  return prisma.userCanvas.upsert({
    where: { id: canvas.id },
    create: { ...canvas, userId },
    update: { name: canvas.name, nodes: canvas.nodes, edges: canvas.edges },
  });
}

export async function deleteUserCanvas(userId: string, canvasId: string) {
  // Enforce ownership (RLS equivalent)
  return prisma.userCanvas.deleteMany({
    where: { id: canvasId, userId },
  });
}

// ── Tutorial Progress ────────────────────────────────────────────────────────
// RLS equivalent: users can only CRUD their own progress

export async function getTutorialProgress(userId: string, tutorialId: string) {
  return prisma.tutorialProgress.findUnique({
    where: { userId_tutorialId: { userId, tutorialId } },
  });
}

export async function upsertTutorialProgress(userId: string, data: {
  tutorialId: string;
  currentLevel: number;
  currentStep: number;
  currentPhase: string;
  completedLevels: number[];
  canvasNodes: InputJson;
  canvasEdges: InputJson;
  explainCount: number;
}) {
  return prisma.tutorialProgress.upsert({
    where: { userId_tutorialId: { userId, tutorialId: data.tutorialId } },
    create: { userId, ...data },
    update: {
      currentLevel: data.currentLevel,
      currentStep: data.currentStep,
      currentPhase: data.currentPhase,
      completedLevels: data.completedLevels,
      canvasNodes: data.canvasNodes,
      canvasEdges: data.canvasEdges,
      explainCount: data.explainCount,
    },
  });
}

export async function deleteTutorialProgress(userId: string, tutorialId: string) {
  return prisma.tutorialProgress.deleteMany({
    where: { userId, tutorialId },
  });
}

export async function getTutorialCachedResponse(questionHash: string) {
  return prisma.tutorialResponseCache.findUnique({
    where: { questionHash },
  });
}

export async function upsertTutorialCachedResponse(questionHash: string, response: string) {
  return prisma.tutorialResponseCache.upsert({
    where: { questionHash },
    create: { questionHash, response },
    update: { response },
  });
}

// ── Shared Canvases ──────────────────────────────────────────────────────────
// RLS equivalent: anyone can read/insert (public)

export async function getSharedCanvas(id: string) {
  return prisma.sharedCanvas.findUnique({ where: { id } });
}

export async function createSharedCanvas(data: {
  canvasName: string;
  nodes: InputJson;
  edges: InputJson;
}) {
  return prisma.sharedCanvas.create({ data });
}

// ── Component Templates + Categories ─────────────────────────────────────────
// RLS equivalent: public read

export async function getComponentTemplatesByIds(ids: string[]) {
  return prisma.componentTemplate.findMany({
    where: { id: { in: ids } },
    include: { category: { select: { name: true } } },
  });
}

export async function getAllComponentTemplates() {
  return prisma.componentTemplate.findMany({
    include: { category: { select: { name: true } } },
  });
}

// ── Visitors ─────────────────────────────────────────────────────────────────
// Analytics tables — accessed via service role (admin) only, no user RLS

export async function getVisitorByAnonId(anonId: string) {
  return prisma.visitor.findUnique({
    where: { anonId },
    select: { id: true, firstReferrer: true },
  });
}

export async function upsertVisitor(data: {
  anonId: string;
  lastSeenAt?: Date;
  userAgent?: string;
  isInternal?: boolean;
  country?: string;
  firstReferrer?: string;
  firstUtm?: InputJson;
}) {
  return prisma.visitor.upsert({
    where: { anonId: data.anonId },
    create: {
      anonId: data.anonId,
      lastSeenAt: data.lastSeenAt ?? new Date(),
      userAgent: data.userAgent,
      isInternal: data.isInternal ?? false,
      country: data.country,
      firstReferrer: data.firstReferrer,
      firstUtm: data.firstUtm ?? undefined,
    },
    update: {
      lastSeenAt: data.lastSeenAt ?? new Date(),
      userAgent: data.userAgent,
      isInternal: data.isInternal,
      country: data.country,
    },
  });
}

export async function updateVisitorIdentity(anonId: string, data: {
  userId: string;
  isInternal?: boolean;
}) {
  return prisma.visitor.update({
    where: { anonId },
    data: {
      userId: data.userId,
      lastSeenAt: new Date(),
      ...(data.isInternal ? { isInternal: true } : {}),
    },
  });
}

// ── Sessions (Analytics) ─────────────────────────────────────────────────────

export async function getAnalyticsSession(id: string) {
  return prisma.visitorSession.findUnique({
    where: { id },
    select: { id: true, startedAt: true },
  });
}

export async function createAnalyticsSession(data: {
  id: string;
  visitorId: string;
  entryPage?: string;
  deviceType?: string;
}) {
  return prisma.visitorSession.create({
    data: {
      id: data.id,
      visitorId: data.visitorId,
      entryPage: data.entryPage,
      deviceType: data.deviceType,
      startedAt: new Date(),
    },
  });
}

export async function updateAnalyticsSession(id: string, data: {
  endedAt: Date;
  durationSeconds: number;
  exitPage?: string;
}) {
  return prisma.visitorSession.update({
    where: { id },
    data,
  });
}

// ── Events (Analytics) ───────────────────────────────────────────────────────

export async function insertEvents(rows: {
  sessionId: string;
  visitorId: string;
  eventType: string;
  eventName?: string;
  pagePath?: string;
  payload?: InputJson;
}[]) {
  return prisma.event.createMany({ data: rows });
}
