/**
 * Returning visitors skip the landing page: someone who has drawn on a canvas
 * and later opens the site's address (typed, bookmarked, or from another site)
 * goes straight to the editor, which reopens the canvas they were last on.
 *
 * The landing page stays reachable: links inside ArchDraw (same-origin
 * navigation) never redirect, and `/?home` always shows it.
 */

/** Set by the editor once the open canvas has something on it. */
export const RETURNING_COOKIE = 'archdraw_returning';
export const RETURNING_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export interface LandingRequest {
  method: string;
  /** The visitor's cookie value, if any. */
  cookie: string | undefined;
  /**
   * `Sec-Fetch-Site`: `same-origin` when the visitor clicked a link inside
   * ArchDraw, including Next's client navigations and prefetches (their own
   * markers are not visible to the proxy).
   */
  fetchSite: string | null;
  searchParams: URLSearchParams;
}

export function shouldResumeEditor(req: LandingRequest): boolean {
  if (req.method !== 'GET') return false;
  if (req.cookie !== '1') return false;
  if (req.fetchSite === 'same-origin') return false;
  if (req.searchParams.has('home')) return false;
  return true;
}
