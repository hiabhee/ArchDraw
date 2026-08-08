import type { TutorialDefinition } from '@/lib/tutorial/schema';
import type { ValidationRule } from '@/lib/tutorial/schema';

const tutorialFiles = import.meta.glob('../../../data/tutorials/*-architecture.ts', { eager: true });

const forbiddenImports = ['react', 'zustand', '@/store'];

interface TestResult {
  file: string;
  passed: boolean;
  errors: string[];
}

function validateTutorialDefinition(tutorial: unknown, filePath: string): TestResult {
  const errors: string[] = [];
  
  if (!tutorial || typeof tutorial !== 'object') {
    return { file: filePath, passed: false, errors: ['Tutorial is not an object'] };
  }
  
  const t = tutorial as Record<string, unknown>;
  
  if (!t.id || typeof t.id !== 'string') {
    errors.push('Missing or invalid id');
  }
  if (!t.title || typeof t.title !== 'string') {
    errors.push('Missing or invalid title');
  }
  if (!t.description || typeof t.description !== 'string') {
    errors.push('Missing or invalid description');
  }
  if (!t.difficulty || !['beginner', 'intermediate', 'advanced'].includes(t.difficulty as string)) {
    errors.push('Missing or invalid difficulty');
  }
  if (typeof t.estimatedMinutes !== 'number') {
    errors.push('Missing or invalid estimatedMinutes');
  }
  if (!Array.isArray(t.levels)) {
    errors.push('Missing or invalid levels array');
  } else {
    t.levels.forEach((level: unknown, i: number) => {
      const l = level as Record<string, unknown>;
      if (!l.id) errors.push(`Level ${i}: missing id`);
      if (!l.title) errors.push(`Level ${i}: missing title`);
      if (!Array.isArray(l.steps)) {
        errors.push(`Level ${i}: missing steps array`);
      } else {
        l.steps.forEach((step: unknown, j: number) => {
          const s = step as Record<string, unknown>;
          if (!s.id) errors.push(`Level ${i} Step ${j}: missing id`);
          if (!s.title) errors.push(`Level ${i} Step ${j}: missing title`);
          if (!s.phases || typeof s.phases !== 'object') {
            errors.push(`Level ${i} Step ${j}: missing phases`);
          } else {
            const phases = s.phases as Record<string, unknown>;
            const teaching = phases.teaching as Record<string, unknown> | undefined;
            if (!teaching || typeof teaching !== 'object') {
              errors.push(`Level ${i} Step ${j}: missing teaching phase`);
            } else {
              if (!teaching.heading || typeof teaching.heading !== 'string' || !teaching.heading.trim()) {
                errors.push(`Level ${i} Step ${j}: teaching phase missing heading`);
              }
              if (!teaching.body || typeof teaching.body !== 'string' || !teaching.body.trim()) {
                errors.push(`Level ${i} Step ${j}: teaching phase missing body`);
              }
            }
          }
          if (!Array.isArray(s.validation)) {
            errors.push(`Level ${i} Step ${j}: missing validation array`);
          }
        });
      }
    });
  }
  
  return { file: filePath, passed: errors.length === 0, errors };
}

import { describe, it, expect } from 'vitest';

describe('Tutorial Definitions Validation', () => {
  it('should validate all tutorial definitions without errors', () => {
    let failed = 0;
    const failures: string[] = [];

    for (const [path, mod] of Object.entries(tutorialFiles)) {
      if (path.includes('TUTORIAL_TEMPLATE') || path.includes('.schema.')) continue;
      if (!path.includes('-architecture.ts')) continue;

      const tutorial = (mod as { default?: TutorialDefinition }).default;
      if (!tutorial) {
        failures.push(`${path}: No default export`);
        failed++;
        continue;
      }

      const result = validateTutorialDefinition(tutorial, path);
      if (!result.passed) {
        failures.push(`${path}: ${result.errors.join(', ')}`);
        failed++;
      }
    }

    expect(failures).toEqual([]);
    expect(failed).toBe(0);
  });

  it('teaching phases are enriched with whyItMatters/tradeoff callouts', () => {
    // The `step()` builder auto-fills these from COMPONENT_TOOLTIPS. If the
    // builder wiring breaks, coverage drops to 0 — this guards the enrichment
    // path while Phase 4 content migration fills the remaining gaps.
    let teachingCount = 0;
    let withWhy = 0;
    let withTradeoff = 0;
    const missing: string[] = [];

    for (const [path, mod] of Object.entries(tutorialFiles)) {
      if (!path.includes('-architecture.ts')) continue;
      const tutorial = (mod as { default?: TutorialDefinition }).default;
      if (!tutorial) continue;

      for (const level of tutorial.levels) {
        for (const step of level.steps) {
          const teaching = step.phases?.teaching;
          if (!teaching) continue;
          teachingCount += 1;
          if (teaching.whyItMatters) withWhy += 1;
          if (teaching.tradeoff) withTradeoff += 1;
          if (!teaching.whyItMatters && !teaching.tradeoff) {
            missing.push(`${tutorial.id}/${step.id}`);
          }
        }
      }
    }

    expect(teachingCount).toBeGreaterThan(0);
    expect(withWhy).toBeGreaterThan(0);
    expect(withTradeoff).toBeGreaterThan(0);
  });
});
