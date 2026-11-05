/**
 * Picks the direction each top-level group is laid out in, so a diagram can mix
 * left-to-right and top-down flow instead of using one for everything.
 *
 * A chain of stages inside a group is wide when it runs left to right and a
 * long left-to-right row of groups is wider still. Laying some groups out top-down
 * (a tall block instead of a wide one) shrinks the whole diagram, and which groups
 * should flip depends on their shapes, so it is searched, not ruled: start with every
 * group in the diagram's own direction, flip one group at a time to the other
 * direction, and keep a flip when it lets the diagram be drawn larger on screen.
 *
 * The caller supplies the score (how large the diagram can be drawn for a given
 * assignment), so this holds no layout code and costs one score per trial.
 */

export type FlowDirection = 'LR' | 'TD';

/** A flip must lift the score by at least this factor to be kept. */
const MIN_STEP_GAIN = 1.02;
/** The mix as a whole must beat the single direction by this factor to be used. */
export const MIN_MIX_GAIN = 1.15;
/** More groups than this are not searched (each trial is a full layout). */
const MAX_GROUPS = 10;
const MAX_PASSES = 2;

export interface GroupDirectionSearch {
  /** The groups to lay out in the other direction, and which one. */
  assignment: Map<string, FlowDirection>;
  /** The score with every group in the diagram's own direction. */
  baseFit: number;
  /** The score with `assignment`. */
  fit: number;
}

/**
 * @param groups   top-level groups that may flip, most influential first (they are tried in this order)
 * @param other    the direction a flipped group takes
 * @param fitOf    the score for an assignment (higher is better, and 1 is "already fits": nothing to gain)
 */
export function searchGroupDirections(
  groups: readonly string[],
  other: FlowDirection,
  fitOf: (assignment: ReadonlyMap<string, FlowDirection>) => number,
): GroupDirectionSearch | undefined {
  const candidates = groups.slice(0, MAX_GROUPS);
  if (candidates.length < 2) return undefined;

  let assignment = new Map<string, FlowDirection>();
  const baseFit = fitOf(assignment);
  let fit = baseFit;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;
    for (const group of candidates) {
      if (assignment.has(group)) continue;
      const trial = new Map(assignment).set(group, other);
      const score = fitOf(trial);
      if (score > fit * MIN_STEP_GAIN) {
        assignment = trial;
        fit = score;
        improved = true;
      }
    }
    if (!improved) break;
  }
  if (assignment.size === 0 || fit < baseFit * MIN_MIX_GAIN) return undefined;
  return { assignment, baseFit, fit };
}
