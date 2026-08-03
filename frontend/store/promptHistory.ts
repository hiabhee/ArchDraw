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
  favorites: PromptHistoryItem[];
  addToHistory: (prompt: string, model?: string, nodeCount?: number, score?: number) => void;
  addToFavorites: (item: PromptHistoryItem) => void;
  removeFromFavorites: (id: string) => void;
  clearHistory: () => void;
  getSuggestions: (currentPrompt: string) => PromptHistoryItem[];
}

const MAX_HISTORY = 50;

export const usePromptHistory = create<PromptHistoryState>()(
  persist(
    (set, get) => ({
      history: [],
      favorites: [],

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

      addToFavorites: (item: PromptHistoryItem) => {
        const { favorites } = get();
        if (!favorites.find(f => f.id === item.id)) {
          set({ favorites: [item, ...favorites] });
        }
      },

      removeFromFavorites: (id: string) => {
        const { favorites } = get();
        set({ favorites: favorites.filter(f => f.id !== id) });
      },

      clearHistory: () => {
        set({ history: [] });
      },

      getSuggestions: (currentPrompt: string) => {
        const { history } = get();
        const normalized = currentPrompt.toLowerCase();
        
        if (normalized.length < 3) return [];
        
        return history
          .filter(item => {
            const itemWords = item.prompt.toLowerCase().split(/\s+/);
            const promptWords = normalized.split(/\s+/);
            return itemWords.some(word => promptWords.some(pWord => word.includes(pWord) || pWord.includes(word)));
          })
          .slice(0, 5);
      },
    }),
    {
      name: 'archdraw-prompt-history',
      storage: createJSONStorage(() => serializedStorage),
      partialize: (state) => ({
        history: state.history,
        favorites: state.favorites,
      }),
    }
  )
);

export const PROMPT_SUGGESTIONS = [
  {
    category: 'Common Patterns',
    prompts: [
      { title: 'E-Commerce', prompt: 'Microservices e-commerce platform with user auth, product catalog, shopping cart, payment processing, inventory management, and order fulfillment' },
      { title: 'Real-time Chat', prompt: 'Real-time chat application with WebSocket support, message persistence, push notifications, typing indicators, and read receipts' },
      { title: 'Video Streaming', prompt: 'Video streaming platform with CDN, transcoding pipeline, user authentication, content recommendations, and DRM protection' },
      { title: 'Social Media', prompt: 'Social media platform with user profiles, posts, feeds, real-time notifications, media uploads, and follower relationships' },
      { title: 'IoT Platform', prompt: 'IoT platform with device management, time-series data ingestion, real-time analytics, alerting, and dashboard visualization' },
    ],
  },
  {
    category: 'Backend Services',
    prompts: [
      { title: 'API Gateway', prompt: 'API Gateway with rate limiting, authentication, request routing, response caching, and API versioning' },
      { title: 'Auth Service', prompt: 'Authentication service with OAuth2, JWT tokens, session management, MFA support, and social login' },
      { title: 'Payment System', prompt: 'Payment processing system with multiple payment providers, fraud detection, idempotency, and transaction logging' },
      { title: 'Data Pipeline', prompt: 'Data pipeline with Kafka, stream processing, ETL jobs, data warehouse integration, and real-time analytics' },
    ],
  },
  {
    category: 'Infrastructure',
    prompts: [
      { title: 'Microservices', prompt: 'Microservices architecture with API gateway, service discovery, load balancing, circuit breakers, and distributed tracing' },
      { title: 'Serverless', prompt: 'Serverless architecture with Lambda functions, API Gateway, DynamoDB, S3, and CloudWatch monitoring' },
      { title: 'CI/CD Pipeline', prompt: 'CI/CD pipeline with GitHub Actions, automated testing, Docker containers, Kubernetes deployment, and blue-green releases' },
      { title: 'Multi-Region', prompt: 'Multi-region deployment with global load balancing, data replication, failover handling, and latency optimization' },
    ],
  },
];
