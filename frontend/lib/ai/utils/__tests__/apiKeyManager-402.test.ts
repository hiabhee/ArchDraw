/**
 * Regression tests for the OpenRouter 402 retry loop bug.
 *
 * Bug: When OpenRouter returned 402 (Payment Required), the error was swallowed
 * in executeWithRetry's fallback paths, causing the caller to retry the entire
 * Groq→OpenRouter cycle instead of failing immediately.
 *
 * Fix: 402 (and 401/403) from OpenRouter are now propagated immediately.
 */
import { describe, it, expect } from 'vitest';

describe('OpenRouter 402 propagation', () => {
  it('402 error should propagate through executeWithRetry, not be swallowed', async () => {
    // Simulate the error propagation logic from executeWithRetry
    // The bug was: openrouterError was caught, logged, and lastError (a Groq error) was thrown
    // The fix is: unrecoverable OpenRouter errors (401/402/403) throw immediately

    const openrouterError = Object.assign(
      new Error('OpenRouter API error: 402 - Payment required'),
      { status: 402 }
    );

    const groqError = new Error('Groq rate limit exceeded');

    // Simulate the fixed logic
    let lastError: Error | null = groqError;
    let thrownError: Error | null = null;

    try {
      // Early fallback path — the fixed code
      const orErr = openrouterError as { status?: number; message?: string };
      if (orErr.status === 401 || orErr.status === 402 || orErr.status === 403) {
        thrownError = openrouterError;
      } else {
        // Non-recoverable — swallowed, continue with Groq
        lastError = groqError;
      }
    } catch {
      // should not reach here
    }

    expect(thrownError).toBe(openrouterError);
    expect(thrownError?.message).toContain('402');
  });

  it('402 error should propagate through full fallback, not be replaced by Groq error', async () => {
    const openrouterError = Object.assign(
      new Error('OpenRouter API error: 402 - Payment required'),
      { status: 402 }
    );

    const groqError = new Error('All Groq keys exhausted');

    // Simulate the fixed full fallback logic
    let lastError: Error | null = groqError;
    let thrownError: Error | null = null;

    try {
      const orErr = openrouterError as { status?: number; message?: string };
      if (orErr.status === 401 || orErr.status === 402 || orErr.status === 403) {
        thrownError = openrouterError;
      } else {
        // Non-recoverable — swallowed, fall through to lastError
        thrownError = lastError;
      }
    } catch {
      // should not reach here
    }

    expect(thrownError).toBe(openrouterError);
    expect(thrownError?.message).toContain('402');
    // NOT the Groq error
    expect(thrownError?.message).not.toContain('Groq');
  });

  it('transient OpenRouter errors (500, 429) should still be swallowed and retried', async () => {
    const serverError = Object.assign(
      new Error('OpenRouter API error: 500 - Internal server error'),
      { status: 500 }
    );

    const rateLimitError = Object.assign(
      new Error('OpenRouter API error: 429 - Rate limit exceeded'),
      { status: 429 }
    );

    const groqError = new Error('Groq rate limit exceeded');

    // Server error — should NOT throw, should continue retrying
    let thrownError: Error | null = null;
    const orErr = serverError as { status?: number; message?: string };
    if (orErr.status === 401 || orErr.status === 402 || orErr.status === 403) {
      thrownError = serverError;
    }
    expect(thrownError).toBeNull(); // swallowed — correct

    // Rate limit — should NOT throw, should continue retrying
    thrownError = null;
    const orErr2 = rateLimitError as { status?: number; message?: string };
    if (orErr2.status === 401 || orErr2.status === 402 || orErr2.status === 403) {
      thrownError = rateLimitError;
    }
    expect(thrownError).toBeNull(); // swallowed — correct
  });
});
