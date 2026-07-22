import { create } from 'zustand';

export const AVAILABLE_MODELS = [
  { id: 'llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout (17B)', provider: 'groq' as const },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 (70B)', provider: 'groq' as const },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq' as const },
  { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT OSS (120B)', provider: 'openrouter' as const },
] as const;

export function getProviderForModel(modelId: string): 'groq' | 'openrouter' {
  return modelId.includes('/') ? 'openrouter' : 'groq';
}

type ModelStore = {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
};

export const useModelStore = create<ModelStore>((set) => ({
  selectedModel: 'llama-3.3-70b-versatile',
  setSelectedModel: (model) => set({ selectedModel: model }),
}));
