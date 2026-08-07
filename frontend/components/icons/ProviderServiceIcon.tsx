'use client';

import { AWS_BRAND_ICON_MAP } from '@/lib/cloudIcons/awsBrandIconMap';
import { CloudProviderIcon } from '@/components/icons/CloudProviderIcon';
import type { CloudProviderId } from '@/lib/cloudIcons/types';

interface ProviderServiceIconProps {
  provider: CloudProviderId;
  serviceKey: string;
  size?: number;
  color?: string;
}

/**
 * Renders the official AWS architecture icon when available, otherwise the
 * lazy-loaded path glyph for AWS/Azure dictionary keys.
 */
export function ProviderServiceIcon({ provider, serviceKey, size = 18, color }: ProviderServiceIconProps) {
  if (provider === 'aws') {
    const AwsIcon = AWS_BRAND_ICON_MAP[serviceKey];
    if (AwsIcon) {
      return <AwsIcon size={size} aria-hidden />;
    }
  }

  return <CloudProviderIcon provider={provider} serviceKey={serviceKey} size={size} color={color} />;
}
