import { TEMPLATES } from '@/data/templates/index';
import { TUTORIALS } from '@/data/tutorials';
import { SITE_URL } from '@/lib/site/discovery';
import { templateHeading, templateSlug } from '@/lib/site/templateCatalog';
import type { SiteCatalog } from '@/lib/site/webmcpTools';

/**
 * A small machine-readable index of the templates and tutorials, read on demand by the
 * in-page WebMCP tools (`components/providers/WebMcpTools.tsx`) so the page itself does
 * not carry the list. Static: built once per deploy.
 */
export const dynamic = 'force-static';

export function GET() {
  const catalog: SiteCatalog = {
    templates: TEMPLATES.map((t) => ({
      id: t.id,
      name: templateHeading(t),
      description: t.description,
      tags: t.tags,
      url: `${SITE_URL}/templates/${templateSlug(t)}`,
    })),
    tutorials: TUTORIALS.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      difficulty: t.difficulty,
      minutes: t.estimatedMinutes,
      tags: t.tags ?? [],
      url: `${SITE_URL}/tutorials/${t.id}`,
    })),
  };
  return Response.json(catalog, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } });
}
