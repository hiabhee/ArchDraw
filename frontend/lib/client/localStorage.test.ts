import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serializedStorage } from './localStorage';

describe('coalesced persistence', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });

  it('writes the latest snapshot once and makes pending state readable', async () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    for (let i = 0; i < 100; i++) serializedStorage.setItem('drag', String(i));
    await Promise.resolve();
    expect(write).not.toHaveBeenCalled();
    expect(serializedStorage.getItem('drag')).toBe('99');
    await vi.runAllTimersAsync();
    expect(write).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('drag')).toBe('99');
    write.mockRestore(); vi.useRealTimers();
  });

  it('flushes pending data on pagehide and never resurrects a removed key', async () => {
    serializedStorage.setItem('keep', 'latest');
    serializedStorage.setItem('remove', 'stale');
    serializedStorage.removeItem('remove');
    window.dispatchEvent(new Event('pagehide'));
    expect(localStorage.getItem('keep')).toBe('latest');
    await vi.runAllTimersAsync();
    expect(localStorage.getItem('remove')).toBeNull();
    vi.useRealTimers();
  });
});
