import type { Stage } from './Stage';
import type { PipelineContext } from './PipelineContext';
import type { StageResult } from './StageResult';
import type { PipelineResult, PipelineMetrics, StageExecutionResult } from './PipelineResult';
import { DefaultPipelineContext } from './PipelineContext';

/** Browser + Node safe id — never import `crypto` from node (breaks client bundles). */
function createExecutionId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `exec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

type PipelineExecuteOptions = {
  context?: Partial<PipelineContext>;
  signal?: AbortSignal;
  onProgress?: (stage: string, progress: number, message: string) => void;
};

export class Pipeline<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  private stages: Stage<unknown, unknown>[];
  private readonly totalWeight: number;

  constructor(name: string, stages: Stage<unknown, unknown>[]) {
    this.name = name;
    this.stages = stages;
    this.totalWeight = stages.reduce((sum, stage) => sum + (stage.weight ?? 1), 0) || 1;
  }

  async execute(
    input: TInput,
    options?: PipelineExecuteOptions | PipelineContext
  ): Promise<PipelineResult<TOutput>> {
    const startTime = Date.now();
    const providedContext = isPipelineContext(options) ? options : undefined;
    const optionBag: PipelineExecuteOptions | undefined = providedContext ? undefined : options as PipelineExecuteOptions | undefined;
    const executionId = providedContext?.executionId ?? optionBag?.context?.executionId ?? createExecutionId();

    const context = providedContext ?? new DefaultPipelineContext(
      executionId,
      optionBag?.context?.metadata ?? {},
      optionBag?.onProgress ?? optionBag?.context?.onProgress,
      optionBag?.signal ?? optionBag?.context?.signal
    );

    const stageResults: StageExecutionResult[] = [];
    const allWarnings: string[] = [];
    const allErrors: string[] = [];
    let currentOutput: unknown = input;
    let hasFatalError = false;
    let fatalError: Error | undefined;

    const totalStages = this.stages.length;

    for (let i = 0; i < totalStages; i++) {
      if (context.isAborted()) {
        return this.buildResult(
          currentOutput as TOutput,
          false,
          startTime,
          stageResults,
          allWarnings,
          allErrors,
          new Error('Pipeline aborted'),
          true
        );
      }

      const stage = this.stages[i];

      stageResults.push({
        stage: stage.name,
        success: false,
        skipped: false,
        durationMs: 0,
        warnings: [],
      });

      const stageStart = Date.now();

      let stageDurationMs: number;
      try {
        if (stage.validate && stage.validate(currentOutput, context).valid === false) {
          const validationResult = stage.validate(currentOutput, context);
          if (!isSkippable(stage)) {
            const error = new Error(`Stage "${stage.name}" validation failed: ${validationResult.errors.join(', ')}`);
            allErrors.push(error.message);
            allWarnings.push(...validationResult.warnings.map(w => `[${stage.name}] ${w}`));
            stageResults[i] = {
              stage: stage.name,
              success: false,
              skipped: false,
              durationMs: Date.now() - stageStart,
              warnings: validationResult.warnings,
              error: error.message,
            };
            hasFatalError = true;
            fatalError = error;
            break;
          }
          stageResults[i] = {
            stage: stage.name,
            success: true,
            skipped: true,
            durationMs: Date.now() - stageStart,
            warnings: validationResult.warnings,
          };
          context.onProgress?.(stage.name, this.progressThrough(i), `Skipped: ${stage.name}`);
          continue;
        }

        const result: StageResult<unknown> = await stage.execute(currentOutput, context);

        stageDurationMs = Date.now() - stageStart;

        if (result.warnings?.length) {
          allWarnings.push(...result.warnings.map(w => `[${stage.name}] ${w}`));
        }

        if (result.skipped) {
          stageResults[i] = {
            stage: stage.name,
            success: true,
            skipped: true,
            durationMs: stageDurationMs,
            warnings: result.warnings ?? [],
          };
          context.onProgress?.(stage.name, this.progressThrough(i), `Skipped: ${stage.name}`);
          continue;
        }

        if (!result.success) {
          const errorMessage = result.error?.message ?? `Stage "${stage.name}" failed`;
          allErrors.push(errorMessage);
          stageResults[i] = {
            stage: stage.name,
            success: false,
            skipped: false,
            durationMs: stageDurationMs,
            warnings: result.warnings ?? [],
            error: errorMessage,
          };

          if (isSkippable(stage)) {
            context.onProgress?.(stage.name, this.progressThrough(i), `Failed (optional): ${stage.name}`);
            continue;
          }

          hasFatalError = true;
          fatalError = result.error ?? new Error(errorMessage);
          break;
        }

        currentOutput = result.data;
        stageResults[i] = {
          stage: stage.name,
          success: true,
          skipped: false,
          durationMs: stageDurationMs,
          warnings: result.warnings ?? [],
        };

        const progress = result.metadata?.terminal ? 100 : this.progressThrough(i);
        context.onProgress?.(stage.name, progress, `Completed: ${stage.name}`);
        if (result.metadata?.terminal) {
          break;
        }
      } catch (err) {
        stageDurationMs = Date.now() - stageStart;
        const errorMessage = err instanceof Error ? err.message : `Stage "${stage.name}" threw unexpectedly`;
        allErrors.push(errorMessage);
        stageResults[i] = {
          stage: stage.name,
          success: false,
          skipped: false,
          durationMs: stageDurationMs,
          warnings: [],
          error: errorMessage,
        };

        if (isSkippable(stage)) {
          context.onProgress?.(stage.name, this.progressThrough(i), `Failed (optional): ${stage.name}`);
          continue;
        }

        hasFatalError = true;
        fatalError = err instanceof Error ? err : new Error(errorMessage);
        break;
      }

    }

    return this.buildResult(
      currentOutput as TOutput,
      !hasFatalError,
      startTime,
      stageResults,
      allWarnings,
      allErrors,
      fatalError,
      context.isAborted()
    );
  }

  /** Weighted progress after stages [0..index] are accounted for. */
  private progressThrough(index: number): number {
    let completed = 0;
    for (let i = 0; i <= index && i < this.stages.length; i++) {
      completed += this.stages[i].weight ?? 1;
    }
    return Math.min(100, Math.round((completed / this.totalWeight) * 100));
  }

  private buildResult(
    data: TOutput | undefined,
    success: boolean,
    startTime: number,
    stageResults: StageExecutionResult[],
    allWarnings: string[],
    allErrors: string[],
    error?: Error,
    aborted?: boolean
  ): PipelineResult<TOutput> {
    const endTime = Date.now();
    const metrics: PipelineMetrics = {
      totalDurationMs: endTime - startTime,
      stagesExecuted: stageResults.filter(s => s.success && !s.skipped).length,
      stagesSkipped: stageResults.filter(s => s.skipped).length,
      stagesFailed: stageResults.filter(s => !s.success).length,
      startTime,
      endTime,
      stages: stageResults.map(s => ({
        stage: s.stage,
        duration: s.durationMs,
        status: s.skipped ? 'skipped' : s.success ? 'success' : 'failed',
      })),
    };

    return {
      success,
      data,
      error: !success ? error : undefined,
      warnings: allWarnings,
      errors: allErrors,
      metrics,
      stageResults,
      aborted,
    };
  }
}

function isPipelineContext(value: unknown): value is PipelineContext {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'executionId' in value &&
    'sharedData' in value &&
    'isAborted' in value
  );
}

function isSkippable(stage: Stage<unknown, unknown>): boolean {
  return Boolean(stage.optional || stage.skippable);
}
