/**
 * PipelineContext - Shared context across pipeline stages
 * 
 * Provides a mechanism for stages to share state, track progress,
 * and access common utilities without tight coupling.
 */

export interface PipelineContext {
  /** Unique identifier for this pipeline execution */
  readonly executionId: string;
  
  /** Timestamp when pipeline execution started */
  readonly startTime: number;
  
  /** User-provided metadata for this execution */
  readonly metadata: Record<string, unknown>;
  
  /** Progress callback for reporting stage completion */
  onProgress?: (stage: string, progress: number, message: string) => void;
  
  /** Signal for aborting pipeline execution */
  signal?: AbortSignal;
  
  /** Shared key-value store for stage communication */
  readonly sharedData: Map<string, unknown>;
  
  /** Set a value in shared data */
  setShared(key: string, value: unknown): void;
  
  /** Get a value from shared data */
  getShared<T>(key: string): T | undefined;
  
  /** Check if execution was aborted */
  isAborted(): boolean;
}

export class DefaultPipelineContext implements PipelineContext {
  readonly executionId: string;
  readonly startTime: number;
  readonly metadata: Record<string, unknown>;
  readonly sharedData = new Map<string, unknown>();
  onProgress?: (stage: string, progress: number, message: string) => void;
  signal?: AbortSignal;

  constructor(
    executionId: string,
    metadata: Record<string, unknown> = {},
    onProgress?: PipelineContext['onProgress'],
    signal?: AbortSignal
  ) {
    this.executionId = executionId;
    this.startTime = Date.now();
    this.metadata = metadata;
    this.onProgress = onProgress;
    this.signal = signal;
  }

  setShared(key: string, value: unknown): void {
    this.sharedData.set(key, value);
  }

  getShared<T>(key: string): T | undefined {
    return this.sharedData.get(key) as T | undefined;
  }

  isAborted(): boolean {
    return this.signal?.aborted ?? false;
  }
}
