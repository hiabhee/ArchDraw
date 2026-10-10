import { OPENAPI_SPEC } from '@/lib/openapiSpec';

export const runtime = 'nodejs';

export function GET() {
  return new Response(JSON.stringify(OPENAPI_SPEC, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
