import prisma from '@/lib/prisma';
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

export async function upsertUserCanvas(userId: string, data: {
  id: string;
  name: string;
  nodes: InputJson;
  edges: InputJson;
}) {
  return prisma.userCanvas.upsert({
    where: { id: data.id },
    create: { ...data, userId },
    update: { name: data.name, nodes: data.nodes, edges: data.edges },
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

// ── Tutorial Response Cache ──────────────────────────────────────────────────
// RLS equivalent: anyone can read/insert/update (public)

export async function getCachedResponse(questionHash: string) {
  const row = await prisma.tutorialResponseCache.findUnique({
    where: { questionHash },
    select: { response: true },
  });
  return row?.response ?? null;
}

export async function cacheResponse(questionHash: string, response: string) {
  return prisma.tutorialResponseCache.upsert({
    where: { questionHash },
    create: { questionHash, response },
    update: { response },
  });
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
