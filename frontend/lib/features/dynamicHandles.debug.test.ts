/**
 * Debug behavior tests for getDynamicHandles
 * The intersection-based implementation does not use the logger,
 * so these tests verify correct behavior regardless of debug flag.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Position } from 'reactflow';
import { getDynamicHandles, type NodeRect } from './dynamicHandles';

describe('getDynamicHandles - Debug behavior', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NEXT_PUBLIC_DEBUG_HANDLES;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_DEBUG_HANDLES = originalEnv;
  });

  it('should produce correct handles when debug is not set', () => {
    delete process.env.NEXT_PUBLIC_DEBUG_HANDLES;

    const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
    const targetRect: NodeRect = { x: 200, y: 0, width: 100, height: 80 };

    const result = getDynamicHandles(sourceRect, targetRect);

    expect(result.sourcePosition).toBe(Position.Right);
    expect(result.targetPosition).toBe(Position.Left);
  });

  it('should produce correct handles when debug is false', () => {
    process.env.NEXT_PUBLIC_DEBUG_HANDLES = 'false';

    const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
    const targetRect: NodeRect = { x: 200, y: 0, width: 100, height: 80 };

    const result = getDynamicHandles(sourceRect, targetRect);

    expect(result.sourcePosition).toBe(Position.Right);
    expect(result.targetPosition).toBe(Position.Left);
  });

  it('should produce correct handles when debug is enabled', () => {
    process.env.NEXT_PUBLIC_DEBUG_HANDLES = 'true';

    const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
    const targetRect: NodeRect = { x: 200, y: 0, width: 100, height: 80 };

    const result = getDynamicHandles(sourceRect, targetRect, 'edge-1', 'node-1', 'node-2');

    expect(result.sourcePosition).toBe(Position.Right);
    expect(result.targetPosition).toBe(Position.Left);
  });

  it('should produce correct handles for vertical layout', () => {
    process.env.NEXT_PUBLIC_DEBUG_HANDLES = 'true';

    const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
    const targetRect: NodeRect = { x: 0, y: 200, width: 100, height: 80 };

    const result = getDynamicHandles(sourceRect, targetRect, 'edge-2', 'node-3', 'node-4');

    expect(result.sourcePosition).toBe(Position.Bottom);
    expect(result.targetPosition).toBe(Position.Top);
  });

  it('should work without optional edge/node IDs', () => {
    process.env.NEXT_PUBLIC_DEBUG_HANDLES = 'true';

    const sourceRect: NodeRect = { x: 0, y: 0, width: 100, height: 80 };
    const targetRect: NodeRect = { x: 200, y: 0, width: 100, height: 80 };

    const result = getDynamicHandles(sourceRect, targetRect);

    expect(result.sourcePosition).toBe(Position.Right);
    expect(result.targetPosition).toBe(Position.Left);
  });

  it('should handle errors and return safe defaults', () => {
    process.env.NEXT_PUBLIC_DEBUG_HANDLES = 'true';

    const invalidRect: NodeRect = { x: NaN, y: 0, width: 100, height: 80 };
    const validRect: NodeRect = { x: 200, y: 0, width: 100, height: 80 };

    const result = getDynamicHandles(invalidRect, validRect, 'edge-1', 'node-1', 'node-2');

    expect(result).toBeDefined();
    const validPositions = [Position.Top, Position.Right, Position.Bottom, Position.Left];
    expect(validPositions).toContain(result.sourcePosition);
    expect(validPositions).toContain(result.targetPosition);
  });
});
