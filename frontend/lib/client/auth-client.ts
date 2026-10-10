'use client';

import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({
  baseURL: (typeof window !== 'undefined' ? window.location.origin : '') || process.env.NEXT_PUBLIC_APP_URL || 'https://archdraw.hiabhee.online',
});

export const { signIn, signUp, signOut, useSession } = authClient;
