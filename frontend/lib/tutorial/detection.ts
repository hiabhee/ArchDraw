import type { Node, Edge } from 'reactflow';
import type { ValidationRule } from './schema';
import logger from '@/lib/logger';

function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

function nodeTypeId(n: Node): string {
  return n.data?.componentType || n.data?.typeId || n.data?.componentId || n.type || '';
}

/**
 * Checks if a rule passes given the current canvas state.
 */
export function evaluateValidationRule(
  rule: ValidationRule,
  nodes: Node[],
  edges: Edge[]
): boolean {
  logger.log('[Detection] Evaluating rule:', rule);

  switch (rule.type) {
    case 'node_exists': {
      const targetLabel = rule.label ? normalize(rule.label) : '';
      const targetType = normalize(rule.nodeType);
      const result = nodes.some(n => {
        // Exact registry id — always present, most reliable
        if (n.data?.componentId === rule.nodeType) return true;
        const matchesLabel = !rule.label || normalize(n.data?.label || '') === targetLabel;
        const matchesType =
          normalize(nodeTypeId(n)) === targetType ||
          normalize(n.data?.category || '') === targetType ||
          normalize(n.data?.componentId || '') === targetType;
        return matchesLabel && matchesType;
      });
      logger.log('[Detection] node_exists:', { label: rule.label, nodeType: rule.nodeType, result });
      return result;
    }

    case 'node_count': {
      const target = normalize(rule.nodeType);
      const matches = nodes.filter(n => {
        // Exact registry id match
        if (n.data?.componentId === rule.nodeType) return true;
        const nType = nodeTypeId(n);
        const nCategory = n.data?.category || '';
        return normalize(nType) === target || normalize(nCategory) === target;
      });
      const result = matches.length >= rule.min;
      logger.log('[Detection] node_count:', { nodeType: rule.nodeType, found: matches.length, required: rule.min, result });
      return result;
    }

    case 'edge_exists': {
      const srcTarget = normalize(rule.source);
      const tgtTarget = normalize(rule.target);

      const sourceNodes = nodes.filter(n => 
        n.id === rule.source ||
        n.data?.componentId === rule.source ||
        n.data?.typeId === rule.source ||
        normalize(nodeTypeId(n)) === srcTarget ||
        normalize(n.data?.label || '') === srcTarget
      );
      const targetNodes = nodes.filter(n => 
        n.id === rule.target ||
        n.data?.componentId === rule.target ||
        n.data?.typeId === rule.target ||
        normalize(nodeTypeId(n)) === tgtTarget ||
        normalize(n.data?.label || '') === tgtTarget
      );

      if (sourceNodes.length === 0 || targetNodes.length === 0) {
        logger.log('[Detection] edge_exists: source or target not found');
        return false;
      }

      const result = edges.some(e => {
        const hasSource = sourceNodes.some(sn => sn.id === e.source);
        const hasTarget = targetNodes.some(tn => tn.id === e.target);
        return hasSource && hasTarget;
      });

      logger.log('[Detection] edge_exists:', { source: rule.source, target: rule.target, result });
      return result;
    }

    case 'edge_from_type': {
      const srcType = normalize(rule.sourceType);
      const tgtType = normalize(rule.targetType);

      const sourceNodes = nodes.filter(n => normalize(nodeTypeId(n)) === srcType);
      const targetNodes = nodes.filter(n => normalize(nodeTypeId(n)) === tgtType);

      if (sourceNodes.length === 0 || targetNodes.length === 0) {
        return false;
      }

      const result = edges.some(e => {
        const hasSource = sourceNodes.some(sn => sn.id === e.source);
        const hasTarget = targetNodes.some(tn => tn.id === e.target);
        return hasSource && hasTarget;
      });

      logger.log('[Detection] edge_from_type:', { sourceType: rule.sourceType, targetType: rule.targetType, result });
      return result;
    }

    case 'all_of': {
      const result = rule.rules.every(r => evaluateValidationRule(r, nodes, edges));
      logger.log('[Detection] all_of result:', result);
      return result;
    }

    case 'any_of': {
      const result = rule.rules.some(r => evaluateValidationRule(r, nodes, edges));
      logger.log('[Detection] any_of result:', result);
      return result;
    }

    default:
      return false;
  }
}

/**
 * Validates a list of rules and returns those that failed.
 */
export function validateRules(
  rules: ValidationRule[],
  nodes: Node[],
  edges: Edge[]
): { passed: boolean; unmetRules: ValidationRule[] } {
  const unmetRules = rules.filter(rule => !evaluateValidationRule(rule, nodes, edges));
  return {
    passed: unmetRules.length === 0,
    unmetRules,
  };
}
