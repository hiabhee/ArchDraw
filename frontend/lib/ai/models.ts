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
}

export const MODELS: readonly ModelDefinition[] = [
  // Groq (primary — higher TPM for long prompts)
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 (70B)', provider: 'groq' },
  { id: 'openai/gpt-oss-120b', label: 'OpenAI GPT OSS (120B)', provider: 'groq', supportsStreaming: true },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 (8B)', provider: 'groq' },
  { id: 'openai/gpt-oss-20b', label: 'OpenAI GPT OSS (20B)', provider: 'groq' },
  // OpenRouter (additional options)
  { id: 'google/gemma-4-26b-a4b-it', label: 'Google Gemma 4 (26B)', provider: 'openrouter' },
  { id: 'nvidia/nemotron-3-super-120b-a12b', label: 'Nvidia Nemotron 3 Super (120B)', provider: 'openrouter' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Meta Llama 3.3 (70B)', provider: 'openrouter' },
  { id: 'meta-llama/llama-3.2-3b-instruct', label: 'Meta Llama 3.2 (3B)', provider: 'openrouter' },
] as const;

/** Default model for prompt → diagram generation (longer context, higher TPM on Groq). */
export const DEFAULT_GENERATION_MODEL = 'llama-3.3-70b-versatile';

/** Fallback when the primary model hits TPM limits or fails. */
export const FALLBACK_GENERATION_MODEL = 'openai/gpt-oss-120b';

export function getProviderForModel(modelId: string): AIProvider {
  // openai/gpt-oss-120b is served via Groq
  if (modelId === 'openai/gpt-oss-120b' || modelId === 'openai/gpt-oss-20b') {
    return 'groq';
  }
  return modelId.includes('/') ? 'openrouter' : 'groq';
}

export function isKnownModel(modelId: string): boolean {
  return MODELS.some((m) => m.id === modelId);
}