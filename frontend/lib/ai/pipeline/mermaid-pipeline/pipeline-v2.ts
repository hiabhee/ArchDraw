import { Pipeline, pipelineStages, toDomainResult } from '@/lib/pipeline-core';
import type { DomainPipelineResult } from '@/lib/pipeline-core';
import { successResult, errorResult } from '@/lib/pipeline-core/StageResult';
import type { StageResult } from '@/lib/pipeline-core/StageResult';
import type { Stage } from '@/lib/pipeline-core/Stage';
import type { PipelineContext } from '@/lib/pipeline-core/PipelineContext';
import type { PipelineResult as CorePipelineResult } from '@/lib/pipeline-core/PipelineResult';
import type { UserIntent, ReactFlowNode, ReactFlowEdge, LayerType, ServiceType } from '../../types';
import type { ArchitectureStyle, DiagramScore, PipelineDiagnostics, ValidationIssue } from '../types';
import type { PipelineResult, PipelineState } from './types';
import type { RFNode, RFEdge } from '@/lib/mermaid/types';
import type { ArchitectureEdge } from '../../types';
import { ConceptDetectionStage } from './stages/ConceptDetectionStage';
import type { ConceptDetectionOutput } from './stages/ConceptDetectionStage';
import { ArchitecturePlanningStage } from './stages/ArchitecturePlanningStage';
import type { ArchitecturePlan, ArchitecturePlanningInput } from './stages/ArchitecturePlanningStage';
import { LayoutOverrideStage } from './stages/LayoutOverrideStage';
import { MermaidMaterializeStage } from './stages/MermaidMaterializeStage';
import type { MermaidMaterializeOutput } from './stages/MermaidMaterializeStage';
import { ScoreStage } from './stages/ScoreStage';
import type { ScoreOutput } from './stages/ScoreStage';
import { ValidationStage } from './stages/ValidationStage';
import type { ValidationOutput } from './stages/ValidationStage';

export interface AiPipelineData {
  userIntent: UserIntent;
  prompt: string;
  diagramSize: 'small' | 'medium' | 'large';
  detailLevel: 1 | 2 | 3;
  conceptDetection: ConceptDetectionOutput;
  plan: ArchitecturePlan;
  parseOutput: MermaidMaterializeOutput;
  scoreOutput: ScoreOutput;
  validationOutput: ValidationOutput;
}

const createStages = (): Stage<UserIntent, AiPipelineData>[] => {
  const conceptDetectionStage = new ConceptDetectionStage();
  const architecturePlanningStage = new ArchitecturePlanningStage();
  const layoutOverrideStage = new LayoutOverrideStage();
  const mermaidMaterializeStage = new MermaidMaterializeStage();
  const scoreStage = new ScoreStage();
  const validationStage = new ValidationStage();

  return pipelineStages<UserIntent, AiPipelineData>(
    {
      name: 'concept-detection',
      description: 'Detect implicit concepts from prompt',
      weight: 1,
      async execute(userIntent: UserIntent, context: PipelineContext): Promise<StageResult<AiPipelineData>> {
        const prompt = userIntent.description;
        const diagramSize = userIntent.diagramSize ?? 'medium';
        const detailLevel = userIntent.detailLevel ?? 2;
        const conceptResult = await conceptDetectionStage.execute(prompt, context);
        if (!conceptResult.success || !conceptResult.data) {
          return errorResult(conceptResult.error ?? new Error('Concept detection failed'), conceptResult.warnings);
        }
        return successResult({
          userIntent,
          prompt,
          diagramSize,
          detailLevel,
          conceptDetection: conceptResult.data,
          plan: {} as ArchitecturePlan,
          parseOutput: {} as MermaidMaterializeOutput,
          scoreOutput: {} as ScoreOutput,
          validationOutput: {} as ValidationOutput,
        });
      },
    },
    {
      name: 'planning-orchestrator',
      description: 'Orchestrate architecture planning with concept detection',
      weight: 5,
      async execute(data: AiPipelineData, context: PipelineContext): Promise<StageResult<AiPipelineData>> {
        const planningInput: ArchitecturePlanningInput = {
          prompt: data.prompt,
          diagramSize: data.diagramSize,
          detailLevel: data.detailLevel,
          model: data.userIntent.model,
          existingContext: data.userIntent.existingContext,
          conceptDetection: data.conceptDetection,
        };
        const planResult = await architecturePlanningStage.execute(planningInput, context);
        if (!planResult.success || !planResult.data) {
          return errorResult(planResult.error ?? new Error('Architecture planning failed'), planResult.warnings);
        }
        return successResult({ ...data, plan: planResult.data });
      },
    },
    {
      name: 'layout-override',
      description: 'Apply layout direction overrides',
      weight: 1,
      async execute(data: AiPipelineData, context: PipelineContext): Promise<StageResult<AiPipelineData>> {
        const result = await layoutOverrideStage.execute({ plan: data.plan, conceptDetection: data.conceptDetection }, context);
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Layout override failed'), result.warnings);
        }
        return successResult({ ...data, plan: result.data });
      },
    },
    {
      name: 'mermaid-materialize',
      description: 'Materialize mermaid plan (parse, retry, fallback)',
      weight: 3,
      async execute(data: AiPipelineData, context: PipelineContext): Promise<StageResult<AiPipelineData>> {
        const parseInput = {
          plan: data.plan,
          prompt: data.prompt,
          diagramSize: data.diagramSize,
          detailLevel: data.detailLevel,
          model: data.userIntent.model,
        };
        const result = await mermaidMaterializeStage.execute(parseInput, context);
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Mermaid materialize failed'), result.warnings);
        }
        return successResult({ ...data, parseOutput: result.data });
      },
    },
    {
      name: 'scoring',
      description: 'Score the diagram',
      weight: 1,
      async execute(data: AiPipelineData, context: PipelineContext): Promise<StageResult<AiPipelineData>> {
        const scoreInput = {
          nodes: data.parseOutput.nodes,
          edges: data.parseOutput.edges,
          diagramSize: data.diagramSize,
          detailLevel: data.detailLevel,
          styleTheme: data.plan.styleConfig.theme,
          prompt: data.prompt,
          stylePlan: {
            style: data.plan.styleConfig.theme as ArchitectureStyle,
            strictness: 'explicit' as const,
            productionDepth: 'conceptual' as const,
          },
        };
        const result = await scoreStage.execute(scoreInput, context);
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Scoring failed'), result.warnings);
        }
        return successResult({ ...data, scoreOutput: result.data });
      },
    },
    {
      name: 'validation',
      description: 'Validate diagram quality',
      weight: 1,
      async execute(data: AiPipelineData, context: PipelineContext): Promise<StageResult<AiPipelineData>> {
        const validationInput = {
          nodes: data.parseOutput.nodes,
          edges: data.parseOutput.edges,
          reasoning: data.plan.reasoning,
          diagramSize: data.diagramSize,
          detailLevel: data.detailLevel,
          parseWarnings: data.parseOutput.parseWarnings,
        };
        const result = await validationStage.execute(validationInput, context);
        if (!result.success || !result.data) {
          return errorResult(result.error ?? new Error('Validation failed'), result.warnings);
        }
        return successResult({ ...data, validationOutput: result.data });
      },
    },
  );
};

function toReactFlowNode(n: RFNode): ReactFlowNode {
  const parentId = n.parentNode || (n.data?.parentId as string | undefined);
  return {
    id: n.id,
    type: n.type,
    position: n.position,
    parentId,
    data: {
      label: (n.data?.label as string) || n.id,
      icon: (n.data?.icon as string) || '',
      layer: (n.data?.layer as LayerType) || 'application',
      layerIndex: n.data?.layerIndex as number | undefined,
      isGroup: n.data?.isGroup as boolean | undefined,
      parentId,
      groupLabel: n.data?.groupLabel as string | undefined,
      groupColor: n.data?.groupColor as string | undefined,
      serviceType: n.data?.serviceType as ServiceType | undefined,
      tier: n.data?.tier as string | undefined,
    },
    extent: n.extent,
    width: n.width,
    height: n.height,
    measured: n.width && n.height ? { width: n.width, height: n.height } : undefined,
    style: n.style as ReactFlowNode['style'],
    zIndex: n.zIndex,
  };
}

function toReactFlowEdge(e: RFEdge): ReactFlowEdge {
  const d = (e.data || {}) as Record<string, unknown>;
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: (e.sourceHandle as ReactFlowEdge['sourceHandle']) || null,
    targetHandle: (e.targetHandle as ReactFlowEdge['targetHandle']) || null,
    type: e.type || 'default',
    animated: e.animated || false,
    label: e.label || '',
    labelShowBg: (d.labelShowBg as boolean) || false,
    labelBgPadding: (d.labelBgPadding as [number, number]) || [8, 4],
    labelBgBorderRadius: (d.labelBgBorderRadius as number) || 4,
    labelBgStyle: (d.labelBgStyle as ReactFlowEdge['labelBgStyle']) || { fill: '#ffffff' },
    labelStyle: (d.labelStyle as ReactFlowEdge['labelStyle']) || { fontSize: 12, fontWeight: 400, fill: '#64748b' },
    style: (d.style as ReactFlowEdge['style']) || { stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: 'none' },
    markerEnd: (d.markerEnd as ReactFlowEdge['markerEnd']) || { type: 'arrowclosed', color: '#94a3b8' },
    data: {
      communicationType: (d.communicationType as ReactFlowEdge['data']['communicationType']) || 'sync',
      pathType: (d.pathType as ReactFlowEdge['data']['pathType']) || 'straight',
      label: e.label || '',
      edgeVariant: d.edgeVariant as ReactFlowEdge['data']['edgeVariant'],
      labelX: d.labelX as number | undefined,
      labelY: d.labelY as number | undefined,
      labelAngle: d.labelAngle as number | undefined,
      waypoints: d.waypoints as ReactFlowEdge['data']['waypoints'],
    },
  };
}

export async function runAiMermaidPipelineV2(
  userIntent: UserIntent,
  onProgress?: (step: string, progress: number) => void
): Promise<DomainPipelineResult<PipelineResult>> {
  const prompt = userIntent.description;
  const diagramSize = userIntent.diagramSize ?? 'medium';
  const detailLevel = userIntent.detailLevel ?? 2;

  const pipeline = new Pipeline<UserIntent, AiPipelineData>('ai-mermaid-pipeline-v2', createStages());

  const result: CorePipelineResult<AiPipelineData> = await pipeline.execute(userIntent, {
    onProgress: (stage: string, _progress: number, _message: string) => {
      onProgress?.(stage, _progress);
    },
  });

  const domainResult = toDomainResult(result);

  if (!domainResult.success) {
    return domainResult;
  }

  const { parseOutput, plan, scoreOutput, validationOutput } = domainResult.data;

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
    rawNodes: parseOutput.nodes.map(n => ({
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
    enrichedNodes: parseOutput.nodes.map(n => ({
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

  // Create a set of valid node IDs for parent validation
  const validNodeIds = new Set(parseOutput.nodes.map(n => n.id));
  
  // Validate parent references before conversion
  const toReactFlowNodeSafe = (n: RFNode): ReactFlowNode => {
    const parentId = n.parentNode || (n.data?.parentId as string | undefined);
    const isValidParent = parentId && validNodeIds.has(parentId);
    
    const result = toReactFlowNode(n);
    
    // Only set parentId and extent if parent actually exists
    if (!isValidParent) {
      result.parentId = undefined;
      result.extent = undefined;
    }
    
    return result;
  };

  const pipelineResult: PipelineResult = {
    success: true,
    nodes: parseOutput.nodes.map(toReactFlowNodeSafe),
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
