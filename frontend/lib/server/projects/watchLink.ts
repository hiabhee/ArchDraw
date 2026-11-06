import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Read-only "watch" links for a live project: `<canvasId>.<signature>`, where
 * the signature is an HMAC of the canvas id and its agentic project id. No
 * storage needed; stopping the project (a new project gets a new id) revokes
 * every link. Disabled when no server secret is configured.
 */

function secret(): string | null {
  return process.env.BETTER_AUTH_SECRET || null;
}

function sign(canvasId: string, agenticProjectId: string, key: string): string {
  return createHmac('sha256', key).update(`live-watch:v1:${canvasId}:${agenticProjectId}`).digest('base64url');
}

export function createWatchToken(canvasId: string, agenticProjectId: string): string | null {
  const key = secret();
  return key ? `${canvasId}.${sign(canvasId, agenticProjectId, key)}` : null;
}

/** Split a token; the signature is checked against the canvas with `verifyWatchToken`. */
export function parseWatchToken(token: string): { canvasId: string; signature: string } | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0 || dot === token.length - 1 || token.length > 300) return null;
  return { canvasId: token.slice(0, dot), signature: token.slice(dot + 1) };
}

export function verifyWatchToken(token: string, canvasId: string, agenticProjectId: string): boolean {
  const key = secret();
  const parsed = parseWatchToken(token);
  if (!key || !parsed || parsed.canvasId !== canvasId) return false;
  const expected = Buffer.from(sign(canvasId, agenticProjectId, key));
  const actual = Buffer.from(parsed.signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Claim secret for a project created without an account (`npx archdraw-live`):
 * whoever holds it can sign in and take the project over. Only the CLI that
 * created the project receives it; it is never part of the watch link.
 */
function signClaim(canvasId: string, agenticProjectId: string, key: string): string {
  return createHmac('sha256', key).update(`live-claim:v1:${canvasId}:${agenticProjectId}`).digest('base64url');
}

export function createClaimSecret(canvasId: string, agenticProjectId: string): string | null {
  const key = secret();
  return key ? signClaim(canvasId, agenticProjectId, key) : null;
}

export function verifyClaimSecret(claim: string, canvasId: string, agenticProjectId: string): boolean {
  const key = secret();
  if (!key || typeof claim !== 'string' || claim.length > 100) return false;
  const expected = Buffer.from(signClaim(canvasId, agenticProjectId, key));
  const actual = Buffer.from(claim);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
