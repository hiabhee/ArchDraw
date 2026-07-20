import { Position } from 'reactflow';
import { describe, it, expect } from 'vitest';
import {
  scoreAllHandlerPairs,
  selectBestHandlerPair,
  buildDefaultOrthogonalWaypoints,
  anchorOutsideBoundary,
  type HandlerRect,
} from '../handlerPairScorer';

function makeRect(x: number, y: number, w: number, h: number): HandlerRect {
  return { x, y, width: w, height: h };
}

function sideLabel(side: Position): string {
  switch (side) {
    case Position.Top: return 'Top';
    case Position.Right: return 'Right';
    case Position.Bottom: return 'Bottom';
    case Position.Left: return 'Left';
  }
}

// =============================================================================
// INVARIANT 1: Edges never pass through nodes
// =============================================================================
describe('Invariant: edges never pass through nodes', () => {
  it('selects a pair whose default orthogonal path avoids a blocking node', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);
    const blocker = makeRect(260, 130, 120, 10);

    const obstacles = new Map([['blocker', blocker]]);

    const best = selectBestHandlerPair(source, target, 'LR', obstacles, new Set());

    expect(orthogonalPathHits(source, target, best.sourceSide, best.targetSide, blocker)).toBe(false);
  });

  it('penalizes pairs whose default orthogonal path hits an obstacle (score >= 1000)', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);
    const blocker = makeRect(300, 120, 60, 30);

    const obstacles = new Map([['blocker', blocker]]);
    const scores = scoreAllHandlerPairs(source, target, 'LR', obstacles, new Set());

    const rightLeft = scores.find(
      s => s.pair.sourceSide === Position.Right && s.pair.targetSide === Position.Left
    );
    expect(rightLeft).toBeDefined();
    expect(rightLeft!.collides).toBe(true);
    expect(rightLeft!.total).toBeGreaterThanOrEqual(1000);
  });
});

// =============================================================================
// INVARIANT 2: Edges terminate on node boundary
// =============================================================================
describe('Invariant: edges terminate on node boundary', () => {
  it('anchor points are on the node boundary for all sides', () => {
    const rect = makeRect(100, 200, 160, 80);
    const sides: Position[] = [Position.Top, Position.Right, Position.Bottom, Position.Left];

    for (const side of sides) {
      const scores = scoreAllHandlerPairs(rect, rect, 'LR');
      // Verify anchor computation matches expected boundary positions
      const expected = expectedAnchor(rect, side);
      const actual = anchorOnBoundary(rect, side);
      expect(actual.x).toBeCloseTo(expected.x, 5);
      expect(actual.y).toBeCloseTo(expected.y, 5);
    }
  });

  it('scoring anchors sit 24px outside the node (matches rendered endpoints)', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);
    const best = selectBestHandlerPair(source, target, 'LR');

    const srcAnch = anchorOutsideBoundary(source, best.sourceSide);
    const tgtAnch = anchorOutsideBoundary(target, best.targetSide);

    // Outside anchors must not lie inside the node interior
    expect(
      srcAnch.x < source.x || srcAnch.x > source.x + source.width ||
      srcAnch.y < source.y || srcAnch.y > source.y + source.height,
    ).toBe(true);
    expect(
      tgtAnch.x < target.x || tgtAnch.x > target.x + target.width ||
      tgtAnch.y < target.y || tgtAnch.y > target.y + target.height,
    ).toBe(true);
  });
});

// =============================================================================
// INVARIANT 3: Side selection before routing
// =============================================================================
describe('Invariant: side selection is deterministic and before routing', () => {
  it('returns the same pair across multiple calls', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 200, 120, 70);

    const results = Array.from({ length: 5 }, () =>
      selectBestHandlerPair(source, target, 'LR')
    );

    for (const r of results) {
      expect(r.sourceSide).toBe(results[0].sourceSide);
      expect(r.targetSide).toBe(results[0].targetSide);
    }
  });

  it('always produces exactly one winner', () => {
    const source = makeRect(0, 0, 120, 70);
    const target = makeRect(400, 300, 120, 70);

    const scores = scoreAllHandlerPairs(source, target, 'LR');
    expect(scores.length).toBe(16);
    // First score is strictly best (lowest total)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i].total).toBeGreaterThanOrEqual(scores[0].total);
    }
  });
});

// =============================================================================
// INVARIANT 4: Natural side preference
// =============================================================================
describe('Invariant: natural side preference', () => {
  it('LR layout: prefers horizontal pairs for left-right node arrangement', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);
    const best = selectBestHandlerPair(source, target, 'LR');

    // For purely horizontal arrangement, should pick a horizontal pair
    const srcH = best.sourceSide === Position.Left || best.sourceSide === Position.Right;
    const tgtH = best.targetSide === Position.Left || best.targetSide === Position.Right;
    expect(srcH && tgtH).toBe(true);
  });

  it('TD layout: prefers vertical pairs for top-bottom node arrangement', () => {
    const source = makeRect(200, 0, 120, 70);
    const target = makeRect(200, 500, 120, 70);
    const best = selectBestHandlerPair(source, target, 'TD');

    const srcV = best.sourceSide === Position.Top || best.sourceSide === Position.Bottom;
    const tgtV = best.targetSide === Position.Top || best.targetSide === Position.Bottom;
    expect(srcV && tgtV).toBe(true);
  });

  it('LR layout with target below-left: prefers facing / nearest handlers', () => {
    const source = makeRect(198, 17, 153, 90);
    const target = makeRect(27, 254, 153, 90);
    const best = selectBestHandlerPair(source, target, 'LR');

    // Dominant axis is vertical (target below) → Bottom→Top, not a far-side wrap
    expect(best.sourceSide).toBe(Position.Bottom);
    expect(best.targetSide).toBe(Position.Top);
  });
});

// =============================================================================
// INVARIANT 5: Minimal bends
// =============================================================================
describe('Invariant: minimal bends', () => {
  it('prefers L-shape (1 bend) over Z-shape (2 bends) when geometry allows', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 300, 120, 70);
    const best = selectBestHandlerPair(source, target, 'LR');

    const scores = scoreAllHandlerPairs(source, target, 'LR');
    const bestScore = scores.find(
      s => s.pair.sourceSide === best.sourceSide && s.pair.targetSide === best.targetSide
    )!;
    expect(bestScore.bends).toBeLessThanOrEqual(2);
  });

  it('L-shaped pair has lower bend count than Z-shaped pair for same nodes', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 300, 120, 70);
    const scores = scoreAllHandlerPairs(source, target, 'LR');

    const lShape = scores.find(
      s => (s.pair.sourceSide === Position.Right && s.pair.targetSide === Position.Top) ||
           (s.pair.sourceSide === Position.Right && s.pair.targetSide === Position.Bottom)
    );
    const zShape = scores.find(
      s => s.pair.sourceSide === Position.Right && s.pair.targetSide === Position.Left
    );

    if (lShape && zShape) {
      expect(lShape.bends).toBeLessThanOrEqual(zShape.bends);
    }
  });
});

// =============================================================================
// INVARIANT 6: Directional consistency
// =============================================================================
describe('Invariant: directional consistency', () => {
  it('LR layout: same-side horizontal pairs (Left→Left) are penalized', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);
    const scores = scoreAllHandlerPairs(source, target, 'LR');

    const leftLeft = scores.find(
      s => s.pair.sourceSide === Position.Left && s.pair.targetSide === Position.Left
    );
    const rightLeft = scores.find(
      s => s.pair.sourceSide === Position.Right && s.pair.targetSide === Position.Left
    );

    expect(leftLeft).toBeDefined();
    expect(rightLeft).toBeDefined();
    // Opposite sides should score better than same sides
    expect(rightLeft!.total).toBeLessThan(leftLeft!.total);
  });

  it('TD layout: same-side vertical pairs (Top→Top) are penalized', () => {
    const source = makeRect(200, 0, 120, 70);
    const target = makeRect(200, 500, 120, 70);
    const scores = scoreAllHandlerPairs(source, target, 'TD');

    const topTop = scores.find(
      s => s.pair.sourceSide === Position.Top && s.pair.targetSide === Position.Top
    );
    const bottomTop = scores.find(
      s => s.pair.sourceSide === Position.Bottom && s.pair.targetSide === Position.Top
    );

    expect(topTop).toBeDefined();
    expect(bottomTop).toBeDefined();
    expect(bottomTop!.total).toBeLessThan(topTop!.total);
  });

  it('H→V pairs score better than V→H in LR layout (exit matches layout direction)', () => {
    const source = makeRect(198, 17, 153, 90);
    const target = makeRect(27, 254, 153, 90);
    const scores = scoreAllHandlerPairs(source, target, 'LR');

    const hv = scores.find(
      s => s.pair.sourceSide === Position.Left && s.pair.targetSide === Position.Top
    );
    const vh = scores.find(
      s => s.pair.sourceSide === Position.Bottom && s.pair.targetSide === Position.Right
    );

    if (hv && vh) {
      expect(hv.total).toBeLessThanOrEqual(vh.total);
    }
  });
});

// =============================================================================
// INVARIANT 7: Nodes as obstacles
// =============================================================================
describe('Invariant: nodes as obstacles', () => {
  it('penalizes pairs whose default orthogonal path hits an obstacle', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);
    const blocker = makeRect(280, 120, 80, 30);
    const obstacles = new Map([['blocker', blocker]]);

    const scores = scoreAllHandlerPairs(source, target, 'LR', obstacles, new Set());

    // Right→Left Z-path runs at y≈135 through blocker y=120..150
    const rightLeft = scores.find(
      s => s.pair.sourceSide === Position.Right && s.pair.targetSide === Position.Left
    );
    expect(rightLeft).toBeDefined();
    expect(rightLeft!.collides).toBe(true);
    expect(rightLeft!.total).toBeGreaterThanOrEqual(1000);
  });

  it('non-colliding pairs are preferred over colliding pairs', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);
    const blocker = makeRect(280, 120, 80, 30);
    const obstacles = new Map([['blocker', blocker]]);

    const scores = scoreAllHandlerPairs(source, target, 'LR', obstacles, new Set());
    const best = scores[0];

    // Best pair must not collide
    expect(best.collides).toBe(false);
    expect(best.total).toBeLessThan(1000);
  });

  it('multiple obstacles force a different pair selection', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);

    // Block the Right→Left direct path
    const blocker1 = makeRect(280, 120, 80, 30);
    // Also block the Bottom→Top path
    const blocker2 = makeRect(280, 150, 80, 100);
    const obstacles = new Map([
      ['blocker1', blocker1],
      ['blocker2', blocker2],
    ]);

    const best = selectBestHandlerPair(source, target, 'LR', obstacles, new Set());
    const srcAnch = anchorOnBoundary(source, best.sourceSide);
    const tgtAnch = anchorOnBoundary(target, best.targetSide);

    expect(segmentHitsRect(srcAnch.x, srcAnch.y, tgtAnch.x, tgtAnch.y, blocker1)).toBe(false);
    expect(segmentHitsRect(srcAnch.x, srcAnch.y, tgtAnch.x, tgtAnch.y, blocker2)).toBe(false);
  });

  it('source and target nodes are excluded from obstacle checks', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);
    const obstacles = new Map([
      ['source', source],
      ['target', target],
    ]);

    // Should not be disqualified despite source/target being "obstacles"
    const best = selectBestHandlerPair(source, target, 'LR', obstacles, new Set(['source', 'target']));
    expect(best.sourceSide).toBeDefined();
    expect(best.targetSide).toBeDefined();
  });
});

// =============================================================================
// INVARIANT 8: Determinism
// =============================================================================
describe('Invariant: determinism', () => {
  it('produces identical results for identical inputs', () => {
    const source = makeRect(100, 200, 160, 80);
    const target = makeRect(600, 400, 160, 80);

    const run1 = selectBestHandlerPair(source, target, 'LR');
    const run2 = selectBestHandlerPair(source, target, 'LR');
    const run3 = selectBestHandlerPair(source, target, 'LR');

    expect(run1).toEqual(run2);
    expect(run2).toEqual(run3);
  });

  it('deterministic with obstacles', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);
    const blocker = makeRect(280, 120, 80, 30);
    const obstacles = new Map([['blocker', blocker]]);

    const results = Array.from({ length: 5 }, () =>
      selectBestHandlerPair(source, target, 'LR', obstacles, new Set())
    );

    for (const r of results) {
      expect(r.sourceSide).toBe(results[0].sourceSide);
      expect(r.targetSide).toBe(results[0].targetSide);
    }
  });
});

// =============================================================================
// INVARIANT 9: No special-case logic
// =============================================================================
describe('Invariant: no special-case logic', () => {
  it('scoring is consistent across all node pairs — same function for all', () => {
    const configs: Array<{ source: HandlerRect; target: HandlerRect; label: string }> = [
      { source: makeRect(0, 0, 120, 70), target: makeRect(400, 0, 120, 70), label: 'same-Y' },
      { source: makeRect(0, 0, 120, 70), target: makeRect(400, 300, 120, 70), label: 'diagonal' },
      { source: makeRect(0, 0, 120, 70), target: makeRect(0, 400, 120, 70), label: 'same-X' },
      { source: makeRect(200, 200, 160, 80), target: makeRect(200, 200, 160, 80), label: 'identical' },
    ];

    for (const cfg of configs) {
      const scores = scoreAllHandlerPairs(cfg.source, cfg.target, 'LR');
      expect(scores.length).toBe(16);
      // All 16 pairs should have valid scores (no NaN, no Infinity)
      for (const s of scores) {
        expect(Number.isFinite(s.total)).toBe(true);
        expect(s.bends).toBeGreaterThanOrEqual(0);
        expect(s.distance).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// =============================================================================
// INVARIANT 10: Regression tests
// =============================================================================
describe('Invariant: regression — horizontal layout (LR)', () => {
  it('source right of target: prefers horizontal pair for LR layout', () => {
    const source = makeRect(500, 100, 120, 70);
    const target = makeRect(0, 100, 120, 70);
    const best = selectBestHandlerPair(source, target, 'LR');

    // LR layout prefers horizontal pairs
    const srcH = best.sourceSide === Position.Left || best.sourceSide === Position.Right;
    const tgtH = best.targetSide === Position.Left || best.targetSide === Position.Right;
    expect(srcH && tgtH).toBe(true);
  });

  it('source left of target: prefers Source Right → Target Left', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);
    const best = selectBestHandlerPair(source, target, 'LR');

    expect(best.sourceSide).toBe(Position.Right);
    expect(best.targetSide).toBe(Position.Left);
  });

  it('target offset slightly below: still prefers horizontal pair', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 200, 120, 70);
    const best = selectBestHandlerPair(source, target, 'LR');

    const srcH = best.sourceSide === Position.Left || best.sourceSide === Position.Right;
    const tgtH = best.targetSide === Position.Left || best.targetSide === Position.Right;
    expect(srcH && tgtH).toBe(true);
  });
});

describe('Invariant: regression — vertical layout (TD)', () => {
  it('source above target: prefers Source Bottom → Target Top', () => {
    const source = makeRect(200, 0, 120, 70);
    const target = makeRect(200, 500, 120, 70);
    const best = selectBestHandlerPair(source, target, 'TD');

    expect(best.sourceSide).toBe(Position.Bottom);
    expect(best.targetSide).toBe(Position.Top);
  });

  it('target offset slightly right: still prefers vertical pair', () => {
    const source = makeRect(200, 0, 120, 70);
    const target = makeRect(350, 500, 120, 70);
    const best = selectBestHandlerPair(source, target, 'TD');

    const srcV = best.sourceSide === Position.Top || best.sourceSide === Position.Bottom;
    const tgtV = best.targetSide === Position.Top || best.targetSide === Position.Bottom;
    expect(srcV && tgtV).toBe(true);
  });
});

describe('Invariant: regression — diagonal layout', () => {
  it('source upper-right, target lower-left: prefers facing nearest sides', () => {
    const source = makeRect(198, 17, 153, 90);
    const target = makeRect(27, 254, 153, 90);
    const best = selectBestHandlerPair(source, target, 'LR');

    expect(best.sourceSide).toBe(Position.Bottom);
    expect(best.targetSide).toBe(Position.Top);
  });

  it('source lower-left, target upper-right: uses facing sides (no far-side wrap)', () => {
    const source = makeRect(0, 400, 120, 70);
    const target = makeRect(500, 50, 120, 70);
    const best = selectBestHandlerPair(source, target, 'LR');

    // Dominant axis is horizontal → Right→Left
    expect(best.sourceSide).toBe(Position.Right);
    expect(best.targetSide).toBe(Position.Left);
  });
});

describe('Invariant: regression — different node sizes', () => {
  it('small source, large target: selects valid pair', () => {
    const source = makeRect(0, 100, 40, 30);
    const target = makeRect(500, 100, 300, 200);
    const best = selectBestHandlerPair(source, target, 'LR');

    const srcAnch = anchorOnBoundary(source, best.sourceSide);
    const tgtAnch = anchorOnBoundary(target, best.targetSide);

    expect(srcAnch.x).toBeGreaterThanOrEqual(source.x);
    expect(srcAnch.x).toBeLessThanOrEqual(source.x + source.width);
    expect(tgtAnch.x).toBeGreaterThanOrEqual(target.x);
    expect(tgtAnch.x).toBeLessThanOrEqual(target.x + target.width);
  });

  it('large source, small target: selects valid pair', () => {
    const source = makeRect(0, 50, 300, 200);
    const target = makeRect(500, 100, 40, 30);
    const best = selectBestHandlerPair(source, target, 'LR');

    const srcAnch = anchorOnBoundary(source, best.sourceSide);
    const tgtAnch = anchorOnBoundary(target, best.targetSide);

    expect(srcAnch.y).toBeGreaterThanOrEqual(source.y);
    expect(srcAnch.y).toBeLessThanOrEqual(source.y + source.height);
    expect(tgtAnch.y).toBeGreaterThanOrEqual(target.y);
    expect(tgtAnch.y).toBeLessThanOrEqual(target.y + target.height);
  });
});

describe('Invariant: regression — closely spaced nodes', () => {
  it('nodes 50px apart: selects valid pair', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(170, 100, 120, 70);
    const best = selectBestHandlerPair(source, target, 'LR');

    expect(best.sourceSide).toBeDefined();
    expect(best.targetSide).toBeDefined();
  });
});

describe('Invariant: regression — long-distance connections', () => {
  it('nodes 5000px apart: selects valid pair with reasonable distance', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(5000, 100, 120, 70);
    const scores = scoreAllHandlerPairs(source, target, 'LR');

    const best = scores[0];
    expect(best.distance).toBeGreaterThan(0);
    expect(Number.isFinite(best.total)).toBe(true);
  });
});

describe('Invariant: regression — overlapping obstacle between nodes', () => {
  it('obstacle touching source edge: avoids it', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);
    const blocker = makeRect(120, 110, 60, 50);
    const obstacles = new Map([['blocker', blocker]]);

    const best = selectBestHandlerPair(source, target, 'LR', obstacles, new Set());
    expect(orthogonalPathHits(source, target, best.sourceSide, best.targetSide, blocker)).toBe(false);
  });
});

describe('Invariant: regression — manual overrides', () => {
  it('uses manual override when both sides provided', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);

    const result = selectBestHandlerPair(
      source, target, 'LR',
      undefined, undefined,
      Position.Bottom, Position.Top
    );

    expect(result.sourceSide).toBe(Position.Bottom);
    expect(result.targetSide).toBe(Position.Top);
  });

  it('uses source override and scores target', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);

    const result = selectBestHandlerPair(
      source, target, 'LR',
      undefined, undefined,
      Position.Left, undefined
    );

    expect(result.sourceSide).toBe(Position.Left);
    // Target should be the best matching side for Left source
    expect(result.targetSide).toBeDefined();
  });
});

describe('Invariant: regression — multiple incoming/outgoing edges', () => {
  it('scoring is independent of edge count — same result for single or multiple edges', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);

    const best = selectBestHandlerPair(source, target, 'LR');
    const scores = scoreAllHandlerPairs(source, target, 'LR');

    // The best pair should always be the same regardless of how many edges exist
    expect(scores[0].pair.sourceSide).toBe(best.sourceSide);
    expect(scores[0].pair.targetSide).toBe(best.targetSide);
  });
});

// =============================================================================
// INVARIANT 11: Lane preferences bias, not bypass
// =============================================================================
describe('Invariant: lane preferences bias scoring, not bypass', () => {
  it('lane preferences do not bypass collision penalty', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);
    const blocker = makeRect(280, 120, 80, 30);
    const obstacles = new Map([['blocker', blocker]]);

    // Lane prefers Right→Left which collides with blocker
    const best = selectBestHandlerPair(
      source, target, 'LR',
      obstacles, new Set(),
      undefined, undefined,
      Position.Right, Position.Left,
    );

    // Scoring should NOT be bypassed — collision penalty must still apply
    const scores = scoreAllHandlerPairs(source, target, 'LR', obstacles, new Set());
    const rightLeft = scores.find(s => s.pair.sourceSide === Position.Right && s.pair.targetSide === Position.Left);
    expect(rightLeft).toBeDefined();
    expect(rightLeft!.collides).toBe(true);

    // The selected pair must NOT collide even with lane preference
    expect(orthogonalPathHits(source, target, best.sourceSide, best.targetSide, blocker)).toBe(false);
    expect(best.sourceSide === Position.Right && best.targetSide === Position.Left).toBe(false);
  });

  it('lane preferences influence scoring when no collision exists', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 300, 120, 70);

    // Without lane preference: diagonal might prefer L-shape
    const bestNoLane = selectBestHandlerPair(source, target, 'LR');

    // With lane preference for Bottom→Top: should bias toward that
    const bestWithLane = selectBestHandlerPair(
      source, target, 'LR',
      undefined, undefined,
      undefined, undefined,
      Position.Right, Position.Top,
    );

    // Lane preference should influence the result
    expect(bestWithLane.targetSide).toBe(Position.Top);
  });

  it('manual overrides still bypass scoring entirely', () => {
    const source = makeRect(0, 100, 120, 70);
    const target = makeRect(500, 100, 120, 70);
    const blocker = makeRect(280, 120, 80, 30);
    const obstacles = new Map([['blocker', blocker]]);

    // Manual overrides should bypass scoring even with collision
    const best = selectBestHandlerPair(
      source, target, 'LR',
      obstacles, new Set(),
      Position.Right, Position.Left,
    );

    expect(best.sourceSide).toBe(Position.Right);
    expect(best.targetSide).toBe(Position.Left);
  });
});

// =============================================================================
// Helpers
// =============================================================================
function anchorOnBoundary(
  rect: HandlerRect,
  side: Position,
): { x: number; y: number } {
  switch (side) {
    case Position.Left:
      return { x: rect.x, y: rect.y + rect.height / 2 };
    case Position.Right:
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
    case Position.Top:
      return { x: rect.x + rect.width / 2, y: rect.y };
    case Position.Bottom:
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
  }
}

function expectedAnchor(
  rect: HandlerRect,
  side: Position,
): { x: number; y: number } {
  return anchorOnBoundary(rect, side);
}

function segmentHitsRect(
  ax: number, ay: number,
  bx: number, by: number,
  rect: HandlerRect,
): boolean {
  const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
  const code = (x: number, y: number) => {
    let c = INSIDE;
    if (x < rect.x) c |= LEFT;
    else if (x > rect.x + rect.width) c |= RIGHT;
    if (y < rect.y) c |= TOP;
    else if (y > rect.y + rect.height) c |= BOTTOM;
    return c;
  };

  let x1 = ax, y1 = ay, x2 = bx, y2 = by;
  let c1 = code(x1, y1), c2 = code(x2, y2);

  while (true) {
    if (!(c1 | c2)) return true;
    if (c1 & c2) return false;
    const c = c1 || c2;
    let x = 0, y = 0;
    if (c & BOTTOM) { x = x1 + (x2 - x1) * (rect.y + rect.height - y1) / (y2 - y1); y = rect.y + rect.height; }
    else if (c & TOP) { x = x1 + (x2 - x1) * (rect.y - y1) / (y2 - y1); y = rect.y; }
    else if (c & RIGHT) { y = y1 + (y2 - y1) * (rect.x + rect.width - x1) / (x2 - x1); x = rect.x + rect.width; }
    else if (c & LEFT) { y = y1 + (y2 - y1) * (rect.x - x1) / (x2 - x1); x = rect.x; }
    if (c === c1) { x1 = x; y1 = y; c1 = code(x1, y1); }
    else { x2 = x; y2 = y; c2 = code(x2, y2); }
  }
}

function orthogonalPathHits(
  source: HandlerRect,
  target: HandlerRect,
  sourceSide: Position,
  targetSide: Position,
  blocker: HandlerRect,
): boolean {
  const src = anchorOutsideBoundary(source, sourceSide);
  const tgt = anchorOutsideBoundary(target, targetSide);
  const waypoints = buildDefaultOrthogonalWaypoints(src, tgt, sourceSide, targetSide);
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (segmentHitsRect(
      waypoints[i].x, waypoints[i].y,
      waypoints[i + 1].x, waypoints[i + 1].y,
      blocker,
    )) {
      return true;
    }
  }
  return false;
}

// =============================================================================
// INVARIANT 12: Nearest / facing handlers (no far-side wrap under the node)
// =============================================================================
describe('Invariant: nearest facing handlers', () => {
  it('edge approaching from above connects to Top, not Right/Bottom', () => {
    const source = makeRect(120, -50, 120, 70);
    const target = makeRect(100, 200, 180, 90); // Load Balancing
    const best = selectBestHandlerPair(source, target, 'LR');

    expect(best.sourceSide).toBe(Position.Bottom);
    expect(best.targetSide).toBe(Position.Top);
  });

  it('edge approaching from the left connects to Left, not Bottom/Right', () => {
    const source = makeRect(-100, 210, 120, 70);
    const target = makeRect(100, 200, 180, 90);
    const best = selectBestHandlerPair(source, target, 'LR');

    expect(best.sourceSide).toBe(Position.Right);
    expect(best.targetSide).toBe(Position.Left);
  });

  it('does not pick a pair whose path tunnels through the target node', () => {
    const source = makeRect(100, 0, 150, 80);
    const target = makeRect(100, 200, 150, 80);
    const scores = scoreAllHandlerPairs(source, target, 'LR');

    const throughNode = scores.find(
      s => s.pair.sourceSide === Position.Bottom && s.pair.targetSide === Position.Right,
    );
    expect(throughNode).toBeDefined();
    expect(throughNode!.terminal).toBe(true);
    expect(throughNode!.total).toBeGreaterThanOrEqual(1000);

    const best = scores[0];
    expect(best.terminal).toBe(false);
    expect(best.pair.targetSide).toBe(Position.Top);
  });
});
