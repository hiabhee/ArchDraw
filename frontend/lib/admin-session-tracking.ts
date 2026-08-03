/**
 * Shared admin session tracking for security enhancements.
 * Tracks IP and user agent binding for admin sessions.
 */

export interface AdminSessionData {
  ip: string;
  ua: string;
  timestamp: number;
}

export const adminSessionTracking = new Map<string, AdminSessionData>();

export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [key, value] of adminSessionTracking) {
    if (now - value.timestamp > 24 * 60 * 60 * 1000) { // 24 hours
      adminSessionTracking.delete(key);
    }
  }
}

export function trackAdminSession(sessionValue: string, ip: string, ua: string): void {
  adminSessionTracking.set(sessionValue, { ip, ua, timestamp: Date.now() });
}