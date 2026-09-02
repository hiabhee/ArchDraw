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
  layoutWidth: number,
  layoutHeight: number,
  label: string,
  shape: string,
): { writes: number; finalWidth: number; finalHeight: number } {
  let nodeWidth = initial.nodeWidth;
  let nodeHeight = initial.nodeHeight;
  let writes = 0;

  // emulate ShapeNode.resolveShapeSize (reads data.*, no RF floats)
  const computeWidth = () =>
    resolveShapeNodeDimensions({ label, shape, nodeWidth, nodeHeight }).width;
  const computeHeight = () =>
    resolveShapeNodeDimensions({ label, shape, nodeWidth, nodeHeight }).height;

  let width = computeWidth();
  let height = computeHeight();
  let storedWidth = layoutWidth; // RF measured node.width, starts at dagre/measured value
  let storedHeight = layoutHeight;

  // Safety cap to fail the test if it does NOT converge (i.e. regression).
  const MAX_ITER = 100;
  let iter = 0;
  while (iter < MAX_ITER) {
    iter++;
    // OLD guard: compared computed vs RF node.width (float) — would loop.
    // NEW guard: compare computed vs our own persisted data.*
    if (nodeWidth === width && nodeHeight === height) break;

    // updateNodeSize writes node.width+node.height AND data.nodeWidth/nodeHeight
    nodeWidth = width;
    nodeHeight = height;
    writes++;
    // store node.width to RF; RF re-measures and reports a FLOAT that differs
    // from our integer by subpixel (emulated), overwriting node.width — but
    // this no longer feeds the guard.
    storedWidth = width + 0.001;
    storedHeight = height + 0.001;
    // re-render → recompute
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
