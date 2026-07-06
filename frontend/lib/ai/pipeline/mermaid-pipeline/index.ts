import logger from '@/lib/logger';
import type {
  UserIntent,
  ReactFlowNode,
  ArchitectureEdge,
  LayerType,
} from '../../types';
import type {
  ArchitectureStyle,
  DiagramScore,
  PipelineDiagnostics,
} from '../types';
import type { PipelineResult, PipelineState } from './types';
import { runArchitecturePlanner } from './stage1-planner';
import { runMermaidPipeline as parseMermaidToReactFlow } from '@/lib/mermaid/pipeline';
import { scoreDiagram } from '../stage8-score';

function generateFallbackPlan(prompt: string) {
  const mermaidCode = `graph LR
  subgraph CLIENT["Client Layer"]
    user["User"]
  end
  subgraph API["API Layer"]
    gateway["API Gateway"]
  end
  subgraph SERVICE["Service Layer"]
    service["Service"]
  end
  subgraph DATA["Data Layer"]
    database[("Database")]
  end
  user -->|request| gateway
  gateway -->|route| service
  service -->|query| database`;

  return {
    formatConfig: {
      format: 'mermaid' as const,
      diagramType: 'graph LR' as const,
      optionalVariants: [],
    },
    styleConfig: {
      primaryColor: '#2563EB',
      secondaryColor: '#4F46E5',
      background: '#F9FAFB',
      backgroundColor: '#F9FAFB',
      fontFamily: 'Inter',
      theme: 'default',
      nodeTypeStyles: {
        client: '#2563EB',
        edge: '#4F46E5',
        gateway: '#4F46E5',
        application: '#4F46E5',
        data: '#1e293b',
        queue: '#1e293b',
        observability: '#475569',
        external: '#64748b',
      },
    },
    mermaidCode,
  };
}

export async function runMermaidPipeline(
  userIntent: UserIntent,
  onProgress?: (step: string, progress: number) => void
): Promise<PipelineResult> {
  const diagramSize = userIntent.diagramSize ?? 'medium';
  const prompt = userIntent.description;

  onProgress?.('Planning architecture', 10);

  // A1.5: Downstream guard check
  const promptLower = prompt.toLowerCase();

  // STAGE 1: Planner — single LLM call to plan diagram in Mermaid syntax
  let plan = await runArchitecturePlanner(prompt, diagramSize, userIntent.model);
  let { formatConfig, styleConfig, mermaidCode } = plan;

  // Layout override
  const isVerticalRequested = promptLower.includes('vertical') || promptLower.includes('vertically') || promptLower.includes('top-to-bottom') || promptLower.includes('top to bottom') || promptLower.includes('graph td') || promptLower.includes('graph tb') || promptLower.includes('vertical layout');

  if (isVerticalRequested) {
    logger.info('[DownstreamGuard] Override: vertical layout requested. Forcing graph TD.');
    formatConfig.diagramType = 'graph TD';
    mermaidCode = mermaidCode.replace(/^graph LR/m, 'graph TD');
  } else {
    logger.info('[DownstreamGuard] Forcing default layout to horizontal (graph LR).');
    formatConfig.diagramType = 'graph LR';
    mermaidCode = mermaidCode.replace(/^graph TD/m, 'graph LR');
  }

  onProgress?.('Parsing and laying out diagram', 50);

  let parseResult = parseMermaidToReactFlow(mermaidCode);

  // Retry once if planner returned no nodes or parsing failed
  if (!parseResult.success || parseResult.nodes.length === 0) {
    logger.warn('[Pipeline] Planner failed or returned 0 nodes. Retrying with stronger instructions...');
    const retryPrompt = `${prompt}\n\nIMPORTANT: Generate valid, complete Mermaid flowchart code containing at least 3-6 components.`;
    plan = await runArchitecturePlanner(retryPrompt, diagramSize, userIntent.model);
    ({ formatConfig, styleConfig, mermaidCode } = plan);
    if (isVerticalRequested) {
      mermaidCode = mermaidCode.replace(/^graph LR/m, 'graph TD');
    } else {
      mermaidCode = mermaidCode.replace(/^graph TD/m, 'graph LR');
    }
    parseResult = parseMermaidToReactFlow(mermaidCode);
  }

  // Fallback to default plan if still empty
  if (!parseResult.success || parseResult.nodes.length === 0) {
    logger.warn('[Pipeline] Parser still returned 0 nodes. Using fallback plan.');
    plan = generateFallbackPlan(prompt);
    ({ formatConfig, styleConfig, mermaidCode } = plan);
    if (isVerticalRequested) {
      mermaidCode = mermaidCode.replace(/^graph LR/m, 'graph TD');
    } else {
      mermaidCode = mermaidCode.replace(/^graph TD/m, 'graph LR');
    }
    parseResult = parseMermaidToReactFlow(mermaidCode);
  }

  const rfNodes = parseResult.nodes;
  const rfEdges = parseResult.edges;

  onProgress?.('Scoring diagram', 80);

  const stylePlan = {
    style: styleConfig.theme as ArchitectureStyle,
    strictness: 'explicit' as const,
    productionDepth: 'conceptual' as const,
  };

  onProgress?.('Complete', 100);

  const diagramScore = scoreDiagram(rfNodes as any, rfEdges as any, {
    nodesRemoved: 0,
    edgesRemoved: 0,
    diagramSize,
    stylePlan,
    prompt: userIntent.description,
  });

  // PipelineState & Diagnostics for compatibility
  const pipelineDiagnostics: PipelineDiagnostics = {
    style: styleConfig.theme as any,
    productionDepth: 'conceptual',
    semanticIssues: [],
    mechanicalRepairs: [],
    removedInvalidEdgeIds: [],
    rejectedAutoInjection: true,
  };

  const state: PipelineState = {
    userIntent,
    rawNodes: rfNodes.map((n) => ({
      id: n.id,
      type: n.type || 'shapeNode',
      position: n.position || { x: 0, y: 0 },
      label: n.data?.label || '',
      layer: (n.data?.layer || 'compute') as LayerType,
      icon: n.data?.icon || 'box',
      subtitle: n.data?.subtitle,
      serviceType: n.data?.serviceType,
      width: n.width || 180,
      height: 70,
      metadata: {},
    })),
    enrichedNodes: rfNodes.map((n) => ({
      id: n.id,
      type: n.type || 'shapeNode',
      position: n.position || { x: 0, y: 0 },
      label: n.data?.label || '',
      layer: (n.data?.layer || 'compute') as LayerType,
      icon: n.data?.icon || 'box',
      subtitle: n.data?.subtitle,
      serviceType: n.data?.serviceType,
      width: n.width || 180,
      height: 70,
      metadata: {},
    })),
    edges: rfEdges as any as ArchitectureEdge[],
    reactFlowNodes: rfNodes as ReactFlowNode[],
    graph: null,
    score: diagramScore.score,
    iteration: 0,
    history: [],
    errors: [],
    useAWS: false,
    systemIntent: { primary: [], useAWS: false, useAzure: false, useGCP: false },
    pipelineDiagnostics,
  };

  return {
    success: true,
    nodes: rfNodes as ReactFlowNode[],
    edges: rfEdges as any as ArchitectureEdge[],
    state,
    score: diagramScore.score,
    diagramScore: diagramScore as DiagramScore,
    diagnostics: pipelineDiagnostics,
    diagramType: formatConfig.diagramType,
  };
}
