import type { Stage } from './Stage';

/**
 * Build a heterogeneous stage list for Pipeline.
 * Erases per-stage IO once at the runner boundary; keep Stage classes strongly typed.
 * 
 * Note: This function intentionally erases specific stage IO types because heterogeneous
 * stages cannot be expressed as a single Stage<TIn,TOut> union. The individual stages
 * remain strongly typed, and the pipeline boundaries should be typed via the Pipeline
 * class generics (Pipeline<TInput, TOutput>).
 */
export function pipelineStages<TInput = unknown, TOutput = unknown>(
  // Heterogeneous stage IO is erased here; Stage methods are bivariant so
  // concrete Stage<A,B> instances are assignable to Stage<unknown, unknown>.
  ...stages: Array<Stage<unknown, unknown>>
): Stage<TInput, TOutput>[] {
  return stages as Stage<TInput, TOutput>[];
}
