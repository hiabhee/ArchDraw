/**
 * Cloud provider icon types — the shared data model for the render-only
 * AWS/Azure icon toggle. These types describe *classification* of nodes, never
 * node geometry, layout, or the Mermaid IR.
 */

export type CloudProviderId = 'aws' | 'azure';

/** Global three-way state: `'off' | 'aws' | 'azure'`. Never two booleans. */
export type CloudProviderToggle = 'off' | CloudProviderId;

/**
 * Three-tier node typing.
 * - `cloudService` — eligible for provider icons.
 * - `genericComponent` — ambiguous; always keeps its default icon.
 * - `nonCloud` — permanently excluded (clients, docker, groups, text, …).
 *
 * Ambiguity must land in `genericComponent`: a wrong icon is worse than none.
 */
export type NodeCloudTier = 'cloudService' | 'genericComponent' | 'nonCloud';

/**
 * Per-provider match state. `matchedBoth` is only reachable via the curated
 * 1:1 equivalence table in `dictionaries.ts` — never from string similarity.
 */
export type ProviderMatchState = 'matchedAWS' | 'matchedAzure' | 'matchedBoth' | 'unmatched';

export interface CloudNodeClassification {
  tier: NodeCloudTier;
  /** Canonical `serviceKey` matched in the AWS dictionary, or null. */
  awsMatch: string | null;
  /** Canonical `serviceKey` matched in the Azure dictionary, or null. */
  azureMatch: string | null;
  state: ProviderMatchState;
}

/** Subset of node data the classifier is allowed to read. */
export interface CloudNodeInput {
  label?: string;
  typeId?: string;
  componentId?: string;
  technology?: string;
  serviceType?: string;
  icon?: string;
}
