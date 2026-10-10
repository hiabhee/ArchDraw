#!/usr/bin/env tsx
/**
 * Diagnostic script to check API key configuration and status
 * Usage: npx tsx scripts/check-api-keys.ts
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

interface KeyInfo {
  envVar: string;
  configured: boolean;
  length?: number;
  preview?: string;
}

function checkKeys() {
  console.log('🔍 Checking API Key Configuration...\n');

  // Check Groq keys
  const groqKeys: KeyInfo[] = [];
  const groqEnvVars = [
    'GROQ_API_KEY',
    ...Array.from({ length: 10 }, (_, i) => `GROQ_API_KEY_FOR_DESC_${i + 1}`)
  ];

  for (const envVar of groqEnvVars) {
    const key = process.env[envVar];
    const configured = !!(key && key.trim() !== '' && !key.startsWith('#'));
    groqKeys.push({
      envVar,
      configured,
      length: configured ? key!.length : undefined,
      preview: configured ? `${key!.substring(0, 10)}...` : undefined,
    });
  }

  // Check OpenRouter keys
  const openRouterKeys: KeyInfo[] = [];
  const openRouterEnvVars = [
    'OPENROUTER_API_KEY',
    'OPENROUTER_API_KEY_1',
    'OPENROUTER_API_KEY_2',
  ];

  for (const envVar of openRouterEnvVars) {
    const key = process.env[envVar];
    const configured = !!(key && key.trim() !== '' && !key.startsWith('#'));
    openRouterKeys.push({
      envVar,
      configured,
      length: configured ? key!.length : undefined,
      preview: configured ? `${key!.substring(0, 10)}...` : undefined,
    });
  }

  // Display results
  console.log('📊 GROQ API Keys:');
  console.log('─'.repeat(60));
  const configuredGroq = groqKeys.filter(k => k.configured);
  if (configuredGroq.length === 0) {
    console.log('❌ No Groq keys configured');
  } else {
    configuredGroq.forEach((key, idx) => {
      console.log(`✅ Key ${idx + 1}: ${key.envVar}`);
      console.log(`   Preview: ${key.preview} (${key.length} chars)`);
    });
  }
  console.log(`\nTotal: ${configuredGroq.length} Groq keys configured\n`);

  console.log('📊 OPENROUTER API Keys:');
  console.log('─'.repeat(60));
  const configuredOpenRouter = openRouterKeys.filter(k => k.configured);
  if (configuredOpenRouter.length === 0) {
    console.log('❌ No OpenRouter keys configured');
  } else {
    configuredOpenRouter.forEach((key, idx) => {
      console.log(`✅ Key ${idx + 1}: ${key.envVar}`);
      console.log(`   Preview: ${key.preview} (${key.length} chars)`);
    });
  }
  console.log(`\nTotal: ${configuredOpenRouter.length} OpenRouter keys configured\n`);

  // Recommendations
  console.log('💡 RECOMMENDATIONS:');
  console.log('─'.repeat(60));

  if (configuredGroq.length === 0) {
    console.log('⚠️  No Groq keys found - AI generation will not work!');
    console.log('   Add GROQ_API_KEY to .env.local');
  } else if (configuredGroq.length < 3) {
    console.log('ℹ️  Consider adding more Groq keys for better load distribution');
  } else {
    console.log('✅ Good number of Groq keys configured');
  }

  if (configuredOpenRouter.length === 0) {
    console.log('ℹ️  No OpenRouter fallback configured');
    console.log('   Consider adding OPENROUTER_API_KEY for resilience');
  } else {
    console.log('✅ OpenRouter fallback is configured');
    console.log('   ⚠️  Ensure your OpenRouter account has credits!');
    console.log('   Check: https://openrouter.ai/account');
  }

  console.log('\n📚 For more info, see: OPENROUTER_402_FIX.md\n');
}

checkKeys();
