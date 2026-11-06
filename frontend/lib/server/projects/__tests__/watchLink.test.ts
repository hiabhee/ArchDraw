import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClaimSecret, createWatchToken, parseWatchToken, verifyClaimSecret, verifyWatchToken } from '../watchLink';

describe('watch links', () => {
  const previous = process.env.BETTER_AUTH_SECRET;
  beforeEach(() => { process.env.BETTER_AUTH_SECRET = 'test-secret'; });
  afterEach(() => { process.env.BETTER_AUTH_SECRET = previous; });

  it('round-trips for the same canvas and project', () => {
    const token = createWatchToken('c1', 'p1')!;
    expect(parseWatchToken(token)?.canvasId).toBe('c1');
    expect(verifyWatchToken(token, 'c1', 'p1')).toBe(true);
  });

  it('stops working when the project is stopped and re-made (new project id)', () => {
    expect(verifyWatchToken(createWatchToken('c1', 'p1')!, 'c1', 'p2')).toBe(false);
  });

  it('rejects tampered, foreign and malformed tokens', () => {
    const token = createWatchToken('c1', 'p1')!;
    expect(verifyWatchToken(`${token}x`, 'c1', 'p1')).toBe(false);
    expect(verifyWatchToken(token.replace('c1.', 'c2.'), 'c2', 'p1')).toBe(false);
    expect(parseWatchToken('no-dot')).toBeNull();
    expect(parseWatchToken('.sig')).toBeNull();
  });

  it('is disabled without a server secret', () => {
    delete process.env.BETTER_AUTH_SECRET;
    expect(createWatchToken('c1', 'p1')).toBeNull();
  });

  it('claim secrets verify only for their project and differ from the watch signature', () => {
    const claim = createClaimSecret('c1', 'p1')!;
    expect(verifyClaimSecret(claim, 'c1', 'p1')).toBe(true);
    expect(verifyClaimSecret(claim, 'c1', 'p2')).toBe(false);
    expect(verifyClaimSecret(`${claim}x`, 'c1', 'p1')).toBe(false);
    expect(createWatchToken('c1', 'p1')!.endsWith(claim)).toBe(false);
  });
});
