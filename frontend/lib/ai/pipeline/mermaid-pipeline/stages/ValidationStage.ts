import { BaseStage, type StageResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import type { RFNode, RFEdge } from '@/lib/mermaid/types';
import type { ArchitectureEdge, LayerType, ServiceType } from '../../../types';
import type { ValidationIssue, ArchitectureStyle, DiagramScore } from '../../types';
import { classifyNode } from '@/lib/mermaid/planTranslator';
import { isTextNode } from '@/lib/mermaid/textNodes';

function validateReasoningField(reasoning?: string, nodesCount?: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!reasoning || reasoning.trim().length < 50) {
    issues.push({
      severity: 'warning',
      type: 'REASONING_MISSING',
      message: 'Step-by-step architectural reasoning is missing or too short.',
    });
    return issues;
  }

  const steps = [0, 1, 2, 3, 4, 5, 6, 7];
  const missingSteps = steps.filter(step => !reasoning.includes(`Step ${step}`));
  if (missingSteps.length > 0) {
    issues.push({
      severity: 'warning',
      type: 'REASONING_INCOMPLETE',
      message: `Architectural reasoning is missing explicit step check(s): ${missingSteps.map(s => `Step ${s}`).join(', ')}`,
    });
  }

  const match = reasoning.toLowerCase().match(/(\d+)\s+nodes?/);
  if (match && nodesCount !== undefined) {
    const reasonedCount = parseInt(match[1], 10);
    if (reasonedCount !== nodesCount) {
      issues.push({
        severity: 'warning',
        type: 'REASONING_CONTRADICTION',
        message: `Reasoning mentions ${reasonedCount} nodes, but generated diagram has ${nodesCount} nodes.`,
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
): ValidationIssue[] {
  const semanticIssues: ValidationIssue[] = [];
  const maxNodes = detailLevel === 1 ? 7 : detailLevel === 2 ? 12 : 20;
  const leafNodes = nodes.filter(n => n.type !== 'groupNode' && n.type !== 'frameNode' && !isTextNode(n));

  if (leafNodes.length > maxNodes) {
    semanticIssues.push({
      severity: 'warning',
      type: 'SIZE_EXCEEDED',
      message: `Node count (${leafNodes.length}) exceeds the maximum limit of ${maxNodes} for "${diagramSize}" size.`,
    });
  }

  const nodeClassifications = new Map<string, string>();
  for (const n of leafNodes) {
    const label = (n.data?.label as string) || n.id;
    const parentNode = n.parentNode;
    const parentLabel = parentNode
      ? (nodes.find(parent => parent.id === parentNode)?.data?.label as string) || parentNode
      : undefined;
    const classification = classifyNode(label, parentLabel);
    nodeClassifications.set(n.id, classification.serviceType);
  }

  const connectedNodes = new Set<string>();
  for (const edge of edges) {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);

    const sourceKind = nodeClassifications.get(edge.source);
    const targetKind = nodeClassifications.get(edge.target);

    if (targetKind === 'client') {
      const labelLower = (edge.label || '').toLowerCase();
      const isResponseFlow =
        labelLower.includes('response') ||
        labelLower.includes('return') ||
        labelLower.includes('reply') ||
        labelLower.includes('ack') ||
        labelLower.includes('callback') ||
        labelLower.includes('data');
      if (!isResponseFlow) {
        semanticIssues.push({
          severity: 'warning',
          type: 'CLIENT_AS_TARGET',
          nodeId: edge.target,
          message: `Client component "${nodes.find(n => n.id === edge.target)?.data?.label || edge.target}" should not be the target of an incoming request flow (incoming from "${nodes.find(n => n.id === edge.source)?.data?.label || edge.source}").`,
        });
      }
    }

    if (sourceKind === 'load-balancer' && (targetKind === 'database' || targetKind === 'queue')) {
      semanticIssues.push({
        severity: 'warning',
        type: 'DIRECT_GATEWAY_TO_DATA',
        nodeId: edge.source,
        message: `Gateway/LB "${nodes.find(n => n.id === edge.source)?.data?.label || edge.source}" routes directly to data/queue "${nodes.find(n => n.id === edge.target)?.data?.label || edge.target}". LBs should only route to compute services.`,
      });
    }
  }

  for (const n of leafNodes) {
    if (!connectedNodes.has(n.id)) {
      semanticIssues.push({
        severity: 'warning',
        type: 'ORPHAN_NODE',
        nodeId: n.id,
        message: `Component "${n.data?.label || n.id}" has no connections to the rest of the architecture.`,
      });
    }
  }

  return semanticIssues;
}

export interface ValidationInput {
  nodes: RFNode[];
  edges: RFEdge[];
  reasoning?: string;
  diagramSize: 'small' | 'medium' | 'large';
  detailLevel: 1 | 2 | 3;
  parseWarnings: string[];
}

export interface ValidationOutput {
  semanticIssues: ValidationIssue[];
  mechanicalRepairs: ValidationIssue[];
}

export class ValidationStage extends BaseStage<ValidationInput, ValidationOutput> {
  constructor() {
    super('validation', { description: 'Validate diagram quality', weight: 1 });
  }

  async execute(input: ValidationInput, _context: PipelineContext): Promise<StageResult<ValidationOutput>> {
    const reasoningIssues = validateReasoningField(
      input.reasoning,
      input.nodes.filter(n => n.type !== 'groupNode' && n.type !== 'frameNode' && !isTextNode(n)).length
    );

    const topologyIssues = validateTopologyAndSize(
      input.nodes,
      input.edges as unknown as ArchitectureEdge[],
      input.diagramSize,
      input.detailLevel
    );

    const parserSemanticIssues: ValidationIssue[] = [];
    const parserMechanicalIssues: ValidationIssue[] = [];

    for (const warnStr of input.parseWarnings || []) {
      const match = warnStr.match(/^\[([A-Z_]+)\]\s*(.*)$/);
      if (match) {
        const type = match[1];
        const message = match[2];
        if (type === 'LAYOUT_DIRECTION_FAILURE' || type === 'ORPHANED_NODE') {
          parserSemanticIssues.push({ severity: 'warning', type, message });
        } else {
          parserMechanicalIssues.push({ severity: 'warning', type, message });
        }
      } else {
        parserMechanicalIssues.push({ severity: 'warning', type: 'PARSER_WARNING', message: warnStr });
      }
    }

    return successResult({
      semanticIssues: [...reasoningIssues, ...topologyIssues, ...parserSemanticIssues],
      mechanicalRepairs: parserMechanicalIssues,
    });
  }
}
