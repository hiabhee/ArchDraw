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
 * Validates GitHub OAuth configuration.
 * Returns null if not configured (auth will be disabled).
 * Throws if only partially configured.
 */
export function validateGitHubOAuthConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  // Both missing = OAuth not configured
  if (!clientId && !clientSecret) {
    logger.warn('[EnvValidation] GitHub OAuth not configured - social login disabled');
    return null;
  }

  // Only one present = misconfiguration
  if (!clientId || !clientSecret) {
    const missing = !clientId ? 'GITHUB_CLIENT_ID' : 'GITHUB_CLIENT_SECRET';
    const errorMsg = `Partial GitHub OAuth configuration. Missing: ${missing}. Provide both for social login.`;
    logger.error(`[EnvValidation] ${errorMsg}`);
    throw new EnvironmentError(errorMsg, missing);
  }

  return { clientId, clientSecret };
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
export function validateAdminConfig(): { passcode: string; sessionSecret: string; userId?: string; adminEmail?: string } | null {
  const passcode = process.env.ADMIN_PASSCODE;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  const userId = process.env.ADMIN_USER_ID;
  const adminEmail = process.env.ALLOWED_ADMIN_EMAIL;
  
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
  
  if (adminEmail) {
    logger.info('[EnvValidation] Admin email configured for OAuth fallback');
  }
  
  return { passcode, sessionSecret, userId, adminEmail };
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
 * Validates authentication configuration for production.
 * Throws if critical auth config is missing in production.
 */
export function validateAuthConfig(): void {
  if (process.env.NODE_ENV === 'production') {
    const errors: string[] = [];
    
    if (!process.env.BETTER_AUTH_URL && !process.env.NEXT_PUBLIC_APP_URL) {
      errors.push('BETTER_AUTH_URL or NEXT_PUBLIC_APP_URL must be set in production');
    }
    
    if (!process.env.BETTER_AUTH_SECRET) {
      errors.push('BETTER_AUTH_SECRET must be set in production');
    }
    
    if (errors.length > 0) {
      const errorMsg = `Authentication configuration error in production: ${errors.join(', ')}`;
      logger.error(`[EnvValidation] ${errorMsg}`);
      throw new EnvironmentError(errorMsg, 'AUTH_CONFIG');
    }
  } else {
    // In development, just warn if critical config is missing
    if (!process.env.BETTER_AUTH_URL && !process.env.NEXT_PUBLIC_APP_URL) {
      logger.warn('[EnvValidation] BETTER_AUTH_URL or NEXT_PUBLIC_APP_URL not set in development - using localhost');
    }
    if (!process.env.BETTER_AUTH_SECRET) {
      logger.warn('[EnvValidation] BETTER_AUTH_SECRET not set in development - authentication may not work properly');
    }
  }
}

/**
 * Validates all critical environment variables at startup.
 * Call this in server initialization to fail fast.
 */
export function validateCriticalEnv(): void {
  const errors: string[] = [];
  
  try {
    // Validate auth configuration for production
    try {
      validateAuthConfig();
    } catch (err) {
      if (err instanceof EnvironmentError) {
        errors.push(err.message);
      }
    }
    
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
