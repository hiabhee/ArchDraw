/**
 * Pre-generates deterministic tutorial AI responses and writes them to
 * frontend/data/tutorialCache.json.
 *
 * Run with:  npx tsx scripts/generateTutorialCache.ts
 *
 * Requires GROQ_API_KEY in environment (reads from ../.env.local automatically).
 */

import * as fs from 'fs';
import * as path from 'path';
import Groq from 'groq-sdk';

// Manually load .env.local or .env (no dotenv dependency needed)
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envRegularPath = path.resolve(__dirname, '../.env');
const targetEnv = fs.existsSync(envLocalPath) ? envLocalPath : (fs.existsSync(envRegularPath) ? envRegularPath : null);

if (targetEnv) {
  const lines = fs.readFileSync(targetEnv, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

import { TUTORIALS, isLeveledTutorial } from '../data/tutorials/index';
import type { TutorialData } from '../data/tutorials';
import type { TutorialDefinition } from '@/lib/tutorial/schema';

const SYSTEM_PROMPT = `You are an expert system design tutor guiding users through architecture diagramming. You lead every step — the user follows your cues.

STRICT RULES:
- Max 3 sentences per response. Never exceed this.
- Never use bullet points or lists.
- Be warm, direct, and technically precise.
- Always end with a clear next action or a forward-looking statement.
- CRITICAL: Never tell the user how to respond. Never say "respond with yes or no", "let me know", "click a button", or reference any UI element. Never ask open-ended questions like "What do you think?" Just ask or state naturally — the UI handles response options.

PHASE INSTRUCTIONS — you will receive a PHASE tag in every message:

PHASE:INTRO
Ask a single yes/no question about whether the user knows what this component does. Example: "Do you know what a Load Balancer does in a system like Netflix?" 1-2 sentences max. Make it feel like a quick knowledge check, not a quiz. Do NOT tell the user how to answer.

PHASE:TEACHING
Explain what the component does and why it exists in this specific architecture. Use one concrete real-world analogy. End with the exact action: tell them to press ⌘K and search for the component name.

PHASE:TEACHING with RETEACH:true EXPLAIN_COUNT:1
Give a different angle on why this component matters — focus on what breaks without it. Use a failure scenario. End with the same action instruction.

PHASE:TEACHING with RETEACH:true EXPLAIN_COUNT:2
Give a third angle — focus on a real-world example of this component at a company like Netflix, Google, or Uber. End with the same action instruction.

PHASE:ACTION
Give one crisp instruction: exactly what to search for and add. Example: "Press ⌘K, search for 'Load Balancer', and drag it onto the canvas." Nothing else.

PHASE:CELEBRATION
Celebrate in one sentence. Then give one real-world insight about this component at scale. End by hinting at what comes next without revealing it.

PHASE:WRONG_COMPONENT
The user added a component but it's not the one needed for this step. Gently redirect them — acknowledge what they added, then tell them exactly what to search for instead. Keep it encouraging, not critical. One sentence max.

CONTEXT: You will also receive the tutorial ID, step number, component name, explanation, and action instruction. Use these to make responses specific — never generic.`;

type Phase = 'intro' | 'teaching' | 'reteach' | 'action' | 'celebration' | 'wrong_component';

interface CacheEntry {
  phase: Phase;
  explainCount: number;
}

interface CacheStep {
  id: string | number;
  title: string;
  explanation?: string;
  action?: unknown;
  requiredNodes?: string[];
  validation?: unknown;
  phases?: {
    teaching?: { body?: string };
    action?: { body?: string };
  };
}

function getRequiredNodeName(step: CacheStep): string {
  if (step.requiredNodes && step.requiredNodes.length > 0) {
    return step.requiredNodes[0];
  }
  if (Array.isArray(step.validation)) {
    const existsRule = (step.validation as unknown[]).find(
      (r: unknown) => typeof r === 'object' && r !== null && 'type' in r && (r as { type: string }).type === 'node_exists'
    ) as { label?: string } | undefined;
    if (existsRule?.label) {
      return existsRule.label;
    }
    for (const rule of (step.validation as unknown[])) {
      if (
        typeof rule === 'object' &&
        rule !== null &&
        'type' in rule &&
        ((rule as { type: string }).type === 'all_of' || (rule as { type: string }).type === 'any_of') &&
        'rules' in rule &&
        Array.isArray((rule as { rules: unknown }).rules)
      ) {
        const nested = ((rule as { rules: unknown[] }).rules).find(
          (r: unknown) => typeof r === 'object' && r !== null && 'type' in r && (r as { type: string }).type === 'node_exists'
        ) as { label?: string } | undefined;
        if (nested?.label) {
          return nested.label;
        }
      }
    }
  }
  return step.title;
}

// Generate all teaching iterations (0, 1, 2) + wrong_component per step
const PHASES_TO_GENERATE: CacheEntry[] = [
  { phase: 'intro', explainCount: 0 },
  { phase: 'teaching', explainCount: 0 },
  { phase: 'reteach', explainCount: 1 },
  { phase: 'reteach', explainCount: 2 },
  { phase: 'action', explainCount: 0 },
  { phase: 'celebration', explainCount: 0 },
  { phase: 'wrong_component', explainCount: 0 },
];

function buildPrompt(
  tutorialId: string,
  stepNumber: number,
  totalSteps: number,
  componentTitle: string,
  explanation: string,
  action: string,
  phase: Phase,
  explainCount: number,
  requiredNode?: string,
): string {
  let phaseTag: string;
  switch (phase) {
    case 'reteach':
      phaseTag = `PHASE:TEACHING RETEACH:true EXPLAIN_COUNT:${explainCount}`;
      break;
    case 'wrong_component':
      phaseTag = `PHASE:WRONG_COMPONENT NEEDED:"${requiredNode ?? componentTitle}"`;
      break;
    default:
      phaseTag = `PHASE:${phase.toUpperCase()}`;
  }

  return [
    `TUTORIAL:${tutorialId}`,
    `STEP:${stepNumber}/${totalSteps}`,
    `COMPONENT:"${componentTitle}"`,
    phaseTag,
    `EXPLANATION:${explanation}`,
    `ACTION:${action}`,
  ].join('\n');
}

function cacheKey(
  tutorialId: string,
  stepNumber: number,
  phase: Phase,
  explainCount: number,
): string {
  // reteach stored as teaching:N, wrong_component stored as wrong_component:0
  const phaseKey = phase === 'reteach' ? 'teaching' : phase;
  return `${tutorialId}:${stepNumber}:${phaseKey}:${explainCount}`;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generate(groq: Groq, prompt: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    max_tokens: 180,
    temperature: 0.7,
    stream: false,
  });
  return completion.choices[0]?.message?.content?.trim() ?? '';
}

async function main() {
  const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_FOR_DESC_1;
  if (!apiKey) {
    console.error('GROQ_API_KEY not found. Make sure frontend/.env.local or frontend/.env is set and contains GROQ_API_KEY or GROQ_API_KEY_FOR_DESC_1.');
    process.exit(1);
  }

  const groq = new Groq({ apiKey });
  const outputPath = path.resolve(__dirname, '../data/tutorialCache.json');

  // Load existing cache so we can resume interrupted runs
  let cache: Record<string, string> = {};
  if (fs.existsSync(outputPath)) {
    try {
      cache = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    } catch {
      cache = {};
    }
  }

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const tutorial of TUTORIALS) {
    // All tutorials now use leveled format (TutorialDefinition)
    const leveled = tutorial as TutorialDefinition;
    const totalSteps = leveled.levels?.reduce((sum, l) => sum + l.steps.length, 0) ?? 0;
    console.log(`\n── ${tutorial.id} (${totalSteps} steps across ${leveled.levels?.length ?? 0} levels) ──`);
    const allSteps: unknown[] = [];
    for (const level of leveled.levels ?? []) {
      allSteps.push(...(level.steps as unknown[]));
    }

    // Non-Netflix tutorials: only generate intro for steps 1-3
    // Netflix: generate all phases for all steps
    const isNetflix = tutorial.id === 'netflix-architecture';

    for (const rawStep of allSteps) {
      const step = rawStep as CacheStep;
      let stepNum = 0;
      if (typeof step.id === 'number') {
        stepNum = step.id;
      } else if (typeof step.id === 'string') {
        const match = step.id.match(/\d+/);
        if (match) {
          stepNum = parseInt(match[0], 10);
        }
      }

      // Skip steps 4+ for non-Netflix tutorials
      if (!isNetflix && stepNum > 3) {
        process.stdout.write(`  SKIP  ${tutorial.id}:${step.id} (non-live, step>3)\n`);
        continue;
      }

      const requiredNode = getRequiredNodeName(step);

      // Non-Netflix: only generate intro phase
      const phasesToRun = isNetflix ? PHASES_TO_GENERATE : PHASES_TO_GENERATE.filter(p => p.phase === 'intro' && p.explainCount === 0);

      for (const { phase, explainCount } of phasesToRun) {
        const key = cacheKey(tutorial.id, stepNum, phase, explainCount);

        if (cache[key]) {
          process.stdout.write(`  SKIP  ${key}\n`);
          skipped++;
          continue;
        }

        const explanationText = step.explanation ?? step.phases?.teaching?.body ?? '';
        const actionText = typeof step.action === 'string'
          ? step.action
          : (step.phases?.action?.body ?? '');

        const prompt = buildPrompt(
          tutorial.id,
          stepNum,
          totalSteps,
          step.title,
          explanationText,
          actionText,
          phase,
          explainCount,
          requiredNode,
        );

        try {
          process.stdout.write(`  GEN   ${key} ... `);
          const text = await generate(groq, prompt);
          if (!text) {
            process.stdout.write('EMPTY (skipping)\n');
            errors++;
            continue;
          }
          cache[key] = text;
          generated++;
          process.stdout.write('OK\n');

          // Write after every entry so a crash doesn't lose progress
          fs.writeFileSync(outputPath, JSON.stringify(cache, null, 2));

          // Rate-limit: 200ms between calls to avoid Groq rate limits
          await sleep(200);
        } catch (err) {
          process.stdout.write('ERROR\n');
          console.error(`    ${err}`);
          errors++;
          // Back off on error
          await sleep(1000);
        }
      }
    }
  }

  console.log(`\n── Summary ──`);
  console.log(`Generated: ${generated}`);
  console.log(`Skipped (cached): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Total keys: ${Object.keys(cache).length}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
