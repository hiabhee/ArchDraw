export interface Checkpoint {
  name: string;
  description?: string;
  savedAt: string;
  state: {
    nodes: unknown[];
    edges: unknown[];
  };
}

const checkpointsBySession = new Map<string, Map<string, Checkpoint>>();

function checkpointsFor(workingSession: string): Map<string, Checkpoint> {
  let checkpoints = checkpointsBySession.get(workingSession);
  if (!checkpoints) {
    checkpoints = new Map();
    checkpointsBySession.set(workingSession, checkpoints);
  }
  return checkpoints;
}

export function saveCheckpoint(
  name: string,
  description: string | undefined,
  state: { nodes: unknown[]; edges: unknown[] },
  workingSession = 'default'
): { success: boolean; name: string; savedAt: string; nodeCount: number; edgeCount: number; overwritten?: boolean } {
  const savedAt = new Date().toISOString();
  const checkpoints = checkpointsFor(workingSession);
  const overwritten = checkpoints.has(name);
  
  checkpoints.set(name, {
    name,
    description,
    savedAt,
    state: {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
    },
  });

  return {
    success: true,
    name,
    savedAt,
    nodeCount: state.nodes.length,
    edgeCount: state.edges.length,
    overwritten,
  };
}

export function loadCheckpoint(name: string, workingSession = 'default'): {
  success: boolean;
  name?: string;
  restoredAt?: string;
  nodeCount?: number;
  edgeCount?: number;
  message?: string;
  availableCheckpoints?: Array<{ name: string; description?: string; savedAt: string; nodeCount: number; edgeCount: number }>;
  error?: string;
} {
  const checkpoint = checkpointsFor(workingSession).get(name);
  
  if (!checkpoint) {
    return {
      success: false,
      error: `Checkpoint '${name}' not found`,
      availableCheckpoints: listCheckpoints(),
    };
  }

  const restoredAt = new Date().toISOString();
  return {
    success: true,
    name: checkpoint.name,
    restoredAt,
    nodeCount: checkpoint.state.nodes.length,
    edgeCount: checkpoint.state.edges.length,
    message: 'Diagram restored. Call get_diagram_state to view it.',
  };
}

export function getCheckpointState(name: string, workingSession = 'default'): { nodes: unknown[]; edges: unknown[] } | null {
  const checkpoint = checkpointsFor(workingSession).get(name);
  return checkpoint ? {
    nodes: JSON.parse(JSON.stringify(checkpoint.state.nodes)),
    edges: JSON.parse(JSON.stringify(checkpoint.state.edges)),
  } : null;
}

export function listCheckpoints(workingSession = 'default'): Array<{ name: string; description?: string; savedAt: string; nodeCount: number; edgeCount: number }> {
  return Array.from(checkpointsFor(workingSession).values()).map(cp => ({
    name: cp.name,
    description: cp.description,
    savedAt: cp.savedAt,
    nodeCount: cp.state.nodes.length,
    edgeCount: cp.state.edges.length,
  }));
}
