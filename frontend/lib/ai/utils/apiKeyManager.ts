import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import Groq from 'groq-sdk';
import logger from '@/lib/logger';

export type AIProvider = 'groq' | 'openrouter';

// Ambient request ID for LLM call counting — no signature changes needed downstream
// Two counters:
//   networkAttempts — every operation() invocation (cost / quota)
//   logicalCalls    — every executeWithRetry entry (pipeline depth / repair loops)
export const requestContext = new AsyncLocalStorage<{
  requestId: string;
  networkAttempts: number;
  logicalCalls: number;
}>();

export function getRequestCounts(): { networkAttempts: number; logicalCalls: number } {
  const store = requestContext.getStore();
  return store
    ? { networkAttempts: store.networkAttempts, logicalCalls: store.logicalCalls }
    : { networkAttempts: -1, logicalCalls: -1 };
}

interface ApiKeyState {
  key: string;
  provider: AIProvider;
  inUse: number;
  lastUsed: number;
  consecutiveErrors: number;
  isRateLimited: boolean;
}

interface ModelConfig {
  provider: AIProvider;
  name: string;
  supportsStreaming?: boolean;
}

export const AVAILABLE_MODELS: ModelConfig[] = [
  // Groq Models (Primary - Fast!)
  { provider: 'groq', name: 'llama-3.3-70b-versatile' },
  { provider: 'groq', name: 'mixtral-8x7b-32768' },
  // OpenRouter Free Models (Fallback)
  { provider: 'openrouter', name: 'google/gemma-4-26b-a4b-it' },
  { provider: 'openrouter', name: 'nvidia/nemotron-3-super-120b-a12b' },
  { provider: 'openrouter', name: 'meta-llama/llama-3.3-70b-instruct' },
  { provider: 'openrouter', name: 'meta-llama/llama-3.2-3b-instruct' },
];

class ApiKeyManager {
  private groqKeys: ApiKeyState[] = [];
  private openrouterKeys: ApiKeyState[] = [];
  private currentGroqIndex = 0;
  private currentOpenrouterIndex = 0;
  private readonly maxConcurrentPerKey = 2;
  private readonly baseDelay = 1000;
  private readonly maxConsecutiveErrors = 3;
  private isInitialized = false;

  constructor() {
    this.initializeKeys();
  }

  initializeKeys(): void {
    this.groqKeys = [];
    this.openrouterKeys = [];
    
    // Load Groq keys
    const groqKeyEnvVars = [
      'GROQ_API_KEY_FOR_DESC_1',
      'GROQ_API_KEY_FOR_DESC_2',
      'GROQ_API_KEY_FOR_DESC_3',
      'GROQ_API_KEY_FOR_DESC_4',
      'GROQ_API_KEY_FOR_DESC_5',
      'GROQ_API_KEY_FOR_DESC_6',
      'GROQ_API_KEY_FOR_DESC_7',
      'GROQ_API_KEY_FOR_DESC_8',
      'GROQ_API_KEY_FOR_DESC_9',
      'GROQ_API_KEY_FOR_DESC_10',
    ];

    for (const envVar of groqKeyEnvVars) {
      const key = process.env[envVar];
      if (key && key.trim() !== '' && !key.startsWith('#')) {
        this.groqKeys.push({
          key,
          provider: 'groq',
          inUse: 0,
          lastUsed: 0,
          consecutiveErrors: 0,
          isRateLimited: false,
        });
      }
    }

    // Load fallback Groq key
    if (this.groqKeys.length === 0) {
      const fallback = process.env.GROQ_API_KEY;
      if (fallback && !fallback.startsWith('#')) {
        this.groqKeys.push({
          key: fallback,
          provider: 'groq',
          inUse: 0,
          lastUsed: 0,
          consecutiveErrors: 0,
          isRateLimited: false,
        });
      }
    }

    // Load OpenRouter keys
    const openrouterKeyEnvVars = [
      'OPENROUTER_API_KEY',
      'OPENROUTER_API_KEY_1',
      'OPENROUTER_API_KEY_2',
    ];

    for (const envVar of openrouterKeyEnvVars) {
      const key = process.env[envVar];
      if (key && key.trim() !== '' && !key.startsWith('#')) {
        this.openrouterKeys.push({
          key,
          provider: 'openrouter',
          inUse: 0,
          lastUsed: 0,
          consecutiveErrors: 0,
          isRateLimited: false,
        });
      }
    }

    this.isInitialized = true;
    logger.log(`[ApiKeyManager] Loaded ${this.groqKeys.length} Groq keys, ${this.openrouterKeys.length} OpenRouter keys`);
  }

  clearAllRateLimits(): void {
    for (const keyState of [...this.groqKeys, ...this.openrouterKeys]) {
      keyState.isRateLimited = false;
      keyState.consecutiveErrors = 0;
    }
    logger.log(`[ApiKeyManager] Cleared all rate limit states`);
  }

  refreshKeys(): void {
    logger.log(`[ApiKeyManager] Refreshing API keys...`);
    this.clearAllRateLimits();
    this.initializeKeys();
  }

  private getAvailableKey(provider: AIProvider): { key: string; index: number } | null {
    const keys = provider === 'groq' ? this.groqKeys : this.openrouterKeys;
    const currentIndex = provider === 'groq' ? this.currentGroqIndex : this.currentOpenrouterIndex;
    
    if (keys.length === 0) return null;

    const now = Date.now();
    
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const index = (currentIndex + attempt) % keys.length;
      const keyState = keys[index];

      if (keyState.inUse >= this.maxConcurrentPerKey) {
        continue;
      }

      if (keyState.isRateLimited) {
        const timeSinceLastUse = now - keyState.lastUsed;
        if (timeSinceLastUse > 60000) { // 60 second cooldown
          keyState.isRateLimited = false;
          keyState.consecutiveErrors = 0;
          logger.log(`[ApiKeyManager] ${provider} key ${index + 1} cooldown complete`);
        } else {
          continue;
        }
      }

      if (provider === 'groq') {
        this.currentGroqIndex = (index + 1) % keys.length;
      } else {
        this.currentOpenrouterIndex = (index + 1) % keys.length;
      }
      keyState.inUse++;
      keyState.lastUsed = now;
      return { key: keyState.key, index };
    }

    return null;
  }

  private releaseKey(provider: AIProvider, index: number): void {
    const keys = provider === 'groq' ? this.groqKeys : this.openrouterKeys;
    if (index >= 0 && index < keys.length) {
      keys[index].inUse = Math.max(0, keys[index].inUse - 1);
    }
  }

  private markKeyError(provider: AIProvider, index: number): void {
    const keys = provider === 'groq' ? this.groqKeys : this.openrouterKeys;
    if (index >= 0 && index < keys.length) {
      keys[index].consecutiveErrors++;
      if (keys[index].consecutiveErrors >= this.maxConsecutiveErrors) {
        keys[index].isRateLimited = true;
        logger.log(`[ApiKeyManager] ${provider} key ${index + 1} marked as rate-limited`);
      }
    }
  }

  private clearKeyError(provider: AIProvider, index: number): void {
    const keys = provider === 'groq' ? this.groqKeys : this.openrouterKeys;
    if (index >= 0 && index < keys.length) {
      keys[index].consecutiveErrors = 0;
      keys[index].isRateLimited = false;
    }
  }

  async executeWithGroq<T>(
    operation: (groq: Groq) => Promise<T>,
    options?: { maxRetries?: number }
  ): Promise<T> {
    return this.executeWithProvider<T>('groq', operation, options);
  }

  async executeWithOpenRouter<T>(
    operation: (openrouter: OpenRouterClient) => Promise<T>,
    options?: { maxRetries?: number; model?: string }
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? 5;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt % 2 === 0) {
        this.refreshKeys();
      }

      const keyInfo = this.getAvailableKey('openrouter');

      if (!keyInfo) {
        logger.log(`[ApiKeyManager] All OpenRouter keys busy/rate-limited, waiting 3s...`);
        await this.delay(3000);
        continue;
      }

      try {
        const store = requestContext.getStore();
        if (store) store.networkAttempts++;

        const client = new OpenRouterClient(keyInfo.key, options?.model);
        const result = await operation(client);
        this.releaseKey('openrouter', keyInfo.index);
        this.clearKeyError('openrouter', keyInfo.index);
        return result;
      } catch (error: unknown) {
        this.releaseKey('openrouter', keyInfo.index);
        
        const err = error as { status?: number; code?: string; message?: string };
        const status = err.status;
        const errorMessage = err.message || '';
        
        logger.log(`[ApiKeyManager] OpenRouter key ${keyInfo.index + 1} error: ${errorMessage}`);

        const isRateLimit = status === 429 || 
          errorMessage.includes('rate limit') ||
          errorMessage.includes('Too many requests');

        if (isRateLimit) {
          this.markKeyError('openrouter', keyInfo.index);
          const delay = this.baseDelay * Math.pow(2, Math.min(attempt, 5));
          logger.log(`[ApiKeyManager] OpenRouter rate limit, waiting ${delay/1000}s...`);
          await this.delay(delay);
        } else if (status && status >= 500) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          logger.log(`[ApiKeyManager] OpenRouter server error ${status}, waiting ${delay/1000}s...`);
          await this.delay(delay);
        } else if (status === 401 || status === 403) {
          throw error;
        } else {
          this.markKeyError('openrouter', keyInfo.index);
          throw error;
        }
      }
    }

    throw new Error('All OpenRouter keys exhausted after maximum retries');
  }

  private async executeWithProvider<T>(
    provider: AIProvider,
    operation: (client: Groq) => Promise<T>,
    options?: { maxRetries?: number }
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? 5;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt % 2 === 0) {
        this.refreshKeys();
      }

      const keyInfo = this.getAvailableKey(provider);

      if (!keyInfo) {
        logger.log(`[ApiKeyManager] All ${provider} keys busy/rate-limited, waiting 3s...`);
        await this.delay(3000);
        continue;
      }

      try {
        const groq = new Groq({ apiKey: keyInfo.key, dangerouslyAllowBrowser: true });
        const result = await operation(groq);
        this.releaseKey(provider, keyInfo.index);
        this.clearKeyError(provider, keyInfo.index);
        return result;
      } catch (error: unknown) {
        this.releaseKey(provider, keyInfo.index);
        
        const err = error as { status?: number; code?: string; message?: string };
        const status = err.status;
        const errorMessage = err.message || '';
        
        logger.log(`[ApiKeyManager] ${provider} key ${keyInfo.index + 1} error: ${errorMessage}`);

        const isRateLimit = status === 429 || 
          errorMessage.includes('rate limit') ||
          errorMessage.includes('tokens per day') ||
          errorMessage.includes('tokens per minute') ||
          errorMessage.includes('Too many requests');

        if (isRateLimit) {
          this.markKeyError(provider, keyInfo.index);
          const delay = this.baseDelay * Math.pow(2, Math.min(attempt, 5));
          logger.log(`[ApiKeyManager] Rate limit on ${provider} key ${keyInfo.index + 1}, waiting ${delay/1000}s...`);
          await this.delay(delay);
        } else if (status && status >= 500) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          logger.log(`[ApiKeyManager] Server error ${status}, waiting ${delay/1000}s...`);
          await this.delay(delay);
        } else if (status === 401 || status === 403) {
          throw error;
        } else {
          this.markKeyError(provider, keyInfo.index);
          throw error;
        }
      }
    }

    throw new Error(`All ${provider} keys exhausted after maximum retries`);
  }

  async executeWithRetry<T>(
    operation: (groq: Groq) => Promise<T>,
    options?: { maxRetries?: number; provider?: AIProvider }
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? 1;
    
    // Count one logical call per executeWithRetry entry (pipeline depth)
    const store = requestContext.getStore();
    if (store) store.logicalCalls++;
    
    // Strategy: 1. Try Groq keys (10→1), 2. Early fallback to OpenRouter after 2 rate-limited keys
    
    let lastError: Error | null = null;
    let rateLimitedCount = 0;
    
    for (let keyIndex = this.groqKeys.length - 1; keyIndex >= 0; keyIndex--) {
      const keyState = this.groqKeys[keyIndex];
      const keyNumber = keyIndex + 1;
      
      // Skip rate-limited keys
      if (keyState.isRateLimited) {
        const timeSinceLastUse = Date.now() - keyState.lastUsed;
        if (timeSinceLastUse < 60000) {
          continue; // Still in cooldown
        }
        keyState.isRateLimited = false;
      }
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          keyState.inUse++;
          keyState.lastUsed = Date.now();
          
          if (store) store.networkAttempts++;

          const groq = new Groq({ apiKey: keyState.key, dangerouslyAllowBrowser: true });
          const result = await operation(groq);
          
          keyState.inUse = Math.max(0, keyState.inUse - 1);
          keyState.consecutiveErrors = 0;
          logger.log(`[ApiKeyManager] Groq key ${keyNumber} succeeded`);
          return result;
        } catch (error: unknown) {
          keyState.inUse = Math.max(0, keyState.inUse - 1);
          const err = error as { status?: number; message?: string };
          lastError = new Error(err.message || 'Unknown error');
          
          // Don't retry on auth errors
          if (err.status === 401 || err.status === 403) {
            logger.log(`[ApiKeyManager] Groq key ${keyNumber} auth failed, skipping...`);
            break;
          }
          
          // Rate limit — back off then try next key
          if (err.status === 429 || (err.message || '').includes('rate limit')) {
            keyState.consecutiveErrors++;
            if (keyState.consecutiveErrors >= 2) {
              keyState.isRateLimited = true;
            }
            rateLimitedCount++;
            // Fast OpenRouter fallback after 2 rate-limited Groq keys
            if (rateLimitedCount >= 2 && this.openrouterKeys.length > 0) {
              logger.log('[ApiKeyManager] 2 Groq keys rate limited, trying OpenRouter early...');
              try {
                return await this.executeWithOpenRouter(
                  (client: OpenRouterClient) => operation(client as any as Groq),
                  { maxRetries: 1 }
                );
              } catch (openrouterError) {
                logger.log(`[ApiKeyManager] Early OpenRouter also failed: ${(openrouterError as Error).message}`);
              }
            }
            const delay = 3000; // 3s fixed delay per key
            logger.log(`[ApiKeyManager] Groq key ${keyNumber} rate limited (${delay/1000}s delay)...`);
            await this.delay(delay);
          } else if (err.status && err.status >= 500) {
            // Server error - retry
            const delay = this.baseDelay * Math.pow(2, attempt);
            logger.log(`[ApiKeyManager] Groq key ${keyNumber} server error ${err.status}, retrying...`);
            await this.delay(delay);
          } else {
            // Other error - log and continue to next attempt
            logger.log(`[ApiKeyManager] Groq key ${keyNumber} error: ${err.message}`);
          }
        }
      }
    }
    
    // Step 2: Fallback to OpenRouter if all Groq keys failed
    if (this.openrouterKeys.length > 0) {
      try {
        logger.log('[ApiKeyManager] All Groq keys failed, trying OpenRouter...');
        return await this.executeWithOpenRouter(
          (client: OpenRouterClient) => operation(client as any as Groq),
          { maxRetries: 1 }
        );
      } catch (openrouterError) {
        logger.log(`[ApiKeyManager] OpenRouter also failed: ${(openrouterError as Error).message}`);
      }
    }
    
    throw lastError || new Error('All API keys exhausted');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats(): { 
    total: number; 
    available: number; 
    inUse: number; 
    rateLimited: number;
    groqKeys: number;
    openrouterKeys: number;
  } {
    const allKeys = [...this.groqKeys, ...this.openrouterKeys];
    const inUse = allKeys.reduce((sum, k) => sum + k.inUse, 0);
    const rateLimited = allKeys.filter(k => k.isRateLimited).length;
    return {
      total: allKeys.length,
      available: allKeys.filter(k => !k.isRateLimited && k.inUse < this.maxConcurrentPerKey).length,
      inUse,
      rateLimited,
      groqKeys: this.groqKeys.length,
      openrouterKeys: this.openrouterKeys.length,
    };
  }

  hasOpenRouter(): boolean {
    return this.openrouterKeys.length > 0;
  }

  hasGroq(): boolean {
    return this.groqKeys.length > 0;
  }
}

export class OpenRouterClient {
  private apiKey: string;
  public model: string;
  public chat: {
    completions: {
      create: (options: {
        model?: string;
        messages: { role: string; content: string }[];
        temperature?: number;
        max_tokens?: number;
        stream?: boolean;
      }) => Promise<{ 
        choices: { message: { content: string } }[] 
      }>;
    };
  };

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || 'anthropic/claude-3.5-sonnet';
    
    this.chat = {
      completions: {
        create: this.createCompletion.bind(this),
      },
    };
  }

  private async createCompletion(options: {
    model?: string;
    messages: { role: string; content: string }[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
  }): Promise<{ 
    choices: { message: { content: string } }[] 
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://archdraw.ai',
          'X-Title': 'ArchDraw',
        },
        body: JSON.stringify({
          model: options.model || this.model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 4096,
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        throw new Error('OpenRouter request timed out after 60s');
      }
      throw error;
    }
  }
}

export const apiKeyManager = new ApiKeyManager();
