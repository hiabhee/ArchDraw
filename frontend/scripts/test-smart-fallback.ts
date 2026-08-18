#!/usr/bin/env tsx
/**
 * Test the smart fallback mechanism with low credits
 * Usage: npx tsx scripts/test-smart-fallback.ts
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

// Import after env is loaded
const { getCheaperModel, getRecommendedMaxTokens, MODELS } = require('../lib/ai/models.ts');

async function testSmartFallback() {
  console.log('🧪 Testing Smart Fallback Mechanism\n');

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.log('❌ OPENROUTER_API_KEY not found\n');
    return;
  }

  // Test 1: Check model cost tiers
  console.log('📊 Model Cost Tiers:');
  console.log('─'.repeat(70));
  const openRouterModels = MODELS.filter((m: any) => m.provider === 'openrouter');
  openRouterModels
    .sort((a: any, b: any) => (b.costTier || 0) - (a.costTier || 0))
    .forEach((model: any) => {
      const tier = '💰'.repeat(model.costTier || 1);
      console.log(`${tier.padEnd(10)} ${model.label.padEnd(40)} (${model.id})`);
      console.log(`           Max tokens: ${model.recommendedMaxTokens || 'N/A'}`);
    });
  console.log();

  // Test 2: Fallback chain
  console.log('🔄 Fallback Chain Test:');
  console.log('─'.repeat(70));
  const testModel = 'meta-llama/llama-3.3-70b-instruct';
  console.log(`Starting with: ${testModel}`);
  
  let current = testModel;
  let depth = 0;
  const maxDepth = 5;
  
  while (depth < maxDepth) {
    const cheaper = getCheaperModel(current);
    if (!cheaper || cheaper === current) {
      console.log(`└─ No cheaper model available`);
      break;
    }
    const model = MODELS.find((m: any) => m.id === cheaper);
    console.log(`├─ Fallback to: ${model?.label || cheaper} (tier ${model?.costTier || '?'})`);
    current = cheaper;
    depth++;
  }
  console.log();

  // Test 3: Token reduction
  console.log('📉 Token Reduction Test:');
  console.log('─'.repeat(70));
  const tokenTests = [4096, 2048, 1578, 1024, 512];
  tokenTests.forEach(tokens => {
    const recommended = getRecommendedMaxTokens(testModel, tokens);
    console.log(`Requested: ${tokens.toString().padStart(4)} tokens → Recommended: ${recommended} tokens`);
  });
  console.log();

  // Test 4: Actual API call with smart fallback
  console.log('🚀 Live API Test (with smart fallback):');
  console.log('─'.repeat(70));
  console.log('Testing with limited tokens to trigger fallback...\n');

  try {
    // Simulate the OpenRouterClient behavior
    const testMessage = {
      model: 'meta-llama/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Hello from smart fallback test!"' }
      ],
      temperature: 0.1,
      max_tokens: 4096, // This should trigger 402, then fallback
    };

    console.log('📤 First attempt: Llama 3.3 70B with 4096 tokens...');
    const response1 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://archdraw.ai',
        'X-Title': 'ArchDraw Smart Fallback Test',
      },
      body: JSON.stringify(testMessage),
    });

    if (response1.ok) {
      const data = await response1.json();
      console.log('✅ Success with first attempt!');
      console.log(`   Response: ${data.choices?.[0]?.message?.content || '(empty)'}\n`);
    } else if (response1.status === 402) {
      const errorText = await response1.text();
      const match = errorText.match(/can only afford (\d+)/i);
      const affordable = match ? parseInt(match[1], 10) : 0;
      
      console.log(`❌ 402 - Can only afford ${affordable} tokens`);
      console.log(`   Trying fallback: Llama 3.2 3B with reduced tokens...\n`);

      const fallbackModel = getCheaperModel('meta-llama/llama-3.3-70b-instruct');
      const fallbackTokens = Math.min(affordable, 2048);

      const response2 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://archdraw.ai',
          'X-Title': 'ArchDraw Smart Fallback Test',
        },
        body: JSON.stringify({
          ...testMessage,
          model: fallbackModel,
          max_tokens: fallbackTokens,
        }),
      });

      if (response2.ok) {
        const data = await response2.json();
        console.log(`✅ Success with fallback model: ${fallbackModel}`);
        console.log(`   Used ${fallbackTokens} tokens instead of 4096`);
        console.log(`   Response: ${data.choices?.[0]?.message?.content || '(empty)'}\n`);
      } else {
        console.log(`❌ Fallback also failed: ${response2.status} ${response2.statusText}\n`);
      }
    } else {
      console.log(`❌ Unexpected error: ${response1.status} ${response1.statusText}\n`);
    }

  } catch (error) {
    console.log(`❌ Test failed: ${(error as Error).message}\n`);
  }

  console.log('📚 The smart fallback is now integrated into OpenRouterClient');
  console.log('   It will automatically try:');
  console.log('   1. Reduce tokens if affordable tokens > 1024');
  console.log('   2. Switch to cheaper model');
  console.log('   3. Cheaper model + reduced tokens\n');
}

testSmartFallback().catch(console.error);
