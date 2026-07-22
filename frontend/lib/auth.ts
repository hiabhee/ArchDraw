import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/lib/prisma';
import { validateGoogleOAuthConfig } from '@/lib/env-validation';
import logger from '@/lib/logger';

// Validate Google OAuth configuration
const googleOAuth = validateGoogleOAuthConfig();

if (!googleOAuth) {
  logger.warn('[Auth] Google OAuth not configured - social login will be disabled');
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: googleOAuth ? {
    google: {
      clientId: googleOAuth.clientId,
      clientSecret: googleOAuth.clientSecret,
    },
  } : {},
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});

export type Session = typeof auth.$Infer.Session;
