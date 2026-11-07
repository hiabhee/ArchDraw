import { RETURNING_COOKIE, RETURNING_COOKIE_MAX_AGE } from '@/lib/site/returningVisitor';

/** Marks this browser as a returning visitor, so `/` reopens the editor. */
export function markReturningVisitor(): void {
  if (typeof document === 'undefined') return;
  if (document.cookie.split('; ').includes(`${RETURNING_COOKIE}=1`)) return;
  document.cookie = `${RETURNING_COOKIE}=1; Path=/; Max-Age=${RETURNING_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Forgets it (on sign-out), so `/` shows the landing page again. */
export function clearReturningVisitor(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${RETURNING_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
