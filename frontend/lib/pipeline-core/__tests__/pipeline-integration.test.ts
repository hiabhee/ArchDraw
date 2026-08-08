import { describe, it, expect, vi } from 'vitest';
import { Pipeline } from '../Pipeline';
import { BaseStage } from '../Stage';
import { successResult, errorResult, skipResult } from '../StageResult';
import type { StageResult } from '../StageResult';
import type { PipelineContext } from '../PipelineContext';
import { DefaultPipelineContext } from '../PipelineContext';

class StageA extends BaseStage<{ value: number }, { value: number; fromA: string }> {
  constructor() {
    super('stageA', { description: 'Stage A', weight: 1 });
  }
  async execute(input: { value: number }): Promise<StageResult<{ value: number; fromA: string }>> {
    return successResult({ value: input.value + 1, fromA: 'done' });
  }
}

class StageB extends BaseStage<{ value: number; fromA: string }, { value: number; fromB: string }> {
  constructor() {
    super('stageB', { description: 'Stage B', weight: 2 });
  }
  async execute(input: { value: number; fromA: string }): Promise<StageResult<{ value: number; fromB: string }>> {
    return successResult({ value: input.value * 2, fromB: `got: ${input.fromA}` });
  }
}

class StageC extends BaseStage<{ value: number; fromB: string }, { value: number; fromC: string }> {
  constructor() {
    super('stageC', { description: 'Stage C', weight: 1 });
  }
  async execute(input: { value: number; fromB: string }): Promise<StageResult<{ value: number; fromC: string }>> {
    return successResult({ value: input.value + 10, fromC: `got: ${input.fromB}` });
  }
}

class FailingStage extends BaseStage<{ value: number }, { value: number; error: string }> {
  constructor() {
    super('failing', { description: 'Always fails', weight: 1 });
  }
  async execute(_input: { value: number }): Promise<StageResult<{ value: number; error: string }>> {
    return errorResult(new Error('OH_NO'), []);
  }
}

class SkipStage extends BaseStage<{ value: number }, { value: number; skipped: boolean }> {
  constructor() {
    super('skip', { description: 'Can be skipped', weight: 1, skippable: true });
  }
  async execute(_input: { value: number }): Promise<StageResult<{ value: number; skipped: boolean }>> {
    return skipResult('manually skipped');
  }
}

describe('Pipeline Integration', () => {
  it('executes a multi-stage pipeline successfully', async () => {
    const pipeline = new Pipeline<{ value: number }, { value: number; fromA: string; fromB: string; fromC: string }>(
      'test-pipeline',
      [new StageA(), new StageB(), new StageC()]
    );
    const result = await pipeline.execute({ value: 1 }, new DefaultPipelineContext('test'));
    expect(result.success).toBe(true);
    expect(result.data!.value).toBe(14);
  });

  it('tracks progress through stages', async () => {
    const progressCalls: string[] = [];
    const pipeline = new Pipeline('progress-test', [new StageA(), new StageB(), new StageC()]);
    const ctx = new DefaultPipelineContext('test');
    ctx.onProgress = (stage, _progress, _msg) => {
      progressCalls.push(`${stage}:${_progress}`);
    };
    await pipeline.execute({ value: 0 }, ctx);
    expect(progressCalls.length).toBeGreaterThanOrEqual(3);
    expect(progressCalls[0]).toContain('stageA');
    expect(progressCalls[1]).toContain('stageB');
    expect(progressCalls[2]).toContain('stageC');
  });

  it('records execution times in metrics', async () => {
    const pipeline = new Pipeline('metrics-test', [new StageA(), new StageB()]);
    const result = await pipeline.execute({ value: 1 }, new DefaultPipelineContext('test'));
    expect(result.metrics).toBeDefined();
    expect(result.metrics.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.stages).toHaveLength(2);
    result.metrics.stages.forEach(s => {
      expect(s.duration).toBeGreaterThanOrEqual(0);
      expect(s.status).toBe('success');
    });
  });

  it('fails on stage error and propagates error info', async () => {
    const pipeline = new Pipeline<{ value: number }, { value: number; fromA: string }>(
      'fail-test',
      [new StageA(), new FailingStage(), new StageC()]
    );
    const result = await pipeline.execute({ value: 1 }, new DefaultPipelineContext('test'));
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('OH_NO');
    expect(result.data).toBeDefined();
    expect(result.data!.fromA).toBe('done');
  });

  it('skips stages that return skipResult', async () => {
    const pipeline = new Pipeline<{ value: number }, { value: number; fromB: string }>(
      'skip-test',
      [new StageA(), new SkipStage(), new StageB()]
    );
    const result = await pipeline.execute({ value: 1 }, new DefaultPipelineContext('test'));
    expect(result.success).toBe(true);
    expect(result.data!.value).toBe(4);
    expect(result.data!.fromB).toBe('got: done');
    expect(result.metrics.stagesSkipped).toBe(1);
  });

  it('handles empty stage list gracefully', async () => {
    const pipeline = new Pipeline('empty-test', []);
    const result = await pipeline.execute({ value: 1 }, new DefaultPipelineContext('test'));
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ value: 1 });
  });

  it('supports abort signal', async () => {
    const pipeline = new Pipeline('abort-test', [
      new StageA(),
      {
        name: 'slow',
        description: 'slow stage',
        weight: 1,
        async execute(_input: unknown, ctx: PipelineContext): Promise<StageResult<unknown>> {
          if (ctx.signal?.aborted) return errorResult(new Error('ABORTED'));
          return successResult({ aborted: false });
        },
      },
    ]);
    const controller = new AbortController();
    controller.abort();
    const ctx = new DefaultPipelineContext('test');
    ctx.signal = controller.signal;
    const result = await pipeline.execute({ value: 1 }, ctx);
    expect(result.success).toBe(false);
  });

  it('captures warnings from stages', async () => {
    const pipeline = new Pipeline('warn-test', [
      new StageA(),
      {
        name: 'warn-stage',
        description: 'produces warning',
        weight: 1,
        async execute(input: Record<string, unknown>): Promise<StageResult<Record<string, unknown>>> {
          return successResult({ ...input, warned: true }, ['This is a warning']);
        },
      },
    ]);
    const result = await pipeline.execute({ value: 1 }, new DefaultPipelineContext('test'));
    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('[warn-stage]');
    expect(result.warnings[0]).toContain('warning');
  });
});
