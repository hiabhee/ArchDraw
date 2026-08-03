import { create } from 'zustand';
import { MODELS, getProviderForModel as sharedGetProviderForModel } from '@/lib/ai/models';

/**
 * Client view of the canonical model registry (`lib/ai/models.ts`). Re-exported
 * in the legacy `{ id, name, provider }` shape that the UI dropdown already
 * consumes, so there is exactly one source of truth shared with the server's
 * apiKeyManager. Do not add models here — add them to `lib/ai/models.ts`.
 */
export const AVAILABLE_MODELS = MODELS.map((m) => ({
  id: m.id,
  name: m.label,
  provider: m.provider,
})) as readonly { id: string; name: string; provider: 'groq' | 'openrouter' }[];

export function getProviderForModel(modelId: string): 'groq' | 'openrouter' {
  return sharedGetProviderForModel(modelId);
}

type ModelStore = {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
};

export const useModelStore = create<ModelStore>((set) => ({
  selectedModel: 'openai/gpt-oss-120b',
  setSelectedModel: (model) => set({ selectedModel: model }),
}));