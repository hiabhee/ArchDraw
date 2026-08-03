/**
 * PipelineResult - Standardized result from pipeline execution
 * 
 * Provides comprehensive information about pipeline execution,
 * including final output, all warnings/errors, and performance metrics.
 */

export interface PipelineResult<T> {
  /** Whether the pipeline executed successfully */
  success: boolean;
  
  /** The final output data from the pipeline (if successful) */
  data?: T;
  
  /** Fatal error that caused pipeline failure (if unsuccessful) */
  error?: Error;
  
  /** All warnings collected from all stages */
  warnings: string[];
  
  /** All errors collected from stages (non-fatal if pipeline succeeded) */
  errors: string[];
  
  /** Execution metrics and metadata */
  metrics: PipelineMetrics;
  
  /** Detailed results from each stage */
  stageResults: StageExecutionResult[];
  
  /** Whether the pipeline was aborted */
  aborted?: boolean;
}

export interface PipelineMetrics {
  /** Total execution time in milliseconds */
  totalDurationMs: number;
  
  /** Number of stages executed */
  stagesExecuted: number;
  
  /** Number of stages skipped */
  stagesSkipped: number;
  
  /** Number of stages that failed */
  stagesFailed: number;
  
  /** Timestamp when pipeline started */
  startTime: number;
  
  /** Timestamp when pipeline completed */
  endTime: number;

  /** Per-stage timing and status metrics. */
  stages: StageMetric[];
}

export interface StageMetric {
  /** Stage name */
  stage: string;

  /** Stage execution duration in milliseconds */
  duration: number;

  /** Coarse status for reporting and diagnostics */
  status: 'success' | 'failed' | 'skipped';
}

export interface StageExecutionResult {
  /** Stage name */
  stage: string;
  
  /** Whether the stage succeeded */
  success: boolean;
  
  /** Whether the stage was skipped */
  skipped: boolean;
  
  /** Stage execution duration in milliseconds */
  durationMs: number;
  
  /** Warnings from this stage */
  warnings: string[];
  
  /** Error from this stage (if failed) */
  error?: string;
}
