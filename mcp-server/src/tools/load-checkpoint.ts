import type { LoadCheckpointInput } from '../lib/schema.js';
import { loadCheckpoint as loadCheckpointFromStore, getCheckpointState, listCheckpoints } from '../lib/checkpoints.js';
import { setDiagramState } from '../lib/diagram-state.js';

export async function loadCheckpoint(input: LoadCheckpointInput, workingSession?: string): Promise<{
  success: boolean;
  name?: string;
  restoredAt?: string;
  nodeCount?: number;
  edgeCount?: number;
  message?: string;
  availableCheckpoints?: Array<{ name: string; description?: string; savedAt: string; nodeCount: number; edgeCount: number }>;
  error?: string;
}> {
  if (input.listAvailable) {
    const checkpoints = listCheckpoints(workingSession);
    return {
      success: true,
      availableCheckpoints: checkpoints,
      message: checkpoints.length === 0 
        ? 'No checkpoints saved yet.' 
        : `Found ${checkpoints.length} checkpoint(s).`,
    };
  }

  const result = loadCheckpointFromStore(input.name, workingSession);
  
  if (!result.success) {
    return result;
  }

  const state = getCheckpointState(input.name, workingSession);
  if (state) {
    setDiagramState(state as any, workingSession);
  }

  return result;
}
