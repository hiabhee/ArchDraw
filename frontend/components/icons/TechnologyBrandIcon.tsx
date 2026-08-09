'use client';

import { getTechnologyBrandSlug, technologyBrandIconUrl } from '@/lib/brandIcons';

interface TechnologyBrandIconProps {
  technology: string;
  size?: number;
  color?: string;
}

/** Renders a third-party brand logo from Simple Icons when the technology is known. */
export function TechnologyBrandIcon({ technology, size = 18, color }: TechnologyBrandIconProps) {
  const slug = getTechnologyBrandSlug(technology);
  if (!slug) return null;

  return (
    <img
      src={technologyBrandIconUrl(slug, color)}
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        maxWidth: size,
        maxHeight: size,
        objectFit: 'contain',
      }}
      draggable={false}
    />
  );
}
