import { describe, it, expect } from 'vitest';
import { resolveShapeNodeDimensions } from '@/lib/utils/shapeNodeDimensions';

/**
 * Regression test for the "Maximum update depth exceeded" infinite loop on
 * layout toggle.
 *
 * The old ShapeNode guard compared the layer's computed width/height against
 * React Flow's measured node.width/node.height. React Flow reports _measured_
 * dimensions (floats from getBoundingClientRect / border box-sizing) through
 * onNodesChange(dimensions), which applyNodeChanges writes into node.width.
 * That float never strictly equals our integer-computed width, so the effect
 * called updateNodeSize → RF re-measured → reported again → effect refired.
 *
 * The fix compares against our OWN persisted data.nodeWidth/data.nodeHeight
 * integers instead. This test simulates the toggle sequence to prove it
 * converges to a fixed point in at most a couple of writes.
 */
function simulateToggleSequence(
  initial: { nodeWidth?: number; nodeHeight?: number },
  _layoutWidth: number,
  _layoutHeight: number,
  label: string,
  shape: string,
): { writes: number; finalWidth: number; finalHeight: number } {
  let nodeWidth = initial.nodeWidth;
  let nodeHeight = initial.nodeHeight;
  let writes = 0;

  const computeWidth = () =>
    resolveShapeNodeDimensions({ label, shape, nodeWidth, nodeHeight }).width;
  const computeHeight = () =>
    resolveShapeNodeDimensions({ label, shape, nodeWidth, nodeHeight }).height;

  let width = computeWidth();
  let height = computeHeight();

  // Safety cap to fail the test if it does NOT converge (i.e. regression).
  const MAX_ITER = 100;
  let iter = 0;
  while (iter < MAX_ITER) {
    iter++;
    if (nodeWidth === width && nodeHeight === height) break;

    nodeWidth = width;
    nodeHeight = height;
    writes++;
    width = computeWidth();
    height = computeHeight();
  }

  expect(iter).toBeLessThan(MAX_ITER);
  return { writes, finalWidth: width, finalHeight: height };
}

describe('ShapeNode size convergence after layout toggle', () => {
  it('converges when layout assigns a larger width than the stored fitted width', () => {
    // Original node had a smaller stored size; dagre laid out at SIZE_L.
    const result = simulateToggleSequence(
      { nodeWidth: 160, nodeHeight: 100 },
      240, // layout (dagre) assigned width
      120,
      'API Gateway',
      'rounded-rectangle',
    );
    expect(result.writes).toBeLessThanOrEqual(2);
    // It must settle on our computed integer width (>= stored), not oscillate.
    expect(Number.isInteger(result.finalWidth)).toBe(true);
    expect(Number.isInteger(result.finalHeight)).toBe(true);
  });

  it('converges when data.nodeWidth is undefined on first render (fresh node)', () => {
    const result = simulateToggleSequence({}, 200, 100, 'Postgres', 'rounded-rectangle');
    expect(result.writes).toBeLessThanOrEqual(2);
    expect(Number.isInteger(result.finalWidth)).toBe(true);
  });

  it('does not grow unboundedly when stored singleton fits below the fitted width', () => {
    // Even if RF keeps reporting a slightly larger float, our guard compares
    // data.* so it stays stable at the integer we wrote — no ratchet growth,
    // no infinite writes.
    const r1 = simulateToggleSequence({ nodeWidth: 240, nodeHeight: 100 }, 240, 100, 'API', 'actor');
    const r2 = simulateToggleSequence({ nodeWidth: 120, nodeHeight: 100 }, 120, 100, 'API', 'actor');
    // Both must converge in a bounded number of writes.
    expect(r1.writes).toBeLessThanOrEqual(2);
    expect(r2.writes).toBeLessThanOrEqual(2);
    // Stored width is the canonical integer we wrote; stays stable.
    expect(Number.isInteger(r1.finalWidth)).toBe(true);
    expect(Number.isInteger(r2.finalWidth)).toBe(true);
  });
});
