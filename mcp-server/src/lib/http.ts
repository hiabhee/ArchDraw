const FETCH_TIMEOUT_MS = 8000;

/** fetch() with a hard timeout so a hung frontend never hangs the MCP server. */
export async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
