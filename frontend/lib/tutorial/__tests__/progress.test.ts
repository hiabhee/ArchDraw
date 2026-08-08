import { describe, it, expect } from 'vitest';
import { defineTutorial, level, step } from '@/lib/tutorial/builder';
import {
  getTutorialProgressMeta,
  getTotalStepCount,
  type ProgressEntryShape,
} from '@/lib/tutorial/progress';
import type { TutorialDefinition } from '@/lib/tutorial/schema';

function buildTutorial(): TutorialDefinition {
  return defineTutorial({
    id: 'cat-tutorial',
    title: 'Catalog Tutorial',
    description: 'progress meta fixture',
    difficulty: 'intermediate',
    estimatedMinutes: 20,
    tags: [],
    icon: 'Zap',
    color: '#000000',
    levels: [
      level({
        title: 'Level 1',
        steps: [
          step({ component: 'Web', noConnect: true }),
          step({ component: 'Cache', nodeType: 'in_memory_cache', parent: 'Web' }),
        ],
      }),
      level({
        title: 'Level 2',
        steps: [step({ component: 'DB', nodeType: 'sql_db', parent: 'Cache' })],
      }),
    ],
  });
}

function entry(partial: Partial<ProgressEntryShape>): ProgressEntryShape {
  return {
    tutorialId: 'cat-tutorial',
    currentLevel: 1,
    currentStep: 1,
    currentPhase: 'context',
    completedLevels: [],
    completedStepIds: [],
    canvasNodes: [],
    canvasEdges: [],
    explainCount: 0,
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe('getTutorialProgressMeta', () => {
  it('returns not_started when there is no entry', () => {
    const meta = getTutorialProgressMeta(buildTutorial(), {}, []);
    expect(meta.status).toBe('not_started');
    expect(meta.percent).toBe(0);
  });

  it('returns not_started for an empty entry (step 1, level 1, no canvas)', () => {
    const meta = getTutorialProgressMeta(buildTutorial(), { 'cat-tutorial': entry({}) }, []);
    expect(meta.status).toBe('not_started');
    expect(meta.percent).toBe(0);
  });

  it('derives in_progress percent from completedStepIds across all levels', () => {
    const progress = {
      'cat-tutorial': entry({ completedStepIds: ['step-client_web'] }),
    };
    const meta = getTutorialProgressMeta(buildTutorial(), progress, []);
    expect(meta.status).toBe('in_progress');
    expect(meta.percent).toBe(Math.round((1 / 3) * 100));
  });

  it('treats a canvas with nodes as in_progress even at step 1', () => {
    const progress = {
      'cat-tutorial': entry({ canvasNodes: [{ id: 'n1' }] }),
    };
    const meta = getTutorialProgressMeta(buildTutorial(), progress, []);
    expect(meta.status).toBe('in_progress');
  });

  it('treats progress in level 2 as in_progress', () => {
    const progress = {
      'cat-tutorial': entry({ currentLevel: 2, completedStepIds: ['step-client_web', 'step-in_memory_cache'] }),
    };
    const meta = getTutorialProgressMeta(buildTutorial(), progress, []);
    expect(meta.status).toBe('in_progress');
    expect(meta.currentLevel).toBe(2);
  });

  it('returns completed with 100% when in completedTutorials', () => {
    const progress = {
      'cat-tutorial': entry({ currentLevel: 2, currentStep: 1, completedStepIds: ['a', 'b', 'c'] }),
    };
    const meta = getTutorialProgressMeta(buildTutorial(), progress, ['cat-tutorial']);
    expect(meta.status).toBe('completed');
    expect(meta.percent).toBe(100);
  });

  it('computed total step count sums every level', () => {
    expect(getTotalStepCount(buildTutorial())).toBe(3);
  });
});
