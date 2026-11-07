import { allTemplateSlugs, getTemplateBySlug } from '@/lib/site/templateCatalog';
import { templatePreviewSvg } from '@/lib/server/templatePreview';

export const runtime = 'nodejs';
export const dynamicParams = false;

const FILES = { 'diagram-light.svg': 'light', 'diagram-dark.svg': 'dark' } as const;
type PreviewFile = keyof typeof FILES;

/** `/templates/<slug>/diagram-{light,dark}.svg`: the gallery's diagram images, built at build time. */
export function generateStaticParams() {
  return allTemplateSlugs().flatMap((slug) => (Object.keys(FILES) as PreviewFile[]).map((file) => ({ slug, file })));
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; file: string }> }) {
  const { slug, file } = await params;
  const template = getTemplateBySlug(slug);
  const theme = FILES[file as PreviewFile];
  if (!template || !theme) return new Response('Not found', { status: 404 });

  const svg = await templatePreviewSvg(template, theme);
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      // The SVG is our own export, but never let it run script if opened directly.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
