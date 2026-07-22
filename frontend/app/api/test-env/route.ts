import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasGithubClientId: !!process.env.GITHUB_CLIENT_ID,
    hasGithubSecret: !!process.env.GITHUB_CLIENT_SECRET,
    hasBetterAuthSecret: !!process.env.BETTER_AUTH_SECRET,
    betterAuthSecretValue: process.env.BETTER_AUTH_SECRET?.substring(0, 10) + '...',
    betterAuthUrl: process.env.BETTER_AUTH_URL,
    nodeEnv: process.env.NODE_ENV,
  });
}
