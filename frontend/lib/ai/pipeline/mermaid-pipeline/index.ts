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
  ValidationIssue,
} from '../types';
import type { PipelineResult, PipelineState } from './types';
import type { RFNode } from '@/lib/mermaid/types';
import type { Node as RFNodeType, Edge as RFEdgeType } from 'reactflow';
import { runArchitecturePlanner } from './stage1-planner';
import { runMermaidPipeline as parseMermaidToReactFlow } from '@/lib/mermaid/pipeline';
import { scoreDiagram } from '../stage8-score';
import { classifyNode } from '@/lib/mermaid/planTranslator';
import { detectImplicitConceptPrompt, getConceptTemplatePlan } from './conceptTemplates';

function validateReasoningField(reasoning?: string, nodesCount?: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!reasoning || reasoning.trim().length < 50) {
    issues.push({
      severity: 'warning',
      type: 'REASONING_MISSING',
      message: 'Step-by-step architectural reasoning is missing or too short.'
    });
    return issues;
  }

  // Check steps 0 to 7 are mentioned
  const steps = [0, 1, 2, 3, 4, 5, 6, 7];
  const missingSteps = steps.filter(step => !reasoning.includes(`Step ${step}`));
  if (missingSteps.length > 0) {
    issues.push({
      severity: 'warning',
      type: 'REASONING_INCOMPLETE',
      message: `Architectural reasoning is missing explicit step check(s): ${missingSteps.map(s => `Step ${s}`).join(', ')}`
    });
  }

  // Try to parse reasoning's node counts and verify consistency
  const match = reasoning.toLowerCase().match(/(\d+)\s+nodes?/);
  if (match && nodesCount !== undefined) {
    const reasonedCount = parseInt(match[1], 10);
    if (reasonedCount !== nodesCount) {
      issues.push({
        severity: 'warning',
        type: 'REASONING_CONTRADICTION',
        message: `Reasoning mentions ${reasonedCount} nodes, but generated diagram has ${nodesCount} nodes.`
      });
    }
  }

  return issues;
}

function validateTopologyAndSize(
  nodes: RFNode[],
  edges: ArchitectureEdge[],
  diagramSize: 'small' | 'medium' | 'large',
  detailLevel: 1 | 2 | 3 = 2
): { semanticIssues: ValidationIssue[]; mechanicalRepairs: ValidationIssue[] } {
  const semanticIssues: ValidationIssue[] = [];
  const mechanicalRepairs: ValidationIssue[] = [];

  const maxNodes = detailLevel === 1 ? 7 : detailLevel === 2 ? 12 : 20;
  const leafNodes = nodes.filter(n => n.type !== 'groupNode' && n.type !== 'frameNode');

  // Size limit check
  if (leafNodes.length > maxNodes) {
    semanticIssues.push({
      severity: 'warning',
      type: 'SIZE_EXCEEDED',
      message: `Node count (${leafNodes.length}) exceeds the maximum limit of ${maxNodes} for "${diagramSize}" size.`
    });
  }

  // Helper to resolve node labels for classification
  const nodeClassifications = new Map<string, string>();
  for (const n of leafNodes) {
    const label = (n.data?.label as string) || n.id;
    const parentNode = n.parentNode;
    const parentLabel = parentNode ? (nodes.find(parent => parent.id === parentNode)?.data?.label as string) || parentNode : undefined;
    const classification = classifyNode(label, parentLabel);
    nodeClassifications.set(n.id, classification.serviceType);
  }

  // Topology validation
  const connectedNodes = new Set<string>();
  for (const edge of edges) {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);

    const sourceKind = nodeClassifications.get(edge.source);
    const targetKind = nodeClassifications.get(edge.target);

    // Client as target check
    if (targetKind === 'client') {
      const labelLower = (edge.label || '').toLowerCase();
      const isResponseFlow = labelLower.includes('response') || labelLower.includes('return') || labelLower.includes('reply') || labelLower.includes('ack') || labelLower.includes('callback') || labelLower.includes('data');
      if (!isResponseFlow) {
        semanticIssues.push({
          severity: 'warning',
          type: 'CLIENT_AS_TARGET',
          nodeId: edge.target,
          message: `Client component "${nodes.find(n => n.id === edge.target)?.data?.label || edge.target}" should not be the target of an incoming request flow (incoming from "${nodes.find(n => n.id === edge.source)?.data?.label || edge.source}").`
        });
      }
    }

    // Gateway direct to database/queue check
    if (sourceKind === 'load-balancer' && (targetKind === 'database' || targetKind === 'queue')) {
      semanticIssues.push({
        severity: 'warning',
        type: 'DIRECT_GATEWAY_TO_DATA',
        nodeId: edge.source,
        message: `Gateway/LB "${nodes.find(n => n.id === edge.source)?.data?.label || edge.source}" routes directly to data/queue "${nodes.find(n => n.id === edge.target)?.data?.label || edge.target}". LBs should only route to compute services.`
      });
    }
  }

  // Orphan node check
  for (const n of leafNodes) {
    if (!connectedNodes.has(n.id)) {
      semanticIssues.push({
        severity: 'warning',
        type: 'ORPHAN_NODE',
        nodeId: n.id,
        message: `Component "${n.data?.label || n.id}" has no connections to the rest of the architecture.`
      });
    }
  }

  return { semanticIssues, mechanicalRepairs };
}

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
  const detailLevel = userIntent.detailLevel ?? 2;
  const prompt = userIntent.description;

  onProgress?.('Planning architecture', 10);

  // A1.5: Downstream guard check
  const promptLower = prompt.toLowerCase();
  const implicitConcept = detectImplicitConceptPrompt(prompt);

  // STAGE 1: Planner — single LLM call to plan diagram in Mermaid syntax
  let plan = implicitConcept
    ? getConceptTemplatePlan(implicitConcept)
    : await runArchitecturePlanner(prompt, diagramSize, detailLevel, userIntent.model);
  let { formatConfig, styleConfig, mermaidCode, reasoning } = plan;

  // Layout override
  const isVerticalRequested = promptLower.includes('vertical') || promptLower.includes('vertically') || promptLower.includes('top-to-bottom') || promptLower.includes('top to bottom') || promptLower.includes('graph td') || promptLower.includes('graph tb') || promptLower.includes('vertical layout');

  if (implicitConcept) {
    logger.info(`[ConceptTemplate] Using implicit concept compiler: ${implicitConcept.subject} (${implicitConcept.domain})`);
    formatConfig.diagramType = 'graph TD';
    mermaidCode = mermaidCode.replace(/^graph LR/m, 'graph TD');
  } else if (isVerticalRequested) {
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
    plan = await runArchitecturePlanner(retryPrompt, diagramSize, detailLevel, userIntent.model);
    ({ formatConfig, styleConfig, mermaidCode, reasoning } = plan);
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

  const diagramScore = scoreDiagram(rfNodes as unknown as RFNodeType[], rfEdges as unknown as RFEdgeType[], {
    nodesRemoved: 0,
    edgesRemoved: 0,
    diagramSize,
    detailLevel,
    stylePlan,
    prompt: userIntent.description,
  });

  // Run validators
  const reasoningIssues = validateReasoningField(reasoning, rfNodes.filter(n => n.type !== 'groupNode' && n.type !== 'frameNode').length);
  const topologyIssues = validateTopologyAndSize(rfNodes, rfEdges as unknown as ArchitectureEdge[], diagramSize, detailLevel);

  // Layout issues from parser warnings
  const parserSemanticIssues: ValidationIssue[] = [];
  const parserMechanicalIssues: ValidationIssue[] = [];
  for (const warnStr of parseResult.warnings || []) {
    const match = warnStr.match(/^\[([A-Z_]+)\]\s*(.*)$/);
    if (match) {
      const type = match[1];
      const message = match[2];
      if (type === 'LAYOUT_DIRECTION_FAILURE' || type === 'ORPHANED_NODE') {
        parserSemanticIssues.push({
          severity: 'warning',
          type,
          message
        });
      } else {
        parserMechanicalIssues.push({
          severity: 'warning',
          type,
          message
        });
      }
    } else {
      parserMechanicalIssues.push({
        severity: 'warning',
        type: 'PARSER_WARNING',
        message: warnStr
      });
    }
  }

  const semanticIssues = [
    ...reasoningIssues,
    ...topologyIssues.semanticIssues,
    ...parserSemanticIssues
  ];
  const mechanicalRepairs = [
    ...topologyIssues.mechanicalRepairs,
    ...parserMechanicalIssues
  ];

  // PipelineState & Diagnostics for compatibility
  const pipelineDiagnostics: PipelineDiagnostics = {
    style: styleConfig.theme as ArchitectureStyle,
    productionDepth: 'conceptual',
    semanticIssues,
    mechanicalRepairs,
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
    edges: rfEdges as unknown as ArchitectureEdge[],
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
    edges: rfEdges as unknown as ArchitectureEdge[],
    state,
    score: diagramScore.score,
    diagramScore: diagramScore as DiagramScore,
    diagnostics: pipelineDiagnostics,
    diagramType: formatConfig.diagramType,
  };
}
