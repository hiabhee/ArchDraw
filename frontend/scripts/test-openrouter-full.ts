#!/usr/bin/env tsx
/**
 * Full test of OpenRouter with the actual model and token limits used in production
 * Usage: npx tsx scripts/test-openrouter-full.ts
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

async function testOpenRouterFull() {
  console.log('🧪 Testing OpenRouter with Production Settings...\n');

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.log('❌ OPENROUTER_API_KEY not found in environment\n');
    return;
  }

  // Test with the actual model that would be used in production
  const defaultModel = 'openai/gpt-oss-120b'; // Groq model name
  const openRouterModel = 'openai/gpt-oss-120b'; // Mapped to OpenRouter

  console.log(`📋 Testing with production model: ${openRouterModel}`);
  console.log(`   (Groq equivalent: ${defaultModel})`);
  console.log(`   Max tokens: 4096 (typical diagram generation)\n`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    console.log('⏳ Sending request...');
    const startTime = Date.now();

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://archdraw.ai',
        'X-Title': 'ArchDraw Production Test',
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: [
          { 
            role: 'system', 
            content: 'You are an architecture diagram generator. Generate node and edge data for architecture diagrams.' 
          },
          { 
            role: 'user', 
            content: 'Generate a simple 3-tier web application architecture with frontend, backend, and database. Keep it brief.' 
          }
        ],
        temperature: 0.7,
        max_tokens: 4096, // Same as production
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`📡 Response received in ${duration}s`);
    console.log(`   Status: ${response.status} ${response.statusText}\n`);

    if (response.status === 200) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      console.log('✅ SUCCESS! OpenRouter is working with production settings.');
      console.log(`   Generated ${content.length} characters\n`);
      
      // Extract cost information from headers
      const creditsUsed = response.headers.get('x-credits-used');
      const creditsRemaining = response.headers.get('x-credits-remaining');
      const ratelimitRequests = response.headers.get('x-ratelimit-requests-remaining');
      
      if (creditsUsed || creditsRemaining || ratelimitRequests) {
        console.log('💰 Usage Information:');
        if (creditsUsed) console.log(`   Credits used: $${creditsUsed}`);
        if (creditsRemaining) console.log(`   Credits remaining: $${creditsRemaining}`);
        if (ratelimitRequests) console.log(`   Requests remaining: ${ratelimitRequests}`);
        console.log();
      }
      
      console.log('📊 Model Pricing (approximate):');
      console.log('   Llama 3.3 70B: ~$0.27 per 1M input tokens');
      console.log('   Typical diagram: $0.001 - $0.01 per generation\n');
      
    } else if (response.status === 402) {
      console.log('❌ PAYMENT REQUIRED (402)');
      console.log('   Your OpenRouter account needs credits!\n');
      
      try {
        const errorData = await response.text();
        console.log('   Error details:');
        console.log('   ' + errorData.replace(/\n/g, '\n   '));
        console.log();
      } catch {}
      
      console.log('   💡 SOLUTIONS:');
      console.log('   1. Add credits at: https://openrouter.ai/account');
      console.log('      - Recommended: Add $10 for good coverage');
      console.log('   2. Or disable OpenRouter fallback:');
      console.log('      - Comment out OPENROUTER_API_KEY in .env.local');
      console.log('   3. Use a cheaper model (if budget is tight):');
      console.log('      - Update DEFAULT_GENERATION_MODEL in lib/ai/models.ts\n');
      
    } else if (response.status === 401 || response.status === 403) {
      console.log('❌ AUTHENTICATION FAILED');
      console.log('   Your API key may be invalid or expired');
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
      console.log('   Request took longer than 30 seconds\n');
    } else {
      console.log('❌ REQUEST ERROR');
      console.log(`   ${(error as Error).message}\n`);
    }
  }

  console.log('📚 Documentation: OPENROUTER_402_FIX.md');
  console.log('🔍 Check keys: npx tsx scripts/check-api-keys.ts\n');
}

testOpenRouterFull().catch(console.error);
