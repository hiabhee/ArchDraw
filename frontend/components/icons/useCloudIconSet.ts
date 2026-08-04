'use client';

import { useEffect, useState } from 'react';
import { preloadCloudIconSet, type IconSet } from '@/lib/cloudIcons/loader';
import type { CloudProviderId } from '@/lib/cloudIcons/types';

/**
 * Lazily loads (and caches per session) the icon set for a provider, keyed by
 * the provider's first activation. Only ever loads what is toggled.
 */
export function useCloudIconSet(provider: CloudProviderId | null): IconSet | null {
  const [iconSet, setIconSet] = useState<IconSet | null>(null);

  useEffect(() => {
    let alive = true;
    if (provider) {
      preloadCloudIconSet(provider).then((set) => {
        if (alive) setIconSet(set);
      });
    }
    return () => {
      alive = false;
    };
  }, [provider]);

  // Never surface a stale set for a disabled provider; only ever show the
  // loaded set when the provider is active.
  return provider ? iconSet : null;
}
