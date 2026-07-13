'use client';

import logger from '@/lib/logger';

type TrackEvent = {
  event_type: string;
  event_name?: string;
  page_path: string;
  payload?: Record<string, unknown>;
};

type AnalyticsState = {
  anonId: string;
  sessionId: string;
  queue: TrackEvent[];
  flushTimer: ReturnType<typeof setInterval> | null;
  initialized: boolean;
};

function generateId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax`;
}

const SESSION_KEY = 'ad_session';
const SESSION_EXPIRY_KEY = 'ad_session_expiry';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const FLUSH_INTERVAL_MS = 5000;
const FLUSH_BATCH_SIZE = 20;
const ANON_COOKIE = 'ad_anon';
const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 years

// Sampling: set NEXT_PUBLIC_ANALYTICS_ENABLED=false to disable tracking entirely in local dev
const ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false';

const state: AnalyticsState = {
  anonId: '',
  sessionId: '',
  queue: [],
  flushTimer: null,
  initialized: false,
};

function ensureAnonId(): string {
  let id = getCookie(ANON_COOKIE);
  if (!id) {
    id = generateId();
    setCookie(ANON_COOKIE, id, ANON_COOKIE_MAX_AGE);
  }
  state.anonId = id;
  return id;
}

function ensureSession(): string {
  if (typeof window === 'undefined') return '';

  const now = Date.now();
  const expiry = parseInt(sessionStorage.getItem(SESSION_EXPIRY_KEY) || '0', 10);

  // If session expired or doesn't exist, create new one
  if (!expiry || now > expiry) {
    const id = generateId();
    sessionStorage.setItem(SESSION_KEY, id);
    sessionStorage.setItem(SESSION_EXPIRY_KEY, String(now + SESSION_TIMEOUT_MS));
    state.sessionId = id;
    return id;
  }

  // Renew the rolling expiry
  sessionStorage.setItem(SESSION_EXPIRY_KEY, String(now + SESSION_TIMEOUT_MS));
  const existing = sessionStorage.getItem(SESSION_KEY) || generateId();
  sessionStorage.setItem(SESSION_KEY, existing);
  state.sessionId = existing;
  return existing;
}

function getUtmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  const source = params.get('utm_source');
  const medium = params.get('utm_medium');
  const campaign = params.get('utm_campaign');
  if (source) utm.utm_source = source;
  if (medium) utm.utm_medium = medium;
  if (campaign) utm.utm_campaign = campaign;
  return utm;
}

async function flush(useBeacon = false) {
  if (state.queue.length === 0) return;

  const batch = state.queue.splice(0, state.queue.length);
  const body = JSON.stringify({
    events: batch,
    session_id: state.sessionId,
    is_internal: getCookie('ad_internal') === '1',
    referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
    ...getUtmParams(),
  });

  if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    return;
  }

  try {
    await fetch('/api/track', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
  } catch (err) {
    // Re-queue on failure (best-effort, don't drop events silently)
    logger.warn('[Analytics] Flush failed, re-queuing:', err);
    state.queue.unshift(...batch);
  }
}

function getCssSelectorPath(el: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = el;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break;
    }
    if (current.className && typeof current.className === 'string') {
      const cls = current.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (cls) selector += `.${cls}`;
    }
    parts.unshift(selector);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

function setupClickTracking() {
  if (typeof document === 'undefined') return;

  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button, a, [role="button"]');
    if (!target) return;

    // Declarative: data-track attribute takes priority
    const trackTarget = (e.target as HTMLElement).closest('[data-track]');
    if (trackTarget) {
      track({
        event_type: 'click',
        event_name: trackTarget.getAttribute('data-track')!,
        page_path: window.location.pathname,
        payload: {
          tag: (trackTarget as HTMLElement).tagName.toLowerCase(),
          text: (trackTarget.textContent || '').trim().slice(0, 100),
        },
      });
      return;
    }

    // Automatic fallback: log untagged interactive element clicks
    track({
      event_type: 'click',
      event_name: 'untagged_click',
      page_path: window.location.pathname,
      payload: {
        tag: (target as HTMLElement).tagName.toLowerCase(),
        text: (target.textContent || '').trim().slice(0, 100),
        selector: getCssSelectorPath(target as HTMLElement),
        href: (target as HTMLAnchorElement).href || undefined,
      },
    });
  });
}

function track(e: TrackEvent) {
  if (!state.initialized || !ANALYTICS_ENABLED) return;
  state.queue.push(e);
  if (state.queue.length >= FLUSH_BATCH_SIZE) {
    flush();
  }
}

function init() {
  if (state.initialized || typeof window === 'undefined' || !ANALYTICS_ENABLED) return;
  state.initialized = true;

  ensureAnonId();
  ensureSession();

  state.flushTimer = setInterval(() => flush(), FLUSH_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });

  window.addEventListener('beforeunload', () => flush(true));

  setupClickTracking();
}

function identify(userId: string) {
  if (!ANALYTICS_ENABLED) return;
  fetch('/api/track/identify', {
    method: 'POST',
    body: JSON.stringify({ anon_id: state.anonId, user_id: userId }),
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {});
}

export const analytics = {
  init,
  track,
  identify,
  flush,
  getAnonId: () => state.anonId,
  getSessionId: () => state.sessionId,
};
