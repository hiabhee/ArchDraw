import { Pipeline, toDomainResult } from '@/lib/pipeline-core';
import type { DomainPipelineResult } from '@/lib/pipeline-core';
import type { UserIntent, LayerType, ArchitectureEdge } from '../../types';
import type { ArchitectureStyle, DiagramScore, PipelineDiagnostics } from '../types';
import type { PipelineResult, PipelineState } from './types';
import { assertCompletedAiPipelineData, type AiPipelineData } from './aiPipelineTypes';
import { createAiMermaidStages } from './createAiMermaidStages';
import { toReactFlowEdge, toReactFlowNodeSafe } from './reactFlowConverters';

export type { AiPipelineData, CompletedAiPipelineData } from './aiPipelineTypes';
export { createAiMermaidStages } from './createAiMermaidStages';

export async function runAiMermaidPipelineV2(
  userIntent: UserIntent,
  onProgress?: (step: string, progress: number) => void
): Promise<DomainPipelineResult<PipelineResult>> {
  const pipeline = new Pipeline<UserIntent, AiPipelineData>('ai-mermaid-pipeline-v2', createAiMermaidStages());

  const result = await pipeline.execute(userIntent, {
    onProgress: (stage: string, progress: number) => {
      onProgress?.(stage, progress);
    },
  });

  const domainResult = toDomainResult(result);

  if (!domainResult.success) {
    return domainResult;
  }

  const completed = assertCompletedAiPipelineData(domainResult.data);
  const { parseOutput, plan, scoreOutput, validationOutput } = completed;

  const pipelineDiagnostics: PipelineDiagnostics = {
    style: plan.styleConfig.theme as ArchitectureStyle,
    productionDepth: 'conceptual',
    semanticIssues: validationOutput.semanticIssues,
    mechanicalRepairs: validationOutput.mechanicalRepairs,
    removedInvalidEdgeIds: [],
    rejectedAutoInjection: true,
  };

  const state: PipelineState = {
    userIntent,
    rawNodes: parseOutput.nodes.map((n) => ({
      id: n.id,
      type: n.type || 'shapeNode',
      position: n.position || { x: 0, y: 0 },
      label: n.data?.label || '',
      layer: (n.data?.layer || 'compute') as LayerType,
      icon: n.data?.icon || 'box',
      subtitle: n.data?.subtitle,
      serviceType: n.data?.serviceType,
      width: n.width || 200,
      height: 88,
      metadata: {},
    })),
    enrichedNodes: parseOutput.nodes.map((n) => ({
      id: n.id,
      type: n.type || 'shapeNode',
      position: n.position || { x: 0, y: 0 },
      label: n.data?.label || '',
      layer: (n.data?.layer || 'compute') as LayerType,
      icon: n.data?.icon || 'box',
      subtitle: n.data?.subtitle,
      serviceType: n.data?.serviceType,
      width: n.width || 200,
      height: 88,
      metadata: {},
    })),
    edges: parseOutput.edges as unknown as ArchitectureEdge[],
    reactFlowNodes: parseOutput.nodes,
    graph: null,
    score: scoreOutput.score,
    iteration: 0,
    history: [],
    errors: [],
    useAWS: false,
    systemIntent: { primary: [], useAWS: false, useAzure: false, useGCP: false },
    pipelineDiagnostics,
  };

  const validNodeIds = new Set(parseOutput.nodes.map((n) => n.id));

  const pipelineResult: PipelineResult = {
    success: true,
    nodes: parseOutput.nodes.map((n) => toReactFlowNodeSafe(n, validNodeIds)),
    edges: parseOutput.edges.map(toReactFlowEdge),
    state,
    score: scoreOutput.score,
    diagramScore: scoreOutput.diagramScore as DiagramScore,
    diagnostics: pipelineDiagnostics,
    diagramType: plan.formatConfig.diagramType,
    usedFallback: parseOutput.usedFallback,
    droppedExistingContext: parseOutput.droppedExistingContext,
  };

  return {
    success: true,
    data: pipelineResult,
    warnings: domainResult.warnings,
    metrics: domainResult.metrics,
  };
}
