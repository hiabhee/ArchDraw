import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Node, Edge } from 'reactflow';
import { GuidePanel } from '@/components/tutorial/GuidePanel';
import { useTutorialStore } from '@/store/tutorialStore';
import { defineTutorial, level, step } from '@/lib/tutorial/builder';
import { initSession, advancePhase } from '@/lib/tutorial/engine';

// Keep the heavy Mermaid pipeline out of the smoke test.
vi.mock('@/lib/mermaid/relayout', () => ({
  layoutDiagramViaMermaid: vi.fn(async () => ({
    nodes: [],
    edges: [],
    success: true,
    warnings: [],
  })),
}));

const tutorial = defineTutorial({
  id: 'smoke-architecture',
  title: 'Smoke Test',
  description: 'A minimal tutorial for the GuidePanel smoke test.',
  difficulty: 'beginner',
  estimatedMinutes: 10,
  tags: ['test'],
  icon: 'Cpu',
  color: '#6FA8DC',
  levels: [
    level({
      title: 'Foundation',
      steps: [
        step({ component: 'API Gateway', parent: 'Web' }),
        step({ component: 'Redis Cache', nodeType: 'in_memory_cache', parent: 'API Gateway' }),
      ],
    }),
  ],
});

function actionSession() {
  // initSession starts at context; advance 3x → intro → teaching → action
  let session = initSession(tutorial);
  session = advancePhase(session, tutorial);
  session = advancePhase(session, tutorial);
  session = advancePhase(session, tutorial);
  expect(session.phase).toBe('action');
  return session;
}

function bootStore(session = actionSession(), nodes: Node[] = [], edges: Edge[] = []) {
  useTutorialStore.setState({
    hasHydrated: true,
    activeTutorial: tutorial,
    session,
    nodes,
    edges,
    currentStep: session.stepIndex + 1,
    currentLevel: session.levelIndex + 1,
    totalSteps: 2,
    activeTutorialId: tutorial.id,
    isComplete: false,
    isLevelComplete: false,
  });
}

describe('GuidePanel smoke (action phase)', () => {
  beforeEach(() => {
    bootStore();
  });

  afterEach(() => {
    cleanup();
    useTutorialStore.getState().exitTutorial();
  });

  it('renders the teaching/action content and requirements checklist', () => {
    render(<GuidePanel />);
    expect(screen.getByText('Your turn!')).toBeTruthy();
    expect(screen.getByText('Requirements')).toBeTruthy();
    expect(screen.getAllByText(/API Gateway/i).length).toBeGreaterThan(0);
  });

  it('shows a validation error when Continue is clicked with unmet requirements', () => {
    render(<GuidePanel />);
    fireEvent.click(screen.getByText('Continue'));
    expect(screen.getByText(/Not ready:/i)).toBeTruthy();
  });

  it('validates and reports ready when node + edge requirements are met', () => {
    const { rerender } = render(<GuidePanel />);

    const web = { id: 'w1', type: 'systemNode', position: { x: 0, y: 0 }, data: { label: 'Web', componentId: 'web_client', category: 'client', componentType: 'client_web' } } as Node;
    const gw = { id: 'g1', type: 'systemNode', position: { x: 100, y: 0 }, data: { label: 'API Gateway', componentId: 'api_gateway', category: 'compute', componentType: 'api_gateway' } } as Node;
    useTutorialStore.getState().setNodes([web, gw]);
    useTutorialStore.getState().setEdges([{ id: 'e1', source: 'w1', target: 'g1' } as Edge]);

    rerender(<GuidePanel />);
    expect(screen.getByText('Ready to continue!')).toBeTruthy();
    fireEvent.click(screen.getByText('✓ Continue'));
    expect(screen.queryByText(/Not ready:/i)).toBeNull();
  });
});
