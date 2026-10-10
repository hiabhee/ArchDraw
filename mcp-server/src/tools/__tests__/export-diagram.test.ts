import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { ReactFlowNode } from '../../types/index.js';

function makeNode(id: string): ReactFlowNode {
  return {
    id,
    type: 'systemNode',
    position: { x: 0, y: 0 },
    data: { label: id, icon: 'box', layer: 'compute', tier: 'compute', tierColor: '#0d9488' },
    width: 200,
    height: 70,
  };
}

describe('exportDiagram', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports json from local state without hitting the API', async () => {
    const { setDiagramState } = await import('../../lib/diagram-state.js');
    const { exportDiagram } = await import('../export-diagram.js');

    setDiagramState({ nodes: [makeNode('a')], edges: [], sessionId: 'sess-1' });

    const result = await exportDiagram({ format: 'json' }) as {
      success: boolean;
      nodes: ReactFlowNode[];
    };
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('a');
  });

  it('errors without a diagram', async () => {
    const { exportDiagram } = await import('../export-diagram.js');
    const result = await exportDiagram({ format: 'json' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('errors for png/svg without a sessionId', async () => {
    const { setDiagramState } = await import('../../lib/diagram-state.js');
    const { exportDiagram } = await import('../export-diagram.js');

    setDiagramState({ nodes: [makeNode('a')], edges: [] });
    const result = await exportDiagram({ format: 'png' }) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toContain('sessionId');
  });
});
