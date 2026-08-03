import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/lib/prisma';
import { validateGoogleOAuthConfig, validateGitHubOAuthConfig, validateAuthConfig } from '@/lib/env-validation';
import logger from '@/lib/logger';

// Validate critical auth configuration for production (only throws in production)
try {
  validateAuthConfig();
} catch (err) {
  if (process.env.NODE_ENV === 'production') {
    throw err;
  }
}

// Validate OAuth configurations
const googleOAuth = validateGoogleOAuthConfig();
const githubOAuth = validateGitHubOAuthConfig();

if (!googleOAuth) {
  logger.warn('[Auth] Google OAuth not configured - Google sign-in will be disabled');
}
if (!githubOAuth) {
  logger.warn('[Auth] GitHub OAuth not configured - GitHub sign-in will be disabled');
}

const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
if (googleOAuth) {
  socialProviders.google = {
    clientId: googleOAuth.clientId,
    clientSecret: googleOAuth.clientSecret,
  };
}
if (githubOAuth) {
  socialProviders.github = {
    clientId: githubOAuth.clientId,
    clientSecret: githubOAuth.clientSecret,
  };
}

const baseURL = process.env.BETTER_AUTH_URL
  || process.env.NEXT_PUBLIC_APP_URL
  || 'http://localhost:3000';

// Build trusted origins list - include both production and development
const trustedOrigins = new Set<string>([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
]);
if (process.env.NEXT_PUBLIC_APP_URL) {
  trustedOrigins.add(process.env.NEXT_PUBLIC_APP_URL);
}
if (!trustedOrigins.has(baseURL)) {
  trustedOrigins.add(baseURL);
}

logger.info('[Auth] Initializing Better Auth', {
  baseURL,
  trustedOrigins: Array.from(trustedOrigins),
  providers: Object.keys(socialProviders),
});

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: socialProviders as Record<string, { clientId: string; clientSecret: string }>,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: Array.from(trustedOrigins),
  baseURL,
});

export type Session = typeof auth.$Infer.Session;
