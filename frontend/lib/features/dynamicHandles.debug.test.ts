/**
 * Debug logging tests for getDynamicHandles
 * Validates Requirements 9.1, 9.2, 9.3, 9.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Position } from 'reactflow';
import { getDynamicHandles, type NodeRect } from './dynamicHandles';
import logger from '@/lib/logger';

describe('getDynamicHandles - Debug Logging', () => {
  let loggerInfoSpy: ReturnType<typeof vi.spyOn>;
  let originalEnv: string | undefined;

  beforeEach(() => {
    loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    originalEnv = process.env.NEXT_PUBLIC_DEBUG_HANDLES;
  });

  afterEach(() => {
    loggerInfoSpy.mockRestore();
    process.env.NEXT_PUBLIC_DEBUG_HANDLES = originalEnv;
  });

  it('should NOT log when NEXT_PUBLIC_DEBUG_HANDLES is not set', () => {
    delete process.env.NEXT_PUBLIC_DEBUG_HANDLES;

    const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
    const targetRect: NodeRect = { x: 200, y: 0, width: 100, height: 80 };

    getDynamicHandles(sourceRect, targetRect);

    expect(loggerInfoSpy).not.toHaveBeenCalled();
  });

  it('should NOT log when NEXT_PUBLIC_DEBUG_HANDLES is false', () => {
    process.env.NEXT_PUBLIC_DEBUG_HANDLES = 'false';

    const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
    const targetRect: NodeRect = { x: 200, y: 0, width: 100, height: 80 };

    getDynamicHandles(sourceRect, targetRect);

    expect(loggerInfoSpy).not.toHaveBeenCalled();
  });

  it('should log node centers, dx, dy when debug is enabled', () => {
    process.env.NEXT_PUBLIC_DEBUG_HANDLES = 'true';

    const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
    const targetRect: NodeRect = { x: 200, y: 0, width: 100, height: 80 };

    getDynamicHandles(sourceRect, targetRect, 'edge-1', 'node-1', 'node-2');

    // Should have been called 3 times: calculation, selected handles, performance
    expect(loggerInfoSpy).toHaveBeenCalledTimes(3);

    // First call should log calculation details
    const firstCall = loggerInfoSpy.mock.calls[0];
    expect(firstCall[0]).toBe('[DynamicHandles] Calculation:');
    expect(firstCall[1]).toMatchObject({
      edgeId: 'edge-1',
      sourceId: 'node-1',
      targetId: 'node-2',
      nodeCenter: {
        source: { x: 50, y: 40 },
        target: { x: 250, y: 40 },
      },
      dx: 200,
      dy: 0,
    });

    // Second call should log selected handles
    const secondCall = loggerInfoSpy.mock.calls[1];
    expect(secondCall[0]).toBe('[DynamicHandles] Selected handles:');
    expect(secondCall[1]).toMatchObject({
      edgeId: 'edge-1',
      sourceId: 'node-1',
      targetId: 'node-2',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
  });

  it('should log vertical distance correctly', () => {
    process.env.NEXT_PUBLIC_DEBUG_HANDLES = 'true';

    const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
    const targetRect: NodeRect = { x: 0, y: 200, width: 100, height: 80 };

    getDynamicHandles(sourceRect, targetRect, 'edge-2', 'node-3', 'node-4');

    const firstCall = loggerInfoSpy.mock.calls[0];
    expect(firstCall[1]).toMatchObject({
      dx: 0,
      dy: 200,
    });

    const secondCall = loggerInfoSpy.mock.calls[1];
    expect(secondCall[1]).toMatchObject({
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });
  });

  it('should work without optional edge/node IDs', () => {
    process.env.NEXT_PUBLIC_DEBUG_HANDLES = 'true';

    const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
    const targetRect: NodeRect = { x: 200, y: 0, width: 100, height: 80 };

    getDynamicHandles(sourceRect, targetRect);

    expect(loggerInfoSpy).toHaveBeenCalledTimes(3);

    const firstCall = loggerInfoSpy.mock.calls[0];
    expect(firstCall[1]).toMatchObject({
      edgeId: undefined,
      sourceId: undefined,
      targetId: undefined,
    });
  });

  it('should log performance timing when debug is enabled', () => {
    process.env.NEXT_PUBLIC_DEBUG_HANDLES = 'true';

    const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
    const targetRect: NodeRect = { x: 200, y: 0, width: 100, height: 80 };

    getDynamicHandles(sourceRect, targetRect, 'edge-1', 'node-1', 'node-2');

    // Third call should log performance
    const thirdCall = loggerInfoSpy.mock.calls[2];
    expect(thirdCall[0]).toBe('[DynamicHandles] Performance:');
    expect(thirdCall[1]).toMatchObject({
      edgeId: 'edge-1',
    });
    expect(thirdCall[1].elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle errors and return safe defaults', () => {
    process.env.NEXT_PUBLIC_DEBUG_HANDLES = 'true';

    // Pass invalid rect that will cause calculation issues
    const invalidRect: NodeRect = { x: NaN, y: 0, width: 100, height: 80 };
    const validRect: NodeRect = { x: 200, y: 0, width: 100, height: 80 };

    const result = getDynamicHandles(invalidRect, validRect, 'edge-1', 'node-1', 'node-2');

    // Should return safe defaults on error
    expect(result).toBeDefined();
    const validPositions = [Position.Top, Position.Right, Position.Bottom, Position.Left];
    expect(validPositions).toContain(result.sourcePosition);
    expect(validPositions).toContain(result.targetPosition);
  });
});
