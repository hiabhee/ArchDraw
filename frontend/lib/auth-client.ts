'use client';

import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001'),
});

export const { signIn, signUp, signOut, useSession } = authClient;
