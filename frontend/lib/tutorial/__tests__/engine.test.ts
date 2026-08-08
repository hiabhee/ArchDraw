import { describe, it, expect } from 'vitest';
import { defineTutorial, level, step } from '@/lib/tutorial/builder';
import {
  initSession,
  advancePhase,
  advanceWithResult,
  isTutorialComplete,
  getCurrentStep,
  getTotalStepCount,
  deriveTutorialStatus,
} from '@/lib/tutorial/engine';
import type { TutorialDefinition, TutorialSession } from '@/lib/tutorial/schema';

function buildFixture(): TutorialDefinition {
  return defineTutorial({
    id: 'test-tutorial',
    title: 'Test Tutorial',
    description: 'A two-level fixture',
    difficulty: 'beginner',
    estimatedMinutes: 10,
    tags: [],
    icon: 'Zap',
    color: '#000000',
    levels: [
      level({
        title: 'Level 1',
        steps: [
          step({ component: 'Web', nodeType: 'client_web', noConnect: true }),
          step({ component: 'API Gateway', nodeType: 'api_gateway', parent: 'Web' }),
        ],
      }),
      level({
        title: 'Level 2',
        steps: [
          step({ component: 'SQL Database', nodeType: 'sql_db', parent: 'API Gateway' }),
        ],
      }),
    ],
  });
}

function advanceN(session: TutorialSession, tutorial: TutorialDefinition, n: number): TutorialSession {
  let s = session;
  for (let i = 0; i < n; i++) s = advancePhase(s, tutorial);
  return s;
}

describe('tutorial engine', () => {
  it('initializes a session at the first step, context phase', () => {
    const tutorial = buildFixture();
    const session = initSession(tutorial);
    expect(session.levelIndex).toBe(0);
    expect(session.stepIndex).toBe(0);
    expect(session.phase).toBe('context');
    expect(session.completedStepIds).toEqual([]);
    expect(session.completedLevelIds).toEqual([]);
    expect(getCurrentStep(session, tutorial)?.title).toBe('Add Web');
    expect(isTutorialComplete(session, tutorial)).toBe(false);
  });

  it('walks through every phase of a step', () => {
    const tutorial = buildFixture();
    let session = initSession(tutorial);

    session = advanceN(session, tutorial, 1);
    expect(session.phase).toBe('intro');
    session = advanceN(session, tutorial, 1);
    expect(session.phase).toBe('teaching');
    session = advanceN(session, tutorial, 1);
    expect(session.phase).toBe('action');
    session = advanceN(session, tutorial, 1);
    // First step is noConnect → 'connecting' is skipped.
    expect(session.phase).toBe('celebration');
  });

  it('moves to the next step after celebration', () => {
    const tutorial = buildFixture();
    let session = initSession(tutorial);

    session = advanceN(session, tutorial, 4); // context→intro→teaching→action→(connecting skipped)→celebration
    expect(session.phase).toBe('celebration');
    expect(session.completedStepIds).toEqual([]);

    session = advanceN(session, tutorial, 1); // celebration → next step
    expect(session.stepIndex).toBe(1);
    expect(session.phase).toBe('context');
    expect(session.completedStepIds).toHaveLength(1);
    expect(session.completedStepIds[0]).toBe('step-client_web');
  });

  it('reports level crossings via advanceWithResult', () => {
    const tutorial = buildFixture();
    let session = initSession(tutorial);

    // Complete step 1.
    session = advanceN(session, tutorial, 4); // step 1 → celebration
    session = advanceN(session, tutorial, 1); // → step 2 context

    // Walk step 2 (has parent → connecting is not skipped).
    session = advanceN(session, tutorial, 3); // context→intro→teaching→action
    expect(session.phase).toBe('action');
    session = advanceN(session, tutorial, 1); // → connecting
    session = advanceN(session, tutorial, 1); // → celebration
    expect(session.phase).toBe('celebration');

    // Celebration click crosses into level 2.
    const result = advanceWithResult(session, tutorial);
    expect(result.crossedLevel).toBe(true);
    expect(result.session.levelIndex).toBe(1);
    expect(result.session.stepIndex).toBe(0);
    expect(result.session.phase).toBe('context');
    expect(result.session.completedLevelIds).toEqual(['level-level-1']);
    expect(isTutorialComplete(result.session, tutorial)).toBe(false);
  });

  it('completes the tutorial on the last step of the last level', () => {
    const tutorial = buildFixture();
    let session = initSession(tutorial);

    // Finish level 1.
    session = advanceN(session, tutorial, 4); // step 1 → celebration
    session = advanceN(session, tutorial, 1); // → step 2 context
    session = advanceN(session, tutorial, 3); // step 2 → action
    session = advanceN(session, tutorial, 1); // → connecting
    session = advanceN(session, tutorial, 1); // → celebration (level 1 done)
    session = advanceN(session, tutorial, 1); // → crossing into level 2 context
    expect(session.levelIndex).toBe(1);
    expect(session.stepIndex).toBe(0);

    // Walk the final step (has parent → connecting is included).
    session = advanceN(session, tutorial, 1); // context→intro
    session = advanceN(session, tutorial, 1); // intro→teaching
    session = advanceN(session, tutorial, 1); // teaching→action
    session = advanceN(session, tutorial, 1); // action→connecting
    session = advanceN(session, tutorial, 1); // connecting→celebration
    expect(session.phase).toBe('celebration');
    expect(isTutorialComplete(session, tutorial)).toBe(true);
    expect(getTotalStepCount(tutorial)).toBe(3);
  });

  it('deriveTutorialStatus reports progress and completion consistently', () => {
    const tutorial = buildFixture();
    let session = initSession(tutorial);

    const before = deriveTutorialStatus(session, tutorial);
    expect(before.isComplete).toBe(false);
    expect(before.progressPercent).toBe(0);
    expect(before.currentLevel).toBe(1);
    expect(before.currentStep).toBe(1);

    // Complete step 1.
    session = advanceN(session, tutorial, 4);
    session = advanceN(session, tutorial, 1);

    const mid = deriveTutorialStatus(session, tutorial);
    expect(mid.progressPercent).toBe(Math.round((1 / 3) * 100));
    expect(mid.completedStepIds).toEqual(['step-client_web']);
    expect(mid.currentLevel).toBe(1);
    expect(mid.currentStep).toBe(2);

    // Finish level 1 and reach the final step's celebration.
    session = advanceN(session, tutorial, 3); // step 2 → action
    session = advanceN(session, tutorial, 1); // → connecting
    session = advanceN(session, tutorial, 1); // → celebration (level 1 done)
    session = advanceN(session, tutorial, 1); // → crossing into level 2 context
    session = advanceN(session, tutorial, 5); // final step → celebration
    expect(session.phase).toBe('celebration');

    const done = deriveTutorialStatus(session, tutorial);
    expect(done.isComplete).toBe(true);
  });
});
