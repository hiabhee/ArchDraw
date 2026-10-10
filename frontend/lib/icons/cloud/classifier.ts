/**
 * Client-side fallback classifier (Rule 3.4). Pure and dependency-free so it can
 * run anywhere (node creation, AI-streamed arrivals, manual renames, repo
 * import) and be unit-tested in vitest.
 *
 * Match order per provider: exact canonical name → aliases → conservative
 * keyword list. AWS and Azure are checked independently; `matchedBoth` is only
 * produced when a curated 1:1 equivalence pair matches (never string
 * similarity).
 */

import { CLOUD_EQUIVALENCE, CLOUD_SERVICE_ENTRIES, type CloudServiceEntry } from './dictionaries';
import type { CloudNodeClassification, CloudNodeInput, CloudProviderId, NodeCloudTier, ProviderMatchState } from './types';

const NON_CLOUD_TYPES = new Set(['textLabelNode', 'annotationNode', 'groupNode', 'group', 'frameNode']);
const NON_CLOUD_SERVICE_TYPES = new Set(['client', 'docker']);
const NON_CLOUD_LABEL_MARKERS: RegExp[] = [
  /\b(client|browser|mobile|phone|tablet|laptop|desktop)\b/i,
  /\b(docker|kubernetes|k8s|on.?prem|self.?hosted|local)\b/i,
  /\b(text|note|annotation|label|group)\b/i,
];

/** Lowercase, punctuation stripped, whitespace collapsed. */
export function normalizeCloudLabel(label?: string): string {
  return (label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(label: string): Set<string> {
  return new Set(label.split(' ').filter(Boolean));
}

/** Keyword match requires every keyword token to appear as a whole label token. */
function keywordMatch(label: string, entry: CloudServiceEntry): boolean {
  const tokens = tokenSet(label);
  if (tokens.size === 0) return false;
  return entry.keywords.some((kw) => {
    const kwTokens = normalizeCloudLabel(kw).split(' ').filter(Boolean);
    return kwTokens.length > 0 && kwTokens.every((t) => tokens.has(t));
  });
}

function findProviderMatch(label: string, provider: CloudProviderId): string | null {
  const entries = CLOUD_SERVICE_ENTRIES[provider];
  // 1. exact canonical name
  for (const e of entries) {
    if (label === normalizeCloudLabel(e.name)) return e.key;
  }
  // 2. aliases
  for (const e of entries) {
    if (e.aliases.some((a) => label === normalizeCloudLabel(a))) return e.key;
  }
  // 3. conservative keyword list
  for (const e of entries) {
    if (keywordMatch(label, e)) return e.key;
  }
  return null;
}

function hasProviderAffinity(input: CloudNodeInput, provider: CloudProviderId): boolean {
  const prefix = `${provider}-`;
  return (
    input.typeId?.startsWith(prefix) === true ||
    input.componentId?.startsWith(prefix) === true ||
    input.technology?.startsWith(prefix) === true ||
    input.icon?.startsWith(prefix) === true
  );
}

export function getNodeProviderAffinity(input: CloudNodeInput): CloudProviderId | null {
  if (hasProviderAffinity(input, 'aws')) return 'aws';
  if (hasProviderAffinity(input, 'azure')) return 'azure';
  return null;
}

function classifyTier(input: CloudNodeInput, label: string, awsMatch: string | null, azureMatch: string | null): NodeCloudTier {
  if (input.typeId && NON_CLOUD_TYPES.has(input.typeId)) return 'nonCloud';
  if (input.serviceType && NON_CLOUD_SERVICE_TYPES.has(input.serviceType)) return 'nonCloud';
  if (label && NON_CLOUD_LABEL_MARKERS.some((m) => m.test(label))) return 'nonCloud';
  const providerPrefixed =
    hasProviderAffinity(input, 'aws') || hasProviderAffinity(input, 'azure');
  if (providerPrefixed || awsMatch || azureMatch) return 'cloudService';
  return 'genericComponent';
}

function computeState(awsMatch: string | null, azureMatch: string | null): ProviderMatchState {
  if (awsMatch && azureMatch) {
    // matchedBoth requires a curated 1:1 equivalence pair — never similarity.
    return CLOUD_EQUIVALENCE[awsMatch] === azureMatch ? 'matchedBoth' : 'unmatched';
  }
  if (awsMatch) return 'matchedAWS';
  if (azureMatch) return 'matchedAzure';
  return 'unmatched';
}

export function classifyCloudNode(input: CloudNodeInput): CloudNodeClassification {
  const label = normalizeCloudLabel(input.label);
  const awsMatch = findProviderMatch(label, 'aws');
  const azureMatch = findProviderMatch(label, 'azure');
  const tier = classifyTier(input, label, awsMatch, azureMatch);
  // Unmatched providers are irrelevant for non-cloud tiers.
  const finalAws = tier === 'cloudService' ? awsMatch : null;
  const finalAzure = tier === 'cloudService' ? azureMatch : null;
  return {
    tier,
    awsMatch: finalAws,
    azureMatch: finalAzure,
    state: computeState(finalAws, finalAzure),
  };
}
