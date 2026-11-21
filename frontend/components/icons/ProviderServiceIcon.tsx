'use client';

import { useEffect, useState } from 'react';
import { CloudProviderIcon } from '@/components/icons/CloudProviderIcon';
import type { AwsBrandIconComponent } from '@/lib/icons/cloud/awsBrandIconMap';
import type { CloudProviderId } from '@/lib/icons/cloud/types';

interface ProviderServiceIconProps {
  provider: CloudProviderId;
  serviceKey: string;
  size?: number;
  color?: string;
}

type AwsIconMap = Record<string, AwsBrandIconComponent>;

/**
 * The official AWS icons come from `@react-icons-cloud/aws`, a single pre-bundled file of
 * ~500 icons (~250 KB compressed) that the bundler cannot tree-shake. Loading it statically
 * put it in every canvas bundle, including the landing hero, which shows no AWS components.
 * It is now imported the first time an AWS component renders and shared by all of them.
 */
let awsIcons: AwsIconMap | null = null;
let awsIconsLoading: Promise<AwsIconMap> | null = null;

function loadAwsIcons(): Promise<AwsIconMap> {
  awsIconsLoading ??= import('@/lib/icons/cloud/awsBrandIconMap').then((m) => {
    awsIcons = m.AWS_BRAND_ICON_MAP;
    return awsIcons;
  });
  return awsIconsLoading;
}

function useAwsIcons(enabled: boolean): AwsIconMap | null {
  const [icons, setIcons] = useState<AwsIconMap | null>(awsIcons);
  useEffect(() => {
    if (!enabled || icons) return;
    let live = true;
    loadAwsIcons().then((map) => { if (live) setIcons(map); }).catch(() => {});
    return () => { live = false; };
  }, [enabled, icons]);
  return icons;
}

/**
 * Renders the official AWS architecture icon when available, otherwise the path glyph for
 * AWS/Azure dictionary keys (also shown for the moment before the AWS icons load).
 */
export function ProviderServiceIcon({ provider, serviceKey, size = 18, color }: ProviderServiceIconProps) {
  const icons = useAwsIcons(provider === 'aws');
  const AwsIcon = provider === 'aws' ? icons?.[serviceKey] : undefined;
  if (AwsIcon) return <AwsIcon size={size} aria-hidden />;
  return <CloudProviderIcon provider={provider} serviceKey={serviceKey} size={size} color={color} />;
}
