import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock next/navigation at top level (hoisted anyway)
vi.mock('next/navigation', () => ({
  usePathname: () => '/editor',
}));

// ── Analytics Library Tests ──────────────────────────────────────────────────
// Test the core analytics library (lib/analytics.ts) in isolation.
// We mock fetch/cookie/storage to verify behavior without network calls.

describe('analytics library', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset cookies
    document.cookie.split(';').forEach((c) => {
      document.cookie = c.trim().split('=')[0] + '=; max-age=0; path=/';
    });
    // Clear storage
    localStorage.clear();
    sessionStorage.clear();
    // Mock fetch
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates anon_id cookie on init', async () => {
    const { analytics } = await import('@/lib/analytics');
    // Need a fresh module — the singleton state is shared.
    // We verify the cookie behavior indirectly.
    analytics.init();

    const cookie = document.cookie;
    expect(cookie).toContain('ad_anon=');
  });

  it('creates session in sessionStorage on init', async () => {
    // Reset modules to get a fresh analytics singleton
    vi.resetModules();
    const { analytics } = await import('@/lib/analytics');
    analytics.init();
    // Track one event to ensure ensureSession runs
    analytics.track({ event_type: 'test', page_path: '/' });
    analytics.flush();

    const sessionId = sessionStorage.getItem('ad_session');
    expect(sessionId).toBeTruthy();
    expect(sessionId!.length).toBeGreaterThan(0);
  });

  it('queues events and flushes on batch size', async () => {
    const { analytics } = await import('@/lib/analytics');
    analytics.init();

    // Track 20 events (the FLUSH_BATCH_SIZE)
    for (let i = 0; i < 20; i++) {
      analytics.track({
        event_type: 'click',
        event_name: `test_click_${i}`,
        page_path: '/test',
      });
    }

    // Should have called fetch at least once (for the batch flush)
    expect(fetchSpy).toHaveBeenCalled();
    const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
    expect(lastCall[0]).toBe('/api/track');
    expect(lastCall[1].method).toBe('POST');

    const body = JSON.parse(lastCall[1].body);
    expect(body.events).toBeInstanceOf(Array);
    expect(body.events.length).toBeGreaterThan(0);
    expect(body.events[0].event_type).toBe('click');
  });

  it('flushes via sendBeacon on beforeunload', async () => {
    const beaconSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { sendBeacon: beaconSpy });

    const { analytics } = await import('@/lib/analytics');
    analytics.init();

    analytics.track({
      event_type: 'page_view',
      page_path: '/test',
    });

    // Simulate beforeunload
    window.dispatchEvent(new Event('beforeunload'));

    // sendBeacon should have been called
    expect(beaconSpy).toHaveBeenCalled();
    const [url, blob] = beaconSpy.mock.calls[0];
    expect(url).toBe('/api/track');
    expect(blob).toBeInstanceOf(Blob);
  });

  it('identify sends POST to /api/track/identify', async () => {
    const { analytics } = await import('@/lib/analytics');
    analytics.init();

    analytics.identify('user-123');

    // identify is fire-and-forget, give it a tick
    await new Promise((r) => setTimeout(r, 10));

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/track/identify',
      expect.objectContaining({
        method: 'POST',
      })
    );
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.user_id).toBe('user-123');
  });

  it('does not track when ANALYTICS_ENABLED is false', async () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', 'false');

    const { analytics } = await import('@/lib/analytics');
    analytics.init();

    analytics.track({
      event_type: 'click',
      page_path: '/test',
    });

    // fetch should not have been called for /api/track
    const trackCalls = fetchSpy.mock.calls.filter(
      (c: [string, RequestInit]) => c[0] === '/api/track'
    );
    expect(trackCalls.length).toBe(0);

    vi.unstubAllEnvs();
  });

  it('getAnonId returns the anon id', async () => {
    const { analytics } = await import('@/lib/analytics');
    analytics.init();

    const anonId = analytics.getAnonId();
    expect(anonId).toBeTruthy();
    expect(typeof anonId).toBe('string');
  });

  it('getSessionId returns the session id', async () => {
    const { analytics } = await import('@/lib/analytics');
    analytics.init();

    const sessionId = analytics.getSessionId();
    expect(sessionId).toBeTruthy();
    expect(typeof sessionId).toBe('string');
  });
});

// ── Click Tracking Tests ─────────────────────────────────────────────────────
describe('click tracking via data-track', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.cookie.split(';').forEach((c) => {
      document.cookie = c.trim().split('=')[0] + '=; max-age=0; path=/';
    });
    sessionStorage.clear();
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('click on [data-track] element sends track event with event_name from attribute', async () => {
    const { analytics } = await import('@/lib/analytics');
    analytics.init();

    // Create a button with data-track
    const btn = document.createElement('button');
    btn.setAttribute('data-track', 'hero_cta_click');
    btn.textContent = 'Get started';
    document.body.appendChild(btn);

    // Click it
    btn.click();

    // Wait for event to be queued
    await new Promise((r) => setTimeout(r, 10));

    // The click listener in analytics.ts should have queued a track event
    // Flush it
    analytics.flush();

    // Check that a POST to /api/track was made with the click event
    const trackCalls = fetchSpy.mock.calls.filter(
      (c: [string, RequestInit]) => c[0] === '/api/track'
    );
    expect(trackCalls.length).toBeGreaterThan(0);

    const body = JSON.parse(trackCalls[0][1].body as string);
    const clickEvent = body.events.find(
      (e: { event_type: string; event_name?: string }) =>
        e.event_type === 'click' && e.event_name === 'hero_cta_click'
    );
    expect(clickEvent).toBeTruthy();
    expect(clickEvent.payload.text).toContain('Get started');

    document.body.removeChild(btn);
  });

  it('click on untagged button sends untagged_click event', async () => {
    const { analytics } = await import('@/lib/analytics');
    analytics.init();

    const btn = document.createElement('button');
    btn.textContent = 'Some button';
    document.body.appendChild(btn);

    btn.click();
    await new Promise((r) => setTimeout(r, 10));
    analytics.flush();

    const trackCalls = fetchSpy.mock.calls.filter(
      (c: [string, RequestInit]) => c[0] === '/api/track'
    );
    expect(trackCalls.length).toBeGreaterThan(0);

    const body = JSON.parse(trackCalls[0][1].body as string);
    const untaggedEvent = body.events.find(
      (e: { event_type: string; event_name?: string }) =>
        e.event_name === 'untagged_click'
    );
    expect(untaggedEvent).toBeTruthy();

    document.body.removeChild(btn);
  });
});

// ── Page Tracking Hook Tests ─────────────────────────────────────────────────
describe('usePageTracking hook', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.cookie.split(';').forEach((c) => {
      document.cookie = c.trim().split('=')[0] + '=; max-age=0; path=/';
    });
    sessionStorage.clear();
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fires page_view on mount', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { usePageTracking } = await import('@/hooks/usePageTracking');

    renderHook(() => usePageTracking());

    // Give the effect time to fire
    await new Promise((r) => setTimeout(r, 50));

    // Init + page_view should have triggered a track
    const { analytics } = await import('@/lib/analytics');
    analytics.flush();

    const trackCalls = fetchSpy.mock.calls.filter(
      (c: [string, RequestInit]) => c[0] === '/api/track'
    );
    expect(trackCalls.length).toBeGreaterThan(0);

    const body = JSON.parse(trackCalls[0][1].body as string);
    const pageView = body.events.find(
      (e: { event_type: string }) => e.event_type === 'page_view'
    );
    expect(pageView).toBeTruthy();
    expect(pageView.page_path).toBe('/editor');
  });
});

// ── API Track Endpoint Tests ─────────────────────────────────────────────────
describe('POST /api/track', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 400 when no ad_anon cookie', async () => {
    const { POST } = await import('@/app/api/track/route');

    const req = new Request('http://localhost/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [{ event_type: 'page_view', page_path: '/' }],
        session_id: '00000000-0000-0000-0000-000000000001',
      }),
    });

    const mockReq = Object.assign(req, {
      cookies: {
        get: () => undefined,
      },
    });

    const res = await POST(mockReq as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid payload (missing events)', async () => {
    const { POST } = await import('@/app/api/track/route');

    const req = new Request('http://localhost/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
    });

    const mockReq = Object.assign(req, {
      cookies: {
        get: (name: string) =>
          name === 'ad_anon' ? { value: 'test-anon-id' } : undefined,
      },
    });

    const res = await POST(mockReq as any);
    expect(res.status).toBe(400);
  });

  it('validates Zod schema correctly (rejects non-uuid session_id)', async () => {
    const { POST } = await import('@/app/api/track/route');

    const req = new Request('http://localhost/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [{ event_type: 'page_view', page_path: '/' }],
        session_id: 'not-a-uuid',
      }),
    });

    const mockReq = Object.assign(req, {
      cookies: {
        get: (name: string) =>
          name === 'ad_anon' ? { value: 'test-anon-id-valid' } : undefined,
      },
    });

    const res = await POST(mockReq as any);
    expect(res.status).toBe(400);
  });
});

// ── AnalyticsProvider Tests ──────────────────────────────────────────────────
describe('AnalyticsProvider', () => {
  it('renders children', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { AnalyticsProvider } = await import('@/components/AnalyticsProvider');

    render(
      <AnalyticsProvider>
        <div data-testid="child">Hello</div>
      </AnalyticsProvider>
    );

    expect(screen.getByTestId('child')).toBeTruthy();
  });
});
