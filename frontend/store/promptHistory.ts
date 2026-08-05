import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { serializedStorage } from '@/lib/storage/localStorage';

export interface PromptHistoryItem {
  id: string;
  prompt: string;
  timestamp: number;
  model?: string;
  nodeCount?: number;
  score?: number;
}

interface PromptHistoryState {
  history: PromptHistoryItem[];
  addToHistory: (prompt: string, model?: string, nodeCount?: number, score?: number) => void;
}

const MAX_HISTORY = 50;

export const usePromptHistory = create<PromptHistoryState>()(
  persist(
    (set, get) => ({
      history: [],

      addToHistory: (prompt: string, model?: string, nodeCount?: number, score?: number) => {
        const { history } = get();
        
        const newItem: PromptHistoryItem = {
          id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          prompt: prompt.trim(),
          timestamp: Date.now(),
          model,
          nodeCount,
          score,
        };

        const filteredHistory = history.filter(h => h.prompt.toLowerCase() !== prompt.toLowerCase());
        const newHistory = [newItem, ...filteredHistory].slice(0, MAX_HISTORY);
        
        set({ history: newHistory });
      },
    }),
    {
      name: 'archdraw-prompt-history',
      storage: createJSONStorage(() => serializedStorage),
      partialize: (state) => ({
        history: state.history,
      }),
    }
  )
);
