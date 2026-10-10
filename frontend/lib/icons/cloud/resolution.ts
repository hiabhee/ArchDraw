/**
 * Render-layer resolution (Rule 5.1). Pure function that maps a node + the
 * active toggle to a cloud icon variant. It never touches node geometry,
 * layout, edges, or network — toggling is a pure re-render.
 *
 * Priority:
 * - `nonCloud` / `genericComponent` → null (keep default icon)
 * - matched active provider      → provider icon
 * - `matchedBoth`                → active provider icon
 * - matched only other provider  → null (default icon — a wrong icon is worse)
 * - `unmatched`                  → vendor-neutral generic cloud icon, UNLESS the
 *   node is already explicitly branded for the active provider (e.g. created
 *   from the AWS palette), in which case the existing provider icon is kept.
 */

import { classifyCloudNode, getNodeProviderAffinity } from './classifier';
import { CLOUD_BRAND_COLORS } from './dictionaries';
import type { CloudNodeInput, CloudProviderId, CloudProviderToggle } from './types';

export type CloudIconVariant =
  | { kind: CloudProviderId; serviceKey: string; color: string }
  | { kind: 'generic'; color: string }
  | null;

/** Single vendor-neutral generic cloud icon color. */
export const GENERIC_CLOUD_COLOR = '#64748b';

export function resolveCloudIcon(input: CloudNodeInput, toggle: CloudProviderToggle): CloudIconVariant {
  if (toggle === 'off') return null;

  const cls = classifyCloudNode(input);
  if (cls.tier !== 'cloudService') return null;

  switch (cls.state) {
    case 'matchedBoth':
      return {
        kind: toggle,
        serviceKey: toggle === 'aws' ? cls.awsMatch! : cls.azureMatch!,
        color: CLOUD_BRAND_COLORS[toggle],
      };
    case 'matchedAWS':
      return toggle === 'aws'
        ? { kind: 'aws', serviceKey: cls.awsMatch!, color: CLOUD_BRAND_COLORS.aws }
        : null;
    case 'matchedAzure':
      return toggle === 'azure'
        ? { kind: 'azure', serviceKey: cls.azureMatch!, color: CLOUD_BRAND_COLORS.azure }
        : null;
    case 'unmatched':
      // Node already branded for the active provider (palette / repo import):
      // keep its existing icon rather than replacing it with a generic cloud.
      return getNodeProviderAffinity(input) === toggle ? null : { kind: 'generic', color: GENERIC_CLOUD_COLOR };
  }
}
