import { AsyncLocalStorage } from 'node:async_hooks';

const FETCH_TIMEOUT_MS = 8000;

/**
 * Per-request overrides for hosts that embed the tools (the hosted
 * `/api/mcp` endpoint). Scoped with AsyncLocalStorage so concurrent requests
 * in one process never see each other's API base or fetch implementation.
 */
export interface McpRequestContext {
  apiBase?: string;
  fetch?: typeof fetch;
}

const requestContext = new AsyncLocalStorage<McpRequestContext>();

export function runWithMcpContext<T>(context: McpRequestContext, fn: () => T): T {
  return requestContext.run(context, fn);
}

/** ArchDraw web API origin: request context first, then `API_BASE_URL`. */
export function getApiBase(): string | undefined {
  return requestContext.getStore()?.apiBase || process.env.API_BASE_URL;
}

/** fetch() with a hard timeout so a hung frontend never hangs the MCP server. */
export async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  const fetchImpl = requestContext.getStore()?.fetch ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
