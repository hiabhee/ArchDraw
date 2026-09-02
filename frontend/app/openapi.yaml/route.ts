import { OPENAPI_SPEC } from '@/lib/openapiSpec';
import * as yaml from 'yaml';

export const runtime = 'nodejs';

export function GET() {
  const yamlText = yaml.stringify(OPENAPI_SPEC);
  return new Response(yamlText, {
    headers: {
      'Content-Type': 'text/yaml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
