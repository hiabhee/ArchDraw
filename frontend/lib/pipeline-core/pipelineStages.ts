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
  // Heterogeneous stage IO cannot be expressed as one Stage<TIn,TOut> union without erasure.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...stages: Array<Stage<any, any>>
): Stage<TInput, TOutput>[] {
  return stages as Stage<TInput, TOutput>[];
}
