/**
 * Projects made without an account (`npx archdraw-live`) belong to a
 * placeholder user until someone claims them. Kept free of server
 * dependencies so read-only routes can check it cheaply.
 */
export const ANONYMOUS_USER_PREFIX = 'anon_';

export function isAnonymousUserId(userId: string | null | undefined): boolean {
  return typeof userId === 'string' && userId.startsWith(ANONYMOUS_USER_PREFIX);
}
