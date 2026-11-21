import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { toast } from 'sonner';
import * as relayout from '@/lib/diagram/mermaid/relayout';
import { useDiagramStore } from '@/store/diagramStore';
import { LayoutStyleButton } from './LayoutControls';

it('applies the verified routes and shows a warning for a hard geometry issue', async () => {
  const previous = useDiagramStore.getState();
  const nodes = [
    { id: 'a', type: 'systemNode', position: { x: 0, y: 0 }, draggable: false, data: { label: 'API' } },
    { id: 'b', type: 'systemNode', position: { x: 300, y: 0 }, data: { label: 'DB' } },
  ];
  const edges = [
    { id: 'manual', source: 'a', target: 'b', sourceHandle: 'source-top', data: { customWaypoints: [{ x: 150, y: -40 }] } },
    { id: 'automatic', source: 'a', target: 'b', sourceHandle: 'source-right' },
  ];
  const placed = nodes.map(node => ({ ...node, position: { ...node.position, y: 15 } }));
  const layout = vi.spyOn(relayout, 'layoutDiagramViaMermaid').mockResolvedValue({
    success: true,
    nodes: placed,
    edges,
    warnings: ['[GEOMETRY_INVALID] One edge intersects a node.'],
    geometrySummary: {
      status: 'invalid',
      hardViolations: 1,
      criticalPathDisconnectCount: 0,
      crossings: 0,
      weightedCrossings: 0,
      unexplainedPrivateOverlapLength: 0,
      labelCollisions: 0,
      bendCount: 0,
      totalPathLength: 0,
    },
  });
  const warning = vi.spyOn(toast, 'warning').mockImplementation(() => 'geometry-warning');
  useDiagramStore.setState({
    canvases: [{ id: 'layout-test', name: 'Architecture', nodes, edges, isOpen: true, updatedAt: 0 }],
    activeCanvasId: 'layout-test',
    openCanvasIds: ['layout-test'],
    diagramLayoutStyle: 'flow',
  });

  const view = render(<LayoutStyleButton />);
  try {
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
    expect(useDiagramStore.getState().nodes).toEqual(placed);
    expect(useDiagramStore.getState().edges).toEqual(edges);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  } finally {
    view.unmount();
    useDiagramStore.setState(previous);
    layout.mockRestore();
    warning.mockRestore();
  }
});
