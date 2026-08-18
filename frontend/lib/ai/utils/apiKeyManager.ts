import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import Groq from 'groq-sdk';
import logger from '@/lib/logger';
import { DEFAULT_GENERATION_MODEL, MODELS, type AIProvider, getCheaperModel, getRecommendedMaxTokens } from '@/lib/ai/models';

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

export const AVAILABLE_MODELS: ModelConfig[] = MODELS.map((m) => ({
  provider: m.provider,
  name: m.id,
  ...(m.supportsStreaming !== undefined ? { supportsStreaming: m.supportsStreaming } : {}),
}));

/**
 * Groq rate limits are enforced per organization, not per API key — so with
 * all keys on the same account, round-robin across them does not raise the
 * token/minute ceiling. This flag keeps the round-robin logic available but
 * unplugged by default; enable it only if keys ever live on separate Groq orgs.
 */
const ROUND_ROBIN_GROQ_KEYS = process.env.GROQ_KEY_ROUND_ROBIN === 'true';

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
      keys[index].inUse -= 1;
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
        } else if (status === 401 || status === 402 || status === 403) {
          logger.log(`[ApiKeyManager] OpenRouter key ${keyInfo.index + 1} unrecoverable error ${status} — aborting key rotation`);
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
        const groq = new Groq({ apiKey: keyInfo.key });
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
    const maxRetries = options?.maxRetries ?? 3;
    
    // Count one logical call per executeWithRetry entry (pipeline depth)
    const store = requestContext.getStore();
    if (store) store.logicalCalls++;
    
    // Strategy: 1. Try Groq keys in a fixed fallback order (skipping
    // rate-limited keys), rotating round-robin only when ROUND_ROBIN_GROQ_KEYS
    // is enabled. 2. Fall back to OpenRouter only after all Groq keys fail.
    
    let lastError: Error | null = null;
    const keyCount = this.groqKeys.length;
    if (keyCount === 0) {
      throw new Error('No Groq API keys configured');
    }

    // With round-robin unplugged, walk keys in fixed order (last → first) so
    // the active behavior is a simple fallback chain. When enabled, cycle
    // through all keys starting from the last one used.
    const keyOrder: number[] = ROUND_ROBIN_GROQ_KEYS
      ? Array.from({ length: keyCount }, (_, i) => (this.currentGroqIndex + i) % keyCount)
      : Array.from({ length: keyCount }, (_, i) => keyCount - 1 - i);

    for (const keyIndex of keyOrder) {
      const keyState = this.groqKeys[keyIndex];
      const keyNumber = keyIndex + 1;
      lastError = null; // Reset per key so stale errors don't mask actual failure
      
      // Skip rate-limited keys
      if (keyState.isRateLimited) {
        const timeSinceLastUse = Date.now() - keyState.lastUsed;
        if (timeSinceLastUse < 60000) {
          continue; // Still in cooldown
        }
        keyState.isRateLimited = false;
      }
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        keyState.inUse++;
        keyState.lastUsed = Date.now();
        if (store) store.networkAttempts++;
        try {
          const groq = new Groq({ apiKey: keyState.key });
          const result = await operation(groq);
          keyState.consecutiveErrors = 0;
          if (ROUND_ROBIN_GROQ_KEYS) {
            // Advance the pointer so the next logical call starts at the next key.
            this.currentGroqIndex = (keyIndex + 1) % keyCount;
          }
          logger.log(`[ApiKeyManager] Groq key ${keyNumber} succeeded`);
          return result;
        } catch (error: unknown) {
          const err = error as { status?: number; message?: string };
          lastError = new Error(err.message || 'Unknown error');
          
          // Fail fast on request-level errors no key rotation can fix
          if (err.status === 400 || err.status === 402 || err.status === 422) {
            logger.log(`[ApiKeyManager] Groq key ${keyNumber} unrecoverable error ${err.status}: ${err.message} — aborting key rotation`);
            throw lastError;
          }
          
          // Don't retry on auth errors
          if (err.status === 401 || err.status === 403) {
            logger.log(`[ApiKeyManager] Groq key ${keyNumber} auth failed, skipping...`);
            break;
          }
          
          // 413 = TPM (tokens per minute) exhausted. Groq enforces this per
          // org, so every key on the same account hits it together — rotating
          // is pointless and only adds latency. Abort and let the caller fall
          // back. Rotate only when keys are on separate orgs (round-robin on).
          const isTpmExceeded =
            err.status === 413 ||
            (err.message || '').toLowerCase().includes('tokens per minute');
          if (isTpmExceeded && ROUND_ROBIN_GROQ_KEYS) {
            keyState.consecutiveErrors++;
            keyState.isRateLimited = true;
            logger.log(`[ApiKeyManager] Groq key ${keyNumber} TPM limit hit, rotating to next key...`);
            await this.delay(2000);
            break; // try next key
          }
          if (isTpmExceeded) {
            logger.log(`[ApiKeyManager] Groq key ${keyNumber} TPM limit hit — aborting key rotation`);
            throw lastError;
          }
          
          // Rate limit — back off then try next key
          if (err.status === 429 || (err.message || '').includes('rate limit')) {
            keyState.consecutiveErrors++;
            if (keyState.consecutiveErrors >= 2) {
              keyState.isRateLimited = true;
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
        } finally {
          keyState.inUse -= 1;
        }
      }
    }
    
    // Step 2: Fallback to OpenRouter if all Groq keys failed
    if (this.openrouterKeys.length > 0) {
      try {
        logger.log('[ApiKeyManager] All Groq keys failed, trying OpenRouter...');
        return await this.executeWithOpenRouter(
          (client: OpenRouterClient) => operation(client as unknown as Groq),
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

  private static groqToOpenRouter: Record<string, string> = {
    'llama-3.3-70b-versatile': 'meta-llama/llama-3.3-70b-instruct',
    'llama-3.1-8b-instant': 'meta-llama/llama-3.1-8b-instruct',
    'llama-3.1-70b-versatile': 'meta-llama/llama-3.1-70b-instruct',
    'llama-3.2-1b-preview': 'meta-llama/llama-3.2-1b-instruct',
    'llama-3.2-3b-preview': 'meta-llama/llama-3.2-3b-instruct',
    'gpt-4o-mini': 'openai/gpt-4o-mini',
    'gpt-4o': 'openai/gpt-4o',
    'openai/gpt-oss-120b': 'openai/gpt-oss-120b',
  };

  private static mapModel(model?: string): string | undefined {
    if (!model) return undefined;
    return OpenRouterClient.groqToOpenRouter[model] || model;
  }

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = OpenRouterClient.mapModel(model) || DEFAULT_GENERATION_MODEL;
    
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
    const targetModel = OpenRouterClient.mapModel(options.model) || this.model;
    const requestedMaxTokens = options.max_tokens ?? 4096;
    
    // First attempt with requested model and tokens
    const result = await this.attemptCompletion(targetModel, options, requestedMaxTokens);
    
    // If successful, return
    if (result.success) {
      return result.data!;
    }
    
    // If 402 error (insufficient credits), try cheaper alternatives
    if (result.status === 402 && result.affordableTokens) {
      logger.log(`[OpenRouterClient] Insufficient credits for ${requestedMaxTokens} tokens (can afford ${result.affordableTokens})`);
      
      // Strategy 1: Try with reduced tokens on the same model
      if (result.affordableTokens >= 1024) {
        logger.log(`[OpenRouterClient] Retrying with reduced tokens: ${result.affordableTokens}`);
        const retryResult = await this.attemptCompletion(targetModel, options, result.affordableTokens);
        if (retryResult.success) {
          logger.log(`[OpenRouterClient] Success with reduced tokens`);
          return retryResult.data!;
        }
      }
      
      // Strategy 2: Try a cheaper model with original token count
      const cheaperModel = getCheaperModel(targetModel);
      if (cheaperModel && cheaperModel !== targetModel) {
        logger.log(`[OpenRouterClient] Trying cheaper model: ${cheaperModel}`);
        const cheaperResult = await this.attemptCompletion(cheaperModel, options, requestedMaxTokens);
        if (cheaperResult.success) {
          logger.log(`[OpenRouterClient] Success with cheaper model: ${cheaperModel}`);
          return cheaperResult.data!;
        }
        
        // Strategy 3: Cheaper model + reduced tokens
        if (result.affordableTokens >= 1024) {
          logger.log(`[OpenRouterClient] Trying cheaper model with reduced tokens`);
          const finalResult = await this.attemptCompletion(cheaperModel, options, result.affordableTokens);
          if (finalResult.success) {
            logger.log(`[OpenRouterClient] Success with cheaper model and reduced tokens`);
            return finalResult.data!;
          }
        }
      }
    }
    
    // All strategies failed, throw the original error
    throw result.error!;
  }

  private async attemptCompletion(
    model: string,
    options: {
      messages: { role: string; content: string }[];
      temperature?: number;
      stream?: boolean;
    },
    maxTokens: number
  ): Promise<{ 
    success: boolean; 
    data?: { choices: { message: { content: string } }[] };
    status?: number;
    affordableTokens?: number;
    error?: Error;
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
          model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: maxTokens,
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        
        // Parse 402 error to extract affordable token count
        let affordableTokens: number | undefined;
        if (response.status === 402) {
          const match = errorText.match(/can only afford (\d+)/i);
          if (match) {
            affordableTokens = parseInt(match[1], 10);
          }
        }
        
        const error = new Error(`OpenRouter API error: ${response.status} - ${errorText}`) as Error & { status?: number };
        error.status = response.status;
        
        return {
          success: false,
          status: response.status,
          affordableTokens,
          error,
        };
      }

      const data = await response.json();
      return { success: true, data };
      
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        const timeoutError = new Error('OpenRouter request timed out after 15s');
        return { success: false, error: timeoutError };
      }
      return { success: false, error: error as Error };
    }
  }
}

export const apiKeyManager = new ApiKeyManager();
