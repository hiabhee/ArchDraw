'use client';

import { useCloudIconSet } from './useCloudIconSet';
import type { CloudProviderId } from '@/lib/cloudIcons/types';

interface CloudProviderIconProps {
  provider: CloudProviderId;
  serviceKey: string;
  size?: number;
  color?: string;
}

/**
 * Renders a provider icon glyph for a classified service. Fixed-size SVG slot
 * (Rule 5.2) — never affects node dimensions, handles, or edge routing.
 */
export function CloudProviderIcon({ provider, serviceKey, size = 14, color }: CloudProviderIconProps) {
  const iconSet = useCloudIconSet(provider);
  const path = iconSet?.[serviceKey];
  if (!path) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={path} />
    </svg>
  );
}

interface GenericCloudIconProps {
  size?: number;
  color?: string;
}

/** The single vendor-neutral generic cloud icon (Rule 6.3). */
export function GenericCloudIcon({ size = 14, color }: GenericCloudIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.5 18H8a5 5 0 1 1 .85-9.93 6.25 6.25 0 0 1 11.9 1.18A4 4 0 0 1 17.5 18zm-9.5-2h9.5a2 2 0 0 0 .5-3.94l-1.14-.32-.1-1.18a4.25 4.25 0 0 0-8.3-.68l-.2.8-1.46.05A3 3 0 0 0 8 16z" />
    </svg>
  );
}
