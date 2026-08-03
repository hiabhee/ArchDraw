/**
 * Stage - Single processing unit in a pipeline
 * 
 * A stage represents a single step in a pipeline that transforms
 * input data to output data, with optional validation and error handling.
 */

import type { PipelineContext } from './PipelineContext';
import type { StageResult } from './StageResult';

export interface Stage<TInput, TOutput> {
  /** Unique identifier for this stage */
  readonly name: string;
  
  /** Human-readable description of what this stage does */
  readonly description?: string;
  
  /** Optional validation function for input data */
  validate?(input: TInput, context: PipelineContext): StageValidationResult;
  
  /** Execute the stage transformation */
  execute(input: TInput, context: PipelineContext): Promise<StageResult<TOutput>>;
  
  /** Whether this stage can be skipped if input is invalid/missing */
  readonly optional?: boolean;

  /** Backwards-compatible alias for optional skip behavior. */
  readonly skippable?: boolean;
  
  /** Estimated cost of this stage (for progress calculation) */
  readonly weight?: number;
}

export interface StageValidationResult {
  /** Whether the input is valid for this stage */
  valid: boolean;
  
  /** Errors that would prevent stage execution */
  errors: string[];
  
  /** Warnings that don't prevent execution but should be noted */
  warnings: string[];
}

export function validStageResult(warnings: string[] = []): StageValidationResult {
  return { valid: true, errors: [], warnings };
}

export function invalidStageResult(errors: string[], warnings: string[] = []): StageValidationResult {
  return { valid: false, errors, warnings };
}

/**
 * Base class for implementing stages with common functionality
 */
export abstract class BaseStage<TInput, TOutput> implements Stage<TInput, TOutput> {
  readonly name: string;
  readonly description?: string;
  readonly optional?: boolean;
  readonly weight?: number;

  constructor(
    name: string,
    options?: {
      description?: string;
      optional?: boolean;
      skippable?: boolean;
      weight?: number;
    }
  ) {
    this.name = name;
    this.description = options?.description;
    this.optional = options?.optional ?? options?.skippable;
    this.weight = options?.weight;
  }

  validate?(input: TInput, context: PipelineContext): StageValidationResult {
    // Default implementation: no validation
    return validStageResult();
  }

  abstract execute(input: TInput, context: PipelineContext): Promise<StageResult<TOutput>>;
}
