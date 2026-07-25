/** @deprecated All 22 tutorials use schema.ts + builder.ts. Do not use. */
import type { 
  ValidationFn, 
  ValidationResult, 
  ValidationError,
  ArchitectureGraph,
  ComponentMatcher,
  ActionIntent,
} from './types';

function error(code: string, message: string, hint?: string): ValidationError {
  return { code, message, ...(hint ? { hint } : {}) };
}

export function hasNode(graph: ArchitectureGraph, matcher: ComponentMatcher): boolean {
  return graph.hasNodesMatching(matcher);
}

export function hasConnection(
  graph: ArchitectureGraph, 
  from: ComponentMatcher, 
  to: ComponentMatcher
): boolean {
  return graph.isConnected(from, to);
}

export function countNodes(graph: ArchitectureGraph, matcher: ComponentMatcher): number {
  return graph.countNodesMatching(matcher);
}

export function hasNodes(
  ...matchers: ComponentMatcher[]
): ValidationFn {
  return (graph: ArchitectureGraph): ValidationResult => {
    const missing = matchers.filter(m => !hasNode(graph, m));
    
    if (missing.length === 0) {
      return { isValid: true, errors: [] };
    }

    return {
      isValid: false,
      errors: missing.map(m => 
        error('MISSING_NODE', `Add a ${m.category || m.keywords?.[0] || 'component'}`, 
          'Use ⌘K to search and add this component')
      ),
    };
  };
}

export function hasConnections(
  ...connections: Array<{ from: ComponentMatcher; to: ComponentMatcher }>
): ValidationFn {
  return (graph: ArchitectureGraph): ValidationResult => {
    const missing = connections.filter(c => !hasConnection(graph, c.from, c.to));
    
    if (missing.length === 0) {
      return { isValid: true, errors: [] };
    }

    return {
      isValid: false,
      errors: missing.map(c => 
        error('MISSING_CONNECTION', `Connect the components as shown`, 
          'Click and drag from one node to another to create a connection')
      ),
    };
  };
}

export function addNodeValidation(
  matcher: ComponentMatcher
): ValidationFn {
  return (graph: ArchitectureGraph): ValidationResult => {
    if (hasNode(graph, matcher)) {
      return { isValid: true, errors: [] };
    }

    const label = matcher.labelContains?.[0] || matcher.category || 'component';
    return {
      isValid: false,
      errors: [
        error('NODE_NOT_ADDED', `Add a ${label} to the canvas`,
          `Press ⌘K and search for "${label}"`)
      ],
    };
  };
}

export function connectValidation(
  from: ComponentMatcher,
  to: ComponentMatcher
): ValidationFn {
  return (graph: ArchitectureGraph): ValidationResult => {
    if (!hasNode(graph, from)) {
      return {
        isValid: false,
        errors: [error('SOURCE_NOT_FOUND', 'Add the source component first')],
      };
    }

    if (!hasNode(graph, to)) {
      return {
        isValid: false,
        errors: [error('TARGET_NOT_FOUND', 'Add the target component first')],
      };
    }

    if (hasConnection(graph, from, to)) {
      return { isValid: true, errors: [] };
    }

    return {
      isValid: false,
      errors: [
        error('NOT_CONNECTED', `Connect the components`,
          'Click and drag from the source to the target to create an edge')
      ],
    };
  };
}

export function nodeAndConnectionValidation(
  nodeMatcher: ComponentMatcher,
  fromMatcher?: ComponentMatcher,
  toMatcher?: ComponentMatcher
): ValidationFn {
  return (graph: ArchitectureGraph): ValidationResult => {
    if (!hasNode(graph, nodeMatcher)) {
      const label = nodeMatcher.labelContains?.[0] || nodeMatcher.category || 'component';
      return {
        isValid: false,
        errors: [
          error('NODE_NOT_ADDED', `Add a ${label}`,
            `Press ⌘K and search for "${label}"`)
        ],
      };
    }

    const requiredConnections: Array<{ from: ComponentMatcher; to: ComponentMatcher }> = [];
    
    if (fromMatcher && toMatcher) {
      requiredConnections.push({ from: fromMatcher, to: nodeMatcher });
    }
    if (toMatcher && fromMatcher) {
      requiredConnections.push({ from: nodeMatcher, to: toMatcher });
    }

    if (requiredConnections.length === 0) {
      return { isValid: true, errors: [] };
    }

    const missing = requiredConnections.filter(c => !hasConnection(graph, c.from, c.to));
    
    if (missing.length === 0) {
      return { isValid: true, errors: [] };
    }

    return {
      isValid: false,
      errors: missing.map(() => 
        error('NOT_CONNECTED', 'Connect all required components',
          'Make sure every connection arrow is created')
      ),
    };
  };
}

export function multiStepValidation(
  validations: ValidationFn[]
): ValidationFn {
  return (graph: ArchitectureGraph): ValidationResult => {
    const allErrors: ValidationError[] = [];

    for (const validate of validations) {
      const result = validate(graph);
      if (!result.isValid) {
        allErrors.push(...result.errors);
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  };
}

export function alwaysValid(): ValidationFn {
  return () => ({ isValid: true, errors: [] });
}

export function alwaysInvalid(message: string): ValidationFn {
  return () => ({
    isValid: false,
    errors: [error('ALWAYS_INVALID', message)],
  });
}
