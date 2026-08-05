import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DiagramState } from '../../types';
import { rehydrateDiagramState } from '../rehydrate';

function baseState(overrides: Partial<DiagramState> = {}): DiagramState {
  return {
    canvases: [
      {
        id: 'guest-canvas',
        name: 'Elephant',
        nodes: [
          {
            id: 'n1',
            type: 'system',
            position: { x: 0, y: 0 },
            data: { label: 'API', category: 'default', typeId: 'default', color: '#000', icon: 'Box' },
          },
        ],
        edges: [],
      },
    ],
    activeCanvasId: 'guest-canvas',
    openCanvasIds: ['guest-canvas'],
    userProfile: { id: 'guest' },
    ...overrides,
  } as DiagramState;
}

describe('rehydrateDiagramState', () => {
  const originalSessionStorage = global.sessionStorage;

  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(global, 'sessionStorage', {
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'sessionStorage', {
      value: originalSessionStorage,
      configurable: true,
    });
  });

  it('normalizes node types on existing guest session reload', () => {
    sessionStorage.setItem('archdraw-session-active', 'true');
    const state = baseState();
    rehydrateDiagramState(state);
    expect(state.canvases[0].nodes[0].type).toBe('systemNode');
  });

  it('resets guest canvases on a new browser session', () => {
    const state = baseState({
      canvases: [
        {
          id: 'old',
          name: 'Old',
          nodes: [{ id: 'x', type: 'systemNode', position: { x: 1, y: 1 }, data: { label: 'X' } }],
          edges: [],
        },
      ],
      activeCanvasId: 'old',
      openCanvasIds: ['old'],
    });
    rehydrateDiagramState(state);
    expect(state.canvases).toHaveLength(1);
    expect(state.canvases[0].id).toBe('guest-canvas');
    expect(state.canvases[0].nodes).toHaveLength(0);
    expect(state.activeCanvasId).toBe('guest-canvas');
  });
});
