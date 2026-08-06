import { randomUUID } from 'crypto';
import type { UserIntent, GenerationResult, GenerationProgress } from '../types';
import type { ValidationIssue } from '../pipeline/types';
import { runAiMermaidPipelineV2 as runMermaidPipeline } from '../pipeline/mermaid-pipeline/pipeline-v2';
import { requestContext } from '../utils/apiKeyManager';
import logger from '@/lib/logger';

export type ProgressCallback = (progress: GenerationProgress) => void;

/**
 * High-level orchestration for AI diagram generation.
 * Handles retries, cache, and progress updates.
 */
export async function generateDiagram(
  userIntent: UserIntent,
  onProgress?: ProgressCallback
): Promise<GenerationResult> {
  const requestId = randomUUID().slice(0, 8);

  return requestContext.run({ requestId, networkAttempts: 0, logicalCalls: 0 }, async () => {
    try {
      logger.log(`[Orchestrator] [${requestId}] Starting diagram generation:`, userIntent.description);

      const result = await runMermaidPipeline(userIntent, (step, progress) => {
        onProgress?.({
          phase: progress >= 100 ? 'complete' : phaseForStep(step),
          iteration: 0,
          currentAgent: step,
          score: 0,
          message: step,
          progress,
        });
      });

      if (!result.success) {
        throw new GenerationFailedError(result.error.message || result.code || 'generation_failed');
      }

      const data = result.data;
      const store = requestContext.getStore();
      logger.log(`[Orchestrator] [${requestId}] Generation complete. Score: ${data.score}, logical: ${store?.logicalCalls ?? '?'}, network: ${store?.networkAttempts ?? '?'}`);

      const qualityWarnings = [
        ...(data.diagnostics?.semanticIssues.map((i: ValidationIssue) => i.message) ?? []),
        ...(data.diagnostics?.mechanicalRepairs.map((i: ValidationIssue) => i.message) ?? []),
      ];

      return {
        type: 'architecture',
        nodes: data.nodes,
        edges: data.edges,
        metadata: {
          totalNodes: data.nodes.length,
          totalEdges: data.edges.length,
          systemType: 'architecture',
          generatedAt: new Date().toISOString(),
          score: data.score,
          grade: (data.diagramScore?.grade === 'F' ? 'D' : data.diagramScore?.grade || 'D') as 'A' | 'B' | 'C' | 'D',
          qualityWarnings: qualityWarnings.length > 0 ? qualityWarnings : undefined,
          pipelineDiagnostics: data.diagnostics,
          diagramType: data.diagramType,
          styleTheme: data.diagnostics?.style || 'default',
          // Signal whether the result came from the hardcoded fallback or if
          // the user's existing diagram context was silently dropped, so API
          // callers can warn rather than silently serving a stale result.
          usedFallback: data.usedFallback,
          droppedExistingContext: data.droppedExistingContext,
        },
      };
    } catch (error) {
      const store = requestContext.getStore();
      logger.error(`[Orchestrator] [${requestId}] Generation failed after ${store?.logicalCalls ?? '?'} logical / ${store?.networkAttempts ?? '?'} network calls:`, error);
      onProgress?.({
        phase: 'error',
        iteration: 0,
        currentAgent: 'pipeline',
        score: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
        progress: 100
      });
      throw error;
    }
  });
}

export class GenerationFailedError extends Error {
  code = 'generation_failed' as const;

  constructor(details: string) {
    super(details);
    this.name = 'GenerationFailedError';
  }
}

function phaseForStep(step: string): GenerationProgress['phase'] {
  const lower = step.toLowerCase();
  // Map to actual stage names from AI pipeline
  if (lower === 'concept-detection') return 'planning';
  if (lower === 'architecture-planning' || lower === 'planning-orchestrator') return 'planning';
  if (lower === 'layout-override') return 'layout';
  if (lower === 'mermaid-materialize') return 'generating';
  if (lower === 'scoring') return 'scoring';
  if (lower === 'validation') return 'validating';
  // Fallback mappings for backward compatibility
  if (lower.includes('reason')) return 'reasoning';
  if (lower.includes('layout')) return 'layout';
  if (lower.includes('edge') || lower.includes('connect')) return 'edges';
  if (lower.includes('validat') || lower.includes('repair')) return 'validating';
  if (lower.includes('scor')) return 'scoring';
  if (lower.includes('generat') || lower.includes('enrich')) return 'generating';
  return 'planning';
}
