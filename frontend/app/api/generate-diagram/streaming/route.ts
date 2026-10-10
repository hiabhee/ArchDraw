import { NextRequest, NextResponse } from 'next/server';
import { POST as generateDiagramPOST } from '../route';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Streaming alias of `/api/generate-diagram`.
 *
 * Kept for API compatibility (documented in openapiSpec). It only defaults
 * `stream` to true and delegates to the primary handler, so quota, credits,
 * capacity limits and model validation are enforced in exactly one place.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'VALIDATION_ERROR', status: 400 }, { status: 400 });
  }
  const payload = body && typeof body === 'object' && !Array.isArray(body)
    ? { stream: true, ...(body as Record<string, unknown>) }
    : body;

  const forwarded = new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(payload),
    signal: req.signal,
  });
  return generateDiagramPOST(forwarded);
}
