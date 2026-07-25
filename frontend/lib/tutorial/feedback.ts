/** @deprecated All 22 tutorials use schema.ts + builder.ts. Do not use. */
import type { 
  FeedbackFn, 
  ArchitectureGraph,
  ComponentMatcher,
  ValidationResult,
} from './types';

function getLabel(matcher: ComponentMatcher): string {
  return matcher.labelContains?.[0] || matcher.category || matcher.keywords?.[0] || 'component';
}

export function nodeNotAddedFeedback(matcher: ComponentMatcher): FeedbackFn {
  const label = getLabel(matcher);
  return (graph: ArchitectureGraph): string[] => {
    if (graph.hasNodesMatching(matcher)) {
      return [];
    }
    return [
      `You haven't added a ${label} yet.`,
      `Press ⌘K and search for "${label}" to add it.`,
    ];
  };
}

export function notConnectedFeedback(
  from: ComponentMatcher,
  to: ComponentMatcher
): FeedbackFn {
  const fromLabel = getLabel(from);
  const toLabel = getLabel(to);
  
  return (graph: ArchitectureGraph): string[] => {
    if (!graph.hasNodesMatching(from)) {
      return [`Add a ${fromLabel} first.`];
    }
    if (!graph.hasNodesMatching(to)) {
      return [`Add a ${toLabel} first.`];
    }
    if (graph.isConnected(from, to)) {
      return [];
    }
    return [
      `Connect ${fromLabel} → ${toLabel}.`,
      `Click on ${fromLabel} and drag to ${toLabel}.`,
    ];
  };
}

export function nodeAddedFeedback(
  nodeMatcher: ComponentMatcher,
  connections?: Array<{ from: ComponentMatcher; to: ComponentMatcher }>
): FeedbackFn {
  const nodeLabel = getLabel(nodeMatcher);
  
  return (graph: ArchitectureGraph): string[] => {
    const messages: string[] = [];

    if (!graph.hasNodesMatching(nodeMatcher)) {
      messages.push(`Add a ${nodeLabel} to the canvas.`);
      return messages;
    }

    if (connections) {
      const missing = connections.filter(c => !graph.isConnected(c.from, c.to));
      
      for (const conn of missing) {
        const fromLabel = getLabel(conn.from);
        const toLabel = getLabel(conn.to);
        messages.push(`Connect ${fromLabel} → ${toLabel}.`);
      }
    }

    if (messages.length === 0) {
      messages.push(`${nodeLabel} added correctly!`);
    }

    return messages;
  };
}

export function progressiveFeedback(
  steps: Array<{ matcher: ComponentMatcher; connections?: Array<{ from: ComponentMatcher; to: ComponentMatcher }> }>
): FeedbackFn {
  return (graph: ArchitectureGraph): string[] => {
    for (const step of steps) {
      const nodeLabel = getLabel(step.matcher);
      
      if (!graph.hasNodesMatching(step.matcher)) {
        return [
          `Add a ${nodeLabel}.`,
          `Press ⌘K and search for "${nodeLabel}".`,
        ];
      }

      if (step.connections) {
        for (const conn of step.connections) {
          if (!graph.isConnected(conn.from, conn.to)) {
            const fromLabel = getLabel(conn.from);
            const toLabel = getLabel(conn.to);
            return [
              `Connect ${fromLabel} → ${toLabel}.`,
              `Click on ${fromLabel} and drag to ${toLabel}.`,
            ];
          }
        }
      }
    }

    return ['Step complete!'];
  };
}

export function genericFeedback(message: string): FeedbackFn {
  return () => [message];
}

