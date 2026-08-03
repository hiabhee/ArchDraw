import type { PipelineMetrics, PipelineResult } from './PipelineResult';

export type DomainErrorCode =
  | 'aborted'
  | 'generation_failed'
  | 'parse_failed'
  | 'ingestion_failed'
  | 'validation_failed'
  | 'unknown';

export type DomainPipelineFailure = {
  success: false;
  error: Error;
  code: DomainErrorCode;
  warnings: string[];
  metrics?: PipelineMetrics;
  aborted?: boolean;
};

export type DomainPipelineSuccess<T> = {
  success: true;
  data: T;
  warnings: string[];
  metrics?: PipelineMetrics;
};

export type DomainPipelineResult<T> = DomainPipelineSuccess<T> | DomainPipelineFailure;

export function isDomainFailure<T>(
  result: DomainPipelineResult<T>
): result is DomainPipelineFailure {
  return result.success === false;
}

export function isDomainSuccess<T>(
  result: DomainPipelineResult<T>
): result is DomainPipelineSuccess<T> {
  return result.success === true;
}

/** Infer a stable error code from core pipeline failure metadata. */
export function inferDomainErrorCode(
  result: Pick<PipelineResult<unknown>, 'aborted' | 'error' | 'errors' | 'stageResults'>
): DomainErrorCode {
  if (result.aborted) return 'aborted';

  const stageName = result.stageResults.find(s => !s.success && !s.skipped)?.stage ?? '';
  const message = (result.error?.message ?? result.errors[0] ?? '').toLowerCase();

  if (stageName === 'ingesting' || message.includes('ingest')) return 'ingestion_failed';
  if (stageName.includes('parse') || message.includes('parse')) return 'parse_failed';
  if (stageName.includes('validat') || message.includes('validat')) return 'validation_failed';
  if (message.includes('abort')) return 'aborted';
  if (message.includes('generation') || message.includes('generat')) return 'generation_failed';

  return 'unknown';
}

export function toDomainResult<T>(
  result: PipelineResult<T>
): DomainPipelineResult<T> {
  if (result.success && result.data !== undefined) {
    return {
      success: true,
      data: result.data,
      warnings: result.warnings,
      metrics: result.metrics,
    };
  }

  return {
    success: false,
    error: result.error ?? new Error(result.errors[0] ?? 'Pipeline failed'),
    code: inferDomainErrorCode(result),
    warnings: result.warnings,
    metrics: result.metrics,
    aborted: result.aborted,
  };
}

/** Unwrap domain success or throw — for call sites that prefer exceptions. */
export function unwrapDomainResult<T>(result: DomainPipelineResult<T>): T {
  if (result.success) return result.data;
  const err = result.error;
  (err as Error & { code?: DomainErrorCode }).code = result.code;
  throw err;
}
