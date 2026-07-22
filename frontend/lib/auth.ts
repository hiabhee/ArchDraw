import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/lib/prisma';
import { validateGoogleOAuthConfig, validateGitHubOAuthConfig } from '@/lib/env-validation';
import logger from '@/lib/logger';

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
  trustedOrigins: ['http://localhost:3001'],
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
});

export type Session = typeof auth.$Infer.Session;
