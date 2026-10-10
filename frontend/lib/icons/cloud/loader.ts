/**
 * Lazy icon-set loader (Rule 6.4). Each provider's icon set is code-split and
 * only fetched on first toggle activation; the resolved module is cached for
 * the rest of the session.
 */

import type { CloudProviderId } from './types';

export type IconSet = Record<string, string>;

const cache: Partial<Record<CloudProviderId, Promise<IconSet>>> = {};

export function preloadCloudIconSet(provider: CloudProviderId): Promise<IconSet> {
  if (!cache[provider]) {
    cache[provider] =
      provider === 'aws'
        ? import('./iconData/aws').then((m) => m.AWS_ICON_PATHS)
        : import('./iconData/azure').then((m) => m.AZURE_ICON_PATHS);
    // Drop failed loads so a later toggle can retry.
    cache[provider]!.catch(() => {
      delete cache[provider];
    });
  }
  return cache[provider]!;
}
