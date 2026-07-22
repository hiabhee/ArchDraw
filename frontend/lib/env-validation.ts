/**
 * Environment Variable Validation
 * 
 * Centralized validation for critical environment variables.
 * Provides clear error messages when required config is missing.
 */

import logger from '@/lib/logger';

export class EnvironmentError extends Error {
  constructor(message: string, public readonly envVar: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}

/**
 * Validates that a required environment variable is set.
 * Throws a descriptive error if missing.
 */
export function requireEnv(key: string, context?: string): string {
  const value = process.env[key];
  
  if (!value || value.trim() === '') {
    const contextMsg = context ? ` (required for ${context})` : '';
    const errorMsg = `Missing required environment variable: ${key}${contextMsg}. Please check your .env file.`;
    
    logger.error(`[EnvValidation] ${errorMsg}`);
    throw new EnvironmentError(errorMsg, key);
  }
  
  return value;
}

/**
 * Gets an optional environment variable with a default value.
 */
export function getEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

/**
 * Validates Redis configuration.
 * Returns null if Redis is not configured (graceful degradation).
 * Throws if only partially configured (likely misconfiguration).
 */
export function validateRedisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  // Both missing = Redis not configured, graceful degradation
  if (!url && !token) {
    logger.warn('[EnvValidation] Redis not configured - caching disabled');
    return null;
  }
  
  // Only one present = likely misconfiguration
  if (!url || !token) {
    const missing = !url ? 'UPSTASH_REDIS_REST_URL' : 'UPSTASH_REDIS_REST_TOKEN';
    const errorMsg = `Partial Redis configuration detected. Missing: ${missing}. Either provide both or remove both for graceful degradation.`;
    logger.error(`[EnvValidation] ${errorMsg}`);
    throw new EnvironmentError(errorMsg, missing);
  }
  
  return { url, token };
}

/**
 * Validates Google OAuth configuration.
 * Returns null if not configured (auth will be disabled).
 * Throws if only partially configured.
 */
export function validateGoogleOAuthConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  // Both missing = OAuth not configured
  if (!clientId && !clientSecret) {
    logger.warn('[EnvValidation] Google OAuth not configured - social login disabled');
    return null;
  }
  
  // Only one present = misconfiguration
  if (!clientId || !clientSecret) {
    const missing = !clientId ? 'GOOGLE_CLIENT_ID' : 'GOOGLE_CLIENT_SECRET';
    const errorMsg = `Partial Google OAuth configuration. Missing: ${missing}. Provide both for social login.`;
    logger.error(`[EnvValidation] ${errorMsg}`);
    throw new EnvironmentError(errorMsg, missing);
  }
  
  return { clientId, clientSecret };
}

/**
 * Validates admin authentication configuration.
 * Returns null if not configured (admin panel disabled).
 */
export function validateAdminConfig(): { passcode: string; sessionSecret: string; userId?: string } | null {
  const passcode = process.env.ADMIN_PASSCODE;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  const userId = process.env.ADMIN_USER_ID;
  
  // Both missing = admin not configured
  if (!passcode && !sessionSecret) {
    logger.warn('[EnvValidation] Admin auth not configured - admin panel disabled');
    return null;
  }
  
  // Only one present = misconfiguration
  if (!passcode || !sessionSecret) {
    const missing = !passcode ? 'ADMIN_PASSCODE' : 'ADMIN_SESSION_SECRET';
    const errorMsg = `Partial admin configuration. Missing: ${missing}. Provide both for admin access.`;
    logger.error(`[EnvValidation] ${errorMsg}`);
    throw new EnvironmentError(errorMsg, missing);
  }
  
  return { passcode, sessionSecret, userId };
}

/**
 * Validates Groq API configuration for AI features.
 * Throws if missing since AI is a core feature.
 */
export function validateGroqConfig(): string {
  return requireEnv('GROQ_API_KEY', 'AI diagram generation and tutorial chat');
}

/**
 * Checks if database is configured.
 * Returns true if DATABASE_URL is set.
 */
export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * Validates all critical environment variables at startup.
 * Call this in server initialization to fail fast.
 */
export function validateCriticalEnv(): void {
  const errors: string[] = [];
  
  try {
    // Database is critical
    if (!isDatabaseConfigured()) {
      errors.push('DATABASE_URL is not set - database operations will fail');
    }
    
    // Better Auth secret is critical
    if (!process.env.BETTER_AUTH_SECRET) {
      errors.push('BETTER_AUTH_SECRET is not set - authentication will fail');
    }
    
    // Groq is critical for core features
    try {
      validateGroqConfig();
    } catch (err) {
      if (err instanceof EnvironmentError) {
        errors.push(err.message);
      }
    }
  } catch (err) {
    logger.error('[EnvValidation] Critical validation failed:', err);
  }
  
  if (errors.length > 0) {
    logger.error('[EnvValidation] Critical environment validation failed:');
    errors.forEach(error => logger.error(`  - ${error}`));
    logger.error('Application may not function correctly. Check your .env file.');
  }
}
