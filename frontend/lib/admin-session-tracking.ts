/**
 * Shared admin session tracking for security enhancements.
 * Tracks IP and user agent binding for admin sessions.
 *
 * Sessions are persisted to Redis (when configured) so UA binding survives
 * server restarts and works across replicas; the in-memory Map remains as a
 * same-instance fast path and fallback when Redis is unavailable.
 */

import { createHash } from 'crypto';
import { redis } from '@/lib/redis';
import logger from '@/lib/logger';

export interface AdminSessionData {
  ip: string;
  ua: string;
  timestamp: number;
}

export const adminSessionTracking = new Map<string, AdminSessionData>();

const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours

function sessionKey(sessionValue: string): string {
  // Never use the raw cookie value as a cache key.
  const hash = createHash('sha256').update(sessionValue).digest('hex');
  return `admin:session:${hash}`;
}

export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [key, value] of adminSessionTracking) {
    if (now - value.timestamp > 24 * 60 * 60 * 1000) { // 24 hours
      adminSessionTracking.delete(key);
    }
  }
}

export async function trackAdminSession(sessionValue: string, ip: string, ua: string): Promise<void> {
  const data: AdminSessionData = { ip, ua, timestamp: Date.now() };
  adminSessionTracking.set(sessionValue, data);

  try {
    await redis.set(sessionKey(sessionValue), data, { ex: SESSION_TTL_SECONDS });
  } catch (error) {
    logger.warn('[AdminSession] Redis session tracking failed (in-memory only):', error);
  }
}

/**
 * Looks up tracked session data: in-memory first, then Redis.
 * Returns undefined when the session is unknown or stores are unavailable.
 */
export async function getTrackedAdminSession(sessionValue: string): Promise<AdminSessionData | undefined> {
  const local = adminSessionTracking.get(sessionValue);
  if (local) return local;

  try {
    const remote = await redis.get<AdminSessionData>(sessionKey(sessionValue));
    if (
      remote &&
      typeof remote === 'object' &&
      typeof remote.ua === 'string' &&
      typeof remote.ip === 'string' &&
      typeof remote.timestamp === 'number'
    ) {
      adminSessionTracking.set(sessionValue, remote);
      return remote;
    }
  } catch (error) {
    logger.warn('[AdminSession] Redis session lookup failed:', error);
  }

  return undefined;
}
