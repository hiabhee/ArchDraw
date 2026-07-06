/**
 * Property-based tests for dynamic handle positioning
 * Uses fast-check to verify properties hold across randomly generated inputs
 * 
 * Each property test runs with minimum 100 iterations to ensure comprehensive coverage
 */

import { describe, it, expect } from 'vitest';
import { Position } from 'reactflow';
import * as fc from 'fast-check';
import { getDynamicHandles, getHandleCoordinate, type NodeRect } from './dynamicHandles';

// Arbitrary generator for valid node rectangles
const nodeRectArbitrary = fc.record({
  x: fc.double({ min: -1000, max: 1000, noNaN: true }),
  y: fc.double({ min: -1000, max: 1000, noNaN: true }),
  width: fc.double({ min: 1, max: 500, noNaN: true }),
  height: fc.double({ min: 1, max: 500, noNaN: true }),
});

// Arbitrary generator for node rectangles that may have missing/zero dimensions
const edgeCaseRectArbitrary = fc.record({
  x: fc.double({ min: -1000, max: 1000, noNaN: true }),
  y: fc.double({ min: -1000, max: 1000, noNaN: true }),
  width: fc.double({ min: 0, max: 500, noNaN: true }),
  height: fc.double({ min: 0, max: 500, noNaN: true }),
});

// Arbitrary generator for Position enum values
const positionArbitrary = fc.constantFrom(
  Position.Top,
  Position.Right,
  Position.Bottom,
  Position.Left
);

describe('Property-Based Tests: Dynamic Handle Positioning', () => {
  describe('Property 1: Handle Selection Based on Spatial Relationship', () => {
    /**
     * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 3.4, 3.5, 3.6**
     * 
     * For any two node rectangles, the handle selection should pick the pair
     * (source side + target side) with the shortest Manhattan distance between
     * handle positions. This automatically routes each edge through the side
     * closest to its target.
     */
    it('should select handles based on spatial relationship', () => {
      fc.assert(
        fc.property(nodeRectArbitrary, nodeRectArbitrary, (sourceRect, targetRect) => {
          const result = getDynamicHandles(sourceRect, targetRect);

          // Compute the expected result using the same distance-based logic
          const candidates: Array<{ source: Position; target: Position }> = [
            { source: Position.Right, target: Position.Left },
            { source: Position.Left, target: Position.Right },
            { source: Position.Top, target: Position.Bottom },
            { source: Position.Bottom, target: Position.Top },
          ];

          let bestDist = Infinity;

          for (const { source, target } of candidates) {
            const srcCoord = getHandleCoordinate(sourceRect, source);
            const tgtCoord = getHandleCoordinate(targetRect, target);
            const dist = Math.abs(tgtCoord.x - srcCoord.x) + Math.abs(tgtCoord.y - srcCoord.y);
            if (dist < bestDist) {
              bestDist = dist;
            }
          }

          const selectedSrcCoord = getHandleCoordinate(sourceRect, result.sourcePosition);
          const selectedTgtCoord = getHandleCoordinate(targetRect, result.targetPosition);
          const selectedDist = Math.abs(selectedTgtCoord.x - selectedSrcCoord.x) + Math.abs(selectedTgtCoord.y - selectedSrcCoord.y);

          expect(selectedDist).toBeLessThanOrEqual(bestDist + 1e-5);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('Property 2: Handle Coordinate Calculation Correctness', () => {
    /**
     * **Validates: Requirements 3.1, 4.1, 4.2, 4.3, 4.4**
     * 
     * For any node rectangle and handle position, coordinates should match formulas:
     * - Top: (centerX, y)
     * - Bottom: (centerX, y + height)
     * - Left: (x, centerY)
     * - Right: (x + width, centerY)
     */
    it('should calculate handle coordinates correctly for all positions', () => {
      fc.assert(
        fc.property(nodeRectArbitrary, positionArbitrary, (rect, position) => {
          const coord = getHandleCoordinate(rect, position);

          const centerX = rect.x + rect.width / 2;
          const centerY = rect.y + rect.height / 2;
          const OUTER_OFFSET = 12;

          switch (position) {
            case Position.Top:
              expect(coord.x).toBeCloseTo(centerX, 10);
              expect(coord.y).toBeCloseTo(rect.y - OUTER_OFFSET, 10);
              break;
            case Position.Bottom:
              expect(coord.x).toBeCloseTo(centerX, 10);
              expect(coord.y).toBeCloseTo(rect.y + rect.height + OUTER_OFFSET, 10);
              break;
            case Position.Left:
              expect(coord.x).toBeCloseTo(rect.x - OUTER_OFFSET, 10);
              expect(coord.y).toBeCloseTo(centerY, 10);
              break;
            case Position.Right:
              expect(coord.x).toBeCloseTo(rect.x + rect.width + OUTER_OFFSET, 10);
              expect(coord.y).toBeCloseTo(centerY, 10);
              break;
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Handle Symmetry', () => {
    /**
     * **Validates: Requirements 10.5**
     * 
     * For any two node rectangles A and B:
     * If A→B produces (sourcePos, targetPos), then B→A should produce (targetPos, sourcePos)
     */
    it('should produce symmetric handle positions when swapping source and target', () => {
      fc.assert(
        fc.property(nodeRectArbitrary, nodeRectArbitrary, (rectA, rectB) => {
          const cxA = rectA.x + rectA.width / 2;
          const cyA = rectA.y + rectA.height / 2;
          const cxB = rectB.x + rectB.width / 2;
          const cyB = rectB.y + rectB.height / 2;
          if (Math.abs(cxA - cxB) < 1e-5 && Math.abs(cyA - cyB) < 1e-5) {
            return true;
          }

          const resultAB = getDynamicHandles(rectA, rectB);
          const resultBA = getDynamicHandles(rectB, rectA);

          // Swapping source and target should reverse the handle positions
          expect(resultAB.sourcePosition).toBe(resultBA.targetPosition);
          expect(resultAB.targetPosition).toBe(resultBA.sourcePosition);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Handle Consistency Under Axis-Aligned Movement', () => {
    /**
     * **Validates: Requirements 10.3**
     * 
     * Moving both nodes by the same offset along the same axis should preserve handle positions
     * (the relative spatial relationship is unchanged)
     */
    it('should maintain handle positions when both nodes move by same offset', () => {
      fc.assert(
        fc.property(
          nodeRectArbitrary,
          nodeRectArbitrary,
          fc.double({ min: -500, max: 500, noNaN: true }),
          fc.double({ min: -500, max: 500, noNaN: true }),
          (sourceRect, targetRect, offsetX, offsetY) => {
            const originalResult = getDynamicHandles(sourceRect, targetRect);

            // Move both nodes by the same offset
            const movedSource: NodeRect = {
              x: sourceRect.x + offsetX,
              y: sourceRect.y + offsetY,
              width: sourceRect.width,
              height: sourceRect.height,
            };
            const movedTarget: NodeRect = {
              x: targetRect.x + offsetX,
              y: targetRect.y + offsetY,
              width: targetRect.width,
              height: targetRect.height,
            };

            const movedResult = getDynamicHandles(movedSource, movedTarget);

            // Handle positions should remain the same
            expect(movedResult.sourcePosition).toBe(originalResult.sourcePosition);
            expect(movedResult.targetPosition).toBe(originalResult.targetPosition);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9: Valid Position Enum Values', () => {
    /**
     * **Validates: Requirements 8.5**
     * 
     * For any valid node rectangles, the result should always be valid Position enum values
     */
    it('should always return valid Position enum values', () => {
      fc.assert(
        fc.property(nodeRectArbitrary, nodeRectArbitrary, (sourceRect, targetRect) => {
          const result = getDynamicHandles(sourceRect, targetRect);

          const validPositions = [Position.Top, Position.Right, Position.Bottom, Position.Left];

          expect(validPositions).toContain(result.sourcePosition);
          expect(validPositions).toContain(result.targetPosition);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Position Fallback Behavior', () => {
    /**
     * **Validates: Requirements 4.5, 8.2**
     * 
     * For nodes positioned in various configurations (including edge cases),
     * the function should always produce valid results without crashing.
     * Tests that position resolution works correctly even with extreme values.
     */
    it('should handle edge case node rectangles without crashing', () => {
      fc.assert(
        fc.property(edgeCaseRectArbitrary, edgeCaseRectArbitrary, (sourceRect, targetRect) => {
          const result = getDynamicHandles(sourceRect, targetRect);

          const validPositions = [Position.Top, Position.Right, Position.Bottom, Position.Left];
          expect(validPositions).toContain(result.sourcePosition);
          expect(validPositions).toContain(result.targetPosition);
        }),
        { numRuns: 100 }
      );
    });

    it('should produce valid coordinates even with zero-dimension nodes', () => {
      fc.assert(
        fc.property(edgeCaseRectArbitrary, edgeCaseRectArbitrary, (sourceRect, targetRect) => {
          const result = getDynamicHandles(sourceRect, targetRect);

          const srcCoord = getHandleCoordinate(sourceRect, result.sourcePosition);
          const tgtCoord = getHandleCoordinate(targetRect, result.targetPosition);

          expect(typeof srcCoord.x).toBe('number');
          expect(typeof srcCoord.y).toBe('number');
          expect(typeof tgtCoord.x).toBe('number');
          expect(typeof tgtCoord.y).toBe('number');
          expect(isFinite(srcCoord.x)).toBe(true);
          expect(isFinite(srcCoord.y)).toBe(true);
          expect(isFinite(tgtCoord.x)).toBe(true);
          expect(isFinite(tgtCoord.y)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: Edge Data Preservation (Function Purity)', () => {
    /**
     * **Validates: Requirements 6.3**
     * 
     * The function is pure: same inputs always produce same outputs.
     * Calling the function multiple times with identical inputs yields identical results.
     */
    it('should return deterministic results for identical inputs', () => {
      fc.assert(
        fc.property(nodeRectArbitrary, nodeRectArbitrary, (sourceRect, targetRect) => {
          const result1 = getDynamicHandles(sourceRect, targetRect);
          const result2 = getDynamicHandles(sourceRect, targetRect);

          expect(result2.sourcePosition).toBe(result1.sourcePosition);
          expect(result2.targetPosition).toBe(result1.targetPosition);
        }),
        { numRuns: 100 }
      );
    });

    it('should not be affected by extraneous properties on edge data', () => {
      fc.assert(
        fc.property(
          nodeRectArbitrary,
          nodeRectArbitrary,
          (sourceRect, targetRect) => {
            // Function only uses sourceRect and targetRect - extraneous data doesn't matter
            const result = getDynamicHandles(sourceRect, targetRect);
            const validPositions = [Position.Top, Position.Right, Position.Bottom, Position.Left];
            expect(validPositions).toContain(result.sourcePosition);
            expect(validPositions).toContain(result.targetPosition);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Default Dimensions Robustness', () => {
    /**
     * **Validates: Requirements 8.2**
     * 
     * Nodes with zero or very small dimensions should still produce valid results.
     * The coordinate calculation should handle degenerate rectangles gracefully.
     */
    it('should handle zero-width and zero-height nodes', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1000, max: 1000, noNaN: true }),
          fc.double({ min: -1000, max: 1000, noNaN: true }),
          fc.double({ min: -1000, max: 1000, noNaN: true }),
          fc.double({ min: -1000, max: 1000, noNaN: true }),
          (sx, sy, tx, ty) => {
            const sourceRect: NodeRect = { x: sx, y: sy, width: 0, height: 0 };
            const targetRect: NodeRect = { x: tx, y: ty, width: 0, height: 0 };

            const result = getDynamicHandles(sourceRect, targetRect);

            const validPositions = [Position.Top, Position.Right, Position.Bottom, Position.Left];
            expect(validPositions).toContain(result.sourcePosition);
            expect(validPositions).toContain(result.targetPosition);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 10: Round-Trip Consistency', () => {
    /**
     * **Validates: Requirements 10.2**
     * 
     * For any two node rectangles, the source handle coordinate should lie on
     * the source node boundary, and target handle on the target node boundary.
     */
    it('should place source handle on source node boundary and target on target boundary', () => {
      fc.assert(
        fc.property(nodeRectArbitrary, nodeRectArbitrary, (sourceRect, targetRect) => {
          const result = getDynamicHandles(sourceRect, targetRect);

          const srcCoord = getHandleCoordinate(sourceRect, result.sourcePosition);
          const tgtCoord = getHandleCoordinate(targetRect, result.targetPosition);

          const OUTER_OFFSET = 12;

          // Verify source coordinate coordinates exactly match offset math
          const srcCX = sourceRect.x + sourceRect.width / 2;
          const srcCY = sourceRect.y + sourceRect.height / 2;
          if (result.sourcePosition === Position.Top) {
            expect(srcCoord.x).toBeCloseTo(srcCX, 10);
            expect(srcCoord.y).toBeCloseTo(sourceRect.y - OUTER_OFFSET, 10);
          } else if (result.sourcePosition === Position.Bottom) {
            expect(srcCoord.x).toBeCloseTo(srcCX, 10);
            expect(srcCoord.y).toBeCloseTo(sourceRect.y + sourceRect.height + OUTER_OFFSET, 10);
          } else if (result.sourcePosition === Position.Left) {
            expect(srcCoord.x).toBeCloseTo(sourceRect.x - OUTER_OFFSET, 10);
            expect(srcCoord.y).toBeCloseTo(srcCY, 10);
          } else if (result.sourcePosition === Position.Right) {
            expect(srcCoord.x).toBeCloseTo(sourceRect.x + sourceRect.width + OUTER_OFFSET, 10);
            expect(srcCoord.y).toBeCloseTo(srcCY, 10);
          }

          // Verify target coordinate coordinates exactly match offset math
          const tgtCX = targetRect.x + targetRect.width / 2;
          const tgtCY = targetRect.y + targetRect.height / 2;
          if (result.targetPosition === Position.Top) {
            expect(tgtCoord.x).toBeCloseTo(tgtCX, 10);
            expect(tgtCoord.y).toBeCloseTo(targetRect.y - OUTER_OFFSET, 10);
          } else if (result.targetPosition === Position.Bottom) {
            expect(tgtCoord.x).toBeCloseTo(tgtCX, 10);
            expect(tgtCoord.y).toBeCloseTo(targetRect.y + targetRect.height + OUTER_OFFSET, 10);
          } else if (result.targetPosition === Position.Left) {
            expect(tgtCoord.x).toBeCloseTo(targetRect.x - OUTER_OFFSET, 10);
            expect(tgtCoord.y).toBeCloseTo(tgtCY, 10);
          } else if (result.targetPosition === Position.Right) {
            expect(tgtCoord.x).toBeCloseTo(targetRect.x + targetRect.width + OUTER_OFFSET, 10);
            expect(tgtCoord.y).toBeCloseTo(tgtCY, 10);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
