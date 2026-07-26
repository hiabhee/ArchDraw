import { describe, it, expect } from 'vitest';
import { useDiagramStore } from '../diagramStore';

describe('diagramStore', () => {
  it('exposes state and actions', () => {
    const state = useDiagramStore.getState();
    expect(state).toBeDefined();
    expect(typeof state.addNode).toBe('function');
    expect(typeof state.removeNode).toBe('function');
    expect(typeof state.importDiagram).toBe('function');
    expect(typeof state.clearDiagram).toBe('function');
  });

  it('addNode increments node count', () => {
    const before = useDiagramStore.getState().nodes.length;
    useDiagramStore.getState().addNode('smoke-test', 'Smoke Test');
    expect(useDiagramStore.getState().nodes.length).toBe(before + 1);
  });
});
