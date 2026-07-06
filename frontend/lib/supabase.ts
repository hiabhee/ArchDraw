import { createClient as _createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type Database, type Json } from '../types/supabase';
import logger from '@/lib/logger';

// ── Console error suppression ────────────────────────────────────
// GoTrue-js (@supabase/auth-js) internally calls console.error with
// AuthRetryableFetchError when token refresh or session fetch fails
// due to network issues (lines 1811, 2092, 2398 in GoTrueClient.js).
// These are expected in offline/guest mode and must not pollute the
// Next.js dev overlay.  We patch console.error at module load time
// (before any Supabase client is created) to suppress them.
if (typeof window !== 'undefined') {
  const _consoleError = console.error;
  console.error = function (...args: unknown[]) {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (
        arg !== null &&
        typeof arg === 'object' &&
        'name' in (arg as object) &&
        (arg as { name: string }).name === 'AuthRetryableFetchError'
      ) {
        return;
      }
    }
    _consoleError.apply(console, args);
  };

  // Also catch any unhandled rejections that slip past GoTrue-js's
  // internal error handling (belt-and-suspenders).
  const _onunhandledrejection = (event: PromiseRejectionEvent) => {
    const err = event.reason;
    if (
      err &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name: string }).name === 'AuthRetryableFetchError'
    ) {
      event.preventDefault();
    }
  };
  window.addEventListener('unhandledrejection', _onunhandledrejection);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
let reachabilityPromise: Promise<boolean> | null = null;
let reachabilityResolvedAt: number | null = null;
const REACHABILITY_CACHE_MS = 30_000; // Re-check after 30s if previously failed
export let isReachable = true;

// Singleton for browser usage
let _client: SupabaseClient<Database> | null = null;

export function checkSupabaseReachability(): Promise<boolean> {
  if (!isSupabaseConfigured) return Promise.resolve(false);

  // If we have a cached result, return it unless it was a failure older than REACHABILITY_CACHE_MS
  // (successful reachability is cached permanently; failures are retried after the grace period)
  if (reachabilityPromise && reachabilityResolvedAt !== null) {
    const cacheAge = Date.now() - reachabilityResolvedAt;
    if (isReachable || cacheAge < REACHABILITY_CACHE_MS) {
      return reachabilityPromise;
    }
    // Reset so we try again
    reachabilityPromise = null;
    reachabilityResolvedAt = null;
  }

  reachabilityPromise = new Promise<boolean>((resolve) => {
    if (typeof window === 'undefined') {
      reachabilityResolvedAt = Date.now();
      resolve(true); // default to true on server-side
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 5000); // 5s timeout to handle slow connections

    fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      credentials: 'omit',
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((res) => {
        clearTimeout(timeoutId);
        isReachable = res.ok;
        reachabilityResolvedAt = Date.now();
        if (!isReachable) {
          _client = null;
        }
        resolve(isReachable);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        reachabilityResolvedAt = Date.now();
        // Silently log and fallback to guest mode
        if (err.name === 'AbortError') {
          logger.info('[Supabase] Health check timed out, operating in guest mode');
        } else {
          logger.info('[Supabase] Connection check failed, operating in guest mode');
        }
        isReachable = false;
        _client = null;
        resolve(false);
      });
  });

  return reachabilityPromise;
}

// Start reachability check immediately in browser
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  checkSupabaseReachability();
}

// Custom fetch to gracefully handle network failures (e.g. offline, DNS block)
const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    return await fetch(input, init);
  } catch (error) {
    const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;
    
    if (isOffline || !isReachable) {
      // Return a 503 response instead of throwing to prevent GoTrue-js from printing the TypeError to console.error.
      // GoTrue-js converts 503 status code to AuthRetryableFetchError which is handled silently.
      return new Response(
        JSON.stringify({
          error: 'service_unavailable',
          message: 'Application is operating in guest mode (network unavailable)',
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    logger.warn('Supabase fetch failed, intercepting and degrading gracefully:', error);
    // Return a 503 if we think it might be a temporary hiccup
    return new Response(
      JSON.stringify({
        error: 'service_unavailable',
        message: 'Supabase server is unreachable or offline',
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export function getSupabaseClient(): SupabaseClient<Database> {
  // We only throw if the basic configuration (URL/Key) is missing.
  // Reachability and online status are handled gracefully by customFetch.
  if (!isSupabaseConfigured) {
    throw new Error('Supabase not configured');
  }

  if (!_client) {
    _client = _createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: customFetch,
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    });
  }
  return _client;
}

/**
 * Types for specific table queries to ensure type safety without 'any'.
 */
export interface UserCanvasesTable {
  upsert: (values: {
    id: string;
    user_id: string;
    name: string;
    nodes: Json;
    edges: Json;
    updated_at: string;
  }) => Promise<{ error: { message: string } | null }>;
  insert: (values: {
    id: string;
    user_id: string;
    name: string;
    nodes: Json;
    edges: Json;
  }) => Promise<{ error: { message: string } | null }>;
  select: (columns?: string) => {
    order: (column: string, options: { ascending: boolean }) => Promise<{ data: Database['public']['Tables']['user_canvases']['Row'][] | null; error: { message: string } | null }>;
    eq: (column: string, value: string) => {
      order: (column: string, options: { ascending: boolean }) => Promise<{ data: Database['public']['Tables']['user_canvases']['Row'][] | null; error: { message: string } | null }>;
    };
  };
  delete: () => {
    eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
  };
}

export interface TutorialResponseCacheTable {
  upsert: (values: { question_hash: string, response: string }) => Promise<{ error: { message: string } | null }>;
  select: (columns?: string) => {
    eq: (column: string, value: string) => {
      single: () => Promise<{ data: Database['public']['Tables']['tutorial_response_cache']['Row'] | null; error: { message: string } | null }>;
    };
  };
}

export interface TutorialProgressTable {
  upsert: (values: {
    user_id: string;
    tutorial_id: string;
    current_level: number;
    current_step: number;
    current_phase: string;
    completed_levels: number[];
    canvas_nodes: Json;
    canvas_edges: Json;
    explain_count: number;
    updated_at: string;
  }, options?: { onConflict: string }) => {
    select: () => {
      single: () => Promise<{ data: Json; error: { message: string } | null }>;
    };
  };
  select: (columns?: string) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Database['public']['Tables']['tutorial_progress']['Row'] | null; error: { message: string } | null }>;
      };
    };
  };
  delete: () => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
}
