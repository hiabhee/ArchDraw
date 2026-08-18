#!/usr/bin/env tsx
/**
 * Test OpenRouter API key status
 * Usage: npx tsx scripts/test-openrouter.ts
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

async function testOpenRouter() {
  console.log('🧪 Testing OpenRouter API Key...\n');

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.log('❌ OPENROUTER_API_KEY not found in environment');
    console.log('   Add it to .env.local to enable OpenRouter fallback\n');
    return;
  }

  console.log(`✅ API Key found: ${apiKey.substring(0, 15)}...`);
  console.log('   Making test request...\n');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://archdraw.ai',
        'X-Title': 'ArchDraw API Key Test',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-3b-instruct',
        messages: [
          { role: 'user', content: 'Say "OK" if you can hear me.' }
        ],
        temperature: 0.1,
        max_tokens: 10,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    console.log(`📡 Response status: ${response.status} ${response.statusText}\n`);

    if (response.status === 200) {
      const data = await response.json();
      console.log('✅ SUCCESS! OpenRouter API key is working.');
      console.log(`   Response: ${data.choices?.[0]?.message?.content || '(empty)'}\n`);
      
      // Try to get credit info from headers
      const creditsUsed = response.headers.get('x-credits-used');
      const creditsRemaining = response.headers.get('x-credits-remaining');
      if (creditsUsed || creditsRemaining) {
        console.log('💰 Credit Information:');
        if (creditsUsed) console.log(`   Used: $${creditsUsed}`);
        if (creditsRemaining) console.log(`   Remaining: $${creditsRemaining}`);
      }
      
    } else if (response.status === 402) {
      console.log('❌ PAYMENT REQUIRED (402)');
      console.log('   Your OpenRouter account needs credits!\n');
      console.log('   Solutions:');
      console.log('   1. Add credits at: https://openrouter.ai/account');
      console.log('   2. Or disable OpenRouter fallback (comment out OPENROUTER_API_KEY)\n');
      
      try {
        const errorData = await response.text();
        console.log('   Error details:', errorData);
      } catch {}
      
    } else if (response.status === 401 || response.status === 403) {
      console.log('❌ AUTHENTICATION FAILED');
      console.log('   Your API key may be invalid or expired\n');
      console.log('   Get a new key at: https://openrouter.ai/keys\n');
      
    } else if (response.status === 429) {
      console.log('⚠️  RATE LIMITED');
      console.log('   Too many requests, wait a moment and try again\n');
      
    } else {
      const errorText = await response.text();
      console.log('❌ REQUEST FAILED');
      console.log(`   Status: ${response.status}`);
      console.log(`   Details: ${errorText}\n`);
    }

  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('❌ REQUEST TIMEOUT');
      console.log('   OpenRouter API did not respond within 10 seconds\n');
    } else {
      console.log('❌ REQUEST ERROR');
      console.log(`   ${(error as Error).message}\n`);
    }
  }

  console.log('📚 For more information, see: OPENROUTER_402_FIX.md\n');
}

testOpenRouter().catch(console.error);
