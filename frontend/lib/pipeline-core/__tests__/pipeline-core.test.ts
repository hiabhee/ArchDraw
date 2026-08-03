import { describe, it, expect, vi } from 'vitest';
import { Pipeline } from '../Pipeline';
import { BaseStage } from '../Stage';
import type { Stage } from '../Stage';
import type { StageResult } from '../StageResult';
import { successResult, errorResult, skipResult, warningResult } from '../StageResult';
import type { PipelineContext } from '../PipelineContext';
import { DefaultPipelineContext } from '../PipelineContext';
import type { PipelineResult } from '../PipelineResult';

describe('StageResult', () => {
  it('creates success result', () => {
    const result = successResult({ foo: 'bar' }, ['warning']);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ foo: 'bar' });
    expect(result.warnings).toEqual(['warning']);
  });

  it('creates error result', () => {
    const error = new Error('test error');
    const result = errorResult(error);
    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
  });

  it('creates skip result', () => {
    const result = skipResult('skipped because...');
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.warnings).toEqual(['skipped because...']);
  });

  it('creates warning result', () => {
    const result = warningResult({ val: 1 }, ['warn1', 'warn2']);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ val: 1 });
    expect(result.warnings).toEqual(['warn1', 'warn2']);
  });
});

describe('DefaultPipelineContext', () => {
  it('creates context with defaults', () => {
    const ctx = new DefaultPipelineContext('test-exec');
    expect(ctx.executionId).toBe('test-exec');
    expect(ctx.startTime).toBeGreaterThan(0);
    expect(ctx.metadata).toEqual({});
    expect(ctx.isAborted()).toBe(false);
  });

  it('stores and retrieves shared data', () => {
    const ctx = new DefaultPipelineContext('test');
    ctx.setShared('key1', 'value1');
    ctx.setShared('key2', 42);
    expect(ctx.getShared<string>('key1')).toBe('value1');
    expect(ctx.getShared<number>('key2')).toBe(42);
    expect(ctx.getShared('nonexistent')).toBeUndefined();
  });

  it('detects abort signal', () => {
    const controller = new AbortController();
    const ctx = new DefaultPipelineContext('test', {}, undefined, controller.signal);
    expect(ctx.isAborted()).toBe(false);
    controller.abort();
    expect(ctx.isAborted()).toBe(true);
  });

  it('calls onProgress callback', () => {
    const onProgress = vi.fn();
    const ctx = new DefaultPipelineContext('test', {}, onProgress);
    ctx.onProgress?.('stage1', 50, 'working');
    expect(onProgress).toHaveBeenCalledWith('stage1', 50, 'working');
  });
});

describe('Pipeline', () => {
  it('executes a single stage successfully', async () => {
    const stage: Stage<string, string> = {
      name: 'uppercase',
      async execute(input: string): Promise<StageResult<string>> {
        return successResult(input.toUpperCase());
      },
    };

    const pipeline = new Pipeline<string, string>('test', [stage]);
    const result = await pipeline.execute('hello');

    expect(result.success).toBe(true);
    expect(result.data).toBe('HELLO');
    expect(result.errors).toHaveLength(0);
  });

  it('executes multiple stages in sequence', async () => {
    const stage1: Stage<string, string> = {
      name: 'append-foo',
      async execute(input: string): Promise<StageResult<string>> {
        return successResult(input + '-foo');
      },
    };
    const stage2: Stage<string, string> = {
      name: 'uppercase',
      async execute(input: string): Promise<StageResult<string>> {
        return successResult(input.toUpperCase());
      },
    };

    const pipeline = new Pipeline<string, string>('test', [stage1, stage2]);
    const result = await pipeline.execute('hello');

    expect(result.success).toBe(true);
    expect(result.data).toBe('HELLO-FOO');
    expect(result.metrics.stagesExecuted).toBe(2);
    expect(result.metrics.stagesSkipped).toBe(0);
    expect(result.metrics.stagesFailed).toBe(0);
  });

  it('stops on non-optional stage failure', async () => {
    const stage1: Stage<string, string> = {
      name: 'will-fail',
      async execute(): Promise<StageResult<string>> {
        return errorResult(new Error('Stage failed'));
      },
    };
    const stage2: Stage<string, string> = {
      name: 'should-not-run',
      async execute(input: string): Promise<StageResult<string>> {
        return successResult(input + '-should-not-appear');
      },
    };

    const pipeline = new Pipeline<string, string>('test', [stage1, stage2]);
    const result = await pipeline.execute('hello');

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Stage failed');
    expect(result.metrics.stagesExecuted).toBe(0);
    expect(result.metrics.stagesFailed).toBe(1);
  });

  it('skips optional stage on failure', async () => {
    const stage1: Stage<string, string> = {
      name: 'optional-fail',
      optional: true,
      async execute(): Promise<StageResult<string>> {
        return errorResult(new Error('Optional stage failed'));
      },
    };
    const stage2: Stage<string, string> = {
      name: 'should-run',
      async execute(input: string): Promise<StageResult<string>> {
        return successResult(input + '-continued');
      },
    };

    const pipeline = new Pipeline<string, string>('test', [stage1, stage2]);
    const result = await pipeline.execute('start');

    expect(result.success).toBe(true);
    expect(result.data).toBe('start-continued');
    expect(result.metrics.stagesSkipped).toBe(0);
    expect(result.metrics.stagesFailed).toBe(1);
  });

  it('collects warnings from all stages', async () => {
    const stage1: Stage<string, string> = {
      name: 'with-warning',
      async execute(input: string): Promise<StageResult<string>> {
        return warningResult(input + '-warned', ['careful!']);
      },
    };
    const stage2: Stage<string, string> = {
      name: 'also-warning',
      async execute(input: string): Promise<StageResult<string>> {
        return warningResult(input + '-again', ['another warning']);
      },
    };

    const pipeline = new Pipeline<string, string>('test', [stage1, stage2]);
    const result = await pipeline.execute('start');

    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('skips stage when validation fails and stage is optional', async () => {
    const stage: Stage<string, string> = {
      name: 'validate-skip',
      optional: true,
      validate() {
        return { valid: false, errors: ['invalid input'], warnings: [] };
      },
      async execute(input: string): Promise<StageResult<string>> {
        return successResult(input + '-executed');
      },
    };

    const pipeline = new Pipeline<string, string>('test', [stage]);
    const result = await pipeline.execute('hello');

    expect(result.success).toBe(true);
    expect(result.metrics.stagesSkipped).toBe(1);
  });

  it('reports progress via onProgress', async () => {
    const onProgress = vi.fn();
    const stage: Stage<string, string> = {
      name: 'test-stage',
      async execute(input: string): Promise<StageResult<string>> {
        return successResult(input + '-done');
      },
    };

    const pipeline = new Pipeline<string, string>('test', [stage]);
    await pipeline.execute('input', { onProgress });

    expect(onProgress).toHaveBeenCalled();
  });

  it('aborts execution when signal is aborted', async () => {
    const controller = new AbortController();
    const stage1: Stage<string, string> = {
      name: 'slow-stage',
      async execute(input: string): Promise<StageResult<string>> {
        controller.abort();
        return successResult(input);
      },
    };
    const stage2: Stage<string, string> = {
      name: 'should-not-run',
      async execute(input: string): Promise<StageResult<string>> {
        return successResult(input + '-extra');
      },
    };

    const pipeline = new Pipeline<string, string>('test', [stage1, stage2]);
    const result = await pipeline.execute('input', { signal: controller.signal });

    expect(result.aborted).toBe(true);
  });

  it('BaseStage provides default validate', () => {
    class TestStage extends BaseStage<string, string> {
      constructor() {
        super('test', { description: 'A test stage' });
      }
      async execute(input: string): Promise<StageResult<string>> {
        return successResult(input);
      }
    }

    const stage = new TestStage();
    expect(stage.name).toBe('test');
    expect(stage.description).toBe('A test stage');
    expect(stage.validate).toBeDefined();
  });

  it('provides execution metrics', async () => {
    const stage: Stage<string, string> = {
      name: 'metrics-test',
      weight: 2,
      async execute(input: string): Promise<StageResult<string>> {
        return successResult(input);
      },
    };

    const pipeline = new Pipeline<string, string>('test', [stage]);
    const result = await pipeline.execute('input');

    expect(result.metrics.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.stagesExecuted).toBe(1);
    expect(result.metrics.startTime).toBeGreaterThan(0);
    expect(result.metrics.endTime).toBeGreaterThan(0);
    expect(result.metrics.endTime).toBeGreaterThanOrEqual(result.metrics.startTime);
  });

  it('handles synchronous-like stage execution', async () => {
    const stage: Stage<number, number> = {
      name: 'double',
      async execute(input: number): Promise<StageResult<number>> {
        return successResult(input * 2);
      },
    };

    const pipeline = new Pipeline<number, number>('number-pipeline', [stage]);
    const result = await pipeline.execute(21);

    expect(result.success).toBe(true);
    expect(result.data).toBe(42);
  });

  it('returns stage results for each stage', async () => {
    const stage: Stage<string, string> = {
      name: 'return-stage',
      async execute(input: string): Promise<StageResult<string>> {
        return successResult(input, ['stage warning']);
      },
    };

    const pipeline = new Pipeline<string, string>('test', [stage]);
    const result = await pipeline.execute('data');

    expect(result.stageResults).toHaveLength(1);
    expect(result.stageResults[0].stage).toBe('return-stage');
    expect(result.stageResults[0].success).toBe(true);
    expect(result.stageResults[0].warnings).toContain('stage warning');
  });
});
