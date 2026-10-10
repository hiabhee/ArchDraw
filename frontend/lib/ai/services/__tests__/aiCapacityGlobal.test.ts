import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const evalScript = vi.fn();
  return { evalScript, client: { eval: evalScript } as { eval?: unknown } };
});
vi.mock('@/lib/redis', () => ({ redis: m.client }));
vi.mock('@/lib/logger', () => ({ default: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn(), info: vi.fn() } }));

import { acquireAiCapacity, CapacityBusyError, getGenerationBudget } from '../aiCapacity';

describe('acquireAiCapacity global admission', () => {
  beforeEach(() => {
    m.evalScript.mockReset();
    m.client.eval = m.evalScript;
  });

  it('admits when the shared Redis window has room', async () => {
    m.evalScript.mockResolvedValue(1);
    const release = await acquireAiCapacity(getGenerationBudget('a web app', 1));
    expect(m.evalScript).toHaveBeenCalledTimes(1);
    const [, keys] = m.evalScript.mock.calls[0];
    expect(keys[0]).toMatch(/^ai-capacity:tpm:\d+$/);
    expect(keys[1]).toMatch(/^ai-capacity:rpm:\d+$/);
    release();
  });

  it('rejects with CapacityBusyError when another instance used up the window', async () => {
    m.evalScript.mockResolvedValue(0);
    await expect(acquireAiCapacity(getGenerationBudget('a web app', 1))).rejects.toBeInstanceOf(CapacityBusyError);
  });

  it('falls back to the local limiter when Redis is unavailable', async () => {
    // The no-op client used when Redis isn't configured has no `eval`.
    delete m.client.eval;
    const release = await acquireAiCapacity(getGenerationBudget('a web app', 1));
    expect(typeof release).toBe('function');
    release();
  });
});
