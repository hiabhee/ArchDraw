import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Node } from 'reactflow';
import { DiagramGeometryProvider } from '../DiagramGeometryProvider';

const mocks = vi.hoisted(() => ({
  internals: new Map(),
  key: vi.fn(() => 'geometry'),
  worker: vi.fn(),
}));
vi.mock('reactflow', () => ({ useStore: (selector: (s: object) => unknown) => selector({ nodeInternals: mocks.internals }) }));
vi.mock('@/lib/diagram/canvas/CanvasHostContext', () => ({
  useCanvasView: () => ({ direction: 'LR', planKey: 'provider-test', renderStyleId: 'precision', iconMode: 'off', readOnly: true }),
}));
vi.mock('@/lib/diagram/geometry/diagramGeometry', () => ({ geometrySnapshotKey: mocks.key, computeDiagramGeometryPlan: vi.fn() }));
vi.mock('@/lib/diagram/geometry/diagramGeometryWorkerClient', () => ({ computeDiagramGeometryInWorker: mocks.worker }));
vi.mock('@/lib/diagram/mermaid/repairLayout', () => ({ repairDiagramLayout: vi.fn() }));
vi.mock('@/store/diagramStore', () => ({ useDiagramStore: { getState: vi.fn() } }));
const edges: never[] = [];
const node = (x: number, dragging = false): Node => ({ id: 'a', position: { x, y: 0 }, data: {}, dragging });

afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe('geometry during dragging', () => {
  it('does not rebuild snapshot keys or request routing for successive drag frames', () => {
    vi.useFakeTimers();
    mocks.worker.mockReturnValue(new Promise(() => {}));
    mocks.internals = new Map([['a', node(0)]]);
    const view = (n: Node) => <DiagramGeometryProvider nodes={[n]} edges={edges}><div /></DiagramGeometryProvider>;
    const { rerender } = render(view(node(0)));
    mocks.internals = new Map([['a', node(1, true)]]);
    rerender(view(node(1, true)));
    const before = mocks.key.mock.calls.length;
    for (let x = 2; x <= 20; x++) {
      mocks.internals = new Map([['a', node(x, true)]]);
      rerender(view(node(x, true)));
    }
    act(() => vi.advanceTimersByTime(100));
    expect(mocks.key).toHaveBeenCalledTimes(before);
    expect(mocks.worker).not.toHaveBeenCalled();
    mocks.internals = new Map([['a', node(20)]]);
    rerender(view(node(20)));
    act(() => vi.advanceTimersByTime(60));
    expect(mocks.worker).toHaveBeenCalledTimes(1);
  });
});
