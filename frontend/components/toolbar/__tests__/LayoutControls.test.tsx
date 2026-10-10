import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Edge, Node } from 'reactflow';
import { LayoutToggleButton } from '../LayoutControls';
import { layoutDiagramViaMermaid } from '@/lib/mermaid/relayout';

const testState = vi.hoisted(() => ({
  activeLayoutPresetId: 'layered-lr',
  activeCanvasId: 'first',
  nodes: [] as Node[],
  edges: [] as Edge[],
  canvases: [{ id: 'first', name: 'First' }],
  diagramRenderStyle: 'precision',
  importDiagram: vi.fn(),
  setActiveLayoutPresetId: vi.fn(),
}));

vi.mock('@/store/diagramStore', () => ({
  useDiagramStore: Object.assign(
    (selector: (state: typeof testState) => unknown) => selector(testState),
    { getState: () => testState },
  ),
}));
vi.mock('@/lib/mermaid/relayout', () => ({
  layoutDiagramViaMermaid: vi.fn(),
  presetIdFromDirection: (direction: string) => direction === 'TD' ? 'layered-tb' : 'layered-lr',
}));

describe('LayoutToggleButton', () => {
  let finishLayout: (result: { nodes: Node[]; edges: Edge[]; success: boolean; warnings: string[] }) => void;

  beforeEach(() => {
    testState.activeCanvasId = 'first';
    testState.nodes = [{ id: 'api', type: 'shapeNode', position: { x: 0, y: 0 }, data: { label: 'API' } } as Node];
    testState.edges = [];
    testState.importDiagram.mockClear();
    testState.setActiveLayoutPresetId.mockClear();
    vi.mocked(layoutDiagramViaMermaid).mockImplementation(() => new Promise((resolve) => {
      finishLayout = resolve;
    }));
  });

  afterEach(cleanup);

  it('applies the layout when the active graph is unchanged', async () => {
    render(<LayoutToggleButton />);
    fireEvent.click(screen.getByRole('button'));
    const layoutedNodes = [...testState.nodes];

    await act(async () => finishLayout({ nodes: layoutedNodes, edges: [], success: true, warnings: [] }));
    expect(testState.importDiagram).toHaveBeenCalledWith(layoutedNodes, []);
    expect(testState.setActiveLayoutPresetId).toHaveBeenCalledWith('layered-tb');
  });

  it('does not apply a result after the graph changes', async () => {
    render(<LayoutToggleButton />);
    fireEvent.click(screen.getByRole('button'));
    testState.nodes = [...testState.nodes, { id: 'db', type: 'shapeNode', position: { x: 0, y: 0 }, data: { label: 'DB' } } as Node];

    await act(async () => finishLayout({ nodes: [], edges: [], success: true, warnings: [] }));
    expect(testState.importDiagram).not.toHaveBeenCalled();
    expect(testState.setActiveLayoutPresetId).not.toHaveBeenCalled();
  });

  it('does not apply a result to another canvas', async () => {
    render(<LayoutToggleButton />);
    fireEvent.click(screen.getByRole('button'));
    testState.activeCanvasId = 'second';

    await act(async () => finishLayout({ nodes: [], edges: [], success: true, warnings: [] }));
    expect(testState.importDiagram).not.toHaveBeenCalled();
  });
});
