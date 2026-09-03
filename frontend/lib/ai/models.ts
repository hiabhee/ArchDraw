/**
 * Canonical AI model registry — the single source of truth for which models
 * the application offers and can route.
 *
 * Previously the client (`lib/ai/utils/modelStore.ts`) and the server
 * (`lib/ai/utils/apiKeyManager.ts`) each declared their own `AVAILABLE_MODELS`
 * with different members and only 2 entries in common, so the UI offered
 * models the server rejected and the server could run models the UI didn't
 * show. Both now derive their typed lists from this module so they cannot
 * diverge again.
 *
 * Field semantics:
 *   - `id`    : the model identifier sent to the provider API (e.g.
 *               'openai/gpt-oss-120b'). Also used as the wire value for the
 *               `model` field in /api/generate-diagram.
 *   - `label` : human-readable name shown in the UI dropdown.
 *   - `provider`: which key pool / client the orchestrator uses.
 */

export type AIProvider = 'groq' | 'openrouter';

export interface ModelDefinition {
  id: string;
  label: string;
  provider: AIProvider;
  supportsStreaming?: boolean;
  /** Approximate cost tier (1=cheapest, 5=most expensive) for smart fallback */
  costTier?: 1 | 2 | 3 | 4 | 5;
  /** Recommended max tokens for this model to stay within typical budget constraints */
  recommendedMaxTokens?: number;
}

export const MODELS: readonly ModelDefinition[] = [
  // Groq (primary — higher TPM for long prompts)
  { id: 'openai/gpt-oss-120b', label: 'OpenAI GPT OSS (120B)', provider: 'groq', supportsStreaming: true, costTier: 4, recommendedMaxTokens: 4096 },
  { id: 'openai/gpt-oss-20b', label: 'OpenAI GPT OSS (20B)', provider: 'groq', costTier: 2, recommendedMaxTokens: 3072 },
  { id: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 (27B)', provider: 'groq', costTier: 2, recommendedMaxTokens: 4096 },
  { id: 'groq/compound-mini', label: 'Groq Compound Mini', provider: 'groq', costTier: 1, recommendedMaxTokens: 8192 },
  // OpenRouter (additional options)
  { id: 'google/gemma-4-26b-a4b-it', label: 'Google Gemma 4 (26B)', provider: 'openrouter', costTier: 2, recommendedMaxTokens: 3072 },
  { id: 'nvidia/nemotron-3-super-120b-a12b', label: 'Nvidia Nemotron 3 Super (120B)', provider: 'openrouter', costTier: 5, recommendedMaxTokens: 4096 },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Meta Llama 3.3 (70B)', provider: 'openrouter', costTier: 3, recommendedMaxTokens: 4096 },
  { id: 'meta-llama/llama-3.2-3b-instruct', label: 'Meta Llama 3.2 (3B)', provider: 'openrouter', costTier: 1, recommendedMaxTokens: 2048 },
] as const;

/** Default model for prompt → diagram generation (longer context, higher TPM on Groq). */
export const DEFAULT_GENERATION_MODEL = 'groq/compound-mini';

/** Fallback when the primary model hits TPM limits or fails. */
export const FALLBACK_GENERATION_MODEL = 'openai/gpt-oss-120b';

/** Budget-friendly model for low-credit scenarios (OpenRouter fallback) */
export const BUDGET_FALLBACK_MODEL = 'meta-llama/llama-3.2-3b-instruct';

/**
 * Get a cheaper alternative model for OpenRouter when credits are low.
 * Returns a model that requires fewer tokens or costs less per token.
 */
export function getCheaperModel(currentModel: string): string | null {
  const current = MODELS.find(m => m.id === currentModel);
  if (!current || !current.costTier) return BUDGET_FALLBACK_MODEL;
  
  // Find a cheaper OpenRouter model
  const cheaper = MODELS
    .filter(m => m.provider === 'openrouter' && m.costTier && m.costTier < current.costTier!)
    .sort((a, b) => (b.costTier || 0) - (a.costTier || 0))[0]; // Get the most capable cheaper model
  
  return cheaper?.id || BUDGET_FALLBACK_MODEL;
}

/**
 * Get recommended max tokens for a model, considering its cost tier.
 */
export function getRecommendedMaxTokens(modelId: string, requestedTokens: number): number {
  const model = MODELS.find(m => m.id === modelId);
  if (!model || !model.recommendedMaxTokens) return Math.min(requestedTokens, 2048);
  
  return Math.min(requestedTokens, model.recommendedMaxTokens);
}

export function getProviderForModel(modelId: string): AIProvider {
  const model = MODELS.find((m) => m.id === modelId);
  if (model) return model.provider;
  return modelId.includes('/') ? 'openrouter' : 'groq';
}

export function isKnownModel(modelId: string): boolean {
  return MODELS.some((m) => m.id === modelId);
}