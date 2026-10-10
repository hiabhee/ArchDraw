import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Position, ReactFlowProvider, type Edge, type Node, type NodeProps } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';
import { useHandleSlotLayout } from '@/hooks/useHandleSlotLayout';
import { ShapeNode } from '@/components/ShapeNode';
import { CanvasHostProvider, EDITOR_HOST, useCanvasView, type CanvasHost } from '../CanvasHostContext';
import { useCanvasTheme } from '@/lib/theme';

const node = (id: string, x: number, data: Record<string, unknown> = {}): Node => ({
  id, type: 'shapeNode', position: { x, y: 0 }, width: 200, height: 100, data: { label: id, ...data },
} as Node);

function loadEditorCanvas(nodes: Node[], edges: Edge[] = []) {
  useDiagramStore.setState({
    activeCanvasId: 'editor-canvas',
    canvases: [{ id: 'editor-canvas', name: 'Mine', nodes, edges }],
    activeLayoutPresetId: 'layered-lr',
    diagramRenderStyle: 'precision',
    diagramStyleTheme: 'slate',
    userProfile: { id: 'guest' } as never,
  });
}

const withHost = (host: CanvasHost) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ReactFlowProvider><CanvasHostProvider value={host}>{children}</CanvasHostProvider></ReactFlowProvider>
  );
  return Wrapper;
};

afterEach(cleanup);

describe('CanvasHostContext', () => {
  it('lets a viewer override render style and direction without touching editor prefs', () => {
    loadEditorCanvas([]);
    const { result } = renderHook(() => useCanvasView(), {
      wrapper: withHost({ readOnly: true, renderStyleId: 'sketch', direction: 'TD', planKey: 'share:x' }),
    });
    expect(result.current).toMatchObject({ readOnly: true, renderStyleId: 'sketch', direction: 'TD', planKey: 'share:x' });
    expect(useDiagramStore.getState().diagramRenderStyle).toBe('precision');
  });

  it('lets a host pin the canvas theme without changing the app-wide mirror', () => {
    useDiagramStore.setState({ darkMode: false });
    const { result } = renderHook(() => useCanvasTheme(), { wrapper: withHost({ readOnly: true, isDark: true }) });
    expect(result.current.isDark).toBe(true);
    expect(useDiagramStore.getState().darkMode).toBe(false);
  });

  it('computes handle slots from the host graph, not the editor canvas', () => {
    // Editor canvas: "hub" has no edges.
    loadEditorCanvas([node('hub', 0)]);
    const viewerNodes = [node('src', 0), node('hub', 400)];
    const viewerEdges = [{ id: 'e', source: 'src', target: 'hub' }] as Edge[];
    const { result } = renderHook(() => useHandleSlotLayout('hub'), {
      wrapper: withHost({ readOnly: true, nodes: viewerNodes, edges: viewerEdges }),
    });
    expect(result.current.shouldRenderHandle(Position.Left, 'target')).toBe(true);
  });

  it('does not resize or save the editor canvas when a viewer renders a node with the same id', async () => {
    const editorNode = node('api', 0, { nodeWidth: 999, nodeHeight: 999 });
    loadEditorCanvas([editorNode]);
    const props = { id: 'api', data: { label: 'API', shape: 'rectangle' }, selected: false } as unknown as NodeProps;

    render(<ShapeNode {...props} />, { wrapper: withHost({ readOnly: true }) });
    await act(async () => { await Promise.resolve(); });
    expect(useDiagramStore.getState().nodes[0].data).toMatchObject({ nodeWidth: 999, nodeHeight: 999 });

    cleanup();
    render(<ShapeNode {...props} />, { wrapper: withHost(EDITOR_HOST) });
    await act(async () => { await Promise.resolve(); });
    // Sanity check: the editor host still syncs sizes as before.
    expect(useDiagramStore.getState().nodes[0].data.nodeWidth).not.toBe(999);
  });
});
