import { describe, it, expect, vi } from 'vitest';
import { Pipeline } from '@/lib/pipeline-core/Pipeline';
import { successResult, errorResult } from '@/lib/pipeline-core/StageResult';
import { DefaultPipelineContext } from '@/lib/pipeline-core/PipelineContext';
import type { Stage } from '@/lib/pipeline-core/Stage';

interface MockPipelineOutput {
  conceptDetection?: {
    implicitConcept: unknown;
    promptLower: string;
    isVerticalRequested: boolean;
  };
  plan?: {
    formatConfig: unknown;
    styleConfig: unknown;
    mermaidCode: string;
    reasoning: string;
    usedFallback: boolean;
    droppedExistingContext: boolean;
    inEditMode: boolean;
  };
  parseOutput?: {
    nodes: unknown[];
    edges: unknown[];
    usedFallback: boolean;
    droppedExistingContext: boolean;
    parseWarnings: unknown[];
  };
  scoreOutput?: {
    score: number;
    diagramScore: {
      score: number;
      detailLevel: number;
      total: number;
      categoryScores: Record<string, unknown>;
    };
  };
  validationOutput?: {
    semanticIssues: unknown[];
    mechanicalRepairs: unknown[];
  };
}

// Create fully mocked pipeline stages that simulate the AI pipeline
function createMockAiStages(): Stage<unknown, MockPipelineOutput>[] {
  return [
    {
      name: 'concept-detection',
      description: 'Detect implicit concepts from prompt',
      weight: 1,
      async execute(input: Record<string, unknown>) {
        return successResult({
          ...input,
          conceptDetection: {
            implicitConcept: null,
            promptLower: String(input.prompt ?? input.description).toLowerCase(),
            isVerticalRequested: false,
          },
        });
      },
    },
    {
      name: 'architecture-planning',
      description: 'Plan architecture from prompt',
      weight: 5,
      async execute(input: Record<string, unknown>) {
        return successResult({
          ...input,
          plan: {
            formatConfig: { format: 'mermaid', diagramType: 'graph TD', optionalVariants: [] },
            styleConfig: { primaryColor: '#2563EB', secondaryColor: '#4F46E5', background: '#fff', backgroundColor: '#fff', fontFamily: 'Inter', theme: 'default', nodeTypeStyles: {} },
            mermaidCode: 'graph TD\nA[API]-->B[DB]',
            reasoning: 'Step 0: plan\nStep 1: design\nStep 2: build\nStep 3: test\nStep 4: deploy\nStep 5: monitor\nStep 6: scale\nStep 7: maintain',
            usedFallback: false,
            droppedExistingContext: false,
            inEditMode: false,
          },
        });
      },
    },
    {
      name: 'layout-override',
      description: 'Apply layout direction overrides',
      weight: 1,
      async execute(input: Record<string, unknown>) {
        return successResult(input);
      },
    },
    {
      name: 'mermaid-parse',
      description: 'Parse mermaid code into nodes/edges',
      weight: 3,
      async execute(input: Record<string, unknown>) {
        return successResult({
          ...input,
          parseOutput: {
            nodes: [],
            edges: [],
            usedFallback: false,
            droppedExistingContext: false,
            parseWarnings: [],
          },
        });
      },
    },
    {
      name: 'scoring',
      description: 'Score the generated diagram',
      weight: 1,
      async execute(input: Record<string, unknown>) {
        return successResult({
          ...input,
          scoreOutput: {
            score: 85,
            diagramScore: { score: 85, detailLevel: 2, total: 100, categoryScores: {} },
          },
        });
      },
    },
    {
      name: 'validation',
      description: 'Validate diagram quality',
      weight: 1,
      async execute(input: Record<string, unknown>) {
        return successResult({
          ...input,
          validationOutput: { semanticIssues: [], mechanicalRepairs: [] },
        });
      },
    },
  ];
}

describe('AiMermaidPipelineV2 (mocked integration)', () => {
  it('executes all stages successfully', async () => {
    const pipeline = new Pipeline<Record<string, unknown>, MockPipelineOutput>('ai-mermaid-pipeline-v2', createMockAiStages());
    const userIntent = {
      description: 'Build a simple web app',
      prompt: 'Build a simple web app',
      diagramSize: 'medium' as const,
      detailLevel: 2 as const,
      model: 'gpt-4' as const,
      existingContext: '',
      style: 'default' as const,
    };

    const result = await pipeline.execute(userIntent, new DefaultPipelineContext('test'));
    expect(result.success).toBe(true);
    expect(result.data!.conceptDetection).toBeDefined();
    expect(result.data!.plan).toBeDefined();
    expect(result.data!.parseOutput).toBeDefined();
    expect(result.data!.scoreOutput).toBeDefined();
    expect(result.data!.validationOutput).toBeDefined();
    expect(result.data!.scoreOutput!.score).toBe(85);
  });

  it('propagates stage failure', async () => {
    const failingStages: Stage<unknown, MockPipelineOutput>[] = [
      ...createMockAiStages().slice(0, 2),
      {
        name: 'mermaid-parse',
        description: 'Fails',
        weight: 1,
        async execute() {
          return errorResult('PARSE_FAILED', 'Could not parse mermaid');
        },
      },
    ];
    const pipeline = new Pipeline<Record<string, unknown>, MockPipelineOutput>('fail-ai-pipeline', failingStages);
    const userIntent = { description: 'test', prompt: 'test', diagramSize: 'small' as const, detailLevel: 1 as const, model: 'gpt-4' as const, existingContext: '', style: 'default' as const };

    const result = await pipeline.execute(userIntent, new DefaultPipelineContext('test'));
    expect(result.success).toBe(false);
    expect(result.errors.some((e: string) => e.includes('PARSE_FAILED'))).toBe(true);
  });

  it('reports progress through stages', async () => {
    const progressLog: string[] = [];
    const pipeline = new Pipeline<Record<string, unknown>, MockPipelineOutput>('progress-ai-pipeline', createMockAiStages());
    const ctx = new DefaultPipelineContext('test');
    ctx.onProgress = (stage, _pct) => { progressLog.push(`${stage}:${_pct}`); };

    await pipeline.execute({ description: 'test', prompt: 'test', model: 'gpt-4', diagramSize: 'medium', detailLevel: 2, existingContext: '', style: 'default' }, ctx);
    expect(progressLog.length).toBeGreaterThanOrEqual(6);
    expect(progressLog[0]).toMatch(/concept-detection/);
    expect(progressLog[progressLog.length - 1]).toMatch(/validation/);
  });
});
