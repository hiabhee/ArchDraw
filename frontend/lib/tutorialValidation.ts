import type { Node, Edge } from 'reactflow';
import type { TutorialStep as SchemaTutorialStep, ValidationRule } from '@/lib/tutorial/schema';
import { evaluateValidationRule } from '@/lib/tutorial/detection';

function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function nodeTypeId(n: Node): string {
  return n.data?.componentType || n.data?.typeId || n.data?.componentId || n.type || '';
}

/**
 * Generate a human-readable error message from an unmet ValidationRule.
 */
function describeUnmetRule(rule: ValidationRule): string {
  switch (rule.type) {
    case 'node_exists': {
      const name = rule.label ?? rule.nodeType.replace(/_/g, ' ');
      return `Add the "${name}" component to your canvas (press ⌘K to search).`;
    }
    case 'edge_exists': {
      const src = rule.source.replace(/_/g, ' ');
      const tgt = rule.target.replace(/_/g, ' ');
      return `Connect "${src}" → "${tgt}" by drawing an edge between them.`;
    }
    case 'node_count': {
      const name = rule.nodeType.replace(/_/g, ' ');
      return `You need at least ${rule.min} "${name}" component(s) on your canvas.`;
    }
    case 'edge_from_type': {
      const src = rule.sourceType.replace(/_/g, ' ');
      const tgt = rule.targetType.replace(/_/g, ' ');
      return `Connect a "${src}" to a "${tgt}".`;
    }
    case 'all_of': {
      for (const sub of rule.rules) {
        const msg = describeUnmetRule(sub);
        if (msg) return msg;
      }
      return 'Complete all required actions.';
    }
    case 'any_of': {
      return 'Complete at least one of the required actions.';
    }
    default:
      return 'Step incomplete. Follow the instructions above.';
  }
}

/**
 * Validate a step using schema-based ValidationRule[] (builder-generated steps).
 */
function validateSchemaStep(
  step: SchemaTutorialStep,
  nodes: Node[],
  edges: Edge[]
): { valid: boolean; message: string } {
  const rules = step.validation;
  if (!rules || rules.length === 0) {
    return { valid: true, message: 'Great job!' };
  }

  const unmet = rules.filter(rule => !evaluateValidationRule(rule, nodes, edges));
  if (unmet.length === 0) {
    return { valid: true, message: 'Great job!' };
  }

  // Return the first unmet rule's descriptive message
  return {
    valid: false,
    message: describeUnmetRule(unmet[0]),
  };
}

/**
 * Main validation entry point. Validates schema-based steps (all 22 tutorials).
 */
export function validateStep(
  step: SchemaTutorialStep,
  nodes: Node[],
  edges: Edge[]
): { valid: boolean; message: string } {
  return validateSchemaStep(step, nodes, edges);
}

export interface StepRequirements {
  /** nodeType strings that need to exist on canvas (e.g. "api_gateway") */
  requiredNodeTypes: string[];
  /** Display labels for required nodes (e.g. "API Gateway") */
  requiredNodeLabels: string[];
  /** Edge requirements: source label → target label */
  requiredEdges: Array<{ source: string; target: string; sourceLabel: string; targetLabel: string }>;
}

/**
 * Extract what the current step requires from the canvas, for use by
 * GuidePanel (hints) and TutorialCanvas (highlighting).
 */
export function getStepRequirements(step: SchemaTutorialStep): StepRequirements {
  const result: StepRequirements = {
    requiredNodeTypes: [],
    requiredNodeLabels: [],
    requiredEdges: [],
  };

  extractSchemaRequirements(step.validation, result);

  return result;
}

function extractSchemaRequirements(rules: ValidationRule[], out: StepRequirements): void {
  for (const rule of rules) {
    switch (rule.type) {
      case 'node_exists':
        out.requiredNodeTypes.push(rule.nodeType);
        out.requiredNodeLabels.push(rule.label ?? rule.nodeType.replace(/_/g, ' '));
        break;
      case 'edge_exists':
        out.requiredEdges.push({
          source: rule.source,
          target: rule.target,
          sourceLabel: rule.source.replace(/_/g, ' '),
          targetLabel: rule.target.replace(/_/g, ' '),
        });
        break;
      case 'all_of':
      case 'any_of':
        extractSchemaRequirements(rule.rules, out);
        break;
      default:
        break;
    }
  }
}

/**
 * Check whether a specific nodeType requirement is already met.
 */
export function isNodeTypeMet(nodeType: string, nodes: Node[]): boolean {
  const target = normalize(nodeType);
  return nodes.some(n => {
    const nType = normalize(nodeTypeId(n));
    const nCategory = normalize(n.data?.category || '');
    const nLabel = normalize(n.data?.label || '');
    return nType === target || nCategory === target || nLabel === target;
  });
}

/**
 * Check whether a specific edge requirement is already met.
 */
export function isEdgeMet(source: string, target: string, nodes: Node[], edges: Edge[]): boolean {
  const srcTarget = normalize(source);
  const tgtTarget = normalize(target);

  const sourceNodes = nodes.filter(n =>
    normalize(nodeTypeId(n)) === srcTarget ||
    normalize(n.data?.label || '') === srcTarget
  );
  const targetNodes = nodes.filter(n =>
    normalize(nodeTypeId(n)) === tgtTarget ||
    normalize(n.data?.label || '') === tgtTarget
  );

  return edges.some(e =>
    sourceNodes.some(sn => sn.id === e.source) &&
    targetNodes.some(tn => tn.id === e.target)
  );
}
