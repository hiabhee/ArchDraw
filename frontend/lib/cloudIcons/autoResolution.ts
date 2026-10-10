/**
 * Per-node provider icon resolution — no global AWS/Azure toggle required.
 * Shows the matching provider logo only when the node is classified as that
 * service (label, palette typeId, or technology field).
 */

import { classifyCloudNode, getNodeProviderAffinity } from './classifier';
import { CLOUD_BRAND_COLORS } from './dictionaries';
import type { CloudNodeInput, CloudProviderId } from './types';

export type AutoCloudIconVariant = {
  kind: CloudProviderId;
  serviceKey: string;
  color: string;
};

function providerHintFromLabel(label?: string): 'aws' | 'azure' | null {
  const normalized = (label ?? '').toLowerCase();
  if (/\b(aws|amazon)\b/.test(normalized)) return 'aws';
  if (/\b(azure|microsoft)\b/.test(normalized)) return 'azure';
  return null;
}

function resolveAffinityServiceKey(input: CloudNodeInput, provider: 'aws' | 'azure'): string | null {
  const candidates = [input.technology, input.typeId, input.componentId, input.icon];
  return candidates.find((key) => key?.startsWith(`${provider}-`)) ?? null;
}

/** Resolve a provider-specific icon for this node, or null to keep the default glyph. */
export function resolveAutoCloudIcon(input: CloudNodeInput): AutoCloudIconVariant | null {
  const affinity = getNodeProviderAffinity(input);
  if (affinity) {
    const serviceKey = resolveAffinityServiceKey(input, affinity);
    if (serviceKey) {
      return { kind: affinity, serviceKey, color: CLOUD_BRAND_COLORS[affinity] };
    }
  }

  const cls = classifyCloudNode(input);
  if (cls.tier !== 'cloudService') return null;

  switch (cls.state) {
    case 'matchedAWS':
      return cls.awsMatch
        ? { kind: 'aws', serviceKey: cls.awsMatch, color: CLOUD_BRAND_COLORS.aws }
        : null;
    case 'matchedAzure':
      return cls.azureMatch
        ? { kind: 'azure', serviceKey: cls.azureMatch, color: CLOUD_BRAND_COLORS.azure }
        : null;
    case 'matchedBoth': {
      const hint = providerHintFromLabel(input.label);
      if (hint === 'aws' && cls.awsMatch) {
        return { kind: 'aws', serviceKey: cls.awsMatch, color: CLOUD_BRAND_COLORS.aws };
      }
      if (hint === 'azure' && cls.azureMatch) {
        return { kind: 'azure', serviceKey: cls.azureMatch, color: CLOUD_BRAND_COLORS.azure };
      }
      return null;
    }
    case 'unmatched':
      return null;
  }
}
