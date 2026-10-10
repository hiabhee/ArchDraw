import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  checkAIGenerationQuota: vi.fn(),
  releaseAIGeneration: vi.fn(),
  incrementAIGeneration: vi.fn(),
  logUsage: vi.fn(),
  getSessionFromRequest: vi.fn(),
  getGuestId: vi.fn(),
  getCreditSnapshot: vi.fn(),
  reserveCredits: vi.fn(),
  refundCredits: vi.fn(),
  generateDiagram: vi.fn(),
  acquireAiCapacity: vi.fn(),
  getCachedDiagram: vi.fn(),
  setCachedDiagram: vi.fn(),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: vi.fn() };
});
vi.mock('@/lib/server/quotaCheck', () => ({
  checkAIGenerationQuota: m.checkAIGenerationQuota,
  releaseAIGeneration: m.releaseAIGeneration,
  incrementAIGeneration: m.incrementAIGeneration,
  logUsage: m.logUsage,
  getSessionFromRequest: m.getSessionFromRequest,
  getGuestId: m.getGuestId,
}));
vi.mock('@/lib/server/credits', async () => ({
  CREDIT_POLICY: (await import('@/lib/quotas/creditPolicy')).CREDIT_POLICY,
  getCreditSnapshot: m.getCreditSnapshot,
  reserveCredits: m.reserveCredits,
  refundCredits: m.refundCredits,
}));
vi.mock('@/lib/ai/services/orchestrator', () => ({ generateDiagram: m.generateDiagram }));
vi.mock('@/lib/ai/services/aiCapacity', () => ({
  acquireAiCapacity: m.acquireAiCapacity,
  getGenerationBudget: vi.fn(() => ({})),
  CapacityBusyError: class CapacityBusyError extends Error {},
}));
vi.mock('@/lib/ai/services/diagramCache', () => ({ get: m.getCachedDiagram, set: m.setCachedDiagram }));
vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), log: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { POST } from '../route';
import { POST as STREAMING_POST } from '../streaming/route';

const snapshot = { tier: 'authenticated', balance: 10, allowance: 10, costs: { 1: 1, 2: 2, 3: 4 }, periodEndsAt: '', unlimited: false };

function request(body: unknown, path = '/api/generate-diagram') {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/generate-diagram metering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.checkAIGenerationQuota.mockResolvedValue({ allowed: true, remaining: 5, tier: 'authenticated', claimedUserId: 'u1' });
    m.getCreditSnapshot.mockResolvedValue(snapshot);
    m.reserveCredits.mockResolvedValue({ allowed: true, ...snapshot, balance: 8, consumed: 2, reservationId: 'r1' });
    m.acquireAiCapacity.mockResolvedValue(() => {});
    m.getCachedDiagram.mockReturnValue(null);
    m.generateDiagram.mockResolvedValue({ nodes: [{ id: 'a' }], edges: [] });
  });

  it('reserves credits before generating and keeps the charge on success', async () => {
    const res = await POST(request({ description: 'a web app', detailLevel: 2 }));
    expect(res.status).toBe(200);
    expect(m.reserveCredits).toHaveBeenCalledBefore(m.generateDiagram);
    expect(m.refundCredits).not.toHaveBeenCalled();
    expect(m.releaseAIGeneration).not.toHaveBeenCalled();
    expect((await res.json()).credits.balance).toBe(8);
  });

  it('refunds credits and releases the quota slot when generation fails', async () => {
    m.generateDiagram.mockRejectedValue(new Error('boom'));
    const res = await POST(request({ description: 'a web app' }));
    expect(res.status).toBe(502);
    expect(m.refundCredits).toHaveBeenCalledWith('r1');
    expect(m.releaseAIGeneration).toHaveBeenCalledWith('u1');
  });

  it('returns 402 and releases the slot when the reservation loses a race', async () => {
    m.reserveCredits.mockResolvedValue({ allowed: false, ...snapshot, balance: 0, required: 2 });
    const res = await POST(request({ description: 'a web app' }));
    expect(res.status).toBe(402);
    expect(m.generateDiagram).not.toHaveBeenCalled();
    expect(m.releaseAIGeneration).toHaveBeenCalledWith('u1');
  });

  it('serves cache hits without charging credits or a quota slot', async () => {
    m.getCachedDiagram.mockReturnValue({ nodes: [], edges: [] });
    const res = await POST(request({ description: 'a web app' }));
    expect((await res.json()).cached).toBe(true);
    expect(m.reserveCredits).not.toHaveBeenCalled();
    expect(m.releaseAIGeneration).toHaveBeenCalledWith('u1');
  });

  it('passes edit context to the pipeline and bypasses the prompt cache', async () => {
    m.getCachedDiagram.mockReturnValue({ nodes: [], edges: [] });
    const existingContext = { nodes: [{ id: 'a', data: { label: 'API' } }], edges: [] };
    await POST(request({ description: 'add a cache', existingContext }));
    expect(m.getCachedDiagram).not.toHaveBeenCalled();
    expect(m.setCachedDiagram).not.toHaveBeenCalled();
    expect(m.generateDiagram.mock.calls[0][0].existingContext).toEqual(existingContext);
  });

  it('rejects oversized edit context', async () => {
    const nodes = Array.from({ length: 151 }, (_, i) => ({ id: `n${i}` }));
    const res = await POST(request({ description: 'edit', existingContext: { nodes, edges: [] } }));
    expect(res.status).toBe(400);
    expect(m.releaseAIGeneration).toHaveBeenCalledWith('u1');
  });
});

describe('POST /api/generate-diagram/streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.checkAIGenerationQuota.mockResolvedValue({ allowed: true, remaining: 5, tier: 'guest' });
    m.getCreditSnapshot.mockResolvedValue(snapshot);
    m.reserveCredits.mockResolvedValue({ allowed: true, ...snapshot, balance: 8, consumed: 2, reservationId: 'r1' });
    m.acquireAiCapacity.mockResolvedValue(() => {});
    m.getCachedDiagram.mockReturnValue(null);
    m.generateDiagram.mockResolvedValue({ nodes: [], edges: [] });
  });

  it('goes through the same credit + capacity metering and streams by default', async () => {
    const res = await STREAMING_POST(request({ description: 'a web app' }, '/api/generate-diagram/streaming'));
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    await res.text();
    expect(m.reserveCredits).toHaveBeenCalledTimes(1);
    expect(m.acquireAiCapacity).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown models like the primary route', async () => {
    const res = await STREAMING_POST(request({ description: 'x', model: 'not-a-model' }, '/api/generate-diagram/streaming'));
    expect(res.status).toBe(400);
    expect(m.generateDiagram).not.toHaveBeenCalled();
  });
});
