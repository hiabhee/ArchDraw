/**
 * StageResult - Standardized result from a single pipeline stage
 * 
 * Provides consistent structure for stage execution results,
 * making it easier to handle errors, warnings, and skip conditions.
 */

export interface StageResult<T> {
  /** Whether the stage executed successfully */
  success: boolean;
  
  /** The output data from the stage (if successful) */
  data?: T;
  
  /** Error that caused stage failure (if unsuccessful) */
  error?: Error;
  
  /** Warnings generated during stage execution (non-blocking) */
  warnings: string[];
  
  /** Whether this stage was skipped (e.g., optional stage) */
  skipped?: boolean;
  
  /** Additional metadata about stage execution */
  metadata?: {
    /** Stop the pipeline and use this result as the final output. */
    terminal?: boolean;
    [key: string]: unknown;
  };
}

export function successResult<T>(data: T, warnings: string[] = [], metadata?: Record<string, unknown>): StageResult<T> {
  return {
    success: true,
    data,
    warnings,
    metadata,
  };
}

export function errorResult<T>(error: Error | string, warnings: string[] | string = []): StageResult<T> {
  const normalizedWarnings = Array.isArray(warnings) ? warnings : [warnings];
  const normalizedError = error instanceof Error ? error : new Error(error);
  return {
    success: false,
    error: normalizedError,
    warnings: normalizedWarnings,
  };
}

export function skipResult<T>(reason: string): StageResult<T> {
  return {
    success: true,
    skipped: true,
    warnings: [reason],
  };
}

export function warningResult<T>(data: T, warnings: string[]): StageResult<T> {
  return {
    success: true,
    data,
    warnings,
  };
}
