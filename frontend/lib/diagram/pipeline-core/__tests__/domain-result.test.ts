import { describe, it, expect } from 'vitest';
import {
  toDomainResult,
  isDomainSuccess,
  isDomainFailure,
  inferDomainErrorCode,
  unwrapDomainResult,
  type DomainPipelineResult,
  type DomainErrorCode,
} from '../DomainResult';

describe('DomainResult', () => {
  describe('toDomainResult', () => {
    it('converts successful pipeline result to domain success', () => {
      const pipelineResult = {
        success: true,
        data: { nodes: [], edges: [] },
        warnings: [],
        errors: [],
        metrics: { totalDurationMs: 100, stagesExecuted: 1, stagesSkipped: 0, stagesFailed: 0, startTime: 0, endTime: 100, stages: [] },
        stageResults: [],
      };

      const domainResult = toDomainResult(pipelineResult);

      expect(isDomainSuccess(domainResult)).toBe(true);
      if (isDomainSuccess(domainResult)) {
        expect(domainResult.data).toEqual({ nodes: [], edges: [] });
        expect(domainResult.warnings).toEqual([]);
        expect(domainResult.metrics).toBeDefined();
      }
    });

    it('converts failed pipeline result to domain failure with inferred code', () => {
      const pipelineResult = {
        success: false,
        error: new Error('Stage failed'),
        warnings: ['warning1'],
        errors: ['error1'],
        metrics: { totalDurationMs: 100, stagesExecuted: 0, stagesSkipped: 0, stagesFailed: 1, startTime: 0, endTime: 100, stages: [] },
        stageResults: [{ stage: 'parse', success: false, skipped: false, durationMs: 50, warnings: [], error: 'Stage failed' }],
        aborted: false,
      };

      const domainResult = toDomainResult(pipelineResult);

      expect(isDomainFailure(domainResult)).toBe(true);
      if (isDomainFailure(domainResult)) {
        expect(domainResult.code).toBe('parse_failed');
        expect(domainResult.error).toBeDefined();
        expect(domainResult.warnings).toEqual(['warning1']);
        expect(domainResult.aborted).toBe(false);
      }
    });

    it('converts aborted pipeline result to domain failure with aborted code', () => {
      const pipelineResult = {
        success: false,
        error: new Error('Pipeline aborted'),
        warnings: [],
        errors: [],
        metrics: { totalDurationMs: 50, stagesExecuted: 0, stagesSkipped: 0, stagesFailed: 0, startTime: 0, endTime: 50, stages: [] },
        stageResults: [],
        aborted: true,
      };

      const domainResult = toDomainResult(pipelineResult);

      expect(isDomainFailure(domainResult)).toBe(true);
      if (isDomainFailure(domainResult)) {
        expect(domainResult.code).toBe('aborted');
        expect(domainResult.aborted).toBe(true);
      }
    });
  });

  describe('inferDomainErrorCode', () => {
    it('infers aborted code when aborted', () => {
      const result = {
        aborted: true,
        error: new Error('Aborted'),
        errors: [],
        stageResults: [],
      };
      expect(inferDomainErrorCode(result)).toBe('aborted');
    });

    it('infers ingestion_failed from stage name', () => {
      const result = {
        aborted: false,
        error: new Error('Failed'),
        errors: [],
        stageResults: [{ stage: 'ingesting', success: false, skipped: false, durationMs: 50, warnings: [] }],
      };
      expect(inferDomainErrorCode(result)).toBe('ingestion_failed');
    });

    it('infers parse_failed from stage name', () => {
      const result = {
        aborted: false,
        error: new Error('Failed'),
        errors: [],
        stageResults: [{ stage: 'parse', success: false, skipped: false, durationMs: 50, warnings: [] }],
      };
      expect(inferDomainErrorCode(result)).toBe('parse_failed');
    });

    it('infers validation_failed from stage name', () => {
      const result = {
        aborted: false,
        error: new Error('Failed'),
        errors: [],
        stageResults: [{ stage: 'validation', success: false, skipped: false, durationMs: 50, warnings: [] }],
      };
      expect(inferDomainErrorCode(result)).toBe('validation_failed');
    });

    it('infers generation_failed from error message', () => {
      const result = {
        aborted: false,
        error: new Error('Generation failed'),
        errors: ['generation failed'],
        stageResults: [],
      };
      expect(inferDomainErrorCode(result)).toBe('generation_failed');
    });

    it('defaults to unknown when no pattern matches', () => {
      const result = {
        aborted: false,
        error: new Error('Unknown error'),
        errors: ['unknown error'],
        stageResults: [{ stage: 'unknown-stage', success: false, skipped: false, durationMs: 50, warnings: [] }],
      };
      expect(inferDomainErrorCode(result)).toBe('unknown');
    });
  });

  describe('unwrapDomainResult', () => {
    it('returns data on success', () => {
      const result: DomainPipelineResult<{ foo: string }> = {
        success: true,
        data: { foo: 'bar' },
        warnings: [],
      };

      const data = unwrapDomainResult(result);
      expect(data).toEqual({ foo: 'bar' });
    });

    it('throws error on failure', () => {
      const result: DomainPipelineResult<{ foo: string }> = {
        success: false,
        error: new Error('Failed'),
        code: 'parse_failed',
        warnings: [],
      };

      expect(() => unwrapDomainResult(result)).toThrow('Failed');
    });

    it('attaches code to thrown error', () => {
      const result: DomainPipelineResult<{ foo: string }> = {
        success: false,
        error: new Error('Failed'),
        code: 'parse_failed',
        warnings: [],
      };

      let caughtError: Error | undefined;
      try {
        unwrapDomainResult(result);
      } catch (err) {
        caughtError = err as Error;
      }
      
      expect(caughtError).toBeDefined();
      expect((caughtError as Error & { code?: DomainErrorCode }).code).toBe('parse_failed');
    });
  });

  describe('type guards', () => {
    it('isDomainSuccess correctly identifies success', () => {
      const success: DomainPipelineResult<string> = {
        success: true,
        data: 'data',
        warnings: [],
      };
      const failure: DomainPipelineResult<string> = {
        success: false,
        error: new Error('Failed'),
        code: 'unknown',
        warnings: [],
      };

      expect(isDomainSuccess(success)).toBe(true);
      expect(isDomainSuccess(failure)).toBe(false);
    });

    it('isDomainFailure correctly identifies failure', () => {
      const success: DomainPipelineResult<string> = {
        success: true,
        data: 'data',
        warnings: [],
      };
      const failure: DomainPipelineResult<string> = {
        success: false,
        error: new Error('Failed'),
        code: 'unknown',
        warnings: [],
      };

      expect(isDomainFailure(success)).toBe(false);
      expect(isDomainFailure(failure)).toBe(true);
    });
  });
});
