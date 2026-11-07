import { cn } from '@/lib/utils';

/**
 * A template's diagram as the gallery shows it: the static light and dark SVGs from
 * `/templates/<slug>/diagram-{light,dark}.svg`, swapped by the site theme (`dark` class).
 * `width`/`height` are the SVG's own size so the browser reserves the space.
 */
export function TemplateDiagram({
  slug,
  alt,
  width,
  height,
  priority = false,
  className,
}: {
  slug: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
}) {
  const shared = { width, height, decoding: 'async' as const, loading: priority ? ('eager' as const) : ('lazy' as const) };
  const base = cn('h-auto w-full', className);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img {...shared} alt={alt} src={`/templates/${slug}/diagram-light.svg`} className={cn(base, 'dark:hidden')} />
      {/* Only one of the two is shown, so they share one accessible name. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img {...shared} alt={alt} src={`/templates/${slug}/diagram-dark.svg`} className={cn(base, 'hidden dark:block')} />
    </>
  );
}
