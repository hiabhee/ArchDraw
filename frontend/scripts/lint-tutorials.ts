/**
 * Lint script for tutorial content quality.
 *
 * Usage:
 *   npx tsx scripts/lint-tutorials.ts            # warnings only (migration grace period)
 *   npx tsx scripts/lint-tutorials.ts --strict   # teaching callouts missing => exit 1
 *
 * Checks:
 *   1. Every teaching phase should have `whyItMatters` + `tradeoff`
 *      (the builder auto-fills these from `COMPONENT_TOOLTIPS` when possible).
 *   2. Tutorials should have at least 8 steps (min depth).
 *   3. Duplicate first-step node types across tutorials reduce entry-point variety.
 */
import { TUTORIALS } from '../data/tutorials';
import type { ValidationRule } from '../lib/tutorial/schema';

const STRICT = process.argv.includes('--strict');

let errors = 0;
let warnings = 0;

function error(msg: string) {
  errors += 1;
  console.error(`  ✗ ${msg}`);
}

function warn(msg: string) {
  warnings += 1;
  console.warn(`  ⚠ ${msg}`);
}

function flattenNodeTypes(rules: ValidationRule[]): string[] {
  const out: string[] = [];
  const walk = (rule: ValidationRule) => {
    if (rule.type === 'node_exists') {
      out.push(rule.nodeType);
    } else if (rule.type === 'all_of' || rule.type === 'any_of') {
      rule.rules.forEach(walk);
    }
  };
  rules.forEach(walk);
  return out;
}

let totalSteps = 0;
let teachingSteps = 0;
let withWhy = 0;
let withTradeoff = 0;
const firstStepNodeTypes: Record<string, string> = {};
const dupes = new Map<string, string[]>();

for (const tutorial of TUTORIALS) {
  const stepCount = tutorial.levels.reduce((sum, l) => sum + l.steps.length, 0);
  totalSteps += stepCount;

  if (stepCount < 8) {
    warn(`"${tutorial.id}" has ${stepCount} steps (< 8 recommended)`);
  }

  const first = tutorial.levels[0]?.steps[0];
  if (first) {
    const nt = flattenNodeTypes(first.validation)[0] ?? '(none)';
    if (firstStepNodeTypes[nt]) {
      const list = dupes.get(nt) ?? [firstStepNodeTypes[nt]];
      list.push(tutorial.id);
      dupes.set(nt, list);
    } else {
      firstStepNodeTypes[nt] = tutorial.id;
    }
  }

  for (const level of tutorial.levels) {
    for (const step of level.steps) {
      const teaching = step.phases?.teaching;
      if (!teaching) continue;
      teachingSteps += 1;
      const hasWhy = Boolean(teaching.whyItMatters?.trim());
      const hasTradeoff = Boolean(teaching.tradeoff?.trim());
      if (hasWhy) withWhy += 1;
      if (hasTradeoff) withTradeoff += 1;
      if (!hasWhy || !hasTradeoff) {
        const msg = `"${tutorial.id}" step "${step.id}" teaching missing ${!hasWhy && !hasTradeoff ? 'whyItMatters + tradeoff' : !hasWhy ? 'whyItMatters' : 'tradeoff'}`;
        if (STRICT) error(msg);
        else warn(msg);
      }
    }
  }
}

for (const [nt, ids] of dupes) {
  if (ids.length > 1) {
    warn(
      `first-step nodeType "${nt}" used in ${ids.length} tutorials — vary entry components where realistic (see data/tutorials/AUTHORING.md)`
    );
  }
}

console.log('\n── Tutorial lint summary ───────────────────────────────');
console.log(`  tutorials:  ${TUTORIALS.length}`);
console.log(`  steps:      ${totalSteps}`);
console.log(`  teaching:   ${teachingSteps} (whyItMatters: ${withWhy}, tradeoff: ${withTradeoff})`);
console.log(`  warnings:   ${warnings}`);
console.log(`  errors:     ${errors}${STRICT ? ' (strict)' : ''}`);
console.log('────────────────────────────────────────────────────────');

if (errors > 0) {
  console.error(`\nLint failed with ${errors} error(s). Run without --strict to see warnings only.`);
  process.exit(1);
}
