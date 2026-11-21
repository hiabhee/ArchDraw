import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CometTrailCanvas } from '../CometTrailCanvas';

vi.mock('reactflow', () => ({ useReactFlow: () => flow }));
vi.mock('@/store/diagramStore', () => ({ useDiagramStore: (selector: (s: object) => unknown) => selector({ isPenModeActive: true }) }));
const flow = {
  getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
  screenToFlowPosition: (point: object) => point,
};
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('pen rendering', () => {
  it('does no idle frame work, runs for a stroke, and stops after it expires', () => {
    const frames: FrameRequestCallback[] = [];
    const request = vi.fn((callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const ctx = { resetTransform: vi.fn(), scale: vi.fn(), clearRect: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const { container } = render(<CometTrailCanvas />);
    expect(request).not.toHaveBeenCalled();
    const canvas = container.querySelector('canvas')!;
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    expect(request).toHaveBeenCalledTimes(1);
    act(() => frames.shift()!(0));
    expect(request).toHaveBeenCalledTimes(2);
    now.mockReturnValue(4001);
    act(() => frames.shift()!(0));
    expect(request).toHaveBeenCalledTimes(2);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);
  });
});
